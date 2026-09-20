import {exec} from '../utils/exec.js';
import {error, info, warn} from '../utils/logger.js';
import {t} from '../utils/i18n.js';

export async function ensureNamespace(namespace: string): Promise<void> {
  try {
    await exec('kubectl', ['get', 'namespace', namespace]);
  } catch {
    await exec('kubectl', ['create', 'namespace', namespace]);
  }
}

export async function applyManifests(yaml: string): Promise<void> {
  info(t('deploy.applyingManifests'));
  await exec('kubectl', ['apply', '-f', '-'], {input: yaml});
}

export async function deleteApp(
  appName: string,
  namespace: string,
): Promise<void> {
  try {
    await exec('kubectl', [
      'delete',
      'all,configmap',
      '-l',
      `app.kubernetes.io/name=${appName}`,
      '-n',
      namespace,
    ]);
  } catch {
    // ignore cleanup errors
  }
}

interface RolloutSnapshot {
  desired: number;
  updated: number;
  total: number;
  available: number;
  errors: Set<string>;
  podRunning: boolean;
}

/**
 * Deterministic rollout wait: poll until the deployment has fully rolled out
 * (new pod template scaled up, old ReplicaSet scaled down, new pods Ready),
 * fail FAST on clearly-broken states (ImagePullBackOff, CrashLoopBackOff),
 * and only fall back to a lenient "warn and continue" when the deadline
 * passes but pods are at least Running.
 *
 * This is NOT "wait for the healthcheck": with no declared healthcheck there
 * are no probes, so a pod is Ready as soon as the container is Running.
 * When a healthcheck (HTTP path or tcp) is declared, pod Ready is gated by
 * the readiness probe and rollout completion tracks it.
 */
export async function waitForRollout(
  appName: string,
  namespace: string,
  timeoutMs = 150_000,
): Promise<void> {
  info(t('deploy.waitingRollout'));

  const deadline = Date.now() + timeoutMs;
  let lastSnapshot: RolloutSnapshot | null = null;

  while (Date.now() < deadline) {
    lastSnapshot = await snapshotRollout(appName, namespace);

    // Rolled out: template replaced, old RS scaled to zero, new pods Ready.
    // (Same signal kubectl rollout status uses — avoids the race where the
    // previous RS is still available right after apply.)
    if (
      lastSnapshot.desired > 0 &&
      lastSnapshot.updated >= lastSnapshot.desired &&
      lastSnapshot.total <= lastSnapshot.updated &&
      lastSnapshot.available >= lastSnapshot.updated
    ) {
      info(t('deploy.rolloutComplete'));
      await pruneStaleReplicaSets(appName, namespace);
      return;
    }

    // Broken: image cannot be pulled. Nothing will change by waiting.
    if (lastSnapshot.errors.has('ImagePullBackOff') || lastSnapshot.errors.has('ErrImagePull')) {
      error(t('deploy.imagePullFailed'));
      await reportPodDetails(appName, namespace);
      throw new Error(t('deploy.imagePullFailed'));
    }

    // Broken: container restarting endlessly.
    if (lastSnapshot.errors.has('CrashLoopBackOff')) {
      error(t('deploy.crashLoop'));
      await reportPodDetails(appName, namespace);
      throw new Error(t('deploy.crashLoop'));
    }

    await sleep(3000);
  }

  // Deadline reached. Running pods -> tolerably slow, continue; otherwise fail.
  if (lastSnapshot?.podRunning) {
    warn(t('deploy.rolloutTimeout', {timeout: String(timeoutMs / 1000)}));
    return;
  }

  error(t('deploy.rolloutFailed'));
  await reportPodDetails(appName, namespace);
  throw new Error(t('deploy.rolloutFailed'));
}

async function snapshotRollout(appName: string, namespace: string): Promise<RolloutSnapshot> {
  const snapshot: RolloutSnapshot = {
    desired: 0,
    updated: 0,
    total: 0,
    available: 0,
    errors: new Set(),
    podRunning: false,
  };

  try {
    const {stdout} = await exec(
      'kubectl',
      ['get', 'deployment', appName, '-n', namespace, '-o', 'json'],
      {silent: true, reject: false} as Record<string, unknown>,
    );
    const dep = JSON.parse(stdout);
    snapshot.desired = dep?.spec?.replicas ?? 0;
    snapshot.updated = dep?.status?.updatedReplicas ?? 0;
    snapshot.total = dep?.status?.replicas ?? 0;
    snapshot.available = dep?.status?.availableReplicas ?? 0;
  } catch {
    // deployment not visible (yet) — continue polling
  }

  const {stdout: podsJson} = await exec(
    'kubectl',
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
    {silent: true, reject: false} as Record<string, unknown>,
  );

  try {
    const pods = JSON.parse(podsJson);
    for (const pod of pods?.items ?? []) {
      if (pod?.status?.phase === 'Running') snapshot.podRunning = true;
      for (const cs of pod?.status?.containerStatuses ?? []) {
        const reason = cs?.state?.waiting?.reason;
        if (reason) snapshot.errors.add(reason);
      }
    }
  } catch {
    // pods not parseable yet
  }

  return snapshot;
}

