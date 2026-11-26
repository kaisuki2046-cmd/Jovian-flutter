import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
const nativeOutput = fileURLToPath(new URL('./native_assets/legacy-compute.html', import.meta.url));
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
