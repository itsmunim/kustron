import {Command} from 'commander';
import {registryLogin} from '../../core/registry.js';
import {pruneRegistry} from '../../core/registry-gc.js';
import {t} from '../../utils/i18n.js';
import {readAndParseEnvFile} from '../../core/env-file.js';
import {access} from 'fs/promises';

const DEFAULT_CLUSTER_NAME = 'kustron';

export function registerRegistryCommand(program: Command): void {
  const registry = program
    .command('registry')
    .description(t('cli.registryDescription'));

  registry
    .command('login')
    .description(t('cli.registryLoginDescription'))
    .requiredOption('--server <url>', t('cli.registryServerOption'))
    .option('--username <user>', t('cli.registryUsernameOption'))
    .option('--password <pass>', t('cli.registryPasswordOption'))
    .action(async (options) => {
      await registryLogin(options.server, options.username, options.password);
    });

  registry
    .command('prune')
    .description(t('cli.registryPruneDescription'))
    .action(async () => {
      const filePath = './kustron-env.yaml';
      try {
        await access(filePath);
        const envFile = await readAndParseEnvFile(filePath);
        const clusterName = envFile.config?.clusterName ?? DEFAULT_CLUSTER_NAME;
        await pruneRegistry(clusterName, 5000);
      } catch {
        console.error('No kustron-env.yaml found');
        process.exit(1);
      }
    });
}
