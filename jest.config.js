/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // This project lives inside a OneDrive-synced folder (Files On-Demand):
  // every file, hydrated or not, shows up to Node as a reparse point/symlink
  // (fs.Dirent.isFile() is false, isSymbolicLink() is true), not a plain
  // regular file. Jest's default crawler skips non-regular files, which
  // silently made it find zero tests despite __tests__ being right there.
  // enableSymlinks makes the crawler follow/stat them instead of skipping.
  haste: { enableSymlinks: true },
  watchman: false,
  // android/ now holds real native build output (Gradle caches, compiled
  // classes, generated resources - 1000+ files after a couple of on-device
  // builds), which was separately slowing/breaking Jest's file crawler.
  // Never JS/test content, so it's safe to exclude outright.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/android/'],
  modulePathIgnorePatterns: ['<rootDir>/android/'],
  watchPathIgnorePatterns: ['<rootDir>/android/'],
};
