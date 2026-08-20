import { access, realpath, rm } from 'fs/promises'
import { resolve } from 'path'
import { tmpdir } from 'os'
import { createHash } from 'crypto'
import { error } from '../utils/logger.js'
import { t } from '../utils/i18n.js'
import { exec } from '../utils/exec.js'

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

export async function verifyGitAccess(url: string): Promise<void> {
  try {
    await exec('git', ['ls-remote', '--exit-code', url, 'HEAD'])
  } catch {
    error(t('deploy.gitAccessDenied', { url }))
    throw new Error(t('deploy.gitAccessDenied', { url }))
  }
}

export async function cloneRepo(url: string, targetDir: string): Promise<void> {
  await exec('git', ['clone', url, targetDir])
}

export async function resolveGitSource(url: string): Promise<string> {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 16)
  const targetDir = resolve(tmpdir(), `kustron-${hash}`)

  await cloneRepo(url, targetDir)

  return targetDir
}

export async function cleanupSource(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true })
}
