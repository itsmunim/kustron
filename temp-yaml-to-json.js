const fs = require('fs');
const path = require('path');
const js = require('js-yaml');
const util = require('util');

function run() {
  const args = process.argv;
  const fileName = args[2];
  if (!fileName || !fileName.endsWith('.yaml')) {
    throw Error('Need a yaml file');
  }

  const fPath = path.resolve(fileName);
  const json = js.safeLoad(fs.readFileSync(fPath, 'utf8'));
  console.log(util.inspect(json, {showHidden: false, depth: null}));
}

run();
