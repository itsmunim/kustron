import {exec} from '../utils/exec.js';
import type {ClusterConfig} from '../types/index.js';

const DEFAULT_CLUSTER_NAME = 'kustron';
const DEFAULT_AGENTS = 2;
const REGISTRY_NAME = 'kustron-registry';
const REGISTRY_PORT = 5000;

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

  for (const port of config.exposedPorts) {
    args.push('--port', `${port}:${port}@loadbalancer`);
  }

  await exec('k3d', args);
}

export async function installMetricsServer(): Promise<void> {
  try {
    await exec('kubectl', [
      'get',
      'deployment',
      'metrics-server',
      '-n',
      'kube-system',
    ]);
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
  await exec('k3d', ['cluster', 'delete', clusterName]);
}

export async function clusterExists(name?: string): Promise<boolean> {
  const clusterName = name ?? DEFAULT_CLUSTER_NAME;
  try {
    const {stdout} = await exec('k3d', ['cluster', 'list', '-o', 'json']);
    const clusters = JSON.parse(stdout) as Array<{name: string}>;
    return clusters.some((c) => c.name === clusterName);
  } catch {
    return false;
  }
}
