import {clusterDestroy} from '../cluster/destroy.js';
import {warn} from '../../utils/logger.js';

export async function envDown(options: {yes?: boolean} = {}): Promise<void> {
  warn(
    '`kustron env down` destroys the entire cluster. ' +
    'Use `kustron env stop` to stop apps without destroying infrastructure. ' +
    'Use `kustron cluster destroy` to explicitly delete the cluster.',
  );
  await clusterDestroy(options);
}
