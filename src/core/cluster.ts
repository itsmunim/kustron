import {exec} from '../utils/exec.js';
import {
  getDockerHostEnv,
  getRuntimeCommand,
  detectContainerRuntime,
} from '../utils/container-runtime.js';
import type {ClusterConfig} from '../types/index.js';

const DEFAULT_CLUSTER_NAME = 'kustron';
const DEFAULT_AGENTS = 2;
const REGISTRY_NAME = 'kustron-registry';
const REGISTRY_PORT = 5000;

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
  const registryPort = REGISTRY_PORT;

  const args = [
    'cluster',
    'create',
    name,
    '--agents',
    String(agents),
    '--registry-create',
    `${REGISTRY_NAME}:0.0.0.0:${registryPort}`,
    '--wait',
  ];

  const env = await getK3dEnv();

  // k3d attaches nodes and the registry to a network named `bridge`.
  // Rootless podman does not ship one (its default network is `podman`), so
  // create it up front to keep cluster creation deterministic on podman hosts.
  if ((await detectContainerRuntime()) === 'podman') {
    const existsResult = await exec(
      'podman',
      ['network', 'exists', 'bridge'],
      {silent: true, reject: false, env},
    );
    if (existsResult.exitCode !== 0) {
      await exec('podman', ['network', 'create', 'bridge'], {silent: true, env});
    }
  }

  await exec('k3d', args, {env});
}

export async function installMetricsServer(): Promise<void> {
  try {
    await exec('kubectl', [
      'get',
      'deployment',
      'metrics-server',
      '-n',
      'kube-system',
    ], {silent: true});
    return;
  } catch {
    // not installed, proceed
  }

  await exec('kubectl', [
    'apply',
    '-f',
    'https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml',
  ]);

  await exec('kubectl', [
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
  const {stdout} = await exec('k3d', ['cluster', 'list', '-o', 'json'], {silent: true, env});
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
export async function ensureRegistry(clusterName?: string): Promise<void> {
  const name = clusterName ?? DEFAULT_CLUSTER_NAME;
  const env = await getK3dEnv();

  let exists = false;
  try {
    const {stdout} = await exec('k3d', ['registry', 'list', '-o', 'json'], {silent: true, env});
    const registries = JSON.parse(stdout) as Array<{name: string}>;
    exists = registries.some((r) => r.name === REGISTRY_NAME);
  } catch {
    // registry list unavailable — attempt creation below; real failures will
    // surface during image push.
  }
  if (exists) return;

  await exec(
    'k3d',
    ['registry', 'create', REGISTRY_NAME, '-p', `127.0.0.1:${REGISTRY_PORT}:${REGISTRY_PORT}`],
    {env},
  );
  await exec('k3d', ['registry', 'connect', REGISTRY_NAME, name], {env});
}

export async function getK3dNodeIp(clusterName: string): Promise<string | null> {
  try {
    const runtime = await getRuntimeCommand();
    const {stdout} = await exec(runtime, [
      'inspect',
      `k3d-${clusterName}-server-0`,
      '-f',
      '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}',
    ]);
    const ip = stdout.trim();
    return ip || null;
  } catch {
    return null;
  }
}
