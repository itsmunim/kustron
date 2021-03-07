const deployment = require('./deployment');
const cmap = require('./cmap');
const service = require('./service');
const ingress = require('./ingress');
const hpa = require('./hpa');

module.exports = {
  deployment,
  cmap,
  service,
  ingress,
  hpa,
};
