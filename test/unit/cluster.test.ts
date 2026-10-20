import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('../../src/utils/exec.js', () => ({
  exec: vi.fn(),
}));

vi.mock('../../src/utils/container-runtime.js', () => ({
  getDockerHostEnv: vi.fn().mockResolvedValue({}),
  getRuntimeCommand: vi.fn().mockResolvedValue('docker'),
}));

import {exec} from '../../src/utils/exec.js';
import {
  getK3dNodeIp,
  clusterExists,
  isClusterRunning,
  startCluster,
  deleteCluster,
  createCluster,
  ensureRegistry,
  registryName,
  discoverRegistryPort,
} from '../../src/core/cluster.js';

const mockedExec = vi.mocked(exec);

describe('getK3dNodeIp', () => {
  it('returns null', async () => {
    expect(await getK3dNodeIp('cluster')).toBeNull();
  });
});

describe('clusterExists', () => {
  beforeEach(() => {
    mockedExec.mockClear();
  });

  it('returns true when cluster is listed', async () => {
    mockedExec.mockResolvedValue({
      stdout: JSON.stringify([
        {name: 'kustron', serversRunning: 1, serversCount: 1},
      ]),
      stderr: '',
      exitCode: 0,
    });
    const result = await clusterExists('kustron');
    expect(result).toBe(true);
  });

  it('returns false when cluster is missing', async () => {
    mockedExec.mockResolvedValue({
      stdout: JSON.stringify([
        {name: 'other', serversRunning: 1, serversCount: 1},
      ]),
      stderr: '',
      exitCode: 0,
    });
    const result = await clusterExists('kustron');
    expect(result).toBe(false);
  });

  it('returns false on error', async () => {
    mockedExec.mockRejectedValue(new Error('fail'));
    const result = await clusterExists('kustron');
    expect(result).toBe(false);
  });
});

describe('isClusterRunning', () => {
  beforeEach(() => {
    mockedExec.mockClear();
  });

  it('returns true when servers are running', async () => {
    mockedExec.mockResolvedValue({
      stdout: JSON.stringify([
        {name: 'kustron', serversRunning: 1, serversCount: 1},
      ]),
      stderr: '',
      exitCode: 0,
    });
    const result = await isClusterRunning('kustron');
    expect(result).toBe(true);
  });

  it('returns false when no servers running', async () => {
    mockedExec.mockResolvedValue({
      stdout: JSON.stringify([
        {name: 'kustron', serversRunning: 0, serversCount: 1},
      ]),
      stderr: '',
      exitCode: 0,
    });
    const result = await isClusterRunning('kustron');
    expect(result).toBe(false);
  });
});

describe('startCluster', () => {
  beforeEach(() => {
    mockedExec.mockClear();
    mockedExec.mockResolvedValue({stdout: '', stderr: '', exitCode: 0});
  });

  it('starts the named cluster', async () => {
    await startCluster('my-cluster');
    expect(mockedExec).toHaveBeenCalledWith(
      'k3d',
      expect.arrayContaining(['cluster', 'start', 'my-cluster']),
      expect.anything(),
    );
  });
});

describe('deleteCluster', () => {
  beforeEach(() => {
    mockedExec.mockClear();
    mockedExec.mockResolvedValue({stdout: '', stderr: '', exitCode: 0});
  });

  it('deletes the named cluster', async () => {
    await deleteCluster('my-cluster');
    expect(mockedExec).toHaveBeenCalledWith(
      'k3d',
      expect.arrayContaining(['cluster', 'delete', 'my-cluster']),
      expect.anything(),
    );
  });
});

describe('createCluster', () => {
  beforeEach(() => {
    mockedExec.mockClear();
    mockedExec.mockResolvedValue({stdout: '', stderr: '', exitCode: 0});
  });

  it('creates cluster with k3d', async () => {
    await createCluster({name: 'test', registryPort: 5000});
    expect(mockedExec).toHaveBeenCalledWith(
      'k3d',
      expect.arrayContaining(['cluster', 'create', 'test']),
      expect.anything(),
    );
  });
});

describe('ensureRegistry', () => {
  beforeEach(() => {
    mockedExec.mockClear();
  });

  it('returns early when registry exists', async () => {
    mockedExec.mockResolvedValue({
      stdout: JSON.stringify([{name: 'cluster-registry'}]),
      stderr: '',
      exitCode: 0,
    });
    await ensureRegistry('cluster', 5000);
    const createCalls = mockedExec.mock.calls.filter((c) =>
      (c[1] as string[])?.includes('create'),
    );
    expect(createCalls).toHaveLength(0);
  });

  it('creates registry when missing', async () => {
    mockedExec.mockImplementation(async (cmd, args) => {
      if (
        (args as string[])?.[0] === 'registry' &&
        (args as string[])?.[1] === 'list'
      ) {
        return {stdout: JSON.stringify([]), stderr: '', exitCode: 0};
      }
      return {stdout: '', stderr: '', exitCode: 0};
    });
    await ensureRegistry('cluster', 5000);
    expect(mockedExec).toHaveBeenCalledWith(
      'k3d',
      expect.arrayContaining(['registry', 'create']),
      expect.anything(),
    );
  });
});

describe('registryName', () => {
  it('keeps kustron-registry for the default cluster', () => {
    expect(registryName()).toBe('kustron-registry');
    expect(registryName('kustron')).toBe('kustron-registry');
  });

  it('scopes the registry name to non-default clusters', () => {
    expect(registryName('ktverify')).toBe('ktverify-registry');
  });
});

describe('discoverRegistryPort', () => {
  beforeEach(() => {
    mockedExec.mockClear();
  });

  it('reads the published host port from container inspect', async () => {
    mockedExec.mockResolvedValue({
      stdout: JSON.stringify({
        '5000/tcp': [{HostIp: '127.0.0.1', HostPort: '5001'}],
      }),
      stderr: '',
      exitCode: 0,
    });
    expect(await discoverRegistryPort('ktverify')).toBe(5001);
  });

  it('returns undefined when the registry container is missing', async () => {
    mockedExec.mockResolvedValue({
      stdout: '',
      stderr: 'No such object',
      exitCode: 1,
    });
    expect(await discoverRegistryPort('ktverify')).toBeUndefined();
  });

  it('returns undefined on malformed inspect output', async () => {
    mockedExec.mockResolvedValue({stdout: 'not-json', stderr: '', exitCode: 0});
    expect(await discoverRegistryPort('ktverify')).toBeUndefined();
  });
});
