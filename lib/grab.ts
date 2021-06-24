import { createReadStream, accessSync, constants } from 'fs';
import * as unzipper from 'unzipper';
import { Writer } from 'fstream';
import Logger from './logger';
import { grabVars, Folder } from '../vars';

/**
 * Grab data from minecraft .jar file
 * @param  {{ file, debug }} .jar path and debug boolean
 */
export default async ({ file, debug }: {
  file: string,
  debug: boolean,
}) => {
  // init logger
  const logger = new Logger(debug);

  // check is file exist and we can work with it
  try {
    accessSync(file, constants.F_OK | constants.W_OK | constants.R_OK);
  } catch (error) {
    logger.log(error);
    throw new Error('Can\'t open file');
  }

  // parse .jar file
  createReadStream(file)
    .pipe(unzipper.Parse())
    .on('entry', (entry) => {
      // check for files
      if (entry.type !== 'Directory') {
        logger.log('Checking file:', entry.type, entry.path);

        // work with each pattern fron 'grabVars'
        for (let i = 0; i < grabVars.folders.length; i += 1) {
          // current pattern
          const path: Folder = grabVars.folders[i];

          // if file matches regexp
          const found = path.pattern.exec(entry.path);
          if (found) {
            // unzip file and save
            logger.log(`${grabVars.rawDataPath}${path.saveTo}${found[1]}`);
            entry.pipe(Writer({
              path: `${grabVars.rawDataPath}${path.saveTo}${found[1]}`,
            }));

            logger.log(`Matches ${path.pattern}, saved to ${path.saveTo}`);
            return;
          }
        }
        // check next
        entry.autodrain();
      }
    });
};
