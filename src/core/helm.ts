import {helm} from './kubectl.js';
import {dump} from 'js-yaml';
import {mkdtemp, rm, writeFile} from 'fs/promises';
import {join} from 'path';
import {tmpdir} from 'os';
import type {AppEntry} from '../types/index.js';

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
 * Image currently injected into a helm release, as `<repository>:<tag>`, read
 * from the release's computed values through the app's imageValues paths.
 * Returns null when the release doesn't exist or the paths don't resolve.
 * Used to skip rebuild+reinstall when nothing changed (deterministic env up).
 * @deprecated Kustron no longer auto-injects images. Kept for backward compat.
 */
export async function helmReleaseImage(
  app: AppEntry,
  namespace: string,
  clusterName: string,
  releaseName?: string,
): Promise<string | null> {
  const imageRef = app.helm?.imageValues;
  if (!imageRef?.repository && !imageRef?.tag) return null;
  try {
    const {stdout} = await helm(
      clusterName,
      [
        'get',
        'values',
        releaseName ?? app.name,
        '-n',
        namespace,
        '--all',
        '-o',
        'json',
      ],
      {silent: true, reject: false},
    );
    if (!stdout.trim()) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values = JSON.parse(stdout) as any;
    // Simple path traversal for backward compat
    const get = (obj: unknown, path: string): unknown => {
      return path
        .split('.')
        .reduce(
          (o, k) =>
            o && typeof o === 'object'
              ? (o as Record<string, unknown>)[k]
              : undefined,
          obj,
        );
    };
    const repo = imageRef.repository ? get(values, imageRef.repository) : null;
    const tag = imageRef.tag ? get(values, imageRef.tag) : null;
    if (typeof repo === 'string' && typeof tag === 'string')
      return `${repo}:${tag}`;
    return null;
  } catch {
    return null;
  }
}

/**
 * Inject a built/deployed image into the chart's values map via the
 * `helm.imageValues` dotted paths (e.g. {repository: 'image.repository'}).
 * The image ref (host:port/name:tag) is split into repository + tag.
 */
export function applyImageValues(
  valuesMap: Record<string, unknown>,
  imageRef: string,
  imageValues: {repository?: string; tag?: string} | undefined,
): Record<string, unknown> {
  if (!imageValues) return valuesMap;
  // Deep-copy so injecting image paths never mutates the caller's values map
  // (app.helm.values) or any nested objects it shares with the clone.
  const merged = structuredClone(valuesMap);
  const setPath = (path: string, value: string) => {
    const keys = path.split('.');
    let obj = merged;
    for (const [i, key] of keys.entries()) {
      if (i === keys.length - 1) {
        obj[key] = value;
      } else if (
        typeof obj[key] === 'object' &&
        obj[key] !== null &&
        !Array.isArray(obj[key])
      ) {
        obj = obj[key] as Record<string, unknown>;
      } else {
        obj[key] = {};
        obj = obj[key] as Record<string, unknown>;
      }
    }
  };
  // host:port/name:tag → repository = host:port/name, tag = last segment
  const lastColon = imageRef.lastIndexOf(':');
  const tag =
    lastColon > imageRef.lastIndexOf('/') ? imageRef.slice(lastColon + 1) : '';
  const repository = tag ? imageRef.slice(0, lastColon) : imageRef;
  if (imageValues.repository && tag)
    setPath(imageValues.repository, repository);
  if (imageValues.tag && tag) setPath(imageValues.tag, tag);
  return merged;
}

export async function helmInstall(
  app: AppEntry,
  namespace: string,
  clusterName: string,
  releaseName?: string,
  builtImageRef?: string,
): Promise<void> {
  if (!app.helm) throw new Error('App has no helm configuration');

  const args = [
    'upgrade',
    '--install',
    releaseName ?? app.name,
    '--namespace',
    namespace,
    '--create-namespace',
    '--wait',
  ];

  let chartRef = app.helm.chart;
  const needsRepo = !!app.helm.repo && !isLocalOrOciChart(app.helm.chart);
  if (needsRepo) {
    const repoName = `kustron-${releaseName ?? app.name}`;
    await helm(clusterName, ['repo', 'add', repoName, app.helm.repo!]);
    await helm(clusterName, ['repo', 'update']);
    // Reference chart as repo_name/chart_name, not just chart name
    chartRef = `${repoName}/${app.helm.chart}`;
  } else if (app.helm.repo) {
    // repo given but chart is local/OCI: nothing to add
  }

  args.push(chartRef);

  if (app.helm.version) {
    args.push('--version', app.helm.version);
  }

  // helm.values is passed directly as a --values file. No merging, no magic.
  let valuesMap: Record<string, unknown> = app.helm.values ?? {};
  // Inject the built (or referenced) image through helm.imageValues paths so
  // `source + helm` / `image + helm` deploys the kustron-built image.
  const injectableRef = builtImageRef ?? app.image;
  if (injectableRef && app.helm.imageValues) {
    valuesMap = applyImageValues(
      valuesMap,
      injectableRef,
      app.helm.imageValues,
    );
  }

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

    await helm(clusterName, args);
  } finally {
    if (tempDir) {
      await rm(tempDir, {recursive: true, force: true}).catch(() => {});
    }
  }
}

export async function helmUninstall(
  appName: string,
  namespace: string,
  clusterName: string,
): Promise<void> {
  try {
    await helm(clusterName, ['uninstall', appName, '--namespace', namespace]);
  } catch {
    // ignore if not installed
  }
}

export async function isHelmRelease(
  appName: string,
  namespace: string,
  clusterName: string,
): Promise<boolean> {
  try {
    const {stdout} = await helm(clusterName, [
      'list',
      '-n',
      namespace,
      '-o',
      'json',
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const releases = JSON.parse(stdout) as any[];
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
  nodePort?: number,
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
          ...(nodePort ? {nodePort} : {}),
        },
      ],
    },
  });
}
