import { getClusterInfo } from '../../core/cluster.js'
import { getCurrentContext } from '../../core/context.js'
import { exec } from '../../utils/exec.js'
import { info, warn } from '../../utils/logger.js'
import { t } from '../../utils/i18n.js'
import chalk from 'chalk'

const DEFAULT_CLUSTER_NAME = 'kustron'

export async function clusterStatus(): Promise<void> {
  const cluster = await getClusterInfo()

  if (!cluster) {
    warn(t('cluster.status.notRunning', { name: DEFAULT_CLUSTER_NAME }))
    return
  }

  console.log()
  console.log(chalk.bold(t('cluster.status.header', { name: cluster.name })))
  console.log(
    t('cluster.status.nodes', {
      serversRunning: String(cluster.serversRunning),
      serversCount: String(cluster.serversCount),
      agentsRunning: String(cluster.agentsRunning),
      agentsCount: String(cluster.agentsCount),
    }),
  )

  const context = await getCurrentContext()
  if (context) {
    console.log(t('cluster.status.context', { context }))
  } else {
    console.log(t('cluster.status.noContext'))
  }

  console.log()
  info(t('cluster.status.appsHeader'))

  try {
    const { stdout } = await exec('kubectl', [
      'get',
      'deployments',
      '--all-namespaces',
      '-o',
      'custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name,READY:.status.readyReplicas,REPLICAS:.status.replicas',
      '--no-headers',
    ])

    if (stdout.trim()) {
      console.log(chalk.bold(t('cluster.status.tableHeader')))
      console.log(stdout)
    } else {
      console.log(t('cluster.status.appsNone'))
    }
  } catch {
    console.log(t('cluster.status.appsError'))
  }
}
