import {access} from 'fs/promises';
import {readAndParseEnvFile} from '../../core/env-file.js';
import {kubectl} from '../../core/kubectl.js';
import {clusterExists, isClusterRunning} from '../../core/cluster.js';
import {success, warn, step} from '../../utils/logger.js';
import {t} from '../../utils/i18n.js';

const DEFAULT_CLUSTER_NAME = 'kustron';
const DEFAULT_NAMESPACE = 'kustron-env';

export async function appStart(appName: string): Promise<void> {
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

  step(t('app.starting', {name: appName}));

  if (app.helm) {
    warn(t('app.helmStartHint', {name: appName}));
    return;
  }

  const replicas = app.ha ? 2 : (app.replicas ?? 1);
  await kubectl(
    clusterName,
    ['scale', 'deployment', app.name, '--replicas', String(replicas), '-n', namespace],
  );

  success(t('app.started', {name: appName}));
}
