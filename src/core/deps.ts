import type {AppEntry} from '../types/index.js';

/**
 * Effective namespace for an app: its own `namespace` override (idea 7),
 * otherwise the env default.
 */
export function appNamespace(app: AppEntry, defaultNamespace: string): string {
  return app.namespace ?? defaultNamespace;
}

/**
 * Effective deployment name, honoring the `instance` suffix (idea 7):
 * `kafka-primary` / `kafka-secondary` stay separate deployments.
 */
export function appDeploymentName(app: AppEntry): string {
  return app.instance ? `${app.name}-${app.instance}` : app.name;
}

/**
 * Topological sort of apps by `dependsOn` (idea 3), with cycle detection.
 * Stable: apps without dependencies keep file order.
 */
export function topoSortApps(apps: AppEntry[]): AppEntry[] {
  const byName = new Map(apps.map((a) => [a.name, a]));
  const state = new Map<string, 'visiting' | 'done'>();
  const order: AppEntry[] = [];

  const visit = (app: AppEntry, chain: string[]) => {
    const s = state.get(app.name);
    if (s === 'done') return;
    if (s === 'visiting') {
      const cycle = [...chain, app.name].join(' -> ');
      throw new Error(`Circular dependsOn detected: ${cycle}`);
    }
    state.set(app.name, 'visiting');
    for (const dep of app.dependsOn ?? []) {
      const depApp = byName.get(dep);
      if (!depApp) {
        throw new Error(`App '${app.name}' dependsOn '${dep}' which is not defined`);
      }
      visit(depApp, [...chain, app.name]);
    }
    state.set(app.name, 'done');
    order.push(app);
  };

  for (const app of apps) visit(app, []);
  return order;
}

/**
 * Interpolate ${VAR} (and ${app.field} for cross-app references) inside a
 * string. Unknown references are left as-is.
 */
export function interpolate(
  value: string,
  vars: Record<string, string>,
): string {
  return value.replace(/\$\{([a-zA-Z0-9_.-]+)\}/g, (match, key: string) => {
    return vars[key] ?? match;
  });
}

/** Build the environment-var context from the app map + external env. */
export function buildVars(
  apps: AppEntry[],
  defaultNamespace: string,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) vars[k] = v;
  }
  for (const app of apps) {
    vars[app.name] = app.name; // plain name
    // common service reference: kafka.bootstrap -> kafka:9092 style DNS niceties
    vars[`${app.name}.name`] = appDeploymentName(app);
    vars[`${app.name}.namespace`] = appNamespace(app, defaultNamespace);
    if (typeof app.port === 'number') {
      vars[`${app.name}.port`] = String(app.port);
      vars[`${app.name}.endpoint`] = `${appDeploymentName(app)}:${app.port}`;
    }
  }
  return vars;
}