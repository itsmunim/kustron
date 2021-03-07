function getBase({namePrefix, namespace}) {
  return {
    apiVersion: 'kustomize.config.k8s.io/v1beta1',
    kind: 'Kustomization',
    namespace,
    commonLabels: {'app.kubernetes.io/name': namePrefix, component: namePrefix},
    resources: ['cmap.yaml', 'deployment.yaml', 'hpa.yaml', 'service.yaml'],
  };
}

function getPatch() {
  return {
    apiVersion: 'kustomize.config.k8s.io/v1beta1',
    kind: 'Kustomization',
    resources: ['../../base'],
    patchesStrategicMerge: ['configmap.yaml', 'hpa.yaml', 'deployment.yaml'],
  };
}
