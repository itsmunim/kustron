const { DEFAULTS } = require('./const');

function _getProbeDefinition(healthCheck) {
	const { path, port, type } = healthCheck;
	const portName = port ? 'management' : 'http-web';
	const probe = {
		httpGet: {
			path,
			port: portName,
		},
		initialDelaySeconds: DEFAULTS.POD_PROBE_INITIAL_DELAY,
		periodSeconds: DEFAULTS.POD_PROBE_PERIOD,
	};

	if (type === 'tcp') {
    probe['tcpSocket'] = {
      port: portName,
    };
    delete probe.httpGet;
  }
  
  return probe;
}

function _toResource({ cpu, memory = 512 }) {
	const req = {
		memory: `${memory}Mi`
	};
	
	if (cpu) {
		req['cpu'] = `${cpu}m`;
	}

	return req;
}

function getBase(name, port, requests, secrets, healthCheck) {
	const ports = [
		{
			name: 'http-web',
			containerPort: port,
		},
	];

	if (healthCheck.port) {
		ports.push({
			name: 'management',
			containerPort: healthCheck.port,
		});
  }
  
  const probe = _getProbeDefinition(healthCheck);

	const envFrom = [
		{
			configMapRef: {
				name,
			},
		},
		...secrets.map((name) => ({
			secretRef: {
				name,
			},
		})),
	];

	return {
		apiVersion: 'apps/v1',
		kind: 'Deployment',
		metadata: {
			name,
		},
		spec: {
			strategy: DEFAULTS.POD_ROLLOUT_STRATEGY,
			template: {
				spec: {
					containers: [
						{
							name,
							image: 'IMAGE_PLACEHOLDER',
							ports,
							resources: {
								limits: _toResource({
									memory: Math.max(DEFAULTS.POD_RESOURCE_LIMITS.memory, requests.memory)
								}),
								requests: _toResource(requests || DEFAULTS.POD_RESOURCE_REQUESTS),
							},
							readinessProbe: probe,
							livenessProbe: probe,
							envFrom,
							lifecycle: DEFAULTS.POD_LIFECYCLE,
						},
					],
					terminationGracePeriodSeconds: DEFAULTS.POD_TERMINATION_GRACE_PERIOD,
				},
			},
		},
	};
}

function getPatch(requests) {
  return [
    {
      op: 'replace',
      path: '/spec/template/spec/containers/0/resources',
      value: { requests }
    }
  ];
}

module.exports = {
  getBase,
  getPatch,
};
