import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('../../src/utils/exec.js', () => ({
  exec: vi.fn(),
}));

import {exec} from '../../src/utils/exec.js';
import {
  mergeKubeconfig,
  deleteContext,
  getCurrentContext,
} from '../../src/core/context.js';

const mockedExec = vi.mocked(exec);

describe('context', () => {
  beforeEach(() => {
    mockedExec.mockClear();
  });

  it('mergeKubeconfig calls k3d', async () => {
    mockedExec.mockResolvedValue({stdout: '', stderr: '', exitCode: 0});
    await mergeKubeconfig('my-cluster');
    expect(mockedExec).toHaveBeenCalledWith(
      'k3d',
      expect.arrayContaining(['kubeconfig', 'merge', 'my-cluster']),
    );
  });

  it('deleteContext ignores missing context', async () => {
    mockedExec.mockRejectedValue(new Error('not found'));
    await expect(deleteContext('my-cluster')).resolves.not.toThrow();
  });

  it('getCurrentContext returns stdout on success', async () => {
    mockedExec.mockResolvedValue({
      stdout: 'k3d-test\n',
      stderr: '',
      exitCode: 0,
    });
    const result = await getCurrentContext();
    expect(result).toBe('k3d-test');
  });

  it('getCurrentContext returns null on error', async () => {
    mockedExec.mockRejectedValue(new Error('no context'));
    const result = await getCurrentContext();
    expect(result).toBeNull();
  });
});
