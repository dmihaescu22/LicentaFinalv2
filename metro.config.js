const { getDefaultConfig } = require('@expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Adăugăm toate extensiile necesare
defaultConfig.resolver.sourceExts = [
    'js',
    'jsx',
    'json',
    'ts',
    'tsx',
    'cjs',
    'mjs'
];

// Dezactivăm câteva opțiuni care pot cauza probleme
defaultConfig.resolver.unstable_enablePackageExports = false;
defaultConfig.resolver.unstable_conditionNames = ['require', 'import'];

// Optimizăm cache-ul
defaultConfig.cacheStores = [];
defaultConfig.resetCache = true;

module.exports = defaultConfig; 