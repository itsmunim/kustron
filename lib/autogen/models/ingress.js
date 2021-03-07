function getBase({namePrefix, exposePath}) {
  return {
    apiVersion: 'networking.k8s.io/v1beta1',
    kind: 'Ingress',
    metadata: {
      name: `${namePrefix}-ingress`,
      annotations: {
        'kubernetes.io/ingress.allow-http': 'false',
      },
    },
    spec: {
      rules: [
        {
          http: {
            paths: [
              {
                path: exposePath || '/',
                backend: {
                  serviceName: `${namePrefix}-svc`,
                  servicePort: 80,
                },
              },
            ],
          },
        },
      ],
    },
  };
}

function getPatch({namePrefix, ipName, secretName}) {
  return {
    apiVersion: 'networking.k8s.io/v1beta1',
    kind: 'Ingress',
    metadata: {
      name: `${namePrefix}-ingress`,
      annotations: {
        'kubernetes.io/ingress.global-static-ip-name': ipName,
      },
    },
    spec: {
      tls: [
        {
          secretName,
        },
      ],
    },
  };
}

module.exports = {
  getBase,
  getPatch,
};
