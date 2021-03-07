function getBase(namePrefix, min, max) {
  return {
    apiVersion: 'autoscaling/v2beta2',
    kind: 'HorizontalPodAutoscaler',
    metadata: {
      name: `${namePrefix}-hpa`,
    },
    spec: {
      scaleTargetRef: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: `${namePrefix}-deployment`,
      },
      minReplicas: min,
      maxReplicas: max,
      metrics: [
        {
          type: 'Resource',
          resource: {
            name: 'cpu',
            target: {type: 'Utilization', averageUtilization: 75},
          },
        },
        {
          type: 'Resource',
          resource: {
            name: 'memory',
            target: {type: 'Utilization', averageUtilization: 75},
          },
        },
      ],
    },
  };
}

function getPatch({namePrefix, minReplicas, maxReplicas}) {
  return {
    apiVersion: 'autoscaling/v2beta2',
    kind: 'HorizontalPodAutoscaler',
    metadata: {
      name: `${namePrefix}-hpa`,
    },
    spec: {
      minReplicas,
      maxReplicas,
    },
  };
}

module.exports = {
  getBase,
  getPatch,
};
