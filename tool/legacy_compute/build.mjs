import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frontendRoot, legacyRoot } from './paths.mjs';

const dependencyRoot = legacyRoot;
const modules = join(dependencyRoot, 'node_modules');
const require = createRequire(join(dependencyRoot, 'package.json'));
const { runBuild } = require('metro');
const { getDefaultConfig, mergeConfig } = require('metro-config');

const entry = fileURLToPath(new URL('./worker.ts', import.meta.url));
const output = join(frontendRoot, 'web', 'legacy-compute.js');
const nativeOutput = fileURLToPath(new URL('./native_assets/legacy-compute.html', import.meta.url));
await mkdir(dirname(output), { recursive: true });
const defaults = await getDefaultConfig(legacyRoot);
const config = mergeConfig(defaults, {
  watchFolders: [join(legacyRoot, 'src'), dirname(entry), modules],
  resolver: {
    nodeModulesPaths: [modules],
    sourceExts: [...defaults.resolver.sourceExts, 'mjs'],
    useWatchman: false,
    resolveRequest(context, specifier, platform) {
      const prefix = 'jovian-legacy/';
      const target = specifier.startsWith(prefix)
        ? join(legacyRoot, 'src', specifier.slice(prefix.length))
        : specifier;
      return context.resolveRequest(context, target, platform);
    },
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
const program = (await readFile(output)).toString('base64');
const nativeRunner = await readFile(new URL('./native-runner.js', import.meta.url), 'utf8');
await mkdir(dirname(nativeOutput), { recursive: true });
await writeFile(nativeOutput, `<!doctype html>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; worker-src blob:; child-src blob:; base-uri 'none'; form-action 'none'">
<title>Jovian local calculation</title>
<script type="text/plain" id="jovian-compute-program">${program}</script>
<script>${nativeRunner}</script>
`);
console.log('Built local calculation assets for Web and the native WebView.');
