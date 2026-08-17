export interface ClusterOptions {
  name: string
  agents: number
  registryPort: number
  loadBalancerPorts: { host: number; container: number }[]
  wait: boolean
}

export interface ClusterInfo {
  name: string
  serversRunning: number
  serversCount: number
  agentsRunning: number
  agentsCount: number
  hasLoadBalancer: boolean
  registry?: {
    host: string
    port: string
  }
}

export interface DeployOptions {
  source: string
  name: string
  port: number
  replicas: number
  ha: boolean
  env: Record<string, string>
  expose: boolean
  ns?: string
  keepSource: boolean
  cpuRequest?: string
  cpuLimit?: string
  memoryRequest?: string
  memoryLimit?: string
  healthcheck?: string
}

export interface DependencyCheck {
  name: string
  command: string
  required: boolean
  installHint: string
  url?: string
}

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'step'
