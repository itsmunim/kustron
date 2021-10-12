function getBase(name, namespace, isExposed) {
	const resources = [
		'cmap.yaml',
		'deployment.yaml',
		'hpa.yaml',
		'service.yaml',
	];

	if (isExposed) {
		resources.push('ingress.yaml');
	}

	return {
		apiVersion: 'kustomize.config.k8s.io/v1beta1',
		kind: 'Kustomization',
		namespace,
		commonLabels: { 'app.kubernetes.io/name': name, component: name },
		resources,
	};
}

function getPatch(name) {
	return {
		apiVersion: 'kustomize.config.k8s.io/v1beta1',
		kind: 'Kustomization',
		resources: ['../../base'],
		patchesStrategicMerge: ['cmap-patch.yaml'],
		patchesJson6902: [
			{
				target: {
					group: 'apps',
					version: 'v1',
					kind: 'Deployment',
					name,
				},
				path: './deployment-patch.yaml',
			},
			{
				target: {
					group: 'autoscaling',
					version: 'v2beta2',
					kind: 'HorizontalPodAutoscaler',
					name,
				},
				path: './hpa-patch.yaml',
			},
		],
	};
}
