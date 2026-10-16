import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import {execa} from 'execa';
import {checkDependency, checkAll} from '../../src/utils/checks.js';

const mockedExeca = vi.mocked(execa);

describe('checkDependency', () => {
  beforeEach(() => {
    mockedExeca.mockClear();
  });

  it('returns present=true for installed command', async () => {
    mockedExeca.mockResolvedValue({exitCode: 0} as never);
    const result = await checkDependency('k3d');
    expect(result.present).toBe(true);
    expect(mockedExeca).toHaveBeenCalledWith('which', ['k3d'], {
      reject: false,
    });
  });

  it('returns present=false for missing command', async () => {
    mockedExeca.mockResolvedValue({exitCode: 1} as never);
    const result = await checkDependency('railpack');
    expect(result.present).toBe(false);
  });

  it('returns present=false for unknown dependency', async () => {
    const result = await checkDependency('unknown-tool');
    expect(result.present).toBe(false);
  });

  it('checks podman for container-runtime', async () => {
    mockedExeca.mockImplementation(async (cmd: string) => {
      if (cmd === 'which') return {exitCode: 0} as never;
      return {exitCode: 1} as never;
    });
    const result = await checkDependency('container-runtime');
    expect(result.present).toBe(true);
  });

  it('checks docker when podman missing for container-runtime', async () => {
    let calls = 0;
    mockedExeca.mockImplementation(async () => {
      calls++;
      return {exitCode: calls === 1 ? 1 : 0} as never;
    });
    const result = await checkDependency('container-runtime');
    expect(result.present).toBe(true);
  });
});

describe('checkAll', () => {
  beforeEach(() => {
    mockedExeca.mockClear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('throws when required dependency is missing', async () => {
    mockedExeca.mockResolvedValue({exitCode: 1} as never);
    await expect(checkAll(['k3d'], [])).rejects.toThrow();
  });

  it('warns when optional dependency is missing', async () => {
    mockedExeca.mockResolvedValue({exitCode: 0} as never);
    await expect(checkAll(['k3d'], ['helm'])).resolves.not.toThrow();
  });
});
