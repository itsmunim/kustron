import { exec } from '../utils/exec.js'
import { error, info } from '../utils/logger.js'
import { t } from '../utils/i18n.js'

export async function ensureNamespace(namespace: string): Promise<void> {
  try {
    await exec('kubectl', ['get', 'namespace', namespace])
  } catch {
    await exec('kubectl', ['create', 'namespace', namespace])
  }
}

export async function applyManifests(yaml: string): Promise<void> {
  info(t('deploy.applyingManifests'))
  await exec('kubectl', ['apply', '-f', '-'], { input: yaml })
}

export async function deleteApp(appName: string, namespace: string): Promise<void> {
  try {
    await exec('kubectl', ['delete', 'all,configmap', '-l', `app.kubernetes.io/name=${appName}`, '-n', namespace])
  } catch {
    // ignore cleanup errors
  }
}

export async function waitForRollout(appName: string, namespace: string): Promise<void> {
  info(t('deploy.waitingRollout'))
  await exec('kubectl', [
    'rollout',
    'status',
    'deployment',
    appName,
    '-n',
    namespace,
    '--timeout=120s',
  ])
}

export async function getPodDebugInfo(appName: string, namespace: string): Promise<string> {
  try {
    const { stdout: describe } = await exec('kubectl', [
      'describe', 'pod',
      '-l', `app.kubernetes.io/name=${appName}`,
      '-n', namespace,
    ])
    return describe
  } catch {
    return ''
  }
}

export async function getPodLogs(appName: string, namespace: string): Promise<string> {
  try {
    const { stdout: logs } = await exec('kubectl', [
      'logs',
      '-l', `app.kubernetes.io/name=${appName}`,
      '-n', namespace,
      '--tail=50',
    ])
    return logs
  } catch {
    return ''
  }
}
