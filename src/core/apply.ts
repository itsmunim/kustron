import { exec } from '../utils/exec.js'
import { info } from '../utils/logger.js'
import { t } from '../utils/i18n.js'

export async function applyManifests(yaml: string): Promise<void> {
  info(t('deploy.applyingManifests'))
  await exec('kubectl', ['apply', '-f', '-'], { input: yaml })
}

export async function deleteApp(name: string): Promise<void> {
  await exec('kubectl', ['delete', 'namespace', name, '--ignore-not-found'])
}

export async function waitForRollout(namespace: string, deployment: string): Promise<void> {
  info(t('deploy.waitingRollout'))
  await exec('kubectl', ['rollout', 'status', 'deployment', deployment, '-n', namespace, '--timeout=5m'])
}

export async function getServiceNodePort(namespace: string, service: string): Promise<string | null> {
  try {
    const { stdout } = await exec('kubectl', [
      'get',
      'service',
      service,
      '-n',
      namespace,
      '-o',
      'jsonpath={.spec.ports[0].nodePort}',
    ])
    return stdout.trim() || null
  } catch {
    return null
  }
}
