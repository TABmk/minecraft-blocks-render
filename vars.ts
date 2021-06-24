export interface Folder {
  pattern: RegExp,
  saveTo: string,
}

interface GrabVars {
  folders: Array<Folder>,
  rawDataPath: string,
}

interface DefaultMinecraftPath {
  darwin: string,
  linux: string,
  win32: string,
  indexes: string,
  objects: string,
  language: RegExp,
  languagePattern: string,
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

export const defaultMinecraftPath: DefaultMinecraftPath = {
  darwin: '/Library/Application Support/minecraft',
  linux: '/.minecraft',
  win32: '%AppData%/.minecraft',
  indexes: '/assets/indexes',
  objects: '/assets/objects',
  language: /minecraft\/lang\/(.*)\.json/i,
  languagePattern: 'minecraft/lang/%LANG%.json',
};
