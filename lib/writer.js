const fs = require('fs');
const path = require('path');

function writeBaseFiles(rootPath, fileMap) {
  write(rootPath, fileMap, 'base');
}

function writeOverrideFiles(rootPath, fileMap, env = 'dev') {
  write(rootPath, fileMap, env);
}

/**
 * Given a filemap of filename vs file content along with
 * a folder path, creates all the .yml files.
 * @param {*} rootPath the absolute path of where the output folder exists
 * @param {*} fileMap contains file content against it's name as key
 * @param {*} folder the output folder
 */
function write(rootPath, fileMap, folder) {
  Object.keys(fileMap).forEach((fileName) => {
    const dumpPath = path.join(rootPath, folder, `${fileName}.yml`);
    fs.writeFileSync(dumpPath, fileMap[fileName]);
  });
}

module.exports = {
  writeBaseFiles,
  writeOverrideFiles,
};