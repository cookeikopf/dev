import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'a2a/index': 'src/protocol/a2a/index.ts',
    'x402/index': 'src/protocol/x402/index.ts',
    'telemetry/index': 'src/telemetry/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  outDir: 'dist',
  external: ['viem'],
});
