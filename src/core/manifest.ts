import {dump} from 'js-yaml';

const DEFAULT_CPU_REQUEST = '100m';
const DEFAULT_CPU_LIMIT = '500m';
const DEFAULT_MEMORY_REQUEST = '128Mi';
const DEFAULT_MEMORY_LIMIT = '512Mi';

export interface ManifestOptions {
  name: string;
  namespace: string;
  image: string;
  port: number;
  replicas: number;
  env: Record<string, string>;
  expose: boolean;
  healthcheck?: string;
}

function managedLabels(name: string): Record<string, string> {
  return {
    'app.kubernetes.io/name': name,
    'app.kubernetes.io/managed-by': 'kustron',
  };
}

export function buildConfigMap(
  appName: string,
  namespace: string,
  env: Record<string, string>,
): string | null {
  if (Object.keys(env).length === 0) return null;

  return dump({
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: appName,
      namespace,
      labels: managedLabels(appName),
    },
    data: env,
  });
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
  };

  const container: Record<string, unknown> = {
    name: opts.name,
    image: opts.image,
    ports: [{containerPort: opts.port}],
    resources,
  };

  if (Object.keys(opts.env).length > 0) {
    container.envFrom = [{configMapRef: {name: opts.name}}];
  }

  // Healthcheck is opt-in:
  //   - absent / 'none'  -> no probes. Pod is Ready as soon as the container
  //     is Running, so rollouts complete fast and never get stuck on services
  //     that don't speak HTTP (redis, postgres, mysql, ...).
  //   - 'tcp'            -> TCP socket probe on the port. Right choice for
  //     plain TCP services: ready when the port accepts connections.
  //   - otherwise        -> HTTP GET on the given path (e.g. '/health').
  const healthcheck = (opts.healthcheck ?? '').trim();
  if (healthcheck && healthcheck !== 'none') {
    const probe: Record<string, unknown> =
      healthcheck === 'tcp'
        ? {tcpSocket: {port: opts.port}}
        : {httpGet: {path: healthcheck, port: opts.port}};

    // Startup probe: gives slow-starting apps up to 150s to become responsive;
    // readiness/liveness stay disabled until startup succeeds.
    container.startupProbe = {...probe, periodSeconds: 5, failureThreshold: 30};
    // Readiness: gates Service traffic + rollout completion.
    container.readinessProbe = {...probe, periodSeconds: 5, failureThreshold: 3, successThreshold: 1};
    // Liveness: restarts dead containers once startup succeeded.
    container.livenessProbe = {...probe, periodSeconds: 10, failureThreshold: 3};
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
        matchLabels: {'app.kubernetes.io/name': opts.name},
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
  };

  return dump(deployment);
}

export function buildService(opts: ManifestOptions): string {
  const ports: Array<Record<string, unknown>> = [
    {
      port: opts.port,
      targetPort: opts.port,
      protocol: 'TCP',
    },
  ];

  const service = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: opts.name,
      namespace: opts.namespace,
      labels: managedLabels(opts.name),
    },
    spec: {
      type: opts.expose ? 'NodePort' : 'ClusterIP',
      selector: {'app.kubernetes.io/name': opts.name},
      ports,
    },
  };

  return dump(service);
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
  };

  return dump(hpa);
}

export function assembleManifests(resources: (string | null)[]): string {
  return resources.filter((r): r is string => r !== null).join('---\n');
}
