import { access } from 'fs/promises'
import { basename } from 'path'
import { error, success } from '../../utils/logger.js'
import { t } from '../../utils/i18n.js'
import { createEnvFile } from '../../core/env-file.js'

function toKebabCase(str: string): string {
  return str
    .replace(/[\s_.]+/g, '-')
    .toLowerCase()
}

export async function envInit(): Promise<void> {
  const filePath = './kustron-env.yaml'

  try {
    await access(filePath)
    error(t('env.init.alreadyExists'))
    process.exit(1)
  } catch {
    // file does not exist, proceed
  }

  const folderName = basename(process.cwd())
  const appName = toKebabCase(folderName)

  await createEnvFile(filePath, {
    name: appName,
    source: './',
    port: 'PORT',
    exposed: false,
  })

  success(t('env.init.created', { file: filePath }))
  info(t('env.init.nextStep'))
}

function info(message: string): void {
  console.log(message)
}
