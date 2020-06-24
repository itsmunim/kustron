#!/usr/bin/env node
const {program} = require('commander');
const chalk = require('chalk');
const figlet = require('figlet');
const generate = require('../lib/generator');

(async function execute() {
  console.log(
    chalk.yellow(figlet.textSync('Kustron', {horizontalLayout: 'full'}))
  );

  program
    .option(
      '-g, --generate',
      'generates a kustomize based kubernetes manifestation inside current dir.'
    )
    .option(
      '-p, --path <env>',
      `an absolute path where the manifest files will be generated.`
    )
    .parse(process.argv);

  if (!program.generate) {
    console.log(
      chalk.red('\nNo valid args are provided. Try -h to see help.\n')
    );
  } else {
    await generate(program.generate, program.path);
  }
})();

