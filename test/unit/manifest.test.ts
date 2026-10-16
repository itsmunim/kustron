import {describe, it, expect} from 'vitest';
import {
  buildConfigMap,
  buildSecret,
  buildDeployment,
  buildService,
  buildHPA,
  assembleManifests,
} from '../../src/core/manifest.js';
import type {ManifestOptions} from '../../src/core/manifest.js';

const baseOpts: ManifestOptions = {
  name: 'api',
  namespace: 'default',
  image: 'test:latest',
  port: 3000,
  replicas: 1,
  env: {NODE_ENV: 'production'},
  expose: false,
};

describe('buildConfigMap', () => {
  it('returns null when env is empty', () => {
    expect(buildConfigMap('app', 'ns', {})).toBeNull();
  });

  it('returns yaml with env data', () => {
    const yaml = buildConfigMap('app', 'ns', {KEY: 'val'});
    expect(yaml).toContain('kind: ConfigMap');
    expect(yaml).toContain('KEY: val');
  });
});

describe('buildSecret', () => {
  it('returns null when secret is empty', () => {
    expect(buildSecret('app', 'ns', {})).toBeNull();
  });

  it('returns yaml with stringData', () => {
    const yaml = buildSecret('app', 'ns', {PWD: 'secret'});
    expect(yaml).toContain('kind: Secret');
    expect(yaml).toContain('PWD: secret');
  });
});

describe('buildDeployment', () => {
  it('includes replicas when ha is false', () => {
    const yaml = buildDeployment(baseOpts);
    expect(yaml).toContain('replicas: 1');
  });

  it('omits replicas when ha is true', () => {
    const yaml = buildDeployment({...baseOpts, ha: true});
    expect(yaml).not.toContain('replicas:');
  });

  it('includes command when provided', () => {
    const yaml = buildDeployment({...baseOpts, command: ['sh', '-c']});
    expect(yaml).toContain('command:');
    expect(yaml).toContain('sh');
  });

  it('includes args when provided', () => {
    const yaml = buildDeployment({...baseOpts, args: ['--port', '3000']});
    expect(yaml).toContain('args:');
  });

  it('includes custom resources when provided', () => {
    const yaml = buildDeployment({
      ...baseOpts,
      resources: {limits: {cpu: '1', memory: '1Gi'}},
    });
    expect(yaml).toContain('cpu: 1');
    expect(yaml).toContain('memory: 1Gi');
  });

  it('applies patch when provided', () => {
    const yaml = buildDeployment({
      ...baseOpts,
      patch: {metadata: {annotations: {team: 'platform'}}},
    });
    expect(yaml).toContain('team: platform');
  });

  it('includes imagePullSecrets when provided', () => {
    const yaml = buildDeployment({
      ...baseOpts,
      imagePullSecrets: ['reg-cred'],
    });
    expect(yaml).toContain('imagePullSecrets:');
    expect(yaml).toContain('name: reg-cred');
  });

  it('has no probes when healthcheck is omitted', () => {
    const yaml = buildDeployment(baseOpts);
    expect(yaml).not.toContain('startupProbe');
    expect(yaml).not.toContain('readinessProbe');
  });

  it('uses tcpSocket probe for tcp healthcheck', () => {
    const yaml = buildDeployment({...baseOpts, healthcheck: 'tcp'});
    expect(yaml).toContain('tcpSocket:');
    expect(yaml).toContain('startupProbe:');
  });

  it('uses httpGet probe for path healthcheck', () => {
    const yaml = buildDeployment({...baseOpts, healthcheck: '/health'});
    expect(yaml).toContain('httpGet:');
    expect(yaml).toContain('path: /health');
  });

  it('has no probes when healthcheck is none', () => {
    const yaml = buildDeployment({...baseOpts, healthcheck: 'none'});
    expect(yaml).not.toContain('startupProbe');
  });

  it('includes envFrom when env and secret exist', () => {
    const yaml = buildDeployment({...baseOpts, secret: {PWD: 'x'}});
    expect(yaml).toContain('envFrom:');
    expect(yaml).toContain('configMapRef:');
    expect(yaml).toContain('secretRef:');
  });

  it('includes only configMapRef when no secret', () => {
    const yaml = buildDeployment(baseOpts);
    expect(yaml).toContain('envFrom:');
    expect(yaml).toContain('configMapRef:');
    expect(yaml).not.toContain('secretRef:');
  });
});

describe('buildService', () => {
  it('uses ClusterIP when not exposed', () => {
    const yaml = buildService(baseOpts);
    expect(yaml).toContain('type: ClusterIP');
  });

  it('uses NodePort when exposed', () => {
    const yaml = buildService({...baseOpts, expose: true});
    expect(yaml).toContain('type: NodePort');
  });
});

describe('buildHPA', () => {
  it('returns autoscaling v2 yaml', () => {
    const yaml = buildHPA(baseOpts);
    expect(yaml).toContain('kind: HorizontalPodAutoscaler');
    expect(yaml).toContain('minReplicas: 2');
    expect(yaml).toContain('maxReplicas: 5');
  });
});

describe('assembleManifests', () => {
  it('joins non-null resources with ---', () => {
    const result = assembleManifests(['a', null, 'b']);
    expect(result).toBe('a---\nb');
  });

  it('returns empty string for all null', () => {
    expect(assembleManifests([null, null])).toBe('');
  });
});
