import { Command } from 'commander'
import { clusterUp } from '../commands/cluster/up.js'
import { clusterDown } from '../commands/cluster/down.js'
import { clusterStatus } from '../commands/cluster/status.js'
import { deploy } from '../commands/deploy.js'
import { setVerbose } from '../utils/exec.js'
import { t } from '../utils/i18n.js'

const program = new Command()

program
  .name('kustron')
  .description(t('cli.description'))
  .version('2.0.0')
  .option('--verbose', t('cli.verboseOption'))
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts()
    if (opts.verbose) {
      setVerbose(true)
    }
  })

const cluster = program.command('cluster').description(t('cli.clusterDescription'))

cluster
  .command('up')
  .description(t('cli.upDescription'))
  .action(async () => {
    await clusterUp()
  })

cluster
  .command('down')
  .description(t('cli.downDescription'))
  .action(async () => {
    await clusterDown()
  })

cluster
  .command('status')
  .description(t('cli.statusDescription'))
  .action(async () => {
    await clusterStatus()
  })

program
  .command('deploy <source>')
  .description(t('cli.deployDescription'))
  .requiredOption('--name <name>', t('cli.nameOption'))
  .requiredOption('--port <port>', t('cli.portOption'), parseInt)
  .option('--replicas <n>', t('cli.replicasOption'), '1')
  .option('--ha', t('cli.haOption'))
  .option('--env <env...>', t('cli.envOption'))
  .option('--expose', t('cli.exposeOption'))
  .option('--ns <namespace>', t('cli.nsOption'))
  .option('--healthcheck <path>', t('cli.healthcheckOption'))
  .option('--cpu-request <value>', t('cli.cpuRequestOption'))
  .option('--cpu-limit <value>', t('cli.cpuLimitOption'))
  .option('--memory-request <value>', t('cli.memoryRequestOption'))
  .option('--memory-limit <value>', t('cli.memoryLimitOption'))
  .action(async (source, options) => {
    const env: Record<string, string> = {}
    if (options.env) {
      for (const e of options.env) {
        const [key, value] = e.split('=')
        if (key && value !== undefined) {
          env[key] = value
        }
      }
    }

    const replicas = options.ha ? parseInt(options.replicas, 10) || 2 : parseInt(options.replicas, 10)

    await deploy(source, {
      name: options.name,
      port: options.port,
      replicas,
      ha: options.ha ?? false,
      env,
      expose: options.expose ?? false,
      ns: options.ns,
      keepSource: options.keepSource ?? false,
      healthcheck: options.healthcheck,
      cpuRequest: options.cpuRequest,
      cpuLimit: options.cpuLimit,
      memoryRequest: options.memoryRequest,
      memoryLimit: options.memoryLimit,
    })
  })

program.parse()
