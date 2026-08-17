import { Command } from 'commander'
import { clusterUp } from '../commands/cluster/up.js'
import { clusterDown } from '../commands/cluster/down.js'
import { clusterStatus } from '../commands/cluster/status.js'
import { setVerbose } from '../utils/exec.js'

const program = new Command()

program
  .name('kustron')
  .description('A CLI tool that gives anyone a fully working local Kubernetes setup in minutes')
  .version('2.0.0')
  .option('--verbose', 'stream all shell command output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts()
    if (opts.verbose) {
      setVerbose(true)
    }
  })

const cluster = program.command('cluster').description('Manage the local k3d cluster')

cluster
  .command('up')
  .description('Spin up k3d + local registry + set kubectl context')
  .action(async () => {
    await clusterUp()
  })

cluster
  .command('down')
  .description('Tear down the cluster')
  .action(async () => {
    await clusterDown()
  })

cluster
  .command('status')
  .description('Show cluster info + deployed apps')
  .action(async () => {
    await clusterStatus()
  })

program.parse()
