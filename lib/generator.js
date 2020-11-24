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
    const data = {app: embedComputedHPAValues(answers)};
    generateK8SManifests(outputRootDir, data);
    generatePipelineFiles(outputRootDir, data);

    logger.debug(
      'kustron: completed generating the manifest and other necessary files.'
    );
  } catch (err) {
    logger.error('kustron: failed to execute your request.', err);
    pman.makeBadExit();
  }
}

/**
 * Generates the base k8s config files.
 *
 * @param {*} outputRootDir
 * @param {*} data
 */
function generateK8SManifests(outputRootDir, data) {
  const deplOutputPath = `${outputRootDir}/k8s`;
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

/**
 * Generates necessary pipeline files if was opted in.
 *
 * @param {*} outputRootDir
 * @param {*} data
 */
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

/**
 * Based on opt-ins, finds the files should be ignored from generation.
 *
 * @param {*} answers
 */
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

/**
 * Calculates the actual avg utilization values for HPA.
 *
 * @param {*} appConfig
 */
function embedComputedHPAValues(appConfig) {
  const {
    cpulimit,
    memorylimit,
    initialmemory,
    initialcpu,
    cputhreshold,
    memthreshold,
  } = appConfig;

  return Object.assign(
    {},
    {
      cpuavgutilization: calculateAvgUtilization(
        cpulimit,
        initialcpu,
        cputhreshold
      ),
      memavgutilization: calculateAvgUtilization(
        memorylimit,
        initialmemory,
        memthreshold
      ),
    },
    appConfig
  );
}

/**
 * Calculates an avg utilization considering `limitVal` as the
 * upper range and percentage to be reachable fraction.
 *
 * @param {*} limitVal
 * @param {*} initialVal
 * @param {*} percentage
 */
function calculateAvgUtilization(limitVal, initialVal, percentage) {
  const suffix = /m|Mi|Gi/g;
  const upperLimit = (limitVal.replace(suffix, '') / 100.0) * percentage;
  const utilizationRatio = upperLimit / initialVal.replace(suffix, '');
  return utilizationRatio * 100;
}

module.exports = generate;
