import { readFile, writeFile } from 'fs/promises'
import { load, dump } from 'js-yaml'
import { error, success } from '../../utils/logger.js'
import { t } from '../../utils/i18n.js'

export async function appsRemove(name: string): Promise<void> {
  const filePath = './kustron-env.yaml'
  const content = await readFile(filePath, 'utf-8')
  const parsed = load(content) as { apps?: Array<{ name: string }> }

  const idx = parsed.apps?.findIndex((a) => a.name === name)
  if (idx === undefined || idx === -1) {
    error(t('apps.remove.notFound', { name }))
    process.exit(1)
  }

  const raw = load(content) as Record<string, unknown>
  const appsRaw = (raw.apps as unknown[]) ?? []
  appsRaw.splice(idx, 1)
  raw.apps = appsRaw

  await writeFile(filePath, dump(raw))

  success(t('apps.remove.success', { name }))
  console.log(t('apps.remove.reloadHint'))
}
