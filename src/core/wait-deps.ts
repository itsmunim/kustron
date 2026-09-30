import {exec} from '../utils/exec.js';
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
import type {WaitConfig} from '../types/index.js';

const DEFAULT_POLL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 180_000;

/**
 * Wait for a dependency to be ready per the configured wait mode (idea 3):
 *   - rollout    (default): deployment available, same logic as waitForRollout
 *   - established:          `kubectl wait --for=condition=established` — for CRDs
 *   - command:              run a shell command (exit 0 = ready), e.g. pg_isready
 */
export async function waitForDependency(
  appName: string,
  namespace: string,
  wait: WaitConfig | undefined,
): Promise<void> {
  const type = wait?.type ?? 'rollout';
  const timeoutMs = DEFAULT_TIMEOUT_MS;

  switch (type) {
    case 'established': {
      await exec(
        'kubectl',
        [
          'wait',
          '--for=condition=established',
          `crd/${appName}`,
          '-n',
          namespace,
          '--timeout=180s',
        ],
        {reject: false} as Record<string, unknown>,
      );
      return;
    }

    case 'command': {
      const command = wait?.command ?? '';
      if (!command) {
        throw new Error(`App '${appName}' wait.type=command requires wait.command`);
      }
      const deadline = Date.now() + timeoutMs;
      // shell via 'sh -c' so pipes/redirects work
      while (Date.now() < deadline) {
        const result = await exec('sh', ['-c', command], {
          silent: true,
          reject: false,
        } as Record<string, unknown>);
        if (result.exitCode === 0) return;
        await sleep(DEFAULT_POLL_MS);
      }
      throw new Error(`Dependency '${appName}' did not become ready: ${command}`);
    }

    case 'rollout':
    default: {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const {stdout} = await exec(
          'kubectl',
          [
            'get',
            'deployment',
            appName,
            '-n',
            namespace,
            '-o',
            'jsonpath={.status.availableReplicas}/{.spec.replicas}',
          ],
          {silent: true, reject: false} as Record<string, unknown>,
        );
        const [available, desired] = stdout.split('/').map((s) => parseInt(s.trim(), 10));
        if (Number.isFinite(available) && available >= (desired ?? 1)) return;
        await sleep(DEFAULT_POLL_MS);
      }
      throw new Error(`Dependency '${appName}' rollout did not complete in time`);
    }
  }
}