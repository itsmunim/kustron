import {describe, it, expect} from 'vitest';
import {
  buildConfigMap,
  buildSecret,
  buildDeployment,
  buildService,
  assembleManifests,
} from '../../src/core/manifest.js';
import {load} from 'js-yaml';

describe('E2E: Manifest generation', () => {
  it('generates a valid ConfigMap', () => {
    const yaml = buildConfigMap('api', 'default', {KEY: 'value'});
    const manifest = load(yaml) as Record<string, unknown>;

    expect(manifest.kind).toBe('ConfigMap');
    expect(manifest.metadata).toMatchObject({
      name: 'api',
      namespace: 'default',
    });
    expect(manifest.data).toEqual({KEY: 'value'});
  });

  it('generates a valid Secret', () => {
    const yaml = buildSecret('api', 'default', {PASSWORD: 'secret123'});
    expect(yaml).toBeTruthy();
    const manifest = load(yaml!) as Record<string, unknown>;

    expect(manifest.kind).toBe('Secret');
    expect(manifest.metadata).toMatchObject({
      name: 'api-env',
      namespace: 'default',
    });
    expect(manifest.type).toBe('Opaque');
    expect(manifest.stringData).toEqual({PASSWORD: 'secret123'});
  });

  it('generates a valid Deployment with env hash annotation', () => {
    const yaml = buildDeployment({
      name: 'api',
      namespace: 'default',
      image: 'api:v1',
      port: 3000,
      replicas: 2,
      env: {KEY: 'value'},
      expose: true,
    });
    const manifest = load(yaml) as Record<string, unknown>;

    expect(manifest.kind).toBe('Deployment');
    expect(manifest.metadata?.name).toBe('api');
    expect(manifest.spec?.replicas).toBe(2);
    expect(manifest.spec?.template?.spec?.containers?.[0]?.image).toBe(
      'api:v1',
    );
    expect(
      manifest.spec?.template?.spec?.containers?.[0]?.ports?.[0]?.containerPort,
    ).toBe(3000);
    expect(
      manifest.spec?.template?.metadata?.annotations?.['kustron.dev/env-hash'],
    ).toBeTruthy();
  });

  it('omits replicas when ha is true', () => {
    const yaml = buildDeployment({
      name: 'api',
      namespace: 'default',
      image: 'api:v1',
      port: 3000,
      replicas: 2,
      env: {},
      ha: true,
    });
    const manifest = load(yaml) as Record<string, unknown>;

    expect(manifest.spec?.replicas).toBeUndefined();
  });

  it('generates a valid Service for exposed app', () => {
    const yaml = buildService({
      name: 'api',
      namespace: 'default',
      image: 'api:v1',
      port: 3000,
      replicas: 1,
      env: {},
      expose: true,
    });
    const manifest = load(yaml) as Record<string, unknown>;

    expect(manifest.kind).toBe('Service');
    expect(manifest.spec?.type).toBe('NodePort');
    expect(manifest.spec?.ports?.[0]?.port).toBe(3000);
  });

  it('generates a ClusterIP Service for non-exposed app', () => {
    const yaml = buildService({
      name: 'api',
      namespace: 'default',
      image: 'api:v1',
      port: 3000,
      replicas: 1,
      env: {},
      expose: false,
    });
    const manifest = load(yaml) as Record<string, unknown>;

    expect(manifest.kind).toBe('Service');
    expect(manifest.spec?.type).toBe('ClusterIP');
  });

  it('assembles multiple manifests into one YAML document', () => {
    const cm = buildConfigMap('api', 'default', {KEY: 'value'});
    const deployment = buildDeployment({
      name: 'api',
      namespace: 'default',
      image: 'api:v1',
      port: 3000,
      replicas: 1,
      env: {KEY: 'value'},
    });
    const service = buildService({
      name: 'api',
      namespace: 'default',
      image: 'api:v1',
      port: 3000,
      replicas: 1,
      env: {},
      expose: true,
    });

    const combined = assembleManifests([cm, null, deployment, service]);
    const docs = combined.split('---\n').filter(Boolean);

    expect(docs).toHaveLength(3);
  });
});
