import { exec } from '../utils/exec.js'

const DEFAULT_CLUSTER_NAME = 'kustron'

export async function mergeKubeconfig(clusterName?: string): Promise<void> {
  const name = clusterName ?? DEFAULT_CLUSTER_NAME
  await exec('k3d', ['kubeconfig', 'merge', name, '--kubeconfig-merge-default'])
}

export async function setContext(clusterName?: string): Promise<void> {
  const name = clusterName ?? DEFAULT_CLUSTER_NAME
  await exec('kubectl', ['config', 'use-context', `k3d-${name}`])
}

export async function deleteContext(clusterName?: string): Promise<void> {
  const name = clusterName ?? DEFAULT_CLUSTER_NAME
  try {
    await exec('kubectl', ['config', 'delete-context', `k3d-${name}`])
  } catch {
    // ignore missing context
  }
}

export async function getCurrentContext(): Promise<string | null> {
  try {
    const { stdout } = await exec('kubectl', ['config', 'current-context'])
    return stdout.trim() || null
  } catch {
    return null
  }
}
