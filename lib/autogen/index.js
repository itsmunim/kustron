const fs = require('fs');
const path = require('path');
const jsYaml = require('js-yaml');

const helper = require('./core/helper');
const logger = require('./core/logger');

const APP_YAML_PATH = path.resolve(__dirname, 'k8s-app.yaml');

function run() {
  let json;
  if (!fs.existsSync(APP_YAML_PATH)) {
    logger.error(`There's no k8s-app.yaml file available in the current dir`);
    process.exit(1);
  }

  try {
    json = jsYaml.load(fs.readFileSync(APP_YAML_PATH, 'utf8'));
  } catch (ex) {
    logger.error('Failed to load k8s-app.yaml', ex);
  }

  const appConfig = helper.toConfig(json);
}
