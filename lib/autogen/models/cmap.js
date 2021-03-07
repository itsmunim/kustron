function getBase({namePrefix, env}) {
  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: `${namePrefix}-cmap`,
    },
    data: env,
  };
}

module.exports = {
  getBase,
};
