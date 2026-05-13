import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'cjs',
  target: ['es2018'],
  sourcemap: true,
  external: ['obsidian'],
  outfile: 'main.js',
});
