#!/usr/bin/env node

const yargs = require("yargs");
const commands = {
  grab: require('../lib/grab'),
  render: require('../lib/render')
}

const options = yargs
  .usage('Usage: $0 <command> [options]')
  .command("grab", "grabs textures from minecraft .jar file", (yargs) => (
    yargs
      .example('$0 grab -f 1.16.2.jar')
      .alias('f', 'file')
      .nargs('f', 1)
      .describe('f', 'Load a file')
      .demandOption(['f'])
      .alias('d', 'debug')
      .nargs('d', 0)
      .describe('d', 'Shows debug info of extraction')
  ))
  .command("render", "renders blocks images from /grab/blocks", (yargs) => (
    yargs
      .example('$0 render -t base -r 32 -s 10')
      .alias('rs', 'renderSides')
      .nargs('rs', 0)
      .describe('rs', 'add if want render blocks with side textures')
      .alias('rt', 'renderTransparent')
      .nargs('rt', 0)
      .describe('rt', 'add if want render blocks with transparent textures')
      .alias('r', 'reducer')
      .default('r', 1)
      .nargs('r', 1)
      .describe('r', 'image bit depth reducer. Bigger number will do more color reduce')
      .alias('s', 'scale')
      .default('s', 1)
      .nargs('s', 1)
      .describe('s', 'scale image without reducing quality. Warning! May cause edges bugs')
      .option('type', {
         alias: 't',
         describe: '"base" will generate JSON file where key - block name, value - base64 string. "png" will render png images for each block',
         choices: ['base', 'png']
       })
      .demandOption(['type'])
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
commands[options._[0]](options);
