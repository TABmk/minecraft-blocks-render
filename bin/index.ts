#!/usr/bin/env node

import * as yargs from 'yargs';
import grab from '../lib/grab';
import lang from '../lib/lang';

const commands = {
  grab,
  lang,
};

const options = yargs
  .usage('Usage: $0 <command> [options]')
  .command('grab', 'grabs textures from minecraft .jar file', (opts) => (
    opts
      .example([
        ['$0 grab -f 1.16.2.jar'],
      ])
      .option('file', {
        alias: 'f',
        nargs: 1,
        demandOption: true,
        describe: 'Load a file',
      })
      .option('extra', {
        nargs: 0,
        describe: 'Grab extra files from /data/',
      })
      .option('debug', {
        alias: 'd',
        nargs: 0,
        describe: 'Shows debug info of extraction',
      })
  ))
  .command('lang', 'grabs lang files from minecraft folders', (opts) => (
    opts
      .example([
        ['$0 lang -l version'],
        ['$0 lang -l lang'],
      ])
      .option('versions', {
        alias: 'vers',
        nargs: 0,
        describe: 'Prints all installed versions with .json data',
      })
      .option('language', {
        alias: 'vl',
        nargs: 1,
        describe: 'Prints all available languages for this version',
      })
      .option('get', {
        alias: 'g',
        nargs: 1,
        describe: 'Save translate locally',
      })
      .option('path', {
        alias: 'p',
        nargs: 1,
        describe: 'minecraft folder path',
      })
      .option('debug', {
        alias: 'd',
        nargs: 0,
        describe: 'Shows debug info of extraction',
      })
  ))
  .demandCommand(1, 1)
  .help('h')
  .alias('h', 'help')
  .strict()
  .argv;

// Start command. Incorrect commands can't pass here due .strict()
// @ts-ignore
commands[options._[0]](options);
