module.exports = {
  root: true,
  env: { 
    browser: true, 
    es2020: true, 
    node: true,
    jest: true 
  },
  extends: [
    'eslint:recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', '@typescript-eslint'],
  rules: {
    'react-refresh/only-export-components': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-undef': 'off', // TypeScript handles this
    'no-redeclare': 'off', // TypeScript handles this
  },
}
