module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended'
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // Pure-web rule enforcement: no Node/Electron in the client bundle.
    'no-restricted-imports': [
      'error',
      {
        paths: [{ name: 'electron', message: 'src/ must stay pure web — no Electron.' }],
        patterns: [{ group: ['node:*'], message: 'src/ must stay pure web — no Node built-ins.' }]
      }
    ]
  }
}