export async function reportPodDetails(appName: string, namespace: string): Promise<void> {
  const debugInfo = await getPodDebugInfo(appName, namespace);
  const logs = await getPodLogs(appName, namespace);
  if (debugInfo) {
    console.log();
    info('--- Pod describe ---');
    console.log(debugInfo);
  }
  if (logs) {
    console.log();
    info('--- Pod logs ---');
    console.log(logs);
  }
}

/**
 * Remove ReplicaSets that have been fully scaled to zero (replicas 0 and no
 * ready/available pods). A scaled-down RS serves nothing — its pods are pure
 * history, including failed pods from a previous bad image (ImagePullBackOff)
 * or superseded rollout. Deleting them keeps `kubectl get pods` clean and
 * deterministic.
 *
 * Unlike pruning by revision annotation, the zero-replica invariant is
 * race-free: the controller may still be settling revision annotations when
 * the rollout completes, but a zero-replica RS is always safe to remove, so
 * we retry briefly to catch scale-down lag.
 */
export async function pruneStaleReplicaSets(
  appName: string,
  namespace: string,
): Promise<void> {
  const nameLabel = `app.kubernetes.io/name=${appName}`;

  for (let attempt = 0; attempt < 6; attempt++) {
    let deletedAny = false;
    try {
      const {stdout: rsOut} = await exec(
        'kubectl',
        ['get', 'replicasets', '-l', nameLabel, '-n', namespace, '-o', 'json'],
        {silent: true, reject: false} as Record<string, unknown>,
      );
      const rsList = JSON.parse(rsOut);
      for (const rs of rsList?.items ?? []) {
        const status = rs?.status ?? {};
        const replicas = status.replicas ?? 0;
        const ready = status.readyReplicas ?? 0;
        const available = status.availableReplicas ?? 0;
        if (replicas === 0 && ready === 0 && available === 0) {
          await exec(
            'kubectl',
            ['delete', 'replicaset', rs.metadata.name, '-n', namespace],
            {silent: true, reject: false} as Record<string, unknown>,
          );
          deletedAny = true;
        }
      }
    } catch {
      // best-effort cleanup — never fail the rollout over it
    }

    if (!deletedAny) return;
    await sleep(2000);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Image currently used by the app's deployment, or null when the deployment
 * does not exist yet. Used to decide whether a source app needs a rebuild;
 * unchanged content produces the same tag, so the build can be skipped.
 */
export async function getDeployedImage(
  appName: string,
  namespace: string,
): Promise<string | null> {
  try {
    const {stdout} = await exec(
      'kubectl',
      [
        'get',
        'deployment',
        appName,
        '-n',
        namespace,
        '-o',
        'jsonpath={.spec.template.spec.containers[0].image}',
      ],
      {silent: true, reject: false} as Record<string, unknown>,
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function getPodDebugInfo(
  appName: string,
  namespace: string,
): Promise<string> {
  try {
    const {stdout: describe} = await exec('kubectl', [
      'describe',
      'pod',
      '-l',
      `app.kubernetes.io/name=${appName}`,
      '-n',
      namespace,
    ]);
    return describe;
  } catch {
    return '';
  }
}

export async function getPodLogs(
  appName: string,
  namespace: string,
): Promise<string> {
  try {
    const {stdout, stderr} = await exec(
      'kubectl',
      [
        'logs',
        '-l',
        `app.kubernetes.io/name=${appName}`,
        '-n',
        namespace,
        '--tail=50',
      ],
      {silent: true, reject: false} as Record<string, unknown>,
    );
    return stdout || stderr;
  } catch {
    return '';
  }
}

export async function getServiceNodePort(
  appName: string,
  namespace: string,
): Promise<number | null> {
  try {
    const {stdout} = await exec(
      'kubectl',
      [
        'get',
        'service',
        appName,
        '-n',
        namespace,
        '-o',
        'jsonpath={.spec.ports[0].nodePort}',
      ],
      {silent: true},
    );
    const nodePort = parseInt(stdout.trim(), 10);
    return isNaN(nodePort) ? null : nodePort;
  } catch {
    return null;
  }
}
