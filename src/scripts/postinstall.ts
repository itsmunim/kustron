import {checkAll} from '../utils/checks.js';

async function main(): Promise<void> {
  try {
    await checkAll(['container-runtime', 'k3d', 'kubectl'], ['railpack', 'git', 'helm', 'docker']);
  } catch {
    // postinstall should never hard-crash npm install
  }
}

main();
