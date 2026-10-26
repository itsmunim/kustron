import {exec} from '../utils/exec.js';
import {kubectl} from './kubectl.js';
import {
  getDockerHostEnv,
  getRuntimeCommand,
} from '../utils/container-runtime.js';
import type {ClusterConfig} from '../types/index.js';

const DEFAULT_CLUSTER_NAME = 'kustron';
const DEFAULT_AGENTS = 2;
const DEFAULT_REGISTRY_PORT = 5000;

/**
 * Registry node name is cluster-scoped: k3d registry node names are global,
 * so two clusters (e.g. 'kustron' and 'ktverify') cannot share one registry
 * name. The default cluster keeps the original 'kustron-registry' name so
 * existing setups keep working; other clusters get '<clusterName>-registry'.
 */
export function registryName(clusterName?: string): string {
  const name = clusterName ?? DEFAULT_CLUSTER_NAME;
  return name === DEFAULT_CLUSTER_NAME
    ? 'kustron-registry'
    : `${name}-registry`;
}

interface ClusterInfo {
  name: string;
  serversRunning: number;
  serversCount: number;
}

async function getK3dEnv(): Promise<Record<string, string>> {
  return getDockerHostEnv();
}

export async function createCluster(config: ClusterConfig): Promise<void> {
  const name = config.name;
  const agents = DEFAULT_AGENTS;
  const registryPort = config.registryPort ?? DEFAULT_REGISTRY_PORT;

  const args = [
    'cluster',
    'create',
    name,
    '--agents',
    String(agents),
    '--registry-create',
    `${registryName(name)}:127.0.0.1:${registryPort}`,
    '--wait',
  ];

  // Map the Kubernetes NodePort range to the host so exposed services are
  // reachable via localhost:<nodePort>. Other k3d clusters on this machine may
  // already hold some of these ports (Kubernetes assigns NodePorts from the
  // same range), so map every port in the range but the already-allocated
  // ones. k3d only supports port additions at create time.
  if (config.mapNodePorts !== false) {
    for (const port of await freeNodePortCandidatesForMapping()) {
      args.push('-p', `${port}:${port}@loadbalancer`);
    }
  }

  const env = await getK3dEnv();

  // NOTE: do NOT pre-create a docker network named `bridge` here. k3d already
  // handles this: it uses Docker's default `bridge` network when one exists,
  // and on rootless podman (where `bridge` doesn't exist) it auto-creates a
  // `k3d-<cluster>` network. Explicitly creating a network named `bridge`
  // fails on podman with "cannot create network with name 'bridge' because it
  // conflicts with a valid network mode" — podman reserves `bridge` as a
  // network mode keyword.

  await exec('k3d', args, {env});
}

export const NODEPORT_RANGE_START = 30000;
export const NODEPORT_RANGE_END = 30100;

/**
 * Ports from the kustron NodePort window (30000..30100) that no other local
 * container is currently publishing. Used when creating the loadbalancer port
 * mappings so that several kustron clusters can coexist on one machine.
 */
export async function freeNodePortCandidatesForMapping(): Promise<number[]> {
  const env = await getK3dEnv();
  const allocated = new Set<number>();

  // Determine host ports held by other serverlb containers via `container ps`
  // including their port publications.
  try {
    const {stdout} = await exec(
      await getRuntimeCommand(),
      ['ps', '--format', '{{json .Ports}}', '--filter', 'name=serverlb'],
      {silent: true, env},
    );
    for (const line of stdout.split('\n').map((s) => s.trim())) {
      if (!line) continue;
      // docker's {{json .Ports}} is either a JSON array of port objects
      // (older clients) or a JSON-quoted string like
      // "0.0.0.0:30080->30080/tcp, [::]:30080->30080/tcp" (newer clients,
      // OrbStack included). Handle both.
      let text = line;
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          for (const p of parsed as Array<{PublicPort?: number | null}>) {
            if (p.PublicPort) allocated.add(p.PublicPort);
          }
          continue;
        }
        if (typeof parsed === 'string') text = parsed;
      } catch {
        // not JSON at all — treat as raw text below
      }
      for (const chunk of text.split(',')) {
        if (!chunk.includes('->')) continue;
        const left = chunk.split('->')[0].trim();
        const hostPort = parseInt(left.split(':').pop() ?? '', 10);
        if (Number.isFinite(hostPort)) allocated.add(hostPort);
      }
    }
  } catch {
    // Best-effort allocation only; if this fails we map everything — k3d will
    // surface its own conflict error, which is better than nothing.
  }

  const candidates: number[] = [];
  for (let port = NODEPORT_RANGE_START; port <= NODEPORT_RANGE_END; port++) {
    if (!allocated.has(port)) candidates.push(port);
  }
  return candidates;
}

