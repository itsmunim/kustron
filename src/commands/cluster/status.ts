import { getClusterInfo } from '../../core/cluster.js'
import { getCurrentContext } from '../../core/context.js'
import { exec } from '../../utils/exec.js'
import { info, warn } from '../../utils/logger.js'
import chalk from 'chalk'

const DEFAULT_CLUSTER_NAME = 'kustron-k3d'

export async function clusterStatus(): Promise<void> {
  const cluster = await getClusterInfo()

  if (!cluster) {
    warn(`Cluster '${DEFAULT_CLUSTER_NAME}' is not running.`)
    return
  }

  console.log()
  console.log(chalk.bold(`Cluster: ${cluster.name}`))
  console.log(
    `Nodes: ${cluster.serversRunning}/${cluster.serversCount} servers, ${cluster.agentsRunning}/${cluster.agentsCount} agents`,
  )

  const context = await getCurrentContext()
  if (context) {
    console.log(`Kubectl context: ${context}`)
  } else {
    console.log('Kubectl context: none set')
  }

  console.log()
  info('Deployed apps:')

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
      console.log(chalk.bold('NAMESPACE  NAME  READY  REPLICAS'))
      console.log(stdout)
    } else {
      console.log('  (none)')
    }
  } catch {
    console.log('  (unable to fetch deployments)')
  }
}
