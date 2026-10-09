import {access} from 'fs/promises';
import {readAndParseEnvFile} from '../../core/env-file.js';
import {kubectl} from '../../core/kubectl.js';
import {clusterExists, isClusterRunning} from '../../core/cluster.js';
import {warn, step} from '../../utils/logger.js';
import {t} from '../../utils/i18n.js';

const DEFAULT_CLUSTER_NAME = 'kustron';
const DEFAULT_NAMESPACE = 'kustron-env';

export async function appLogs(appName: string, options: {follow?: boolean; tail?: number} = {}): Promise<void> {
  const filePath = './kustron-env.yaml';
  try {
    await access(filePath);
  } catch {
    warn(t('env.up.noEnvFile'));
    process.exit(1);
  }

  const envFile = await readAndParseEnvFile(filePath);
  const namespace = envFile.config?.namespace ?? DEFAULT_NAMESPACE;
  const clusterName = envFile.config?.clusterName ?? DEFAULT_CLUSTER_NAME;

  const app = envFile.apps.find((a) => a.name === appName);
  if (!app) {
    warn(t('app.notFound', {name: appName}));
    process.exit(1);
  }

  const exists = await clusterExists(clusterName);
  if (!exists || !(await isClusterRunning(clusterName))) {
    warn(t('env.status.clusterNotRunning', {name: clusterName}));
    return;
  }

  step(t('app.logs', {name: appName}));

  const args = ['logs', '-l', `app.kubernetes.io/name=${app.name}`, '-n', namespace];
  if (options.follow) args.push('-f');
  if (options.tail) args.push('--tail', String(options.tail));
  args.push('--all-containers=true');

  await kubectl(clusterName, args);
}
