import {Command} from 'commander';
import {registryLogin, importImagesToCluster} from '../../core/registry.js';
import {error} from '../../utils/logger.js';
import {t} from '../../utils/i18n.js';

export function registerRegistryCommand(program: Command): void {
  const registry = program.command('registry').description(t('cli.registryDescription'));

  registry
    .command('login')
    .description(t('cli.registryLoginDescription'))
    .argument('<server>', 'registry host (e.g. ghcr.io)')
    .option('-u, --username <user>', 'username')
    .option('-p, --password <pass>', 'password (or use --password-stdin)')
    .option('--password-stdin', 'read password from stdin')
    .action(async (server: string, opts: {username?: string; password?: string; passwordStdin?: boolean}) => {
      let password = opts.password;
      if (opts.passwordStdin) {
        password = await readStdin();
      }
      try {
        await registryLogin(server, opts.username, password);
      } catch (err) {
        error(t('registry.loginFailed', {server}));
        throw err;
      }
    });

  registry
    .command('import')
    .description(t('cli.registryImportDescription'))
    .argument('<images...>', 'image(s) to import into the kustron cluster')
    .option('-c, --cluster <name>', 'cluster name', 'kustron')
    .action(async (images: string[], opts: {cluster: string}) => {
      await importImagesToCluster(images, opts.cluster);
    });
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data.trim()));
  });
}