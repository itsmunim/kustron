import { readFile, writeFile } from 'fs/promises'
import { load, dump } from 'js-yaml'
import { error, success } from '../../utils/logger.js'
import { t } from '../../utils/i18n.js'
import type { AppEntry } from '../../types/index.js'

export interface AddOptions {
  name: string
  source?: string
  image?: string
  helmChart?: string
  helmRepo?: string
  helmVersion?: string
  port?: number
  healthcheck?: string
  exposed?: boolean
  replicas?: number
  ha?: boolean
  env?: string[]
}

export async function appsAdd(options: AddOptions): Promise<void> {
  const hasSource = !!options.source
  const hasImage = !!options.image
  const hasHelm = !!options.helmChart

  if ([hasSource, hasImage, hasHelm].filter(Boolean).length !== 1) {
    error(t('apps.add.exactlyOneSource'))
    process.exit(1)
  }

  if ((hasSource || hasImage) && options.port === undefined) {
    error(t('apps.add.portRequired'))
    process.exit(1)
  }

  const filePath = './kustron-env.yaml'
  const content = await readFile(filePath, 'utf-8')
  const parsed = load(content) as { apps?: Array<{ name: string }> }

  if (parsed.apps?.some((a) => a.name === options.name)) {
    error(t('apps.add.duplicateName', { name: options.name }))
    process.exit(1)
  }

  const env: Record<string, string> = {}
  if (options.env) {
    for (const e of options.env) {
      const [key, value] = e.split('=')
      if (key && value !== undefined) {
        env[key] = value
      }
    }
  }

  const entry: AppEntry = {
    name: options.name,
    port: options.port,
    healthcheck: options.healthcheck,
    exposed: options.exposed ?? false,
    replicas: options.replicas,
    ha: options.ha ?? false,
    env: Object.keys(env).length > 0 ? env : undefined,
  }

  if (hasSource) entry.source = options.source
  if (hasImage) entry.image = options.image
  if (hasHelm) {
    entry.helm = {
      chart: options.helmChart!,
      repo: options.helmRepo,
      version: options.helmVersion,
    }
  }

  const raw = load(content) as Record<string, unknown>
  const appsRaw = (raw.apps as unknown[]) ?? []
  appsRaw.push(entry as unknown as Record<string, unknown>)
  raw.apps = appsRaw
  await writeFile(filePath, dump(raw))

  success(t('apps.add.success', { name: options.name }))
  console.log(t('apps.add.reloadHint'))
}
