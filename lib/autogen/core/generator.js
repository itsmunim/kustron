const path = require('path');
const fs = require('fs');
const jsYaml = require('js-yaml');

const models = require('../models');

const MAIN_DIR = path.resolve(__dirname, 'k8s');

function generateBase(config) {
  _createOverlayDirs(config);

  const yamlMap = {};

  Object.keys(models).forEach((modelName) => {
    const k8sResource = models[modelName].getBase(config);
    yamlMap[modelName] = jsYaml.dump(k8sResource);
  });
}

/**
 * Create overlay directories for each targets.
 *
 * @param {*} config
 */
function _createOverlayDirs(config) {
  const dirs = ['base', ...config.targets.map((t) => t.targetName)];
  if (fs.existsSync(MAIN_DIR)) {
    // as a safety measure, delete existing
    fs.unlinkSync(MAIN_DIR);
    fs.mkdirSync(MAIN_DIR);
  }

  dirs.forEach((dir) => {
    const dirPath = path.resolve(MAIN_DIR, dir);
    fs.mkdirSync(dirPath);
  });
}

function _dumpYamls(baseDir, yamlMap) {
  
}
