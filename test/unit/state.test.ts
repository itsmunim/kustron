import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {rm, access, mkdir, writeFile} from 'fs/promises';
import {join} from 'path';
import {recordDeployedApps, pruneRemovedApps} from '../../src/core/state.js';
import type {AppEntry} from '../../src/types/index.js';

vi.mock('../../src/utils/exec.js', () => ({
  exec: vi.fn(),
}));

import {exec} from '../../src/utils/exec.js';
const mockedExec = vi.mocked(exec);

const STATE_DIR = '.kustron';

describe('state', () => {
  beforeEach(async () => {
    await mkdir(STATE_DIR, {recursive: true});
    try {
      await rm(join(STATE_DIR, 'state.json'));
    } catch {
      // ignore
    }
  });

  afterEach(async () => {
    try {
      await rm(join(STATE_DIR, 'state.json'));
    } catch {
      // ignore
    }
  });

  it('recordDeployedApps writes state file', async () => {
    const apps = [{name: 'api'}, {name: 'redis'}] as AppEntry[];
    await recordDeployedApps(apps, 'default');

    await access(join(STATE_DIR, 'state.json'));
  });

  it('recordDeployedApps writes correct content', async () => {
    const apps = [
      {name: 'api', namespace: 'custom'},
      {name: 'redis'},
    ] as AppEntry[];
    await recordDeployedApps(apps, 'default');

    const {readFile} = await import('fs/promises');
    const raw = await readFile(join(STATE_DIR, 'state.json'), 'utf-8');
    const state = JSON.parse(raw);
    expect(state.apps).toHaveLength(2);
    expect(state.apps[0].namespace).toBe('custom');
    expect(state.apps[1].namespace).toBe('default');
  });
});

describe('pruneRemovedApps', () => {
  beforeEach(async () => {
    mockedExec.mockClear();
    mockedExec.mockResolvedValue({stdout: '', stderr: '', exitCode: 0});
    await mkdir(STATE_DIR, {recursive: true});
  });

  afterEach(async () => {
    try {
      await rm(join(STATE_DIR, 'state.json'));
    } catch {
      // ignore
    }
  });

  it('deletes non-helm app removed from env', async () => {
    await writeFile(
      join(STATE_DIR, 'state.json'),
      JSON.stringify({apps: [{name: 'old-app', namespace: 'ns'}]}),
      'utf-8',
    );
    await pruneRemovedApps([], 'ns', 'cluster');
    expect(mockedExec).toHaveBeenCalled();
  });

  it('uninstalls helm app removed from env', async () => {
    await writeFile(
      join(STATE_DIR, 'state.json'),
      JSON.stringify({apps: [{name: 'old-helm', namespace: 'ns', helm: true}]}),
      'utf-8',
    );
    await pruneRemovedApps([], 'ns', 'cluster');
    expect(mockedExec).toHaveBeenCalledWith(
      'helm',
      expect.arrayContaining(['uninstall', 'old-helm']),
      undefined,
    );
  });

  it('ignores cleanup errors', async () => {
    mockedExec.mockRejectedValue(new Error('fail'));
    await writeFile(
      join(STATE_DIR, 'state.json'),
      JSON.stringify({apps: [{name: 'old-app', namespace: 'ns'}]}),
      'utf-8',
    );
    await expect(pruneRemovedApps([], 'ns', 'cluster')).resolves.not.toThrow();
  });
});
