function getBase({namePrefix, port, limits, requests, healthCheck}) {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: `${namePrefix}-deployment`,
    },
    spec: {
      strategy: {
        type: 'RollingUpdate',
        rollingUpdate: {maxSurge: 1, maxUnavailable: 1},
      },
      template: {
        metadata: {labels},
        spec: {
          containers: [
            {
              name: `${namePrefix}-container`,
              image: 'IMAGE_PLACEHOLDER',
              ports: [
                {
                  name: 'http-web',
                  containerPort: port,
                },
              ],
              resources: {
                limits: limits || {
                  memory: '512Mi',
                },
                requests: requests || {
                  cpu: '200m',
                  memory: '512Mi',
                },
              },
              readinessProbe: {
                httpGet: {
                  path: healthCheck,
                  port: 'http-web',
                },
                initialDelaySeconds: 5,
                periodSeconds: 5,
                successThreshold: 1,
              },
              envFrom: [
                {
                  configMapRef: {
                    name: `${namePrefix}-cmap`,
                  },
                },
                {
                  secretRef: {
                    name: `${namePrefix}-secrets`,
                  },
                },
              ],
              lifecycle: {
                preStop: {
                  exec: {
                    command: ['/bin/sleep', '30'],
                  },
                },
              },
            },
          ],
          terminationGracePeriodSeconds: 60,
        },
      },
    },
  };
}

module.exports = {
  getBase,
};
