import {envStop} from './stop.js';
import {envUp} from './up.js';
import {step} from '../../utils/logger.js';

export async function envReload(): Promise<void> {
  step('Reloading environment…');
  await envStop();
  await envUp();
}
