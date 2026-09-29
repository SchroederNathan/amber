// The theme is TypeScript split across files, which the config loader can't
// require directly, so bundle just the modules native resources need.
const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');

module.exports = function loadTheme() {
  const { outputFiles } = buildSync({
    stdin: {
      contents: "export { buildColors } from './colors'; export { colorSchemes, defaultColorScheme } from './schemes';",
      resolveDir: path.dirname(require.resolve('../src/theme/colors.ts')),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
  });
  const theme = new Module('theme');
  theme._compile(outputFiles[0].text, 'theme.js');
  return theme.exports;
};
