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
  /** Secret environment variables (injected as K8s Secrets, not ConfigMaps). */
  secret?: Record<string, string>;
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
  /** Deploy ordering (idea 3): apps that must be deployed + ready first. */
  dependsOn?: string[];
  /** How each dependency must be considered ready before this app deploys. */
  wait?: WaitConfig;
  /** Pre/post hooks (idea 4): shell commands run on the host around deploy. */
  hooks?: {
    pre?: string[];
    post?: string[];
  };
  /** Per-app namespace override (idea 7). */
  namespace?: string;
  /** Instance suffix: deploy the same app twice with different parameters (idea 7). */
  instance?: string;
  /** Private registry credentials (idea 6). */
  registry?: {
    server?: string;
    username?: string;
    password?: string;
  };
}

export interface WaitConfig {
  /** rollout (default) | established | command */
  type?: 'rollout' | 'established' | 'command';
  /** For type: command — the shell command to run (exit 0 = ready). */
  command?: string;
  /** Namespace to wait in (defaults to the dependency's namespace). */
  namespace?: string;
}

export interface ComponentSpec {
  name: string;
  /** Local path or git URL of the component (must contain a Kustronfile). */
  source: string;
  /** Inputs passed to the component; override its Kustronfile defaults. */
  inputs?: Record<string, string | number | boolean>;
}

export interface EnvFile {
  config?: {namespace?: string};
  components?: ComponentSpec[];
  apps: AppEntry[];
}

export interface ClusterConfig {
  name: string;
  namespace: string;
  registryPort?: number;
}

export interface DeployContext {
  namespace: string;
  registryHost: string;
  clusterName: string;
  verbose: boolean;
  nodeIp?: string;
  registryPort: number;
  /** All apps in the env file (used for cross-app ${app.endpoint} interpolation). */
  allApps?: AppEntry[];
  /** Component output vars (e.g. {hub-kafka.bootstrap: 'kafka:9092'}) for ${...} interpolation. */
  componentOutputs?: Record<string, string>;
}

export interface DependencyCheck {
  name: string;
  command: string;
  required: boolean;
  installHint: string;
  url?: string;
}

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'step';