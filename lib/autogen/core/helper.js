/**
 * Transforms into generator compatible config object
 * @param {*} json
 */
function toConfig(json) {
  const transformed = {};
  const {
    name,
    namespace,
    port,
    healthCheck,
    autoScaling,
    resourcePerInstance,
    targets,
    env,
  } = json;

  if (!namespace) {
    namespace = `ns-${name}`;
  }

  transformed.namePrefix = name;
  transformed.namespace = namespace;
  transformed.port = port;
  transformed.healthCheck = healthCheck;
  transformed.minReplicas = autoScaling.min;
  transformed.maxReplicas = autoScaling.max;
  transformed.requests = {
    cpu: `${resourcePerInstance.cpu * 1000}m`,
    memory: `${resourcePerInstance.memory}Mi`,
  };
  transformed.limits = {
    memory: `${resourcePerInstance.memory}Mi`,
  };
  transformed.env = env;
  transformed.targets = targets.map((target) => {
    const _ = {};
    _.namePrefix = name;
    _.targetName = target.name;
    _.exposePath = target.expose.path;
    _.ipName = target.expose.ipName;
    _.secretName = target.expose.certName;
    _.env = target.env;
  }) || [];

  return transformed;
}

module.exports = {
  toConfig,
};
