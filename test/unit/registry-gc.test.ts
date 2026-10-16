import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('../../src/utils/exec.js', () => ({
  exec: vi.fn(),
}));

vi.mock('../../src/utils/container-runtime.js', () => ({
  detectContainerRuntime: vi.fn(),
}));

import {exec} from '../../src/utils/exec.js';
import {detectContainerRuntime} from '../../src/utils/container-runtime.js';
import {pruneRegistry} from '../../src/core/registry-gc.js';

const mockedExec = vi.mocked(exec);
const mockedRuntime = vi.mocked(detectContainerRuntime);

describe('pruneRegistry', () => {
  beforeEach(() => {
    mockedExec.mockClear();
    mockedRuntime.mockClear();
    mockedRuntime.mockResolvedValue('docker');
  });

  it('does nothing when catalog is empty', async () => {
    mockedExec.mockResolvedValue({stdout: '', stderr: '', exitCode: 0});
    await pruneRegistry('cluster', 5000);
    expect(mockedExec).toHaveBeenCalled();
  });

  it('prunes unused images', async () => {
    let callCount = 0;
    mockedExec.mockImplementation(async (cmd, args) => {
      callCount++;
      if (args?.[1]?.includes('_catalog')) {
        return {
          stdout: JSON.stringify({repositories: ['myapp']}),
          stderr: '',
          exitCode: 0,
        };
      }
      if (args?.[1]?.includes('tags/list')) {
        return {
          stdout: JSON.stringify({tags: ['abc123']}),
          stderr: '',
          exitCode: 0,
        };
      }
      if (cmd === 'kubectl') {
        return {stdout: 'otherimage', stderr: '', exitCode: 0};
      }
      return {stdout: '', stderr: '', exitCode: 0};
    });
    await pruneRegistry('cluster', 5000);
    expect(mockedExec).toHaveBeenCalled();
  });

  it('ignores registry catalog errors', async () => {
    mockedExec.mockRejectedValue(new Error('connection refused'));
    await expect(pruneRegistry('cluster', 5000)).resolves.not.toThrow();
  });
});
