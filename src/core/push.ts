import { exec } from '../utils/exec.js'
import { info } from '../utils/logger.js'
import { t } from '../utils/i18n.js'

export const REGISTRY_HOST = 'kustron-registry:5000'
export const REGISTRY_PUSH_HOST = 'localhost:5000'

export function buildTag(appName: string, timestamp: number): string {
  return `${REGISTRY_HOST}/${appName}:${timestamp}`
}

export function buildPushTag(appName: string, timestamp: number): string {
  return `${REGISTRY_PUSH_HOST}/${appName}:${timestamp}`
}

export async function pushImage(tag: string): Promise<void> {
  info(t('deploy.pushingImage'))
  await exec('docker', ['push', tag])
}
