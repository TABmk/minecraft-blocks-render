export interface Folder {
  pattern: RegExp,
  saveTo: string,
  isExtra: boolean,
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
    isExtra: false,
  }, {
    pattern: /assets\/minecraft\/textures\/item\/(.*)/i,
    saveTo: '/textures/item/',
    isExtra: false,
  }, {
    pattern: /assets\/minecraft\/blockstates\/(.*)/i,
    saveTo: '/blockstates/',
    isExtra: false,
  }, {
    pattern: /assets\/minecraft\/models\/(.*)/i,
    saveTo: '/models/',
    isExtra: false,
  }, {
    pattern: /^(version\.json)$/i,
    saveTo: '',
    isExtra: true,
  }, {
    pattern: /data\/minecraft\/(.*)/i,
    saveTo: '/data/',
    isExtra: true,
  }],
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
