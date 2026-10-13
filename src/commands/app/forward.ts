import {access} from 'fs/promises';
import {readAndParseEnvFile} from '../../core/env-file.js';
import {exec} from '../../utils/exec.js';
import {clusterExists, isClusterRunning} from '../../core/cluster.js';
import {warn, step} from '../../utils/logger.js';
import {t} from '../../utils/i18n.js';

const DEFAULT_CLUSTER_NAME = 'kustron';
const DEFAULT_NAMESPACE = 'kustron-env';

export async function appForward(
  appName: string,
  localPort: number,
  remotePort?: number,
): Promise<void> {
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

  const targetPort = remotePort ?? (typeof app.port === 'number' ? app.port : 80);
  step(t('app.forward', {name: appName, local: String(localPort), remote: String(targetPort)}));

  await exec('kubectl', [
    'port-forward',
    `deployment/${appName}`,
    `${localPort}:${targetPort}`,
    '-n',
    namespace,
    '--context',
    `k3d-${clusterName}`,
  ]);
}
