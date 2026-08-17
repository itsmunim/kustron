import { deleteCluster } from '../../core/cluster.js'
import { success, warn } from '../../utils/logger.js'

const DEFAULT_CLUSTER_NAME = 'kustron-k3d'

export async function clusterDown(): Promise<void> {
  try {
    await deleteCluster()
    success(`Cluster '${DEFAULT_CLUSTER_NAME}' has been torn down.`)
  } catch {
    warn(`Cluster '${DEFAULT_CLUSTER_NAME}' not found. Nothing to do.`)
  }
}
