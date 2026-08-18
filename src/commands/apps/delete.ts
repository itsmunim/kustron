import { exec } from '../../utils/exec.js'
import { success, error, info } from '../../utils/logger.js'
import { t } from '../../utils/i18n.js'
import { KUSTON_CONTEXT } from '../../core/context.js'
import { createInterface } from 'readline'

export async function appsDelete(name: string): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const answer = await new Promise<string>((resolve) => {
    rl.question(t('apps.deleteConfirm', { name }), (ans) => {
      resolve(ans.trim().toLowerCase())
    })
  })
  rl.close()

  if (answer !== 'y' && answer !== 'yes') {
    info(t('apps.deleteCancelled'))
    return
  }

  try {
    await exec('kubectl', ['--context', KUSTON_CONTEXT, 'delete', 'namespace', name, '--ignore-not-found'])
    success(t('apps.deleteSuccess', { name }))
  } catch {
    error(t('apps.deleteFailed', { name }))
  }
}
