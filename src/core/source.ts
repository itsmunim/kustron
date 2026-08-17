import { access, realpath } from 'fs/promises'
import { resolve } from 'path'
import { error } from '../utils/logger.js'
import { t } from '../utils/i18n.js'

export async function resolveLocalSource(input: string): Promise<string> {
  const absolutePath = resolve(input)

  try {
    await access(absolutePath)
  } catch {
    error(t('deploy.sourceNotFound', { path: absolutePath }))
    throw new Error(t('deploy.sourceNotFound', { path: absolutePath }))
  }

  return realpath(absolutePath)
}

export function isGitUrl(input: string): boolean {
  return input.startsWith('git@') || input.startsWith('https://') || input.endsWith('.git')
}
