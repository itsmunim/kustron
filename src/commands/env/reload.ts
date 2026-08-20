import { envDown } from './down.js'
import { envUp } from './up.js'
import { step } from '../../utils/logger.js'

export async function envReload(): Promise<void> {
  step('Reloading environment…')
  await envDown({ yes: true })
  await envUp()
}
