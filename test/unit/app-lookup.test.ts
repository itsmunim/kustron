import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('../../src/core/components.js', () => ({
  expandComponents: vi.fn(),
}));

import {expandComponents} from '../../src/core/components.js';
import {resolveAppByName} from '../../src/core/app-lookup.js';
import type {EnvFile} from '../../src/types/index.js';

const mockedExpand = vi.mocked(expandComponents);

const envFile: EnvFile = {apps: []};

describe('resolveAppByName', () => {
  beforeEach(() => {
    mockedExpand.mockReset();
  });

  it('resolves a declared app under the default namespace', async () => {
    mockedExpand.mockResolvedValue({
      apps: [{name: 'api', image: 'nginx', port: 80}],
      outputs: {},
    });
    const resolved = await resolveAppByName(envFile, 'api', 'env-ns');
    expect(resolved?.app.name).toBe('api');
    expect(resolved?.deploymentName).toBe('api');
    expect(resolved?.namespace).toBe('env-ns');
  });

  it('resolves component-expanded apps by their prefixed name', async () => {
    mockedExpand.mockResolvedValue({
      apps: [{name: 'hubc-cache', port: 6379}],
      outputs: {endpoint: 'hubc-cache:6379'},
    });
    const resolved = await resolveAppByName(envFile, 'hubc-cache', 'env-ns');
    expect(resolved?.deploymentName).toBe('hubc-cache');
    expect(resolved?.app.name).toBe('hubc-cache');
  });

  it('honors per-app namespace overrides', async () => {
    mockedExpand.mockResolvedValue({
      apps: [{name: 'pg', port: 5432, namespace: 'alt-ns'}],
      outputs: {},
    });
    const resolved = await resolveAppByName(envFile, 'pg', 'env-ns');
    expect(resolved?.namespace).toBe('alt-ns');
  });

  it('uses the instance-qualified deployment name', async () => {
    mockedExpand.mockResolvedValue({
      apps: [{name: 'pg', instance: 'region-a', port: 5432}],
      outputs: {},
    });
    const resolved = await resolveAppByName(envFile, 'pg', 'env-ns');
    expect(resolved?.deploymentName).toBe('pg-region-a');
  });

  it('returns undefined for unknown apps', async () => {
    mockedExpand.mockResolvedValue({apps: [], outputs: {}});
    expect(await resolveAppByName(envFile, 'nope', 'env-ns')).toBeUndefined();
  });
});
