const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const pman = require('./processman');
const logger = require('./logger');

const baseTplDirPath = path.resolve(__dirname, '../templates/deployment/base');
const overridesTplDirPath = path.resolve(
  __dirname,
  '../templates/deployment/overrides'
);
const makefilesTplDirPath = path.resolve(__dirname, '../templates/makefiles');
const pipelinefilesTplDirPath = path.resolve(
  __dirname,
  '../templates/pipelines'
);
const configFiles = ['hpa', 'configmap', 'cert'];

function renderBaseFiles(data, ignoreFiles = []) {
  return renderFiles(baseTplDirPath, data, ignoreFiles);
}

function renderOverrideFiles(data, ignoreFiles = []) {
  return renderFiles(overridesTplDirPath, data, ignoreFiles);
}

function renderPipelineFiles(data) {
  return {
    makefiles: {
      gcp: render(path.join(makefilesTplDirPath, 'Makefile'), data),
    },
    pipelines: {
      gitlab: render(path.join(pipelinefilesTplDirPath, 'gitlab'), data),
    },
  };
}

/**
 * Render template files in a given dir.
 * @param {*} dirPath
 * @param {*} data
 * @param {array} ignoreFiles Files that should be ignored, e.g. ['ingress', 'hpa']
 */
function renderFiles(dirPath, data, ignoreFiles = []) {
  if (!dirPath || !data) {
    throw new Error('Either dirPath or data is not provided.');
  }

  const tplContentMap = {};
  fs.readdirSync(dirPath).forEach((f) => {
    if (!ignoreFiles.includes(f)) {
      const tplPath = path.join(dirPath, f);
      const tplKey = isConfigType(f) ? `config/${f}` : f;
      tplContentMap[tplKey] = render(tplPath, data);
    }
  });

  return tplContentMap;
}

/**
 * Render a template file with given data.
 *
 * @param {*} tplPath
 * @param {*} data
 */
function render(tplPath, data) {
  if (!fs.existsSync(tplPath)) {
    logger.error(`template render failed; ${tplPath} was not found.`);
    pman.makeBadExit();
  }

  try {
    const tpl = fs.readFileSync(tplPath, 'utf8');
    const compiled = handlebars.compile(tpl);
    return compiled(data);
  } catch (err) {
    logger.error(`template render failed.`, err);
    pman.makeBadExit();
  }
}

function isConfigType(tplName) {
  return configFiles.includes(tplName);
}

module.exports = {
  renderBaseFiles,
  renderOverrideFiles,
  renderPipelineFiles,
};
