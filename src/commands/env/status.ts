import {access} from 'fs/promises';
import chalk from 'chalk';
import {readAndParseEnvFile} from '../../core/env-file.js';
import type {AppEntry, EnvFile} from '../../types/index.js';
import {
  clusterExists,
  isClusterRunning,
  getK3dNodeIp,
} from '../../core/cluster.js';
import {kubectl, helm} from '../../core/kubectl.js';
import {expandComponents} from '../../core/components.js';
import {appDeploymentName} from '../../core/deps.js';
import {error, info, warn} from '../../utils/logger.js';
import {t} from '../../utils/i18n.js';

const DEFAULT_CLUSTER_NAME = 'kustron';
const DEFAULT_NAMESPACE = 'kustron-env';

interface DeploymentInfo {
  exists: boolean;
  ready: number;
  desired: number;
  image: string;
}

interface PodState {
  label:
    'running' | 'starting' | 'imagepull' | 'crashloop' | 'pending' | 'unknown';
}

function statusColor(state: PodState['label']): (s: string) => string {
  switch (state) {
    case 'running':
      return chalk.green;
    case 'starting':
      return chalk.yellow;
    case 'imagepull':
    case 'crashloop':
      return chalk.red;
    case 'pending':
      return chalk.yellow;
    default:
      return chalk.dim;
  }
}

async function getDeploymentInfo(
  appName: string,
  namespace: string,
  clusterName: string,
): Promise<DeploymentInfo> {
  const result = await kubectl(
    clusterName,
    ['get', 'deployment', appName, '-n', namespace, '-o', 'json'],
    {silent: true, reject: false},
  );
  if (result.exitCode !== 0) {
    return {exists: false, ready: 0, desired: 0, image: ''};
  }

  try {
    const dep = JSON.parse(result.stdout);
    const image = dep?.spec?.template?.spec?.containers?.[0]?.image ?? '';
    return {
      exists: true,
      ready: dep?.status?.readyReplicas ?? 0,
      desired: dep?.spec?.replicas ?? 1,
      image,
    };
  } catch {
    return {exists: false, ready: 0, desired: 0, image: ''};
  }
}

async function getPodState(
  appName: string,
  namespace: string,
  clusterName: string,
): Promise<PodState> {
  const result = await kubectl(
    clusterName,
    [
      'get',
      'pods',
      '-l',
      `app.kubernetes.io/name=${appName}`,
      '-n',
      namespace,
      '-o',
      'json',
    ],
    {silent: true, reject: false},
  );
  if (result.exitCode !== 0) {
    return {label: 'unknown'};
  }

  try {
    const pods = JSON.parse(result.stdout);
    let runningPods = 0;
    let pendingPods = 0;

    for (const pod of pods?.items ?? []) {
      const phase = pod?.status?.phase;
      const waitingReasons: string[] = [];
      for (const cs of pod?.status?.containerStatuses ?? []) {
        const reason = cs?.state?.waiting?.reason;
        if (reason) waitingReasons.push(reason);
      }

      if (
        waitingReasons.includes('ImagePullBackOff') ||
        waitingReasons.includes('ErrImagePull')
      ) {
        return {label: 'imagepull'};
      }
      if (waitingReasons.includes('CrashLoopBackOff')) {
        return {label: 'crashloop'};
      }
      if (phase === 'Running') {
        runningPods += 1;
      } else if (phase === 'Pending' || phase === 'ContainerCreating') {
        pendingPods += 1;
      }
    }

    if (runningPods > 0) return {label: 'running'};
    if (pendingPods > 0) return {label: 'pending'};
    return {label: 'unknown'};
  } catch {
    return {label: 'unknown'};
  }
}

async function getNodePort(
  appName: string,
  namespace: string,
  clusterName: string,
): Promise<number | null> {
  const result = await kubectl(
    clusterName,
    [
      'get',
      'service',
      appName,
      '-n',
      namespace,
      '-o',
      'jsonpath={.spec.ports[0].nodePort}',
    ],
    {silent: true, reject: false},
  );
  if (result.exitCode !== 0) return null;
  const port = parseInt(result.stdout.trim(), 10);
  return Number.isNaN(port) ? null : port;
}

export interface StatusOptions {
  json?: boolean;
}

interface StatusRow {
  name: string;
  deployment: string;
  namespace: string;
  type: string;
  exists: boolean;
  readyReplicas: number;
  desiredReplicas: number;
  state: PodState['label'];
  imageFull: string;
  exposed: boolean;
  nodePort: number | null;
  url: string | null;
  helmRelease: string | null;
}

