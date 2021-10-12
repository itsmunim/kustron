function getBase(name, env) {
  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name,
    },
    data: env,
  };
}

module.exports = {
  getBase,
};
