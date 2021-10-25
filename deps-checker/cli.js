#!/usr/bin/env node
const { existsSync, readFileSync } = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// TODO:Scope: 
// short flags
// loader
// messages for errors

const [,, ...args] = process.argv;

const versionsMap = {
  major: 0,
  minor: 1,
  patch: 2,
}

if (args.includes('--help')) {
  console.log(`
    Usage:
      check-versions [--path='./package.json'] [--level='major|minor|patch'] [--dependencies='dev|prod|all']
    Options:
      --path = Path to package.json. Default is ./package.json
      --level = Specify the level of the version to check. Default is major.
      --dependencies = Specify group of dependencies to check. Default is all. 
    `)
  return;
}

const getArg = getArgumentFromArgs(args);

const path = getArg('--path', './package.json')
  if (existsSync(path)) {
    const packageJson = readFileSync(path, 'utf8');
    const parsedPackageJson = JSON.parse(packageJson);

    const {dependencies, devDependencies} = parsedPackageJson;
    const depArg = getArg('--dependencies', 'all');
    const depsScope = ({
      dev: devDependencies,
      prod: dependencies,
      all: {...dependencies, ...devDependencies}
    })[depArg]

    for (const [packageName, packageVersion] of Object.entries(depsScope)) {
      getVersion(packageName, packageVersion.replace(/~|\^/g, ''));
    }
  }

function getVersion(packageName, packageCurrentVersion) {
  const level = getArg('--level', 'major');
  let versionLevelIdx = versionsMap[level];
  const versionLevel = getCurrentVersionLevel(packageCurrentVersion, versionLevelIdx);

  exec(`npm view ${packageName}@${versionLevel} version --json`)
    .then(({stdout: newPackageVersionJSON, stderr}) => {
      let newVersion = JSON.parse(newPackageVersionJSON)

      if (Array.isArray(newVersion)) {
        newVersion = newVersion[newVersion.length - 1];
      }

      // ^1.2.3 -> 123 
      const versionNumber = packageCurrentVersion
      const newVersionNumber = newVersion.replace(/\./g, '')

      // ^1.2.3 -> [2] when level index is 
      const currentVersionFragment = versionNumber[versionLevelIdx]
      const newVersionFragment = newVersionNumber[versionLevelIdx];
      
      if ((newVersionNumber > versionNumber) && (currentVersionFragment !== newVersionFragment)) {

        const output = coloredOutput(
          packageName, 
          selectLevel(packageCurrentVersion, versionLevelIdx), 
          selectLevel(newVersion, versionLevelIdx), 
        )

        process.stdout.write(output)
      }
    })
    .catch(err => {
      console.error(err);
      return;
    });
}

function coloredOutput(textToYellow, textToRed, textToGreen) {
  return `\x1b[33m${textToYellow}\x1b[0m: \x1b[31m${textToRed}\x1b[0m -> \x1b[32m${textToGreen} \n`;
}

// version = '1.2.3' and level = 1 -> '1.[2].3'
function selectLevel(version, level) {
  return version.split('.').map((fragment, index) => {
    if (index === level) {
      return `[${fragment}]`;
    }

    return fragment;
  }).join('.');
}

function getCurrentVersionLevel(version, idx) {
  return version
    .split('.')
    .slice(0, idx)
    .join('.')
}

function getArgumentFromArgs(args) {
  return function(flag, defaultValue) {
    const argString = args.find(v => v.startsWith(flag))
    return argString ? argString.split('=')[1].replace(/'/g, '') : defaultValue;
  }
}
