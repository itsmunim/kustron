import { exec } from '../utils/exec.js'

export const DEFAULT_CLUSTER_NAME = 'kustron'
export const KUSTON_CONTEXT = `k3d-${DEFAULT_CLUSTER_NAME}`

export async function importKubeconfig(clusterName?: string): Promise<void> {
  const name = clusterName ?? DEFAULT_CLUSTER_NAME
  await exec('k3d', ['kubeconfig', 'merge', name, '--kubeconfig-merge-default'])
}

export async function setCurrentContext(clusterName?: string): Promise<void> {
  const name = clusterName ?? DEFAULT_CLUSTER_NAME
  await exec('kubectl', ['config', 'use-context', `k3d-${name}`])
}

export async function getCurrentContext(): Promise<string | null> {
  try {
    const { stdout } = await exec('kubectl', ['config', 'current-context'])
    return stdout.trim() || null
  } catch {
    return null
  }
}
