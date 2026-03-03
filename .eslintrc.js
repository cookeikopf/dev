/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['eslint:recommended'],
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/out/**',
    '**/artifacts/**',
    '**/cache/**',
    '**/coverage/**',
    '**/lib/**',
    '**/broadcast/**',
    'playwright-report/**',
    'test-results/**'
  ],
  overrides: [
    // TypeScript files
    {
      files: ['**/*.ts', '**/*.tsx'],
      extends: [
        'eslint:recommended',
        '@typescript-eslint/recommended',
        '@typescript-eslint/recommended-requiring-type-checking'
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: ['./tsconfig.json', './packages/*/tsconfig.json']
      },
      plugins: ['@typescript-eslint', 'import'],
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_'
          }
        ],
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/no-non-null-assertion': 'warn',
        '@typescript-eslint/prefer-nullish-coalescing': 'error',
        '@typescript-eslint/prefer-optional-chain': 'error',
        'import/order': [
          'error',
          {
            groups: [
              'builtin',
              'external',
              'internal',
              'parent',
              'sibling',
              'index'
            ],
            'newlines-between': 'always',
            alphabetize: {
              order: 'asc',
              caseInsensitive: true
            }
          }
        ],
        'no-console': ['warn', { allow: ['warn', 'error', 'info'] }]
      }
    },
    // React files
    {
      files: ['**/*.tsx', '**/*.jsx'],
      extends: [
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
        'plugin:jsx-a11y/recommended'
      ],
      plugins: ['react', 'react-hooks', 'jsx-a11y'],
      settings: {
        react: {
          version: 'detect'
        }
      },
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        'jsx-a11y/anchor-is-valid': 'off'
      }
    },
    // Next.js files
    {
      files: ['packages/dashboard/**/*.ts', 'packages/dashboard/**/*.tsx'],
      extends: ['next/core-web-vitals', 'next/typescript']
    },
    // Test files
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      extends: ['plugin:vitest/recommended'],
      plugins: ['vitest'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/unbound-method': 'off'
      }
    },
    // JavaScript config files
    {
      files: ['*.js', '*.cjs', '*.mjs'],
      env: {
        node: true
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ]
};
