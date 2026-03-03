import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for integration tests
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/tests/integration/**/*.test.ts'],
    exclude: ['node_modules/', 'dist/'],
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 30000,
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
    },
  },
  resolve: {
    alias: {
      '@agentlink/core': './agentlink-core/src',
      '@agentlink/a2a': './a2a-protocol/src',
    },
  },
});