async function getHelmReleaseState(
  releaseName: string,
  namespace: string,
  clusterName: string,
): Promise<string> {
  const result = await helm(
    clusterName,
    ['status', releaseName, '-n', namespace, '-o', 'json'],
    {silent: true, reject: false},
  );
  if (result.exitCode !== 0) return 'missing';
  try {
    const parsed = JSON.parse(result.stdout);
    return parsed?.info?.status ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function appHealthy(row: StatusRow): boolean {
  if (row.type === 'helm') return row.helmRelease === 'deployed';
  return (
    row.exists &&
    row.state === 'running' &&
    row.readyReplicas >= row.desiredReplicas
  );
}

export async function envStatus(options: StatusOptions = {}): Promise<void> {
  const filePath = './kustron-env.yaml';
  try {
    await access(filePath);
  } catch {
    error(t('env.status.noEnvFile'));
    process.exit(1);
  }

  const envFile = await readAndParseEnvFile(filePath);
  const namespace = envFile.config?.namespace ?? DEFAULT_NAMESPACE;
  const clusterName = envFile.config?.clusterName ?? DEFAULT_CLUSTER_NAME;

  // Component apps (declared in a Kustronfile) are lifecycle-manageable
  // citizens: status lists the expanded app set, not just declared entries.
  const {apps: expandedApps} = await expandComponents(envFile);

  // Cluster state (informational; status still lists yaml apps regardless)
  const exists = await clusterExists(clusterName);
  let running = false;
  if (!exists) {
    warn(t('env.status.clusterNotCreated', {name: clusterName}));
  } else {
    running = await isClusterRunning(clusterName);
    if (!running) {
      warn(t('env.status.clusterNotRunning', {name: clusterName}));
    }
  }

  const nodeIp = exists ? await getK3dNodeIp(clusterName) : null;

  const rows: StatusRow[] = await Promise.all(
    expandedApps.map(async (app: AppEntry) => {
      const deploymentName = appDeploymentName(app);
      const appNamespace = app.namespace ?? namespace;
      const deployment = await getDeploymentInfo(
        deploymentName,
        appNamespace,
        clusterName,
      );
      const podState = await getPodState(
        deploymentName,
        appNamespace,
        clusterName,
      );
      const nodePort = app.exposed
        ? await getNodePort(deploymentName, appNamespace, clusterName)
        : null;
      const url = app.exposed && nodePort
        ? nodeIp
          ? `http://${nodeIp}:${nodePort}`
          : `http://localhost:${nodePort}`
        : null;

      let state: PodState['label'];
      if (!deployment.exists) {
        state = 'unknown';
      } else {
        state = podState.label;
      }

      const type = app.helm
        ? 'helm'
        : app.source
          ? 'source'
          : app.image
            ? 'image'
            : '?';

      return {
        name: app.name,
        deployment: deploymentName,
        namespace: appNamespace,
        type,
        exists: deployment.exists,
        readyReplicas: deployment.ready,
        desiredReplicas: deployment.desired,
        state,
        imageFull: deployment.image,
        exposed: app.exposed ?? false,
        nodePort,
        url,
        helmRelease: null,
      };
    }),
  );

  // Helm apps are only reliably visible through their release status (chart
  // deployment/service names vary). Query each helm release once.
  for (const row of rows.filter((candidate) => candidate.type === 'helm')) {
    row.helmRelease = await getHelmReleaseState(
      row.name,
      row.namespace,
      clusterName,
    );
  }

  const clusterHealthy = exists && running;
  const healthy = clusterHealthy && rows.every((row) => appHealthy(row));

  if (!options.json) {
    printHumanTable(rows, namespace);
  } else {
    console.log(
      JSON.stringify(
        {
          cluster: {name: clusterName, exists, running},
          namespace,
          healthy,
          apps: rows.map((row) => ({
            name: row.name,
            deployment: row.deployment,
            namespace: row.namespace,
            type: row.type,
            deployed: row.exists,
            readyReplicas: row.readyReplicas,
            desiredReplicas: row.desiredReplicas,
            state: row.type === 'helm' ? row.helmRelease : row.state,
            image: row.imageFull,
            exposed: row.exposed,
            nodePort: row.nodePort,
            url: row.url,
            healthy: appHealthy(row),
          })),
        },
        null,
        2,
      ),
    );
  }

  // Machine + human callers gate test flows on the exit code: 0 only when
  // the cluster is up and every app is running (helm: release deployed).
  if (!healthy) {
    process.exitCode = 1;
  }
}

function printHumanTable(rows: StatusRow[], namespace: string): void {
  info(`${t('env.status.header')} (${rows.length})`);
  info(t('env.status.namespace', {namespace}));
  console.log();

  const stateText = (row: StatusRow): string => {
    if (!row.exists) return t('env.status.notDeployed');
    switch (row.state) {
      case 'running':
        return t('env.status.running');
      case 'starting':
        return t('env.status.starting');
      case 'imagepull':
        return t('env.status.imagePullFailed');
      case 'crashloop':
        return t('env.status.crashLoop');
      case 'pending':
        return t('env.status.pending');
      default:
        return t('env.status.unknown');
    }
  };

  const maxNameLen = Math.max(
    t('env.status.colApp').length,
    ...rows.map((r) => r.name.length),
  );
  const maxTypeLen = Math.max(
    t('env.status.colType').length,
    ...rows.map((r) => r.type.length),
  );
  const maxStateLen = Math.max(
    t('env.status.colStatus').length,
    ...rows.map((r) => stateText(r).length),
  );

  console.log(
    `${chalk.bold(t('env.status.colApp').padEnd(maxNameLen + 2))}${chalk.bold(t('env.status.colType').padEnd(maxTypeLen + 2))}${chalk.bold(
      t('env.status.colStatus').padEnd(maxStateLen + 2),
    )}${chalk.bold(t('env.status.colReady').padEnd(9))}${chalk.bold(t('env.status.colImage').padEnd(36))}${chalk.bold(t('env.status.colUrl'))}`,
  );
  console.log(chalk.dim(t('env.status.divider').repeat(120)));

  for (const row of rows) {
    const color = statusColor(row.state);
    const readyText = row.exists
      ? `${row.readyReplicas}/${row.desiredReplicas}`
      : '-';
    const shortImage = row.imageFull.split('/').pop() ?? row.imageFull;
    console.log(
      `${row.name.padEnd(maxNameLen + 2)}${row.type.padEnd(maxTypeLen + 2)}${color(
        stateText(row).padEnd(maxStateLen + 2),
      )}${readyText.padEnd(9)}${chalk.dim(shortImage.padEnd(36))}${row.url ? chalk.cyan(row.url) : chalk.dim('-')}`,
    );
  }

  console.log();
}
