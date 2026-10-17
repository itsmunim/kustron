import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('../../src/utils/exec.js', () => ({
  exec: vi.fn(),
}));

vi.mock('../../src/utils/container-runtime.js', () => ({
  detectContainerRuntime: vi.fn().mockResolvedValue('docker'),
}));

import {exec} from '../../src/utils/exec.js';
import {detectContainerRuntime} from '../../src/utils/container-runtime.js';
import {
  ensurePullSecret,
  importImagesToCluster,
  registryLogin,
} from '../../src/core/registry.js';
import type {AppEntry} from '../../src/types/index.js';

const mockedExec = vi.mocked(exec);
const mockedRuntime = vi.mocked(detectContainerRuntime);

describe('ensurePullSecret', () => {
  beforeEach(() => {
    mockedExec.mockClear();
    mockedExec.mockResolvedValue({stdout: '', stderr: '', exitCode: 0});
  });

  it('returns undefined when no registry', async () => {
    const app: AppEntry = {name: 'app'};
    const result = await ensurePullSecret(app, 'ns', 'cluster');
    expect(result).toBeUndefined();
  });

  it('returns undefined when registry lacks server', async () => {
    const app: AppEntry = {name: 'app', registry: {username: 'u'}};
    const result = await ensurePullSecret(app, 'ns', 'cluster');
    expect(result).toBeUndefined();
  });

  it('returns undefined when registry lacks username', async () => {
    const app: AppEntry = {name: 'app', registry: {server: 's'}};
    const result = await ensurePullSecret(app, 'ns', 'cluster');
    expect(result).toBeUndefined();
  });

  it('creates secret name when registry is complete', async () => {
    mockedExec.mockImplementation(async (cmd, args) => {
      if (args?.[0] === 'create') {
        return {stdout: 'yaml-output', stderr: '', exitCode: 0};
      }
      return {stdout: '', stderr: '', exitCode: 0};
    });
    const app: AppEntry = {
      name: 'app',
      registry: {server: 'https://reg.io', username: 'u', password: 'p'},
    };
    const result = await ensurePullSecret(app, 'ns', 'cluster');
    expect(result).toBe('app-registry-creds');
  });
});

describe('importImagesToCluster', () => {
  beforeEach(() => {
    mockedExec.mockClear();
    mockedExec.mockResolvedValue({stdout: '', stderr: '', exitCode: 0});
  });

  it('errors when no images provided', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await importImagesToCluster([], 'cluster');
    expect(mockedExec).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('imports each image', async () => {
    await importImagesToCluster(['img:1', 'img:2'], 'cluster');
    expect(mockedExec).toHaveBeenCalledTimes(2);
  });
});

describe('registryLogin', () => {
  beforeEach(() => {
    mockedExec.mockClear();
    mockedExec.mockResolvedValue({stdout: '', stderr: '', exitCode: 0});
  });

  it('calls docker login with credentials', async () => {
    await registryLogin('https://reg.io', 'user', 'pass');
    expect(mockedExec).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['login', 'https://reg.io']),
    );
  });
});
