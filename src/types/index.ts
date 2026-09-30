export interface HelmResources {
  requests?: {cpu?: string; memory?: string};
  limits?: {cpu?: string; memory?: string};
}

export interface HelmConfig {
  chart: string;
  repo?: string;
  version?: string;
  /** Arbitrary values (nested supported). Passed to helm via a --values file. */
  values?: Record<string, unknown>;
  /** Extra local values files, passed as additional --values flags. */
  valuesFiles?: string[];
  /**
   * Where to inject a Kustron-built image into the chart (idea 1: build from
   * source, deploy via helm). Keys are dotted paths into the chart's values,
   * e.g. {repository: 'image.repository', tag: 'image.tag'}.
   */
  imageValues?: {repository?: string; tag?: string};
  selector?: Record<string, string>;
}

export interface AppEntry {
  name: string;
  source?: string;
  image?: string;
  helm?: HelmConfig;
  port?: number | string;
  healthcheck?: string;
  exposed?: boolean;
  replicas?: number;
  ha?: boolean;
  env?: Record<string, string>;
  /** First-class escape hatch: override the container command. */
  command?: string[];
  /** First-class escape hatch: override the container args. */
  args?: string[];
  /** First-class escape hatch: override resource requests/limits. */
  resources?: HelmResources;
  /**
   * Generic escape hatch: deep-merged onto the generated Deployment manifest.
   * Objects merge recursively, arrays are replaced. (idea 2)
   */
  patch?: Record<string, unknown>;
}

export interface EnvFile {
  config?: {namespace?: string};
  apps: AppEntry[];
}

export interface ClusterConfig {
  name: string;
  namespace: string;
}

export interface DeployContext {
  namespace: string;
  registryHost: string;
  clusterName: string;
  verbose: boolean;
  nodeIp?: string;
}

export interface DependencyCheck {
  name: string;
  command: string;
  required: boolean;
  installHint: string;
  url?: string;
}

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'step';