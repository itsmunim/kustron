export interface HelmConfig {
  chart: string
  repo?: string
  version?: string
  values?: Record<string, string>
  selector?: Record<string, string>
}

export interface AppEntry {
  name: string
  source?: string
  image?: string
  helm?: HelmConfig
  port?: number | string
  healthcheck?: string
  exposed?: boolean
  replicas?: number
  ha?: boolean
  env?: Record<string, string>
}

export interface EnvFile {
  config?: { namespace?: string }
  apps: AppEntry[]
}

export interface ClusterConfig {
  name: string
  namespace: string
  exposedPorts: number[]
}

export interface DeployContext {
  namespace: string
  registryHost: string
  clusterName: string
  verbose: boolean
}

export interface DependencyCheck {
  name: string
  command: string
  required: boolean
  installHint: string
  url?: string
}

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'step'
