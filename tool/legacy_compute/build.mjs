import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const dependencyRoot = resolve(process.env.JOVIAN_LEGACY_NODE_ROOT ?? repoRoot);
const modules = join(dependencyRoot, 'node_modules');
const require = createRequire(join(dependencyRoot, 'package.json'));
const { runBuild } = require('metro');
const { getDefaultConfig, mergeConfig } = require('metro-config');
process.env.JOVIAN_LEGACY_NODE_ROOT = dependencyRoot;

const entry = fileURLToPath(new URL('./worker.ts', import.meta.url));
const output = join(repoRoot, 'app-flutter', 'web', 'legacy-compute.js');
await mkdir(dirname(output), { recursive: true });
const defaults = await getDefaultConfig(repoRoot);
const config = mergeConfig(defaults, {
  watchFolders: [join(repoRoot, 'src'), dirname(entry), modules],
  resolver: {
    nodeModulesPaths: [modules],
    sourceExts: [...defaults.resolver.sourceExts, 'mjs'],
    useWatchman: false,
  },
  transformer: {
    babelTransformerPath: fileURLToPath(new URL('./transformer.cjs', import.meta.url)),
    enableBabelRCLookup: false,
    getTransformOptions: async () => ({ transform: { experimentalImportSupport: true } }),
  },
  maxWorkers: 2,
});
await runBuild(config, {
  entry,
  out: output,
  platform: 'web',
  dev: false,
  minify: true,
});
console.log('Built app-flutter/web/legacy-compute.js');
