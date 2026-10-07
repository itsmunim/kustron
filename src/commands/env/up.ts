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
import {mergeKubeconfig} from '../../core/context.js';
import {readAndParseEnvFile} from '../../core/env-file.js';
import {deployAll} from '../../core/deployer.js';
import {expandComponents} from '../../core/components.js';
import {ensureNamespace} from '../../core/apply.js';
import {error, success, step, warn} from '../../utils/logger.js';
import {t} from '../../utils/i18n.js';
import type {DeployContext} from '../../types/index.js';
import {findAvailablePort} from '../../utils/port.js';

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
  const clusterName = envFile.config?.clusterName ?? DEFAULT_CLUSTER_NAME;

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

  const exists = await clusterExists(clusterName);
  const registryPort = await findAvailablePort(5000);

  if (!exists) {
    step(t('env.up.creatingCluster', {name: clusterName}));
    await createCluster({
      name: clusterName,
      namespace,
      registryPort,
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
  step(t('env.up.ensuringRegistry'));
  await ensureRegistry(clusterName, registryPort);
  step(t('env.up.installingMetricsServer'));
  await installMetricsServer(clusterName);

  const nodeIp = await getK3dNodeIp(clusterName);

  const ctx: DeployContext = {
    namespace,
    registryHost: 'kustron-registry:5000',
    clusterName,
    verbose: false,
    nodeIp: nodeIp ?? undefined,
    registryPort,
    allApps: envFile.apps,
  };

  step(t('env.up.deployingApps'));
  await ensureNamespace(namespace, clusterName);

  // Expand components (idea 8) into concrete apps, exposing ${component.output} vars.
  const {apps, outputs} = await expandComponents(envFile);

  // Remove apps that were previously deployed but are no longer in the env file.
  await pruneRemovedApps(apps, namespace, clusterName);

  await deployAll(apps, {
    ...ctx,
    componentOutputs: outputs,
  });

  // Record what was deployed so we can prune removed apps on the next run.
  await recordDeployedApps(apps, namespace);

  success(t('env.up.success', {name: clusterName}));
}
