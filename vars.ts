export interface Folder {
  pattern: RegExp,
  saveTo: string,
}

interface GrabVars {
  folders: Array<Folder>,
  rawDataPath: string,
}

// eslint-disable-next-line
export const grabVars: GrabVars = {
  folders: [{
    pattern: /assets\/minecraft\/textures\/block\/(.*)/i,
    saveTo: '/textures/block/',
  }, {
    pattern: /assets\/minecraft\/textures\/item\/(.*)/i,
    saveTo: '/textures/item/',
  }, {
    pattern: /assets\/minecraft\/blockstates\/(.*)/i,
    saveTo: '/blockstates/',
  }, {
    pattern: /assets\/minecraft\/models\/(.*)/i,
    saveTo: '/models/',
  }, {
    pattern: /^(version\.json)$/i,
    saveTo: '',
  },
  ],
  rawDataPath: './rawData/',
};
