const DEFAULTS = {
	POD_RESOURCE_REQUESTS: {
		cpu: 200,
		memory: 512,
	},
	POD_RESOURCE_LIMITS: {
		memory: 512,
	},
	POD_LIFECYCLE: {
		preStop: {
			exec: {
				command: ['/bin/sleep', '30'],
			},
		},
	},
	POD_TERMINATION_GRACE_PERIOD: 60,
	POD_RESOURCE_USAGE: {
		type: 'Utilization',
		averageUtilization: 80,
	},
	POD_ROLLOUT_STRATEGY: {
		type: 'RollingUpdate',
		rollingUpdate: { maxSurge: 1, maxUnavailable: 1 },
	},
	POD_PROBE_INITIAL_DELAY: 20,
	POD_PROBE_PERIOD: 10,
};

module.exports = {
	DEFAULTS,
};
