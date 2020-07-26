const inquirer = require('inquirer');
const logger = require('./logger');
const pman = require('./processman');
const renderer = require('./renderer');
const writer = require('./writer');
const inquiries = require('../config/inquiries');

const overrides = ['dev', 'stg', 'prd'];

async function generate(...options) {
  const outputRootDir = `${options[1] || process.cwd()}`;

  try {
    const answers = await inquirer.prompt(inquiries);
    const data = {app: answers};
    generateK8SManifests(outputRootDir, data);
    generatePipelineFiles(outputRootDir, data)

    logger.debug(
      'kustron: completed generating the manifest and other necessary files.'
    );
  } catch (err) {
    logger.error('kustron: failed to execute your request.', err);
    pman.makeBadExit();
  }
}

function generateK8SManifests(outputRootDir, data) {
  const deplOutputPath = `${outputRootDir}/deployment`;
  logger.debug('kustron: generating k8s manifest files.');

  const ignoreFiles = getIgnoredFiles(data.app);
  writer.writeBaseFiles(
    deplOutputPath,
    renderer.renderBaseFiles(data, ignoreFiles)
  );
  overrides.forEach((env) => {
    writer.writeOverrideFiles(
      deplOutputPath,
      renderer.renderOverrideFiles(data, ignoreFiles),
      env
    );
  });
}

function generatePipelineFiles(outputRootDir, data) {
  if (data.app.generatepipeline) {
    // TODO: make more generic so that any makefile or pipeline file can
    // can be generated.
    logger.debug('kustron: generating pipeline files.');
    const pipelineFiles = renderer.renderPipelineFiles(data);
    writer.write(outputRootDir, 'Makefile', pipelineFiles.makefiles.gcp);
    writer.write(
      outputRootDir,
      '.gitlab-ci.yml',
      pipelineFiles.pipelines.gitlab
    );
  }
}

function getIgnoredFiles(answers) {
  const ignoreFiles = [];
  if (!answers.exposed) {
    ignoreFiles.push('ingress');
  }
  if (!answers.enableautoscale) {
    ignoreFiles.push('hpa');
  }

  return ignoreFiles;
}

module.exports = generate;
