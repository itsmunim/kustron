import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('../../src/utils/exec.js', () => ({
  exec: vi.fn(),
}));

import {exec} from '../../src/utils/exec.js';
import {
  helmInstall,
  helmUninstall,
  isHelmRelease,
  helmReleaseImage,
  createHelmExposureService,
} from '../../src/core/helm.js';
import type {AppEntry} from '../../src/types/index.js';

const mockedExec = vi.mocked(exec);

describe('createHelmExposureService', () => {
  it('returns NodePort service yaml', () => {
    const yaml = createHelmExposureService('grafana', 'default', 3000, {
      'app.kubernetes.io/name': 'grafana',
    });
    expect(yaml).toContain('kind: Service');
    expect(yaml).toContain('type: NodePort');
    expect(yaml).toContain('port: 3000');
  });
});

describe('helmInstall', () => {
  beforeEach(() => {
    mockedExec.mockClear();
    mockedExec.mockResolvedValue({stdout: '', stderr: '', exitCode: 0});
  });

  it('throws when app has no helm config', async () => {
    const app = {name: 'x'} as AppEntry;
    await expect(helmInstall(app, 'ns', 'cluster')).rejects.toThrow(
      'no helm configuration',
    );
  });

  it('installs with repo when chart is not local/OCI', async () => {
    const app: AppEntry = {
      name: 'prom',
      helm: {
        chart: 'kube-prometheus-stack',
        repo: 'https://prometheus-community.github.io/helm-charts',
      },
    };
    await helmInstall(app, 'ns', 'cluster');
    expect(mockedExec).toHaveBeenCalled();
  });

  it('skips repo add for local chart', async () => {
    const app: AppEntry = {
      name: 'local',
      helm: {chart: './charts/my-app'},
    };
    await helmInstall(app, 'ns', 'cluster');
    const calls = mockedExec.mock.calls.map((c) => c[1]?.[0]);
    expect(calls).not.toContain('repo');
  });

  it('skips repo add for OCI chart', async () => {
    const app: AppEntry = {
      name: 'oci',
      helm: {chart: 'oci://ghcr.io/org/chart'},
    };
    await helmInstall(app, 'ns', 'cluster');
    const calls = mockedExec.mock.calls.map((c) => c[1]?.[0]);
    expect(calls).not.toContain('repo');
  });

  it('passes version when provided', async () => {
    const app: AppEntry = {
      name: 'v',
      helm: {chart: 'c', repo: 'https://example.com', version: '1.0.0'},
    };
    await helmInstall(app, 'ns', 'cluster');
    const helmCalls = mockedExec.mock.calls.filter((c) => c[0] === 'helm');
    const upgradeCall = helmCalls.find((c) => c[1]?.[0] === 'upgrade');
    expect(upgradeCall?.[1]).toContain('--version');
    expect(upgradeCall?.[1]).toContain('1.0.0');
  });
});

describe('helmUninstall', () => {
  beforeEach(() => {
    mockedExec.mockClear();
    mockedExec.mockResolvedValue({stdout: '', stderr: '', exitCode: 0});
  });

  it('uninstalls release', async () => {
    await helmUninstall('app', 'ns', 'cluster');
    expect(mockedExec).toHaveBeenCalledWith(
      'helm',
      expect.arrayContaining(['uninstall', 'app']),
      undefined,
    );
  });

  it('ignores errors', async () => {
    mockedExec.mockRejectedValue(new Error('not found'));
    await expect(helmUninstall('app', 'ns', 'cluster')).resolves.not.toThrow();
  });
});

describe('isHelmRelease', () => {
  beforeEach(() => {
    mockedExec.mockClear();
  });

  it('returns true when release exists', async () => {
    mockedExec.mockResolvedValue({
      stdout: JSON.stringify([{name: 'app'}]),
      stderr: '',
      exitCode: 0,
    });
    const result = await isHelmRelease('app', 'ns', 'cluster');
    expect(result).toBe(true);
  });

  it('returns false when release is missing', async () => {
    mockedExec.mockResolvedValue({
      stdout: JSON.stringify([{name: 'other'}]),
      stderr: '',
      exitCode: 0,
    });
    const result = await isHelmRelease('app', 'ns', 'cluster');
    expect(result).toBe(false);
  });

  it('returns false on error', async () => {
    mockedExec.mockRejectedValue(new Error('fail'));
    const result = await isHelmRelease('app', 'ns', 'cluster');
    expect(result).toBe(false);
  });
});

describe('helmReleaseImage', () => {
  beforeEach(() => {
    mockedExec.mockClear();
  });

  it('returns null when no imageValues', async () => {
    const app: AppEntry = {name: 'x', helm: {chart: 'c'}};
    const result = await helmReleaseImage(app, 'ns', 'cluster');
    expect(result).toBeNull();
  });

  it('returns null when helm get values fails', async () => {
    mockedExec.mockRejectedValue(new Error('fail'));
    const app: AppEntry = {
      name: 'x',
      helm: {
        chart: 'c',
        imageValues: {repository: 'image.repo', tag: 'image.tag'},
      },
    };
    const result = await helmReleaseImage(app, 'ns', 'cluster');
    expect(result).toBeNull();
  });

  it('returns image when values resolve', async () => {
    mockedExec.mockResolvedValue({
      stdout: JSON.stringify({image: {repo: 'myimg', tag: 'v1'}}),
      stderr: '',
      exitCode: 0,
    });
    const app: AppEntry = {
      name: 'x',
      helm: {
        chart: 'c',
        imageValues: {repository: 'image.repo', tag: 'image.tag'},
      },
    };
    const result = await helmReleaseImage(app, 'ns', 'cluster');
    expect(result).toBe('myimg:v1');
  });
});
