import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'bin/kustron': 'src/bin/kustron.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  target: 'node18',
  splitting: true,
  bundle: true,
  sourcemap: true,
  clean: true,
  minify: false,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
})
