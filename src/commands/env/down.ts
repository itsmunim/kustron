import {envDestroy} from './destroy.js';
import {warn} from '../../utils/logger.js';

export async function envDown(options: {yes?: boolean} = {}): Promise<void> {
  warn(
    '`kustron env down` is deprecated. ' +
      'Use `kustron env stop` to stop apps without destroying infrastructure. ' +
      'Use `kustron env destroy` to delete the cluster and all data.',
  );
  await envDestroy(options);
}
