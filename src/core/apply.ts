import {exec} from '../utils/exec.js';
import {error, info} from '../utils/logger.js';
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

export async function waitForRollout(
  appName: string,
  namespace: string,
): Promise<void> {
  info(t('deploy.waitingRollout'));

  // Wait for pods to be scheduled before calling kubectl wait
  let attempts = 0;
  while (attempts < 30) {
    try {
      const {stdout} = await exec('kubectl', [
        'get',
        'pods',
        '-l',
        `app.kubernetes.io/name=${appName}`,
        '-n',
        namespace,
        '--field-selector=status.phase!=Succeeded,status.phase!=Failed',
        '-o',
        'jsonpath={.items[*].metadata.name}',
      ]);
      if (stdout.trim()) break;
    } catch {
      // pod may not exist yet, retry
    }
    await new Promise((r) => setTimeout(r, 1000));
    attempts++;
  }

  await exec('kubectl', [
    'wait',
    '--for=condition=ready',
    'pod',
    '-l',
    `app.kubernetes.io/name=${appName}`,
    '-n',
    namespace,
    '--timeout=120s',
  ]);
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
    const {stdout: logs} = await exec('kubectl', [
      'logs',
      '-l',
      `app.kubernetes.io/name=${appName}`,
      '-n',
      namespace,
      '--tail=50',
    ]);
    return logs;
  } catch {
    return '';
  }
}
