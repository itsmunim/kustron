import { exec } from '../utils/exec.js'
import type { ClusterInfo } from '../types/index.js'

const DEFAULT_CLUSTER_NAME = 'kustron'
const DEFAULT_AGENTS = 2
const REGISTRY_NAME = 'kustron-registry'
const REGISTRY_PORT = 5000

export interface CreateClusterOptions {
  name?: string
  agents?: number
  registryPort?: number
}

export async function createCluster(opts?: CreateClusterOptions): Promise<void> {
  const name = opts?.name ?? DEFAULT_CLUSTER_NAME
  const agents = opts?.agents ?? DEFAULT_AGENTS
  const registryPort = opts?.registryPort ?? REGISTRY_PORT

  const args = [
    'cluster',
    'create',
    name,
    '--agents',
    String(agents),
    '--registry-create',
    `${REGISTRY_NAME}:0.0.0.0:${registryPort}`,
    '--port',
    '9080:80@loadbalancer',
    '--port',
    '9443:443@loadbalancer',
    '--wait',
  ]

  await exec('k3d', args)
}

export async function installMetricsServer(): Promise<void> {
  await exec('kubectl', [
    'apply',
    '-f',
    'https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml',
  ])

  await exec('kubectl', [
    'patch',
    'deployment',
    'metrics-server',
    '-n',
    'kube-system',
    '--type',
    'json',
    '-p',
    '[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]',
  ])
}

export async function deleteCluster(name?: string): Promise<void> {
  const clusterName = name ?? DEFAULT_CLUSTER_NAME
  await exec('k3d', ['cluster', 'delete', clusterName])
}

export async function getClusterInfo(name?: string): Promise<ClusterInfo | null> {
  const clusterName = name ?? DEFAULT_CLUSTER_NAME

  try {
    const { stdout } = await exec('k3d', ['cluster', 'list', '-o', 'json'])
    const clusters = JSON.parse(stdout) as Array<{
      name: string
      serversRunning: number
      serversCount: number
      agentsRunning: number
      agentsCount: number
      hasLoadBalancer: boolean
    }>

    const cluster = clusters.find((c) => c.name === clusterName)
    if (!cluster) return null

    return {
      name: cluster.name,
      serversRunning: cluster.serversRunning,
      serversCount: cluster.serversCount,
      agentsRunning: cluster.agentsRunning,
      agentsCount: cluster.agentsCount,
      hasLoadBalancer: cluster.hasLoadBalancer,
    }
  } catch {
    return null
  }
}
