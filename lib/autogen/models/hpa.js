const { DEFAULTS } = require('./const');

function getBase(name, minReplicas, maxReplicas) {
	return {
		apiVersion: 'autoscaling/v2beta2',
		kind: 'HorizontalPodAutoscaler',
		metadata: {
			name,
		},
		spec: {
			scaleTargetRef: {
				apiVersion: 'apps/v1',
				kind: 'Deployment',
				name,
			},
			minReplicas,
			maxReplicas,
			metrics: [
				{
					type: 'Resource',
					resource: {
						name: 'cpu',
						target: DEFAULTS.POD_RESOURCE_USAGE,
					},
				},
				{
					type: 'Resource',
					resource: {
						name: 'memory',
						target: DEFAULTS.POD_RESOURCE_USAGE,
					},
				},
			],
		},
	};
}

function getPatch({ minReplicas, maxReplicas }) {
	return [
		{ op: 'replace', path: '/spec/minReplicas', value: minReplicas },
		{ op: 'replace', path: '/spec/maxReplicas', value: maxReplicas },
	];
}

module.exports = {
	getBase,
	getPatch,
};
