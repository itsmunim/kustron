import {access} from 'fs/promises';
import {readAndParseEnvFile} from '../../core/env-file.js';
import {kubectl} from '../../core/kubectl.js';
import {helmUninstall} from '../../core/helm.js';
import {clusterExists, isClusterRunning} from '../../core/cluster.js';
import {expandComponents} from '../../core/components.js';
import {appDeploymentName} from '../../core/deps.js';
import {success, warn, step} from '../../utils/logger.js';
import {t} from '../../utils/i18n.js';

const DEFAULT_CLUSTER_NAME = 'kustron';
const DEFAULT_NAMESPACE = 'kustron-env';

export async function envStop(): Promise<void> {
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

  const exists = await clusterExists(clusterName);
  if (!exists) {
    warn(t('env.status.clusterNotCreated', {name: clusterName}));
    return;
  }
  if (!(await isClusterRunning(clusterName))) {
    warn(t('env.status.clusterNotRunning', {name: clusterName}));
    return;
  }

  const {apps} = await expandComponents(envFile);

  step(t('env.stop.stoppingApps', {count: String(apps.length)}));

  for (const app of apps) {
    const deploymentName = appDeploymentName(app);
    if (app.helm) {
      await helmUninstall(
        deploymentName,
        app.namespace ?? namespace,
        clusterName,
      );
    } else {
      try {
        await kubectl(
          clusterName,
          [
            'scale',
            'deployment',
            deploymentName,
            '--replicas=0',
            '-n',
            app.namespace ?? namespace,
          ],
          {silent: true, reject: false},
        );
      } catch {
        // ignore — app may not be deployed
      }
    }
  }

  success(t('env.stop.success', {name: clusterName}));
}
