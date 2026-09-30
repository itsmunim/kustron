import {exec} from '../utils/exec.js';
import {dump} from 'js-yaml';
import {mkdtemp, rm, writeFile} from 'fs/promises';
import {join} from 'path';
import {tmpdir} from 'os';
import type {AppEntry} from '../types/index.js';
import {REGISTRY_HOST} from './push.js';
import {getPath, setPath} from '../utils/merge.js';

/** Chart types helm handles natively without a repo add / helm repo update. */
function isLocalOrOciChart(chart: string): boolean {
  return (
    chart.startsWith('./') ||
    chart.startsWith('../') ||
    chart.startsWith('/') ||
    chart.startsWith('oci://') ||
    chart.endsWith('.tgz')
  );
}

/**
 * imageValues keys are dotted paths (e.g. 'image.repository'). Inject the
 * built image into a values map: repository -> <registry>/<app>, tag -> <ref>.
 */
export function injectImageValues(
  app: AppEntry,
  image: string,
): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  const imageRef = app.helm?.imageValues;
  if (!imageRef) return map;

  const tag = image.split(':').pop() ?? '';
  const repository = image.slice(0, image.length - tag.length - 1);

  if (imageRef.repository) {
    setPath(map, imageRef.repository, repository);
  }
  if (imageRef.tag) {
    setPath(map, imageRef.tag, tag);
  }
  return map;
}

/**
 * Image currently injected into a helm release, as `<repository>:<tag>`, read
 * from the release's computed values through the app's imageValues paths.
 * Returns null when the release doesn't exist or the paths don't resolve.
 * Used to skip rebuild+reinstall when nothing changed (deterministic env up).
 */
export async function helmReleaseImage(
  app: AppEntry,
  namespace: string,
): Promise<string | null> {
  const imageRef = app.helm?.imageValues;
  if (!imageRef?.repository && !imageRef?.tag) return null;
  try {
    const {stdout} = await exec(
      'helm',
      ['get', 'values', app.name, '-n', namespace, '--all', '-o', 'json'],
      {silent: true, reject: false} as Record<string, unknown>,
    );
    if (!stdout.trim()) return null;
    const values = JSON.parse(stdout) as Record<string, unknown>;

    const repo =
      imageRef.repository &&
      typeof getPath(values, imageRef.repository) === 'string'
        ? (getPath(values, imageRef.repository) as string)
        : null;
    const tag =
      imageRef.tag && typeof getPath(values, imageRef.tag) === 'string'
        ? (getPath(values, imageRef.tag) as string)
        : null;
    if (repo && tag) return `${repo}:${tag}`;
    return null;
  } catch {
    return null;
  }
}

export async function helmInstall(
  app: AppEntry,
  namespace: string,
  imageOverride?: string,
): Promise<void> {
  if (!app.helm) throw new Error('App has no helm configuration');

  const args = [
    'upgrade',
    '--install',
    app.name,
    app.helm.chart,
    '--namespace',
    namespace,
    '--create-namespace',
    '--wait',
  ];

  const needsRepo = !!app.helm.repo && !isLocalOrOciChart(app.helm.chart);
  if (needsRepo) {
    await exec('helm', ['repo', 'add', `kustron-${app.name}`, app.helm.repo!]);
    await exec('helm', ['repo', 'update']);
  } else if (app.helm.repo) {
    // repo given but chart is local/OCI: nothing to add
  }

  if (app.helm.version) {
    args.push('--version', app.helm.version);
  }

  // Merge imageValues (injected built image) into the values map, then pass
  // everything through a --values file so nested structures survive (the old
  // --set approach flattened them into strings).
  const valuesMap: Record<string, unknown> = {
    ...(app.helm.values ?? {}),
    ...injectImageValues(app, imageOverride ?? ''),
  };

  let tempDir: string | undefined;
  try {
    if (Object.keys(valuesMap).length > 0) {
      tempDir = await mkdtemp(join(tmpdir(), 'kustron-helm-'));
      const valuesFile = join(tempDir, 'values.yaml');
      await writeFile(valuesFile, dump(valuesMap), 'utf-8');
      args.push('--values', valuesFile);
    }

    for (const file of app.helm.valuesFiles ?? []) {
      args.push('--values', file);
    }

    await exec('helm', args);
  } finally {
    if (tempDir) {
      await rm(tempDir, {recursive: true, force: true}).catch(() => {});
    }
  }
}

export async function helmUninstall(
  appName: string,
  namespace: string,
): Promise<void> {
  try {
    await exec('helm', ['uninstall', appName, '--namespace', namespace]);
  } catch {
    // ignore if not installed
  }
}

export async function isHelmRelease(
  appName: string,
  namespace: string,
): Promise<boolean> {
  try {
    const {stdout} = await exec('helm', [
      'list',
      '-n',
      namespace,
      '-o',
      'json',
    ]);
    const releases = JSON.parse(stdout) as Array<{name: string}>;
    return releases.some((r) => r.name === appName);
  } catch {
    return false;
  }
}

export function createHelmExposureService(
  name: string,
  namespace: string,
  port: number,
  selector: Record<string, string>,
): string {
  return dump({
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name,
      namespace,
      labels: {
        'app.kubernetes.io/name': name,
        'app.kubernetes.io/managed-by': 'kustron',
      },
    },
    spec: {
      type: 'NodePort',
      selector,
      ports: [
        {
          port,
          targetPort: port,
          protocol: 'TCP',
        },
      ],
    },
  });
}
