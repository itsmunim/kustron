import {readFile, access, mkdir} from 'fs/promises';
import {join} from 'path';
import {homedir} from 'os';
import {createHash} from 'crypto';
import {load} from 'js-yaml';
import {appEntrySchema} from './env-file.js';
import {exec} from '../utils/exec.js';
import type {AppEntry, ComponentSpec, EnvFile} from '../types/index.js';

const COMPONENT_CACHE_DIR = join(homedir(), '.kustron', 'component-cache');

export interface Kustronfile {
  name: string;
  inputs?: Record<string, {default?: string | number | boolean}>;
  outputs?: Record<string, string>;
  apps: AppEntry[];
}

export interface ResolvedComponent {
  spec: ComponentSpec;
  kustronfile: Kustronfile;
  /** Component-scoped app entries (name prefixed to avoid collisions). */
  apps: AppEntry[];
  /** Output vars exposed as ${<component>.<key>}. */
  outputs: Record<string, string>;
}

function isGitUrl(source: string): boolean {
  return (
    /^(git@|https?:\/\/.*\.git$)/.test(source) || source.startsWith('git@')
  );
}

async function resolveComponentSource(spec: ComponentSpec): Promise<string> {
  if (isGitUrl(spec.source)) {
    const hash = createHash('sha256')
      .update(spec.source)
      .digest('hex')
      .slice(0, 16);
    const dir = join(COMPONENT_CACHE_DIR, hash);
    await mkdir(COMPONENT_CACHE_DIR, {recursive: true});

    try {
      await access(join(dir, 'Kustronfile'));
      // Already cached — pull latest
      await exec('git', ['-C', dir, 'fetch', 'origin'], {silent: true});
      await exec('git', ['-C', dir, 'reset', '--hard', 'origin/HEAD'], {
        silent: true,
      });
    } catch {
      // Not cached — clone
      await exec('git', ['clone', '--depth', '1', spec.source, dir], {
        silent: true,
      });
    }
    return dir;
  }

  // Local path
  try {
    await access(spec.source);
    return spec.source;
  } catch {
    throw new Error(
      `Component '${spec.name}' source '${spec.source}' not found locally and is not a git URL.`,
    );
  }
}

async function loadKustronfile(dir: string): Promise<Kustronfile> {
  const path = join(dir, 'Kustronfile');
  try {
    await access(path);
  } catch {
    throw new Error(
      `Kustronfile not found at '${path}'. Components must define one.`,
    );
  }
  const raw = await readFile(path, 'utf-8');
  const parsed = load(raw) as Kustronfile;
  if (!parsed || !Array.isArray(parsed.apps)) {
    throw new Error(`Kustronfile at '${path}' must define an 'apps' list.`);
  }
  return parsed;
}

/**
 * Resolve a component (clone or local dir), read its Kustronfile, apply the
 * component's inputs as ${inputs.x} interpolation, and prefix app names with
 * the component name so multiple components (or two instances of one) don't
 * collide.
 */
export async function resolveComponent(
  spec: ComponentSpec,
): Promise<ResolvedComponent> {
  const dir = await resolveComponentSource(spec);
  const kustronfile = await loadKustronfile(dir);

  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(spec.inputs ?? {})) {
    vars[`inputs.${key}`] = String(value);
  }

  const apps: AppEntry[] = kustronfile.apps.map((app) => ({
    ...app,
    name: `${spec.name}-${app.name}`,
    // Component-internal dependsOn references must use prefixed names.
    dependsOn: app.dependsOn?.map((dep) =>
      kustronfile.apps.some((a) => a.name === dep)
        ? `${spec.name}-${dep}`
        : dep,
    ),
    // resolve ${inputs.x} in env values and other strings
    env:
      app.env && Object.keys(app.env).length > 0
        ? Object.fromEntries(
            Object.entries(app.env).map(([k, v]) => [k, replaceVars(v, vars)]),
          )
        : app.env,
    secret:
      app.secret && Object.keys(app.secret).length > 0
        ? Object.fromEntries(
            Object.entries(app.secret).map(([k, v]) => [
              k,
              replaceVars(v, vars),
            ]),
          )
        : app.secret,
    image: app.image ? replaceVars(app.image, vars) : app.image,
    source: app.source ? replaceVars(app.source, vars) : app.source,
    // replicas/port may be ${inputs.x} strings; coerce to their numeric form.
    replicas:
      typeof app.replicas === 'string'
        ? Number(replaceVars(app.replicas, vars)) || undefined
        : app.replicas,
    port:
      typeof app.port === 'string'
        ? Number(replaceVars(app.port, vars)) || app.port
        : app.port,
  }));

  // Component outputs: expose as ${<component>.<key>} vars.
  const outputs = Object.fromEntries(
    Object.entries(kustronfile.outputs ?? {}).map(([k, v]) => [
      `${spec.name}.${k}`,
      replaceVars(v, vars),
    ]),
  );

  return {spec, kustronfile, apps, outputs};
}

function replaceVars(value: string, vars: Record<string, string>): string {
  return value.replace(
    /\$\{([a-zA-Z0-9_.-]+)\}/g,
    (match, key: string) => vars[key] ?? match,
  );
}

export interface ExpandedEnv {
  apps: AppEntry[];
  /** Component output vars (e.g. {hub-kafka.bootstrap: 'kafka:9092'}). */
  outputs: Record<string, string>;
}

/** Expand components into concrete app entries + output vars. */
export async function expandComponents(envFile: EnvFile): Promise<ExpandedEnv> {
  const specs = envFile.components ?? [];
  if (specs.length === 0) {
    return {apps: envFile.apps, outputs: {}};
  }

  let apps: AppEntry[] = [];
  const outputs: Record<string, string> = {};

  for (const spec of specs) {
    const resolved = await resolveComponent(spec);
    apps = apps.concat(resolved.apps);
    Object.assign(outputs, resolved.outputs);
  }

  // Validate expanded component apps against the schema.
  for (const app of apps) {
    const result = appEntrySchema.safeParse(app);
    if (!result.success) {
      throw new Error(
        `Component app '${app.name}' is invalid: ${result.error.issues.map((e) => e.message).join(', ')}`,
      );
    }
  }

  // Prevent name collisions between expanded and declared apps.
  const declared = new Set(envFile.apps.map((a) => a.name));
  for (const app of apps) {
    if (declared.has(app.name)) {
      throw new Error(
        `App '${app.name}' is declared both in kustron-env.yaml and expanded from a component.`,
      );
    }
  }

  return {apps: [...apps, ...envFile.apps], outputs};
}
