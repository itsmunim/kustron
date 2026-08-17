import { deleteCluster } from '../../core/cluster.js'
import { success, warn } from '../../utils/logger.js'
import { t } from '../../utils/i18n.js'

const DEFAULT_CLUSTER_NAME = 'kustron'

export async function clusterDown(): Promise<void> {
  try {
    await deleteCluster()
    success(t('cluster.down.success', { name: DEFAULT_CLUSTER_NAME }))
  } catch {
    warn(t('cluster.down.notFound', { name: DEFAULT_CLUSTER_NAME }))
  }
}
