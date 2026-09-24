import {access} from 'fs/promises';
import chalk from 'chalk';
import {readAndParseEnvFile} from '../../core/env-file.js';
import {clusterExists, isClusterRunning, getK3dNodeIp} from '../../core/cluster.js';
import {exec} from '../../utils/exec.js';
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
  label: 'running' | 'starting' | 'imagepull' | 'crashloop' | 'pending' | 'unknown';
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

async function getDeploymentInfo(appName: string, namespace: string): Promise<DeploymentInfo> {
  const result = await exec(
    'kubectl',
    ['get', 'deployment', appName, '-n', namespace, '-o', 'json'],
    {silent: true, reject: false} as Record<string, unknown>,
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

async function getPodState(appName: string, namespace: string): Promise<PodState> {
  const result = await exec(
    'kubectl',
    ['get', 'pods', '-l', `app.kubernetes.io/name=${appName}`, '-n', namespace, '-o', 'json'],
    {silent: true, reject: false} as Record<string, unknown>,
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

      if (waitingReasons.includes('ImagePullBackOff') || waitingReasons.includes('ErrImagePull')) {
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

async function getNodePort(appName: string, namespace: string): Promise<number | null> {
  const result = await exec(
    'kubectl',
    ['get', 'service', appName, '-n', namespace, '-o', 'jsonpath={.spec.ports[0].nodePort}'],
    {silent: true, reject: false} as Record<string, unknown>,
  );
  if (result.exitCode !== 0) return null;
  const port = parseInt(result.stdout.trim(), 10);
  return Number.isNaN(port) ? null : port;
}

export async function envStatus(): Promise<void> {
  const filePath = './kustron-env.yaml';
  try {
    await access(filePath);
  } catch {
    error(t('env.status.noEnvFile'));
    process.exit(1);
  }

  const envFile = await readAndParseEnvFile(filePath);
  const namespace = envFile.config?.namespace ?? DEFAULT_NAMESPACE;

  // Cluster state (informational; status still lists yaml apps regardless)
  const exists = await clusterExists(DEFAULT_CLUSTER_NAME);
  if (!exists) {
    warn(t('env.status.clusterNotCreated', {name: DEFAULT_CLUSTER_NAME}));
  } else if (!(await isClusterRunning(DEFAULT_CLUSTER_NAME))) {
    warn(t('env.status.clusterNotRunning', {name: DEFAULT_CLUSTER_NAME}));
  }

  const nodeIp = exists ? await getK3dNodeIp(DEFAULT_CLUSTER_NAME) : null;

  info(`${t('env.status.header')} (${envFile.apps.length})`);
  info(t('env.status.namespace', {namespace}));
  console.log();

  const rows = await Promise.all(
    envFile.apps.map(async (app) => {
      const deployment = await getDeploymentInfo(app.name, namespace);
      const podState = await getPodState(app.name, namespace);
      const nodePort = app.exposed ? await getNodePort(app.name, namespace) : null;
      const url =
        app.exposed && nodePort && nodeIp
          ? `http://${nodeIp}:${nodePort}`
          : app.exposed && nodePort
            ? t('env.status.nodePortOnly', {port: String(nodePort)})
            : null;

      let stateText: string;
      let state: PodState['label'];
      if (!deployment.exists) {
        stateText = t('env.status.notDeployed');
        state = 'unknown';
      } else {
        state = podState.label;
        switch (state) {
          case 'running':
            stateText = t('env.status.running');
            break;
          case 'starting':
            stateText = t('env.status.starting');
            break;
          case 'imagepull':
            stateText = t('env.status.imagePullFailed');
            break;
          case 'crashloop':
            stateText = t('env.status.crashLoop');
            break;
          case 'pending':
            stateText = t('env.status.pending');
            break;
          default:
            stateText = t('env.status.unknown');
        }
      }

      const type = app.helm ? 'helm' : app.source ? 'source' : app.image ? 'image' : '?';
      const imageRef = deployment.exists ? deployment.image.split('/').pop() ?? deployment.image : '';

      return {
        name: app.name,
        type,
        state,
        stateText,
        ready: deployment.exists ? `${deployment.ready}/${deployment.desired}` : '-',
        image: imageRef,
        url,
      };
    }),
  );

  const maxNameLen = Math.max(t('env.status.colApp').length, ...rows.map((r) => r.name.length));
  const maxTypeLen = Math.max(t('env.status.colType').length, ...rows.map((r) => r.type.length));
  const maxStateLen = Math.max(
    t('env.status.colStatus').length,
    ...rows.map((r) => r.stateText.length),
  );

  console.log(
    `${chalk.bold(t('env.status.colApp').padEnd(maxNameLen + 2))}${chalk.bold(t('env.status.colType').padEnd(maxTypeLen + 2))}${chalk.bold(
      t('env.status.colStatus').padEnd(maxStateLen + 2),
    )}${chalk.bold(t('env.status.colReady').padEnd(9))}${chalk.bold(t('env.status.colImage').padEnd(36))}${chalk.bold(t('env.status.colUrl'))}`,
  );
  console.log(chalk.dim(t('env.status.divider').repeat(120)));

  for (const row of rows) {
    const color = statusColor(row.state);
    console.log(
      `${row.name.padEnd(maxNameLen + 2)}${row.type.padEnd(maxTypeLen + 2)}${color(
        row.stateText.padEnd(maxStateLen + 2),
      )}${row.ready.padEnd(9)}${chalk.dim(row.image.padEnd(36))}${row.url ? chalk.cyan(row.url) : chalk.dim('-')}`,
    );
  }

  console.log();
}