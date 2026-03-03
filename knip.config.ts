import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // Entry points for each package
  entry: [
    'packages/*/src/index.ts',
    'packages/*/src/index.tsx',
    'packages/dashboard/app/**/*.ts',
    'packages/dashboard/app/**/*.tsx',
    'packages/contracts/script/**/*.sol',
    'packages/contracts/test/**/*.sol'
  ],

  // Project files
  project: [
    'packages/*/src/**/*.ts',
    'packages/*/src/**/*.tsx',
    'packages/dashboard/app/**/*.ts',
    'packages/dashboard/app/**/*.tsx'
  ],

  // Ignore patterns
  ignore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/out/**',
    '**/coverage/**',
    '**/*.d.ts',
    '**/types/**',
    '**/generated/**',
    '**/contracts/lib/**',
    '**/contracts/out/**',
    '**/contracts/cache/**',
    '**/contracts/broadcast/**'
  ],

  // Ignore dependencies that are used but not detected
  ignoreDependencies: [
    // Type definitions
    '@types/node',
    '@types/react',
    '@types/react-dom',

    // Build tools
    'typescript',
    'eslint',
    'prettier',

    // Foundry (used via CLI)
    'forge-std',

    // Peer dependencies
    'react',
    'react-dom',

    // PostCSS plugins
    'autoprefixer',
    'postcss',
    'tailwindcss'
  ],

  // Ignore binaries
  ignoreBinaries: [
    'forge',
    'cast',
    'anvil',
    'vercel',
    'supabase'
  ],

  // Rules
  rules: {
    // Dependencies
    dependencies: 'error',
    devDependencies: 'warn',
    optionalPeerDependencies: 'warn',
    unlisted: 'error',
    unresolved: 'error',

    // Exports
    exports: 'error',
    nsExports: 'error',
    classMembers: 'warn',

    // Types
    types: 'warn',
    nsTypes: 'warn',
    enumMembers: 'warn',

    // Files
    files: 'error',

    // Binaries
    binaries: 'error'
  },

  // Workspaces
  workspaces: {
    'packages/shared': {
      entry: ['src/index.ts'],
      project: ['src/**/*.ts']
    },
    'packages/sdk': {
      entry: ['src/index.ts'],
      project: ['src/**/*.ts']
    },
    'packages/dashboard': {
      entry: [
        'app/**/*.ts',
        'app/**/*.tsx',
        'next.config.js'
      ],
      project: ['app/**/*.ts', 'app/**/*.tsx']
    },
    'packages/contracts': {
      entry: ['script/**/*.sol'],
      project: ['src/**/*.sol', 'test/**/*.sol']
    }
  }
};

export default config;
