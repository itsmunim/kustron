import {access} from 'fs/promises';
import {readAndParseEnvFile} from '../../core/env-file.js';
import {resolveAppByName} from '../../core/app-lookup.js';
import {kubectl} from '../../core/kubectl.js';
import {helmUninstall} from '../../core/helm.js';
import {clusterExists, isClusterRunning} from '../../core/cluster.js';
import {success, warn, step} from '../../utils/logger.js';
import {t} from '../../utils/i18n.js';

const DEFAULT_CLUSTER_NAME = 'kustron';
const DEFAULT_NAMESPACE = 'kustron-env';

export async function appStop(appName: string): Promise<void> {
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

  const resolved = await resolveAppByName(envFile, appName, namespace);
  if (!resolved) {
    warn(t('app.notFound', {name: appName}));
    process.exit(1);
  }
  const app = resolved.app;
  const deploymentName = resolved.deploymentName;

  const exists = await clusterExists(clusterName);
  if (!exists || !(await isClusterRunning(clusterName))) {
    warn(t('env.status.clusterNotRunning', {name: clusterName}));
    return;
  }

  step(t('app.stopping', {name: appName}));

  if (app.helm) {
    await helmUninstall(deploymentName, resolved.namespace, clusterName);
  } else {
    await kubectl(clusterName, [
      'scale',
      'deployment',
      deploymentName,
      '--replicas=0',
      '-n',
      resolved.namespace,
    ]);
  }

  success(t('app.stopped', {name: appName}));
}
