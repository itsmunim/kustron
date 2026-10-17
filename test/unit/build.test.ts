import {describe, it, expect, vi} from 'vitest';
import {mkdir, writeFile, rm} from 'fs/promises';
import {mkdtemp} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';

vi.mock('../../src/utils/exec.js', () => ({
  exec: vi.fn(),
}));

vi.mock('../../src/utils/container-runtime.js', () => ({
  detectContainerRuntime: vi.fn(),
}));

import {exec} from '../../src/utils/exec.js';
import {detectContainerRuntime} from '../../src/utils/container-runtime.js';
import {detectBuildStrategy, buildImage} from '../../src/core/build.js';

const mockedExec = vi.mocked(exec);
const mockedRuntime = vi.mocked(detectContainerRuntime);

describe('detectBuildStrategy', () => {
  it('returns dockerfile when Dockerfile exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kustron-build-test-'));
    await writeFile(join(dir, 'Dockerfile'), 'FROM node:20', 'utf-8');

    const strategy = await detectBuildStrategy(dir);
    expect(strategy).toBe('dockerfile');

    await rm(dir, {recursive: true});
  });

  it('returns railpack when no Dockerfile', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kustron-build-test-'));

    const strategy = await detectBuildStrategy(dir);
    expect(strategy).toBe('railpack');

    await rm(dir, {recursive: true});
  });
});

describe('buildImage', () => {
  beforeEach(() => {
    mockedRuntime.mockClear();
    mockedRuntime.mockResolvedValue('docker');
    mockedExec.mockClear();
    mockedExec.mockResolvedValue({stdout: '', stderr: '', exitCode: 0});
  });

  it('builds dockerfile image with detected runtime', async () => {
    await buildImage('/src', 'tag:latest', 'dockerfile');
    expect(mockedExec).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['build', '-t', 'tag:latest', '/src']),
    );
  });

  it('builds railpack image', async () => {
    await buildImage('/src', 'tag:latest', 'railpack');
    expect(mockedExec).toHaveBeenCalledWith(
      'railpack',
      expect.arrayContaining(['build', '/src', '--name', 'tag:latest']),
      expect.anything(),
    );
  });
});
