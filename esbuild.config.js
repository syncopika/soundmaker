// https://jamesthom.as/2021/05/setting-up-esbuild-for-typescript-libraries/

const esbuild = require('esbuild')

// Automatically exclude all node_modules from the bundled version
const { nodeExternalsPlugin } = require('esbuild-node-externals')

esbuild.build({
  entryPoints: ['./src/soundmaker.ts'],
  outfile: 'dist/soundmaker.js',
  bundle: true,
  minify: true,
  //platform: 'node',
  sourcemap: true,
  //target: 'node14',
  plugins: [nodeExternalsPlugin()]
}).catch(() => process.exit(1))