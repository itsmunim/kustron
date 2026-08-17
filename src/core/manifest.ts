import { dump } from 'js-yaml'

const DEFAULT_CPU_REQUEST = '100m'
const DEFAULT_CPU_LIMIT = '500m'
const DEFAULT_MEMORY_REQUEST = '128Mi'
const DEFAULT_MEMORY_LIMIT = '512Mi'

export interface ManifestOptions {
  name: string
  namespace: string
  image: string
  port: number
  replicas: number
  env: Record<string, string>
  expose: boolean
  serviceType?: 'ClusterIP' | 'NodePort'
  cpuRequest?: string
  cpuLimit?: string
  memoryRequest?: string
  memoryLimit?: string
  healthcheck?: string
}

export function buildNamespace(name: string): string {
  return dump({
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: { name },
  })
}

export function buildDeployment(opts: ManifestOptions): string {
  const resources: Record<string, unknown> = {
    requests: {
      cpu: opts.cpuRequest || DEFAULT_CPU_REQUEST,
      memory: opts.memoryRequest || DEFAULT_MEMORY_REQUEST,
    },
    limits: {
      cpu: opts.cpuLimit || DEFAULT_CPU_LIMIT,
      memory: opts.memoryLimit || DEFAULT_MEMORY_LIMIT,
    },
  }

  const container: Record<string, unknown> = {
    name: opts.name,
    image: opts.image,
    ports: [{ containerPort: opts.port }],
    env: Object.entries(opts.env).map(([name, value]) => ({
      name,
      value,
    })),
    resources,
  }

  if (opts.healthcheck) {
    container.livenessProbe = {
      httpGet: {
        path: opts.healthcheck,
        port: opts.port,
      },
      initialDelaySeconds: 10,
      periodSeconds: 10,
    }
    container.readinessProbe = {
      httpGet: {
        path: opts.healthcheck,
        port: opts.port,
      },
      initialDelaySeconds: 5,
      periodSeconds: 5,
    }
  }

  const deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: opts.name,
      namespace: opts.namespace,
    },
    spec: {
      replicas: opts.replicas,
      selector: {
        matchLabels: { app: opts.name },
      },
      template: {
        metadata: {
          labels: { app: opts.name },
        },
        spec: {
          containers: [container],
        },
      },
    },
  }

  return dump(deployment)
}

export function buildService(opts: ManifestOptions): string {
  const service = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: opts.name,
      namespace: opts.namespace,
    },
    spec: {
      type: opts.expose ? 'NodePort' : 'ClusterIP',
      selector: { app: opts.name },
      ports: [
        {
          port: opts.port,
          targetPort: opts.port,
          ...(opts.expose ? { nodePort: 30000 + (opts.port % 2768) } : {}),
        },
      ],
    },
  }

  return dump(service)
}

export function buildHPA(opts: ManifestOptions): string {
  const hpa = {
    apiVersion: 'autoscaling/v2',
    kind: 'HorizontalPodAutoscaler',
    metadata: {
      name: opts.name,
      namespace: opts.namespace,
    },
    spec: {
      scaleTargetRef: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: opts.name,
      },
      minReplicas: opts.replicas,
      maxReplicas: 10,
      metrics: [
        {
          type: 'Resource',
          resource: {
            name: 'cpu',
            target: {
              type: 'Utilization',
              averageUtilization: 70,
            },
          },
        },
        {
          type: 'Resource',
          resource: {
            name: 'memory',
            target: {
              type: 'Utilization',
              averageUtilization: 80,
            },
          },
        },
      ],
    },
  }

  return dump(hpa)
}
