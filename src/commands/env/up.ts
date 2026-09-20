import {access} from 'fs/promises';
import {checkAll} from '../../utils/checks.js';
import {
  checkContainerRuntimeRunning,
  getContainerRuntimeSocket,
  detectContainerRuntime,
} from '../../utils/container-runtime.js';
import {
  createCluster,
  clusterExists,
  isClusterRunning,
  startCluster,
  ensureRegistry,
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

  try {
    const hasHelmApps = envFile.apps.some((a) => a.helm);
    if (hasHelmApps) {
      await checkAll(['container-runtime', 'k3d', 'kubectl', 'helm'], ['railpack', 'docker']);
    } else {
      await checkAll(['container-runtime', 'k3d', 'kubectl'], ['helm', 'railpack', 'docker']);
    }
  } catch {
    error(t('env.up.missingDepsHint'));
    process.exit(1);
  }

  const runtime = await detectContainerRuntime();
  const runtimeRunning = await checkContainerRuntimeRunning();
  if (!runtimeRunning) {
    error(t('errors.containerRuntimeNotRunning'));
    process.exit(1);
  }

  // Only podman needs an explicit socket (for k3d via DOCKER_HOST).
  // Docker/OrbStack daemons are reached through the Docker CLI's own context,
  // so there is no socket path to resolve.
  if (runtime === 'podman') {
    const socket = await getContainerRuntimeSocket();
    if (!socket) {
      error(t('errors.podmanSocketNotFound'));
      process.exit(1);
    }
  }

  const clusterName = DEFAULT_CLUSTER_NAME;

  const exists = await clusterExists(clusterName);
  if (!exists) {
    step(t('env.up.creatingCluster', {name: clusterName}));
    await createCluster({
      name: clusterName,
      namespace,
    });
  } else if (!(await isClusterRunning(clusterName))) {
    step(t('env.up.startingCluster', {name: clusterName}));
    await startCluster(clusterName);
  } else {
    warn(t('env.up.clusterExists', {name: clusterName}));
  }

  // Idempotent convergence: every `env up` guarantees a usable kubectl
  // context and a wired-in registry, whatever state it finds the cluster in.
  // This is what makes repeated runs deterministic instead of "sometimes
  // failing on a stray kubeconfig/registry".
  step(t('env.up.importingKubeconfig'));
  await mergeKubeconfig(clusterName);
  step(t('env.up.settingContext'));
  await setContext(clusterName);
  step(t('env.up.ensuringRegistry'));
  await ensureRegistry(clusterName);
  step(t('env.up.installingMetricsServer'));
  await installMetricsServer();

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
