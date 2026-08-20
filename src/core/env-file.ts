import {z} from 'zod';
import {readFile, writeFile} from 'fs/promises';
import {dump, load} from 'js-yaml';
import chalk from 'chalk';
import type {AppEntry, EnvFile} from '../types/index.js';

const helmConfigSchema = z.object({
  chart: z.string(),
  repo: z.string().optional(),
  version: z.string().optional(),
  values: z.record(z.string(), z.string()).optional(),
  selector: z.record(z.string(), z.string()).optional(),
});

const appEntrySchema = z
  .object({
    name: z.string().min(1),
    source: z.string().optional(),
    image: z.string().optional(),
    helm: helmConfigSchema.optional(),
    port: z.union([z.number(), z.string()]).optional(),
    healthcheck: z.string().optional(),
    exposed: z.boolean().optional(),
    replicas: z.number().optional(),
    ha: z.boolean().optional(),
    env: z.record(z.string(), z.string()).optional(),
  })
  .refine(
    (data) => {
      const hasSource = !!data.source;
      const hasImage = !!data.image;
      const hasHelm = !!data.helm;
      return [hasSource, hasImage, hasHelm].filter(Boolean).length === 1;
    },
    {
      message: 'Each app must have exactly one of: source, image, or helm',
    },
  )
  .refine(
    (data) => {
      const hasSource = !!data.source;
      const hasImage = !!data.image;
      const hasPort = data.port !== undefined;
      if ((hasSource || hasImage) && !hasPort) {
        return false;
      }
      return true;
    },
    {
      message: 'port is required for source and image apps',
    },
  );

const envFileSchema = z.object({
  config: z.object({namespace: z.string().optional()}).optional(),
  apps: z.array(appEntrySchema),
});

function validatePortPlaceholders(envFile: EnvFile): void {
  for (const app of envFile.apps) {
    if (app.port === 'PORT') {
      throw new Error(
        `Set the port for '${app.name}' in kustron-env.yaml before running.`,
      );
    }
  }
}

export async function parseEnvFileContent(content: string): Promise<EnvFile> {
  const parsed = load(content) as unknown;
  const result = envFileSchema.parse(parsed);
  const envFile: EnvFile = {
    config: result.config,
    apps: result.apps.map((app) => ({
      ...app,
      port:
        app.port === 'PORT'
          ? 'PORT'
          : typeof app.port === 'string'
            ? parseInt(app.port, 10) || app.port
            : app.port,
    })),
  };
  validatePortPlaceholders(envFile);
  return envFile;
}

export async function readAndParseEnvFile(filePath: string): Promise<EnvFile> {
  const content = await readFile(filePath, 'utf-8');
  return parseEnvFileContent(content);
}

export function getExposedPorts(envFile: EnvFile): number[] {
  const ports: number[] = [];
  for (const app of envFile.apps) {
    if (app.exposed && typeof app.port === 'number') {
      ports.push(app.port);
    }
  }
  return ports;
}

export async function appendApp(
  filePath: string,
  entry: AppEntry,
): Promise<void> {
  const content = await readFile(filePath, 'utf-8');
  const parsed = load(content) as {
    config?: {namespace?: string};
    apps?: unknown[];
  };
  const apps = parsed.apps ?? [];
  apps.push(entry as unknown as Record<string, unknown>);
  parsed.apps = apps;
  await writeFile(filePath, dump(parsed));
}

export async function createEnvFile(
  filePath: string,
  entry: AppEntry,
): Promise<void> {
  const data: EnvFile = {
    config: {namespace: 'kustron-env'},
    apps: [entry],
  };
  await writeFile(filePath, dump(data));
}

export function renderSpec(): string {
  return (
    chalk.cyan(`# kustron-env.yaml Schema Reference

`) +
    chalk.white(`config:
  namespace: kustron-env   # default; all apps share this namespace

apps:
  # --- Type 1: Source build (local path or git SSH/HTTPS URL) ---
  - name: api
    source: ./services/api              # local path OR git@github.com:user/repo.git
    port: 3000                          # required
    healthcheck: /health                # optional, defaults to /
    exposed: true                       # accessible at localhost:3000
    replicas: 1                         # ignored when ha: true
    ha: false                           # min 2 / max 5 / cpu 90% / mem 80%
    env:
      NODE_ENV: production
      DB_HOST: postgres                 # 'postgres' resolves to the postgres app's service

  # --- Type 2: Existing container image ---
  - name: postgres
    image: postgres:15
    port: 5432                          # required
    healthcheck: /                      # optional
    exposed: false
    env:
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: myapp

  # --- Type 3: Helm chart ---
  - name: prometheus
    helm:
      chart: kube-prometheus-stack
      repo: https://prometheus-community.github.io/helm-charts
      version: "45.0.0"
      values:                           # passed as helm --set flags
        grafana.enabled: "true"
        alertmanager.enabled: "false"
      selector:                         # required when exposed: true for helm apps
        app.kubernetes.io/name: grafana
    exposed: false
`)
  );
}
