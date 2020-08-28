const fs = require('fs');
const unzipper = require('unzipper');
const { Writer } = require('fstream');

const blocsPath = /assets\/minecraft\/textures\/block\/(.*)/i;
const itemsPath = /assets\/minecraft\/textures\/item\/(.*)/i;

/**
 * grabs textures from minecraft .jar file
 * @param  {String}  file
 * @param  {Boolean} [debug=false]
 */
const grab = ({file, debug}) => {
  // check is file string, .access accept only string, Buffer or URL
  if (typeof file !== 'string') {
    console.error(`Can't open file`);
    return;
  }
  // check is file exist
  fs.access(file, fs.F_OK, (err) => {
    if (err) {
      console.error(`Can't open file`);
      return
    }

    fs.createReadStream(file)
      .pipe(unzipper.Parse())
      .on('entry', (entry) => {
        const blocks = blocsPath.exec(entry.path);
        const items = itemsPath.exec(entry.path);

        if (entry.type !== 'Directory' && (blocks || items)) {
          // save file
          if (debug) {
            console.log(entry.type, entry.path);
          }
          entry.pipe(Writer({
            path: `grab/${blocks ? `blocks/${blocks[1]}` : `items/${items[1]}`}`,
          }));
        } else {
          // parse next
          entry.autodrain();
        }
      });
  });
}

module.exports = grab;
