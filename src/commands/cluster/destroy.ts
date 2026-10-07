import {access} from 'fs/promises';
import {confirm} from '@clack/prompts';
import {deleteCluster} from '../../core/cluster.js';
import {deleteContext} from '../../core/context.js';
import {readAndParseEnvFile} from '../../core/env-file.js';
import {success, warn} from '../../utils/logger.js';
import {t} from '../../utils/i18n.js';

const DEFAULT_CLUSTER_NAME = 'kustron';

export async function clusterDestroy(options: {yes?: boolean} = {}): Promise<void> {
  const filePath = './kustron-env.yaml';
  let clusterName = DEFAULT_CLUSTER_NAME;
  try {
    await access(filePath);
    const envFile = await readAndParseEnvFile(filePath);
    clusterName = envFile.config?.clusterName ?? DEFAULT_CLUSTER_NAME;
  } catch {
    // no env file — fall back to default cluster name
  }

  if (!options.yes) {
    const shouldDelete = await confirm({
      message: t('env.down.confirm', {name: clusterName}),
    });
    if (!shouldDelete) {
      warn(t('env.down.cancelled'));
      return;
    }
  }

  try {
    await deleteCluster(clusterName);
    await deleteContext(clusterName);
    success(t('env.down.success', {name: clusterName}));
  } catch {
    warn(t('env.down.notFound', {name: clusterName}));
  }
}
