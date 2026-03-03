import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'adapters/hono': 'src/adapters/hono.ts',
    'adapters/express': 'src/adapters/express.ts',
    'adapters/next': 'src/adapters/next.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'es2022',
  platform: 'node',
  external: ['express', 'hono', 'next'],
});
