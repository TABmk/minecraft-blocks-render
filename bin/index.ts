#!/usr/bin/env node

import * as yargs from 'yargs';
import grab from '../lib/grab';

const commands = {
  grab,
};

const options = yargs
  .usage('Usage: $0 <command> [options]')
  .command('grab', 'grabs textures from minecraft .jar file', (opts) => (
    opts
      .example([
        ['$0 grab -f 1.16.2.jar'],
      ])
      .alias('f', 'file')
      .nargs('f', 1)
      .describe('f', 'Load a file')
      .demandOption(['f'])
      .alias('d', 'debug')
      .nargs('d', 0)
      .describe('d', 'Shows debug info of extraction')
  ))
  .demandCommand(1, 1)
  .help('h')
  .alias('h', 'help')
  .strict()
  .argv;

// Start command. Incorrect commands can't pass here due .strict()
// @ts-ignore
commands[options._[0]](options);