export async function installMetricsServer(clusterName: string): Promise<void> {
  try {
    await kubectl(
      clusterName,
      ['get', 'deployment', 'metrics-server', '-n', 'kube-system'],
      {silent: true},
    );
    return;
  } catch {
    // not installed, proceed
  }

  await kubectl(clusterName, [
    'apply',
    '-f',
    'https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml',
  ]);

  await kubectl(clusterName, [
    'patch',
    'deployment',
    'metrics-server',
    '-n',
    'kube-system',
    '--type',
    'json',
    '-p',
    '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]',
  ]);
}

export async function deleteCluster(name?: string): Promise<void> {
  const clusterName = name ?? DEFAULT_CLUSTER_NAME;
  const env = await getK3dEnv();
  await exec('k3d', ['cluster', 'delete', clusterName], {env});
}

async function listClusters(): Promise<ClusterInfo[]> {
  const env = await getK3dEnv();
  const {stdout} = await exec('k3d', ['cluster', 'list', '-o', 'json'], {
    silent: true,
    env,
  });
  return JSON.parse(stdout) as ClusterInfo[];
}

export async function clusterExists(name?: string): Promise<boolean> {
  const clusterName = name ?? DEFAULT_CLUSTER_NAME;
  try {
    const clusters = await listClusters();
    return clusters.some((c) => c.name === clusterName);
  } catch {
    return false;
  }
}

export async function isClusterRunning(name?: string): Promise<boolean> {
  const clusterName = name ?? DEFAULT_CLUSTER_NAME;
  try {
    const clusters = await listClusters();
    const found = clusters.find((c) => c.name === clusterName);
    return found ? found.serversRunning > 0 : false;
  } catch {
    return false;
  }
}

export async function startCluster(name?: string): Promise<void> {
  const clusterName = name ?? DEFAULT_CLUSTER_NAME;
  const env = await getK3dEnv();
  await exec('k3d', ['cluster', 'start', clusterName], {env});
}

/**
 * Make sure the kustron registry exists and is wired into the cluster.
 * Idempotent: a registry created by `k3d cluster create --registry-create`
 * (or a previous run) is left untouched.
 */
export async function ensureRegistry(
  clusterName?: string,
  registryPort?: number,
): Promise<void> {
  const name = clusterName ?? DEFAULT_CLUSTER_NAME;
  const port = registryPort ?? DEFAULT_REGISTRY_PORT;
  const env = await getK3dEnv();
  const registry = registryName(clusterName);

  let exists = false;
  try {
    const {stdout} = await exec('k3d', ['registry', 'list', '-o', 'json'], {
      silent: true,
      env,
    });
    const registries = JSON.parse(stdout) as Array<{name: string}>;
    exists = registries.some((r) => r.name === registry);
  } catch {
    // registry list unavailable — attempt creation below; real failures will
    // surface during image push.
  }
  if (exists) return;

  await exec(
    'k3d',
    [
      'registry',
      'create',
      registry,
      '-p',
      `127.0.0.1:${port}:${DEFAULT_REGISTRY_PORT}`,
    ],
    {env},
  );
  await exec('k3d', ['registry', 'connect', registry, name], {env});
}

/**
 * Read back the host port the kustron registry container is published on
 * (plus its bind IP). Cloud drift guards: re-probing for a free port on every
 * run can disagree with the previously created registry, sending `docker push`
 * to the wrong port. Prefer discovery over probing.
 */
export async function discoverRegistryPort(
  clusterName?: string,
): Promise<number | undefined> {
  const registry = registryName(clusterName);
  try {
    const env = await getK3dEnv();
    const {exitCode, stdout} = await exec(
      await getRuntimeCommand(),
      ['inspect', '--format', '{{json .HostConfig.PortBindings}}', registry],
      {silent: true, env},
    );
    if (exitCode !== 0) return undefined;
    const bindings = JSON.parse(stdout) as Record<
      string,
      Array<{HostIp?: string; HostPort?: string}>
    >;
    for (const binds of Object.values(bindings)) {
      for (const b of binds ?? []) {
        const portNum = parseInt(b.HostPort ?? '', 10);
        if (Number.isFinite(portNum) && portNum > 0) return portNum;
      }
    }
  } catch {
    // fall through
  }
  return undefined;
}

/**
 * Return the node IP for direct container-network access.
 * When the cluster was created with loadbalancer port mapping, exposed
 * services are reachable via localhost:<nodePort> instead, so callers
 * should fall back to localhost URLs.
 */
export async function getK3dNodeIp(
  clusterName: string,
): Promise<string | null> {
  return null;
}
