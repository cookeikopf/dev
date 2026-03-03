import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react/index.ts',
    actions: 'src/actions/index.ts'
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
  external: [
    'react',
    'react-dom',
    'viem',
    'wagmi',
    '@tanstack/react-query'
  ],
  esbuildOptions(options) {
    options.banner = {
      js: '"use client"'
    };
  }
});
