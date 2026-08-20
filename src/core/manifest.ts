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
  healthcheck?: string
}

function managedLabels(name: string): Record<string, string> {
  return {
    'app.kubernetes.io/name': name,
    'app.kubernetes.io/managed-by': 'kustron',
  }
}

export function buildConfigMap(appName: string, namespace: string, env: Record<string, string>): string | null {
  if (Object.keys(env).length === 0) return null

  return dump({
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: appName,
      namespace,
      labels: managedLabels(appName),
    },
    data: env,
  })
}

export function buildDeployment(opts: ManifestOptions): string {
  const resources: Record<string, unknown> = {
    requests: {
      cpu: DEFAULT_CPU_REQUEST,
      memory: DEFAULT_MEMORY_REQUEST,
    },
    limits: {
      cpu: DEFAULT_CPU_LIMIT,
      memory: DEFAULT_MEMORY_LIMIT,
    },
  }

  const container: Record<string, unknown> = {
    name: opts.name,
    image: opts.image,
    ports: [{ containerPort: opts.port }],
    resources,
  }

  if (Object.keys(opts.env).length > 0) {
    container.envFrom = [{ configMapRef: { name: opts.name } }]
  }

  // Readiness probe: healthcheck path (default /), on app port
  const readinessPath = opts.healthcheck ?? '/'
  container.readinessProbe = {
    httpGet: {
      path: readinessPath,
      port: opts.port,
    },
    initialDelaySeconds: 3,
    periodSeconds: 5,
  }

  const deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: opts.name,
      namespace: opts.namespace,
      labels: managedLabels(opts.name),
    },
    spec: {
      replicas: opts.replicas,
      selector: {
        matchLabels: { 'app.kubernetes.io/name': opts.name },
      },
      template: {
        metadata: {
          labels: managedLabels(opts.name),
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
      labels: managedLabels(opts.name),
    },
    spec: {
      type: opts.expose ? 'LoadBalancer' : 'ClusterIP',
      selector: { 'app.kubernetes.io/name': opts.name },
      ports: [
        {
          port: opts.port,
          targetPort: opts.port,
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
      labels: managedLabels(opts.name),
    },
    spec: {
      scaleTargetRef: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: opts.name,
      },
      minReplicas: 2,
      maxReplicas: 5,
      metrics: [
        {
          type: 'Resource',
          resource: {
            name: 'cpu',
            target: {
              type: 'Utilization',
              averageUtilization: 90,
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

export function assembleManifests(resources: (string | null)[]): string {
  return resources.filter((r): r is string => r !== null).join('---\n')
}
