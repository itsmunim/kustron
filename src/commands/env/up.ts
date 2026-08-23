import {access} from 'fs/promises';
import {checkAll, checkDockerRunning} from '../../utils/checks.js';
import {
  createCluster,
  clusterExists,
  installMetricsServer,
  getK3dNodeIp,
} from '../../core/cluster.js';
import {mergeKubeconfig, setContext} from '../../core/context.js';
import {readAndParseEnvFile} from '../../core/env-file.js';
import {deployAll} from '../../core/deployer.js';
import {ensureNamespace} from '../../core/apply.js';
import {error, success, step, warn} from '../../utils/logger.js';
import {t} from '../../utils/i18n.js';
import type {DeployContext} from '../../types/index.js';

const DEFAULT_CLUSTER_NAME = 'kustron';

export async function envUp(): Promise<void> {
  const filePath = './kustron-env.yaml';
  try {
    await access(filePath);
  } catch {
    error(t('env.up.noEnvFile'));
    process.exit(1);
  }

  const envFile = await readAndParseEnvFile(filePath);
  const namespace = envFile.config?.namespace ?? 'kustron-env';

  const hasHelmApps = envFile.apps.some((a) => a.helm);
  if (hasHelmApps) {
    await checkAll(['docker', 'k3d', 'kubectl', 'helm'], []);
  } else {
    await checkAll(['docker', 'k3d', 'kubectl'], []);
  }

  const dockerRunning = await checkDockerRunning();
  if (!dockerRunning) {
    error(t('errors.dockerNotRunning'));
    process.exit(1);
  }

  const clusterName = DEFAULT_CLUSTER_NAME;

  const exists = await clusterExists(clusterName);
  if (!exists) {
    step(t('env.up.creatingCluster', {name: clusterName}));
    await createCluster({
      name: clusterName,
      namespace,
    });

    step(t('env.up.importingKubeconfig'));
    await mergeKubeconfig(clusterName);

    step(t('env.up.settingContext'));
    await setContext(clusterName);

    step(t('env.up.installingMetricsServer'));
    await installMetricsServer();
  } else {
    warn(t('env.up.clusterExists', {name: clusterName}));
  }

  const nodeIp = await getK3dNodeIp(clusterName);

  const ctx: DeployContext = {
    namespace,
    registryHost: 'kustron-registry:5000',
    clusterName,
    verbose: false,
    nodeIp: nodeIp ?? undefined,
  };

  step(t('env.up.deployingApps'));
  await ensureNamespace(namespace);
  await deployAll(envFile.apps, ctx);

  success(t('env.up.success', {name: clusterName}));
}
