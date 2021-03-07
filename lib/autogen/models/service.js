function getBase(namePrefix, isExposed) {
  const type = isExposed ? 'NodePort' : 'ClusterIP';
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: `${namePrefix}-svc`,
    },
    spec: {
      type,
      ports: [
        {
          port: 80,
          targetPort: 'http-web',
        },
      ],
    },
  };
}

module.exports = {
  getBase,
};
