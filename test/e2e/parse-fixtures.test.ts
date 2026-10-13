import {describe, it, expect} from 'vitest';
import {readAndParseEnvFile} from '../../src/core/env-file.js';
import {access} from 'fs/promises';
import {join} from 'path';
import {fileURLToPath} from 'url';
import {dirname} from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, '..', 'fixtures');

describe('E2E: Parse fixtures', () => {
  it('parses simple-image fixture', async () => {
    const filePath = join(fixturesDir, 'simple-image', 'kustron-env.yaml');
    await access(filePath);
    const envFile = await readAndParseEnvFile(filePath);

    expect(envFile.config?.namespace).toBe('test-simple');
    expect(envFile.config?.clusterName).toBe('test-simple');
    expect(envFile.apps).toHaveLength(1);
    expect(envFile.apps[0].name).toBe('nginx');
    expect(envFile.apps[0].image).toBe('nginx:alpine');
    expect(envFile.apps[0].port).toBe(80);
    expect(envFile.apps[0].exposed).toBe(true);
  });

  it('parses with-deps fixture', async () => {
    const filePath = join(fixturesDir, 'with-deps', 'kustron-env.yaml');
    const envFile = await readAndParseEnvFile(filePath);

    expect(envFile.apps).toHaveLength(2);
    expect(envFile.apps[0].name).toBe('redis');
    expect(envFile.apps[1].name).toBe('api');
    expect(envFile.apps[1].dependsOn).toEqual(['redis']);
    expect(envFile.apps[1].env?.REDIS_HOST).toBe('redis');
  });

  it('parses with-secrets fixture', async () => {
    const filePath = join(fixturesDir, 'with-secrets', 'kustron-env.yaml');
    const envFile = await readAndParseEnvFile(filePath);

    expect(envFile.apps).toHaveLength(1);
    expect(envFile.apps[0].env?.PUBLIC_VAR).toBe('hello');
    expect(envFile.apps[0].secret?.API_KEY).toBe('${TEST_API_KEY}');
  });

  it('parses with-helm fixture', async () => {
    const filePath = join(fixturesDir, 'with-helm', 'kustron-env.yaml');
    const envFile = await readAndParseEnvFile(filePath);

    expect(envFile.apps).toHaveLength(1);
    expect(envFile.apps[0].helm?.chart).toBe(
      'oci://registry-1.docker.io/bitnamicharts/postgresql',
    );
    expect(envFile.apps[0].helm?.version).toBe('13.4.0');
    expect(envFile.apps[0].helm?.values?.auth?.postgresPassword).toBe(
      'secret123',
    );
  });
});
