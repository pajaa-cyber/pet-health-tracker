// @generated-note: not a template default — added because Metro's file
// watcher was silently stalling (never reaching "packager-status:running")
// after android/ started holding real native build output (Gradle
// caches, compiled classes, generated resources — 1000+ files after each
// on-device build). Same root cause diagnosed for Jest in jest.config.js;
// Metro needs its own exclusion since it has a separate crawler/config.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [/android\/.*/, /ios\/.*/];
config.watchFolders = [__dirname];

module.exports = config;
