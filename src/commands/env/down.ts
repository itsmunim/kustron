import { confirm } from '@clack/prompts'
import { deleteCluster } from '../../core/cluster.js'
import { deleteContext } from '../../core/context.js'
import { success, warn } from '../../utils/logger.js'
import { t } from '../../utils/i18n.js'

const DEFAULT_CLUSTER_NAME = 'kustron'

export async function envDown(options: { yes?: boolean } = {}): Promise<void> {
  if (!options.yes) {
    const shouldDelete = await confirm({
      message: t('env.down.confirm', { name: DEFAULT_CLUSTER_NAME }),
    })
    if (!shouldDelete) {
      warn(t('env.down.cancelled'))
      return
    }
  }

  try {
    await deleteCluster()
    await deleteContext()
    success(t('env.down.success', { name: DEFAULT_CLUSTER_NAME }))
  } catch {
    warn(t('env.down.notFound', { name: DEFAULT_CLUSTER_NAME }))
  }
}
