const { createRequire } = require('node:module');

const dependencies = createRequire(require('node:path').resolve(__dirname, '../../package.json'));
const metro = dependencies('metro-babel-transformer');
const typescript = dependencies.resolve('@babel/plugin-transform-typescript');

exports.transform = (options) => metro.transform(options.filename.endsWith('.ts')
  ? { ...options, plugins: [typescript, ...options.plugins] }
  : options);
