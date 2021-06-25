import {
  readdir, constants, accessSync, readFileSync,
} from 'fs';
import * as os from 'os';
import { Reader, Writer } from 'fstream';
import Logger from './logger';
import { defaultMinecraftPath, grabVars } from '../vars';

/**

    TODO: fix options names!

 */

// each file data
interface MinecraftIndex {
  hash: string,
  size: number,
}

// minecraft files data from "objects" object in version file
interface MinecraftData {
  objects: [pathKeys: MinecraftIndex]
}

/**
 * defaultPath
 * @param  path path to game folder
 * @return      passed path or default for os
 */
// eslint-disable-next-line
const defaultPath = (path: string) => {
  // if path passed, return it
  if (path) {
    return path;
  }

  // get os name
  const platform: string = os.platform();

  // return default path for each os
  if (platform === 'darwin') {
    return `${os.homedir()}${defaultMinecraftPath.darwin}`;
  }
  if (platform === 'linux') {
    return `${os.homedir()}${defaultMinecraftPath.linux}`;
  }
  if (platform === 'win32') {
    return defaultMinecraftPath.win32;
  }
};

/**
 * handle --versions (--vers) option
 * @param  path   custom game path
 * @param  logger custom logger
 */
const handleVersion = (path: string, logger: Logger) => {
  logger.log(`Checking path: ${defaultPath(path)}${defaultMinecraftPath.indexes}`);

  readdir(`${defaultPath(path)}${defaultMinecraftPath.indexes}`, (err, files) => {
    logger.log(err);
    console.log('Select one version:\nExample: mbr lang --vl 1.23.json\n');
    // print each version files
    files.forEach((file) => {
      if (/\.json$/.test(file)) {
        console.log(` - ${file}`);
      } else {
        logger.log('Not .json file', file);
      }
    });
  });
};

/**
 * handle --language (--vl) option
 * @param  path     custom game path
 * @param  language version file name
 * @param  logger   custom logger
 */
const handleLanguages = (
  path: string,
  language: string,
  logger: Logger,
) => {
  const filePath: string = `${defaultPath(path)}${defaultMinecraftPath.indexes}/${language}`;

  logger.log(`Checking path: ${filePath}`);

  try {
    accessSync(filePath, constants.F_OK | constants.W_OK | constants.R_OK);
  } catch (error) {
    logger.log(error);
    throw new Error(`Can't open file ${filePath}`);
  }

  // load version data
  const file: string = readFileSync(filePath).toString();
  const data: MinecraftData = JSON.parse(file);

  // get object keys, which are language codes like en_ud
  const indexes: Array<string> = Object.keys(data.objects);

  console.log('Select languages:\nExample: mbr lang --vl 1.23.json --get en_ud\n');

  // print each language code
  for (let i = 0; i < indexes.length; i += 1) {
    if (defaultMinecraftPath.language.test(indexes[i])) {
      console.log(` - ${indexes[i].match(defaultMinecraftPath.language)[1]}`);
    }
  }
};

/**
 * handle --get (-g) option
 * @param  path     custom game path
 * @param  get      language code
 * @param  language version file name
 * @param  logger   custom logger
 */
const handleGet = (
  path: string,
  get: string,
  language: string,
  logger: Logger,
) => {
  const versionPath: string = `${defaultPath(path)}${defaultMinecraftPath.indexes}/${language}`;

  logger.log(`Checking path: ${versionPath}`);

  try {
    accessSync(versionPath, constants.F_OK | constants.W_OK | constants.R_OK);
  } catch (error) {
    logger.log(error);
    throw new Error(`Can't open file ${versionPath}`);
  }

  // load version data
  const file: string = readFileSync(versionPath).toString();
  const data: MinecraftData = JSON.parse(file);

  const index: string = defaultMinecraftPath.languagePattern.replace('%LANG%', get);

  // check if code exists
  if (data.objects.hasOwnProperty(index)) {
    logger.log('Index:', data.objects[index]);

    // get file name
    const { hash } = data.objects[index];

    // files are located in minecraft/assets/objects/xx/yyy
    // where xx - two first chars of hash, yyy - hash
    const langFile = `${defaultPath(path)}${defaultMinecraftPath.objects}/${hash.substring(0, 2)}/${hash}`;

    logger.log(`Checking lang file path: ${langFile}`);

    try {
      accessSync(langFile, constants.F_OK | constants.W_OK | constants.R_OK);
    } catch (error) {
      logger.log(error);
      throw new Error(`Can't open file ${langFile}`);
    }

    logger.log(`Writing file to: ${grabVars.rawDataPath}/${get}.json`);

    // copy lang file locally
    Reader(langFile)
      .pipe(Writer(`${grabVars.rawDataPath}/${get}.json`));
  } else {
    console.log(`Can't find language "${get}" in ${language}`);
  }
};

/**
 * lang command options
 * @param  {{ path, language, versions, get, debug }}
 */
export default async ({
  path,
  language,
  versions,
  get,
  debug,
}: {
  path: string,
  language: string,
  versions: boolean,
  get: string,
  debug: boolean,
}) => {
  const logger: Logger = new Logger(debug);

  try {
    accessSync(defaultPath(path), constants.F_OK | constants.W_OK | constants.R_OK);
  } catch (error) {
    logger.log(error);
    throw new Error(`Can't open folder ${defaultPath(path)}`);
  }

  if (versions) {
    handleVersion(path, logger);
    return;
  }

  if (get && language) {
    handleGet(path, get, language, logger);
    return;
  }
  if (language) {
    handleLanguages(path, language, logger);
  }
};
