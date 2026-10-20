import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('../../src/core/kubectl.js', () => ({
  kubectl: vi.fn(),
}));

import {kubectl} from '../../src/core/kubectl.js';
import {getExistingNodePort, pickFreeNodePort} from '../../src/core/apply.js';

const mockedKubectl = vi.mocked(kubectl);

describe('getExistingNodePort', () => {
  beforeEach(() => {
    mockedKubectl.mockReset();
  });

  it('returns the pinned port for an existing NodePort service', async () => {
    mockedKubectl.mockResolvedValue({
      stdout: JSON.stringify({
        spec: {type: 'NodePort', ports: [{port: 3000, nodePort: 30000}]},
      }),
      stderr: '',
      exitCode: 0,
    });
    expect(await getExistingNodePort('c', 'web', 'ns')).toBe(30000);
  });

  it('ignores NodePorts outside the assigned window', async () => {
    mockedKubectl.mockResolvedValue({
      stdout: JSON.stringify({
        spec: {type: 'NodePort', ports: [{port: 3000, nodePort: 31321}]},
      }),
      stderr: '',
      exitCode: 0,
    });
    expect(await getExistingNodePort('c', 'web', 'ns')).toBeUndefined();
  });

  it('returns undefined for missing services', async () => {
    mockedKubectl.mockResolvedValue({stdout: '', stderr: '', exitCode: 1});
    expect(await getExistingNodePort('c', 'web', 'ns')).toBeUndefined();
  });

  it('returns undefined when the service is not NodePort-typed', async () => {
    mockedKubectl.mockResolvedValue({
      stdout: JSON.stringify({spec: {type: 'ClusterIP', ports: []}}),
      stderr: '',
      exitCode: 0,
    });
    expect(await getExistingNodePort('c', 'web', 'ns')).toBeUndefined();
  });
});

describe('pickFreeNodePort', () => {
  beforeEach(() => {
    mockedKubectl.mockReset();
  });

  it('skips ports already used by other services', async () => {
    mockedKubectl.mockResolvedValue({
      stdout: JSON.stringify({
        items: [
          {spec: {type: 'NodePort', ports: [{nodePort: 30000}]}},
          {spec: {type: 'NodePort', ports: [{nodePort: 30001}]}},
        ],
      }),
      stderr: '',
      exitCode: 0,
    });
    expect(await pickFreeNodePort('c')).toBe(30002);
  });

  it('falls back to an empty set when listing fails', async () => {
    mockedKubectl.mockResolvedValue({stdout: '', stderr: '', exitCode: 1});
    expect(await pickFreeNodePort('c')).toBe(30000);
  });
});
