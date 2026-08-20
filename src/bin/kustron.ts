import { Command } from 'commander'
import { envInit } from '../commands/env/init.js'
import { envUp } from '../commands/env/up.js'
import { envDown } from '../commands/env/down.js'
import { envReload } from '../commands/env/reload.js'
import { envShowSpec } from '../commands/env/show-spec.js'
import { appsAdd } from '../commands/apps/add.js'
import { appsRemove } from '../commands/apps/remove.js'
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

const env = program.command('env').description(t('cli.envDescription'))

env
  .command('init')
  .description(t('cli.initDescription'))
  .action(async () => {
    await envInit()
  })

env
  .command('up')
  .description(t('cli.upDescription'))
  .action(async () => {
    await envUp()
  })

env
  .command('down')
  .description(t('cli.downDescription'))
  .option('--yes', t('cli.yesOption'))
  .action(async (options) => {
    await envDown(options)
  })

env
  .command('reload')
  .description(t('cli.reloadDescription'))
  .action(async () => {
    await envReload()
  })

env
  .command('show-spec')
  .description(t('cli.showSpecDescription'))
  .action(async () => {
    await envShowSpec()
  })

const apps = program.command('apps').description(t('cli.appsDescription'))

apps
  .command('add')
  .description(t('cli.addDescription'))
  .requiredOption('--name <name>', t('cli.nameOption'))
  .option('--source <path>', t('cli.sourceOption'))
  .option('--image <image>', t('cli.imageOption'))
  .option('--helm-chart <name>', t('cli.helmChartOption'))
  .option('--helm-repo <url>', t('cli.helmRepoOption'))
  .option('--helm-version <ver>', t('cli.helmVersionOption'))
  .option('--port <n>', t('cli.portOption'), parseInt)
  .option('--healthcheck <path>', t('cli.healthcheckOption'))
  .option('--exposed', t('cli.exposedOption'))
  .option('--replicas <n>', t('cli.replicasOption'), parseInt)
  .option('--ha', t('cli.haOption'))
  .option('--env <env...>', t('cli.envOption'))
  .action(async (options) => {
    await appsAdd({
      name: options.name,
      source: options.source,
      image: options.image,
      helmChart: options.helmChart,
      helmRepo: options.helmRepo,
      helmVersion: options.helmVersion,
      port: options.port,
      healthcheck: options.healthcheck,
      exposed: options.exposed ?? false,
      replicas: options.replicas,
      ha: options.ha ?? false,
      env: options.env,
    })
  })

apps
  .command('remove <name>')
  .description(t('cli.removeDescription'))
  .action(async (name) => {
    await appsRemove(name)
  })

program.parse()
