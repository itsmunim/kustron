const inquirer = require('inquirer');
const logger = require('./logger');
const pman = require('./processman');
const renderer = require('./renderer');
const writer = require('./writer');
const inquiries = require('../config/inquiries');

const overrides = ['dev', 'stg', 'prd'];

async function generate(...options) {
  const outputRootDir = `${options[1] || process.cwd()}/deployment`;

  try {
    const answers = await inquirer.prompt(inquiries);
    const data = {app: answers};
    writer.writeBaseFiles(outputRootDir, renderer.renderBaseFiles(data));
    overrides.forEach((env) => {
      writer.writeOverrideFiles(
        outputRootDir,
        renderer.renderOverrideFiles(data),
        env
      );
    });
  } catch (err) {
    logger.error('generate: failed.', err);
    pman.makeBadExit();
  }
}

module.exports = generate;
