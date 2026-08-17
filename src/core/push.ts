import { exec } from '../utils/exec.js'
import { info } from '../utils/logger.js'
import { t } from '../utils/i18n.js'

export function tagForLocalRegistry(appName: string, version: string): string {
  return `localhost:5000/${appName}:${version}`
}

export function imageReferenceForCluster(appName: string, version: string): string {
  return `kustron-registry:5000/${appName}:${version}`
}

export async function pushImage(fullTag: string): Promise<void> {
  info(t('build.imagePush', { tag: fullTag }))
  await exec('docker', ['push', fullTag])
}
