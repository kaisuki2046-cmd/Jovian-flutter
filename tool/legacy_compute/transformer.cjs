const { createRequire } = require('node:module');
const { join } = require('node:path');

const dependencies = createRequire(join(process.env.JOVIAN_LEGACY_NODE_ROOT, 'package.json'));
const metro = dependencies('metro-babel-transformer');
const typescript = dependencies.resolve('@babel/plugin-transform-typescript');

exports.transform = (options) => metro.transform(options.filename.endsWith('.ts')
  ? { ...options, plugins: [typescript, ...options.plugins] }
  : options);
