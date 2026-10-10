import {z} from 'zod';
import {readFile, writeFile} from 'fs/promises';
import {dump, load} from 'js-yaml';
import chalk from 'chalk';
import type {AppEntry, EnvFile} from '../types/index.js';

const helmConfigSchema = z.object({
  chart: z.string(),
  repo: z.string().optional(),
  version: z.string().optional(),
  values: z.record(z.string(), z.unknown()).optional(),
  valuesFiles: z.array(z.string()).optional(),
  imageValues: z
    .object({
      repository: z.string().optional(),
      tag: z.string().optional(),
    })
    .optional(),
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
    secret: z.record(z.string(), z.string()).optional(),
    command: z.array(z.string()).optional(),
    args: z.array(z.string()).optional(),
    resources: z
      .object({
        requests: z.object({cpu: z.string().optional(), memory: z.string().optional()}).optional(),
        limits: z.object({cpu: z.string().optional(), memory: z.string().optional()}).optional(),
      })
      .optional(),
    patch: z.record(z.string(), z.unknown()).optional(),
    dependsOn: z.array(z.string()).optional(),
    wait: z
      .object({
        type: z.enum(['rollout', 'established', 'command']).optional(),
        command: z.string().optional(),
        namespace: z.string().optional(),
      })
      .optional(),
    hooks: z
      .object({
        pre: z.array(z.string()).optional(),
        post: z.array(z.string()).optional(),
      })
      .optional(),
    namespace: z.string().optional(),
    instance: z.string().optional(),
    registry: z
      .object({
        server: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
      })
      .optional(),
  })
  .strict()
  .refine(
    (data) => {
      const hasSource = !!data.source;
      const hasImage = !!data.image;
      const hasHelm = !!data.helm;
      // source and image are mutually exclusive runtimes
      if (hasSource && hasImage) return false;
      // source/image + helm means: build the image, deploy via the chart.
      // That requires imageValues so the image actually reaches the chart.
      if (hasHelm && (hasSource || hasImage)) {
        return !!data.helm?.imageValues;
      }
      return [hasSource, hasImage, hasHelm].filter(Boolean).length === 1;
    },
    {
      message:
        'Each app must have exactly one of: source, image, helm (a source or image combined with helm requires helm.imageValues)',
    },
  )
  .refine(
    (data) => {
      const hasSource = !!data.source;
      const hasImage = !!data.image;
      const hasHelm = !!data.helm;
      const hasPort = data.port !== undefined;
      // port is only needed for the builtin template deploy; helm (or
      // source/image + helm) manages its own ports through the chart.
      if ((hasSource || hasImage) && !hasHelm && !hasPort) {
        return false;
      }
      return true;
    },
    {
      message: 'port is required for source and image apps',
    },
  );

const componentSpecSchema = z.object({
  name: z.string().min(1),
  source: z.string().min(1),
  inputs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

const envFileSchema = z
  .object({
    config: z.object({namespace: z.string().optional(), clusterName: z.string().optional()}).optional(),
    components: z.array(componentSpecSchema).optional(),
    apps: z.array(appEntrySchema),
  })
  .strict();

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
    components: result.components,
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
    healthcheck: /health                # optional: /path (HTTP), tcp, or omit for no probes
    exposed: true                       # reachable at localhost:<nodePort>
    replicas: 1                         # ignored when ha: true
    ha: false                           # min 2 / max 5 / cpu 90% / mem 80%
    env:
      NODE_ENV: production
      DB_HOST: postgres                 # 'postgres' resolves to the postgres app's service

    # First-class escape hatches (all optional):
    # command: ["/bin/sh", "-c"]      # override the container command
    # args: ["run", "--port", "3000"] # override the container args
    # resources:
    #   requests:
    #     cpu: 250m
    #     memory: 256Mi
    #   limits:
    #     cpu: 1
    #     memory: 512Mi
    # patch:                            # generic escape hatch, deep-merged onto
    #   spec:                           # the Deployment manifest (objects merge,
    #     template:                     # arrays replace). For anything the
    #       metadata:                   # first-class fields don't cover
    #         annotations:
    #           team: platform

  # --- Type 2: Existing container image ---
  - name: postgres
    image: postgres:15
    port: 5432                          # required
    healthcheck: tcp                    # optional: /path (HTTP), tcp, or omit for no probes
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
      values:                           # arbitrary YAML (nested ok), via a --values file
        grafana:
          enabled: true
        alertmanager:
          enabled: false
      valuesFiles:
        - ./extra-values.yaml           # additional local values files
      # chart: ./charts/my-app          # local chart path (no repo needed)
      # chart: oci://ghcr.io/org/chart  # OCI chart
      selector:                         # required when exposed: true for helm apps
        app.kubernetes.io/name: grafana
    exposed: false

  # --- Type 4: Build from source, deploy via helm ---
  - name: backend
    source: ./
    helm:
      chart: ./charts/backend           # chart owns the Deployment/Service
      imageValues:                      # where to inject the built image
        repository: image.repository
        tag: image.tag
`)
  );
}
