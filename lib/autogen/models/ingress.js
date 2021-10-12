function getBase(
  name,
  exposePath,
  globalIPName,
  certSecretName,
) {
  if (certSecretName) {
    annotations['kubernetes.io/ingress.allow-http'] = 'false';
  }

  if (globalIPName) {
    annotations['kubernetes.io/ingress.global-static-ip-name'] = globalIPName;
  }
  
  return {
    apiVersion: 'networking.k8s.io/v1beta1',
    kind: 'Ingress',
    metadata: {
      name,
      annotations,
    },
    spec: {
      tls: [
        {
          secretName: certSecretName,
        },
      ],
      rules: [
        {
          http: {
            paths: [
              {
                path: exposePath || '/',
                backend: {
                  serviceName: name,
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

function getPatch(name, globalIPName) {
  const annotations = {
    'kubernetes.io/ingress.global-static-ip-name': globalIPName,
  };

  if (certSecretName) {
    annotations['kubernetes.io/ingress.allow-http'] = 'false';
  }
  
  return {
    apiVersion: 'networking.k8s.io/v1beta1',
    kind: 'Ingress',
    metadata: {
      name,
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
