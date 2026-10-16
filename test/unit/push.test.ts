import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('../../src/utils/container-runtime.js', () => ({
  detectContainerRuntime: vi.fn(),
}));

vi.mock('../../src/utils/exec.js', () => ({
  exec: vi.fn(),
}));

import {detectContainerRuntime} from '../../src/utils/container-runtime.js';
import {exec} from '../../src/utils/exec.js';
import {
  buildTag,
  buildPushTag,
  getRegistryPushHost,
  REGISTRY_HOST,
  pushImage,
} from '../../src/core/push.js';

const mockedRuntime = vi.mocked(detectContainerRuntime);
const mockedExec = vi.mocked(exec);

describe('push', () => {
  it('REGISTRY_HOST is the in-cluster registry address', () => {
    expect(REGISTRY_HOST).toBe('kustron-registry:5000');
  });

  it('getRegistryPushHost returns localhost with port', () => {
    expect(getRegistryPushHost(5000)).toBe('localhost:5000');
    expect(getRegistryPushHost(5001)).toBe('localhost:5001');
  });

  it('buildTag creates in-cluster tag', () => {
    expect(buildTag('api', 'abc123')).toBe('kustron-registry:5000/api:abc123');
  });

  it('buildPushTag creates localhost push tag', () => {
    expect(buildPushTag('api', 'abc123', 5000)).toBe(
      'localhost:5000/api:abc123',
    );
  });
});

describe('pushImage', () => {
  beforeEach(() => {
    mockedRuntime.mockClear();
    mockedExec.mockClear();
    mockedExec.mockResolvedValue({stdout: '', stderr: '', exitCode: 0});
  });

  it('pushes with docker runtime', async () => {
    mockedRuntime.mockResolvedValue('docker');
    await pushImage('localhost:5000/img:tag');
    expect(mockedExec).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['push', 'localhost:5000/img:tag']),
    );
  });

  it('adds --tls-verify=false for podman localhost', async () => {
    mockedRuntime.mockResolvedValue('podman');
    await pushImage('localhost:5000/img:tag', 'localhost:5000');
    expect(mockedExec).toHaveBeenCalledWith(
      'podman',
      expect.arrayContaining([
        'push',
        'localhost:5000/img:tag',
        '--tls-verify=false',
      ]),
    );
  });
});
