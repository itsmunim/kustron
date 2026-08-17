import { dump } from 'js-yaml'

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
}

export function buildNamespace(name: string): string {
  return dump({
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: { name },
  })
}

export function buildDeployment(opts: ManifestOptions): string {
  const resources: Record<string, unknown> = {}
  if (opts.cpuRequest || opts.memoryRequest) {
    resources.requests = {}
    if (opts.cpuRequest) resources.requests.cpu = opts.cpuRequest
    if (opts.memoryRequest) resources.requests.memory = opts.memoryRequest
  }
  if (opts.cpuLimit || opts.memoryLimit) {
    resources.limits = {}
    if (opts.cpuLimit) resources.limits.cpu = opts.cpuLimit
    if (opts.memoryLimit) resources.limits.memory = opts.memoryLimit
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
          containers: [
            {
              name: opts.name,
              image: opts.image,
              ports: [{ containerPort: opts.port }],
              env: Object.entries(opts.env).map(([name, value]) => ({
                name,
                value,
              })),
              ...(Object.keys(resources).length > 0 ? { resources } : {}),
            },
          ],
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
      maxReplicas: opts.replicas * 3,
      metrics: [
        {
          type: 'Resource',
          resource: {
            name: 'cpu',
            target: {
              type: 'Utilization',
              averageUtilization: 50,
            },
          },
        },
      ],
    },
  }

  return dump(hpa)
}
