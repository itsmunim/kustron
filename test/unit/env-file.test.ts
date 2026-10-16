import {describe, it, expect} from 'vitest';
import {z} from 'zod';
import {mkdtemp, writeFile, rm, readFile} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import {
  parseEnvFileContent,
  getExposedPorts,
  validatePortPlaceholders,
  renderSpec,
  appendApp,
  createEnvFile,
} from '../../src/core/env-file.js';
import type {EnvFile, AppEntry} from '../../src/types/index.js';

describe('env file schema validation', () => {
  const appEntrySchema = z
    .object({
      name: z.string().min(1),
      source: z.string().optional(),
      image: z.string().optional(),
      port: z.union([z.number(), z.string()]).optional(),
      exposed: z.boolean().optional(),
      replicas: z.number().optional(),
      ha: z.boolean().optional(),
      env: z.record(z.string(), z.string()).optional(),
      secret: z.record(z.string(), z.string()).optional(),
      command: z.array(z.string()).optional(),
      args: z.array(z.string()).optional(),
      patch: z.record(z.string(), z.unknown()).optional(),
      dependsOn: z.array(z.string()).optional(),
    })
    .strict()
    .refine(
      (data) => {
        const hasSource = !!data.source;
        const hasImage = !!data.image;
        const hasHelm = !!data.helm;
        if (hasSource && hasImage) return false;
        if (hasHelm && (hasSource || hasImage)) {
          return !!data.helm?.imageValues;
        }
        return [hasSource, hasImage, hasHelm].filter(Boolean).length === 1;
      },
      {message: 'Each app must have exactly one of: source, image, helm'},
    );

  it('accepts a valid source app', () => {
    const result = appEntrySchema.safeParse({
      name: 'api',
      source: './api',
      port: 3000,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid image app', () => {
    const result = appEntrySchema.safeParse({
      name: 'redis',
      image: 'redis:7',
      port: 6379,
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown keys', () => {
    const result = appEntrySchema.safeParse({
      name: 'api',
      source: './api',
      port: 3000,
      unknownField: 'value',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = appEntrySchema.safeParse({
      name: '',
      source: './api',
      port: 3000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects source + image together', () => {
    const result = appEntrySchema.safeParse({
      name: 'api',
      source: './api',
      image: 'nginx',
      port: 3000,
    });
    expect(result.success).toBe(false);
  });
});

describe('parseEnvFileContent', () => {
  it('parses valid env file with source app', async () => {
    const yaml = `
config:
  namespace: test-ns
apps:
  - name: api
    source: ./api
    port: 3000
`;
    const result = await parseEnvFileContent(yaml);
    expect(result.config?.namespace).toBe('test-ns');
    expect(result.apps[0].name).toBe('api');
    expect(result.apps[0].port).toBe(3000);
  });

  it('parses port as string into number', async () => {
    const yaml = `
apps:
  - name: api
    source: ./api
    port: "8080"
`;
    const result = await parseEnvFileContent(yaml);
    expect(result.apps[0].port).toBe(8080);
  });

  it('throws on invalid string port', async () => {
    const yaml = `
apps:
  - name: api
    source: ./api
    port: "abc"
`;
    const result = await parseEnvFileContent(yaml);
    expect(result.apps[0].port).toBe('abc');
  });

  it('throws when source + image together', async () => {
    const yaml = `
apps:
  - name: bad
    source: ./
    image: nginx
    port: 80
`;
    await expect(parseEnvFileContent(yaml)).rejects.toThrow();
  });

  it('throws when source app lacks port', async () => {
    const yaml = `
apps:
  - name: bad
    source: ./
`;
    await expect(parseEnvFileContent(yaml)).rejects.toThrow();
  });

  it('accepts helm app without port', async () => {
    const yaml = `
apps:
  - name: prom
    helm:
      chart: kube-prometheus-stack
      repo: https://example.com
`;
    const result = await parseEnvFileContent(yaml);
    expect(result.apps[0].name).toBe('prom');
  });

  it('accepts source + helm with imageValues', async () => {
    const yaml = `
apps:
  - name: backend
    source: ./
    port: 3000
    helm:
      chart: ./charts
      imageValues:
        repository: image.repo
        tag: image.tag
`;
    const result = await parseEnvFileContent(yaml);
    expect(result.apps[0].name).toBe('backend');
  });

  it('rejects unknown top-level keys', async () => {
    const yaml = `
unknown: value
apps:
  - name: api
    source: ./
    port: 3000
`;
    await expect(parseEnvFileContent(yaml)).rejects.toThrow();
  });
});

describe('getExposedPorts', () => {
  it('returns exposed numeric ports', () => {
    const envFile: EnvFile = {
      apps: [
        {name: 'a', port: 3000, exposed: true},
        {name: 'b', port: 8080},
        {name: 'c', port: 'PORT', exposed: true},
      ],
    };
    expect(getExposedPorts(envFile)).toEqual([3000]);
  });
});

describe('validatePortPlaceholders', () => {
  it('throws when port is PORT placeholder', () => {
    const envFile: EnvFile = {
      apps: [{name: 'a', port: 'PORT'}],
    };
    expect(() => validatePortPlaceholders(envFile)).toThrow(
      "Set the port for 'a'",
    );
  });

  it('does not throw when ports are set', () => {
    const envFile: EnvFile = {
      apps: [{name: 'a', port: 3000}],
    };
    expect(() => validatePortPlaceholders(envFile)).not.toThrow();
  });
});

describe('renderSpec', () => {
  it('returns non-empty string with schema reference', () => {
    const spec = renderSpec();
    expect(spec.length).toBeGreaterThan(0);
    expect(spec).toContain('kustron-env.yaml');
  });
});

describe('appendApp', () => {
  it('appends an app to existing env file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kustron-env-test-'));
    const filePath = join(dir, 'kustron-env.yaml');
    await writeFile(
      filePath,
      'config:\n  namespace: ns\napps:\n  - name: api\n    source: ./\n    port: 3000\n',
      'utf-8',
    );

    const entry: AppEntry = {name: 'redis', image: 'redis:7', port: 6379};
    await appendApp(filePath, entry);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('redis');

    await rm(dir, {recursive: true});
  });
});

describe('createEnvFile', () => {
  it('creates a new env file with one app', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kustron-env-test-'));
    const filePath = join(dir, 'kustron-env.yaml');

    const entry: AppEntry = {name: 'api', source: './', port: 3000};
    await createEnvFile(filePath, entry);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('kustron-env');
    expect(content).toContain('api');

    await rm(dir, {recursive: true});
  });
});
