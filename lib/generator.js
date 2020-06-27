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
    // render base and override manifests
    const deplOutputPath = `${outputRootDir}/deployment`;
    logger.debug('kustron: generating k8s manifest files.');
    writer.writeBaseFiles(deplOutputPath, renderer.renderBaseFiles(data));
    overrides.forEach((env) => {
      writer.writeOverrideFiles(
        deplOutputPath,
        renderer.renderOverrideFiles(data),
        env
      );
    });
    // render pipeline files
    logger.debug('kustron: generating dockerfile.');
    writer.write(outputRootDir, 'Dockerfile', renderer.renderImageFile(data));
    if (answers.generatepipeline) {
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

    logger.debug(
      'kustron: completed generating the manifest and other necessary files.'
    );
  } catch (err) {
    logger.error('kustron: failed to execute your request.', err);
    pman.makeBadExit();
  }
}

module.exports = generate;
