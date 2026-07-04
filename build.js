import { build, context } from 'esbuild';
import progress from '@olton/esbuild-plugin-progress';
import { replace } from 'esbuild-plugin-replace';
import pkg from './package.json' with { type: 'json' };

const production = process.env.MODE === 'production';
const version = pkg.version;

const banner = `
/*!
 * Reactive v${version}
 * Build: ${new Date().toLocaleString()}
 * Copyright 2012-${new Date().getFullYear()} by Serhii Pimenov
 * Licensed under MIT
 */
`;

const options = {
  entryPoints: ['./src/index.js'],
  outfile: './dist/reactive.js',
  bundle: true,
  sourcemap: false,
  format: 'esm',
  banner: {
    js: banner,
  },
  plugins: [
    progress({
      text: 'Building Reactive...',
      succeedText: `Reactive built successfully in %s ms!`,
    }),
    replace({
      __BUILD_TIME__: new Date().toLocaleString(),
      __VERSION__: version,
    }),
  ],
};
const drop = [];

if (production) {
  await build({
    ...options,
    drop,
  });
} else {
  const ctx = await context({
    ...options,
  });

  await Promise.all([ctx.watch()]);
}
