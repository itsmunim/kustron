import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {mkdtemp, writeFile, readFile, rm} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import {envInit} from '../../src/commands/env/init.js';
import {readAndParseEnvFile} from '../../src/core/env-file.js';

const mockedExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
  throw new Error(`process.exit(${code})`);
}) as unknown as ReturnType<typeof vi.spyOn>;

describe('env init (non-interactive)', () => {
  let dir: string;
  let originalDir: string;

  beforeEach(async () => {
    originalDir = process.cwd();
    dir = await mkdtemp(join(tmpdir(), 'kustron-init-test-'));
    process.chdir(dir);
  });

  afterEach(async () => {
    process.chdir(originalDir);
    await rm(dir, {recursive: true});
    vi.clearAllMocks();
  });

  it('creates a yaml from flags alone (no prompts)', async () => {
    await envInit({name: 'demo', port: 1234, exposed: true});

    const envFile = await readAndParseEnvFile('./kustron-env.yaml');
    expect(envFile.apps).toHaveLength(1);
    expect(envFile.apps[0]).toMatchObject({
      name: 'demo',
      port: 1234,
      source: './',
      exposed: true,
    });
    expect(envFile.config?.namespace).toBe('demo-env');
  });

  it('derives the app name from the folder when no flags given', async () => {
    await envInit({});

    const envFile = await readAndParseEnvFile('./kustron-env.yaml');
    const folderSlug = dir
      .split('/')
      .pop()!
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    expect(envFile.apps[0].name).toBe(folderSlug);
    expect(envFile.apps[0].source).toBe('./');
    expect(envFile.apps[0].port).toBe(3000);
  });

  it('sanitizes invalid app names into slugs', async () => {
    await envInit({name: 'My App!'});

    const content = await readFile('./kustron-env.yaml', 'utf-8');
    expect(content).toContain('name: my-app');
  });

  it('--cluster writes config.clusterName so envs can isolate from default clusters', async () => {
    await envInit({name: 'api', port: 3000, cluster: 'apidemo'});

    const envFile = await readAndParseEnvFile('./kustron-env.yaml');
    expect(envFile.config?.clusterName).toBe('apidemo');
    expect(envFile.config?.namespace).toBe('api-env');
  });

  it('omits clusterName by default', async () => {
    await envInit({name: 'api'});

    const content = await readFile('./kustron-env.yaml', 'utf-8');
    expect(content).not.toContain('clusterName');
  });

  it('image apps default to port 80 and use the given image', async () => {
    await envInit({image: 'redis:7'});

    const envFile = await readAndParseEnvFile('./kustron-env.yaml');
    expect(envFile.apps[0]).toMatchObject({
      image: 'redis:7',
      port: 80,
    });
    expect(envFile.apps[0].source).toBeUndefined();
  });

  it('refuses --image and --source together', async () => {
    await expect(
      envInit({name: 'a', image: 'redis:7', source: './'}),
    ).rejects.toThrow('process.exit(1)');
    expect(
      await readFile('./kustron-env.yaml', 'utf-8').catch(() => 'no'),
    ).toBe('no');
  });

  it('rejects invalid ports', async () => {
    await expect(envInit({name: 'a', port: 70000})).rejects.toThrow(
      'process.exit(1)',
    );
  });

  it('refuses to overwrite without --force in a non-TTY shell', async () => {
    await writeFile(
      './kustron-env.yaml',
      'config:\n  namespace: keep\napps:\n  - name: original\n    source: ./\n    port: 3000\n',
      'utf-8',
    );

    await expect(envInit({name: 'replacement'})).rejects.toThrow(
      'process.exit(1)',
    );

    const content = await readFile('./kustron-env.yaml', 'utf-8');
    expect(content).toContain('original');
  });

  it('overwrites with --force', async () => {
    await writeFile('./kustron-env.yaml', 'apps: []\n', 'utf-8');

    await envInit({name: 'replacement', force: true});

    const content = await readFile('./kustron-env.yaml', 'utf-8');
    expect(content).toContain('name: replacement');
  });

  it('runs prompt-free even when a TTY would be available (flags win)', async () => {
    // Any flag must fully suppress prompting — the agent contract.
    const textSpy = vi.fn();
    vi.doMock('@clack/prompts', async () => {
      const actual = await vi.importActual('@clack/prompts');
      return {
        ...actual,
        text: textSpy,
        select: textSpy,
        confirm: textSpy,
      };
    });

    await envInit({name: 'flag-win'});

    expect(textSpy).not.toHaveBeenCalled();
    const content = await readFile('./kustron-env.yaml', 'utf-8');
    expect(content).toContain('name: flag-win');
    vi.doUnmock('@clack/prompts');
  });
});
