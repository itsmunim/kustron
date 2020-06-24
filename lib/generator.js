const inquirer = require('inquirer');
const logger = require('./logger');
const pman = require('./processman');
const renderer = require('./renderer');
const writer = require('./writer');
const inquiries = require('../config/inquiries');

const overrides = ['dev', 'stg', 'prd'];

async function generate(...options) {
  const rootPath = options[1] || process.cwd();
  try {
    const answers = await inquirer.prompt(inquiries);
    const data = {app: answers};
    writer.writeBaseFiles(rootPath, renderer.renderBaseFiles(data), 'deployment/base');
    overrides.forEach(env => {
      writer.writeOverrideFiles(rootPath, renderer.renderOverrideFiles(data), env);
    });
  } catch (err) {
    logger.error('generate: failed.', err);
    pman.makeBadExit();
  }
}

module.exports = generate;
