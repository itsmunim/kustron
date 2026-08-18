import { exec } from '../../utils/exec.js'
import { info } from '../../utils/logger.js'
import { t } from '../../utils/i18n.js'
import { KUSTON_CONTEXT } from '../../core/context.js'
import chalk from 'chalk'

const SYSTEM_NAMESPACES = ['default', 'kube-system', 'kube-public', 'kube-node-lease']

export async function appsList(): Promise<void> {
  try {
    const { stdout: nsStdout } = await exec('kubectl', [
      '--context',
      KUSTON_CONTEXT,
      'get',
      'namespaces',
      '-o',
      'jsonpath={.items[*].metadata.name}',
    ])

    const allNamespaces = nsStdout.trim().split(/\s+/).filter((n) => n && !SYSTEM_NAMESPACES.includes(n))

    if (allNamespaces.length === 0) {
      info(t('apps.listNone'))
      return
    }

    const deployments: Array<{ ns: string; name: string; ready: string; replicas: string }> = []

    for (const ns of allNamespaces) {
      try {
        const { stdout } = await exec('kubectl', [
          '--context',
          KUSTON_CONTEXT,
          'get',
          'deployments',
          '-n',
          ns,
          '-o',
          'custom-columns=NAME:.metadata.name,READY:.status.readyReplicas,REPLICAS:.status.replicas',
          '--no-headers',
        ])

        for (const line of stdout.trim().split('\n')) {
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 3) {
            deployments.push({
              ns,
              name: parts[0],
              ready: parts[1] ?? '<none>',
              replicas: parts[2] ?? '0',
            })
          }
        }
      } catch {
        // Skip namespaces we can't read
      }
    }

    if (deployments.length === 0) {
      info(t('apps.listNone'))
      return
    }

    console.log()
    console.log(chalk.bold(t('apps.listHeader')))
    console.log(chalk.dim('-'.repeat(60)))
    for (const dep of deployments) {
      const readyNum = parseInt(dep.ready, 10) || 0
      const replicasNum = parseInt(dep.replicas, 10) || 0
      const status = readyNum === replicasNum && replicasNum > 0 ? chalk.green('●') : chalk.yellow('◐')
      console.log(
        `${status} ${chalk.bold(dep.name)}  ${chalk.dim(dep.ns)}  ${dep.ready ?? 0}/${dep.replicas ?? 0} ready`,
      )
    }
    console.log()
  } catch {
    info(t('apps.listError'))
  }
}
