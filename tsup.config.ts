import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/bin/kustron.ts',
    'src/scripts/postinstall.ts',
  ],
  outDir: 'dist',
  format: ['esm'],
  target: 'node18',
  splitting: true,
  bundle: true,
  sourcemap: true,
  clean: true,
  minify: false,
  shims: true,
})
