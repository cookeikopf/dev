import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 85,
        branches: 75,
        statements: 80,
      },
    },
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true,
    },
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
