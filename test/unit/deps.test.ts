import {describe, it, expect} from 'vitest';
import {
  appNamespace,
  appDeploymentName,
  topoSortApps,
  interpolate,
  buildVars,
} from '../../src/core/deps.js';
import type {AppEntry} from '../../src/types/index.js';

describe('appNamespace', () => {
  it('returns app namespace override when set', () => {
    const app = {name: 'api', namespace: 'custom'} as AppEntry;
    expect(appNamespace(app, 'default')).toBe('custom');
  });

  it('falls back to default namespace', () => {
    const app = {name: 'api'} as AppEntry;
    expect(appNamespace(app, 'default')).toBe('default');
  });
});

describe('appDeploymentName', () => {
  it('returns name only when no instance', () => {
    const app = {name: 'api'} as AppEntry;
    expect(appDeploymentName(app)).toBe('api');
  });

  it('returns name-instance when instance is set', () => {
    const app = {name: 'api', instance: 'v1'} as AppEntry;
    expect(appDeploymentName(app)).toBe('api-v1');
  });
});

describe('topoSortApps', () => {
  it('returns apps in file order when no dependencies', () => {
    const apps = [
      {name: 'a'},
      {name: 'b'},
      {name: 'c'},
    ] as AppEntry[];
    const sorted = topoSortApps(apps);
    expect(sorted.map((a) => a.name)).toEqual(['a', 'b', 'c']);
  });

  it('orders dependencies before dependents', () => {
    const apps = [
      {name: 'web', dependsOn: ['api']},
      {name: 'api', dependsOn: ['db']},
      {name: 'db'},
    ] as AppEntry[];
    const sorted = topoSortApps(apps);
    const names = sorted.map((a) => a.name);
    expect(names.indexOf('db')).toBeLessThan(names.indexOf('api'));
    expect(names.indexOf('api')).toBeLessThan(names.indexOf('web'));
  });

  it('detects circular dependencies', () => {
    const apps = [
      {name: 'a', dependsOn: ['b']},
      {name: 'b', dependsOn: ['a']},
    ] as AppEntry[];
    expect(() => topoSortApps(apps)).toThrow('Circular dependsOn detected');
  });

  it('throws on missing dependency', () => {
    const apps = [{name: 'a', dependsOn: ['missing']}] as AppEntry[];
    expect(() => topoSortApps(apps)).toThrow("dependsOn 'missing' which is not defined");
  });

  it('handles instance-qualified names', () => {
    const apps = [
      {name: 'kafka', instance: 'primary'},
      {name: 'app', dependsOn: ['kafka-primary']},
    ] as AppEntry[];
    const sorted = topoSortApps(apps);
    expect(sorted.map((a) => appDeploymentName(a))).toEqual([
      'kafka-primary',
      'app',
    ]);
  });
});

describe('interpolate', () => {
  it('replaces known variables', () => {
    expect(interpolate('hello ${name}', {name: 'world'})).toBe('hello world');
  });

  it('leaves unknown variables as-is', () => {
    expect(interpolate('hello ${unknown}', {})).toBe('hello ${unknown}');
  });

  it('replaces multiple variables', () => {
    expect(
      interpolate('${a} and ${b}', {a: 'foo', b: 'bar'}),
    ).toBe('foo and bar');
  });

  it('falls back to process.env for unknown vars', () => {
    process.env.TEST_VAR = 'from_env';
    expect(interpolate('${TEST_VAR}', {})).toBe('from_env');
    delete process.env.TEST_VAR;
  });

  it('handles dotted variable names', () => {
    expect(
      interpolate('${app.endpoint}', {'app.endpoint': 'api:3000'}),
    ).toBe('api:3000');
  });
});

describe('buildVars', () => {
  it('includes process.env variables', () => {
    process.env.BUILDVARS_TEST = 'value';
    const vars = buildVars([], 'default');
    expect(vars.BUILDVARS_TEST).toBe('value');
    delete process.env.BUILDVARS_TEST;
  });

  it('builds app references', () => {
    const apps = [{name: 'api', port: 3000}] as AppEntry[];
    const vars = buildVars(apps, 'ns');
    expect(vars['api.name']).toBe('api');
    expect(vars['api.namespace']).toBe('ns');
    expect(vars['api.port']).toBe('3000');
    expect(vars['api.endpoint']).toBe('api:3000');
  });

  it('uses instance-qualified name', () => {
    const apps = [{name: 'api', instance: 'v1', port: 3000}] as AppEntry[];
    const vars = buildVars(apps, 'ns');
    expect(vars['api.name']).toBe('api-v1');
    expect(vars['api.endpoint']).toBe('api-v1:3000');
  });
});
