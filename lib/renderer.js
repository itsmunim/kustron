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
const configFiles = ['hpa', 'configmap'];

function renderBaseFiles(data) {
  return renderFiles(baseTplDirPath, data);
}

function renderOverrideFiles(data) {
  return renderFiles(overridesTplDirPath, data);
}

/**
 * Render template files in a given dir.
 * @param {*} dirPath 
 * @param {*} data 
 */
function renderFiles(dirPath, data) {
  if (!dirPath || !data) {
    throw new Error('Either dirPath or data is not provided.');
  }

  const tplContentMap = {};
  fs.readdirSync(dirPath).forEach((f) => {
    const tplPath = path.join(baseTplDirPath, f);
    const tplKey = isConfigType(f) ? `config/${f}` : f;
    tplContentMap[tplKey] = render(tplPath, data);
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

module.exports = {renderBaseFiles, renderOverrideFiles};
