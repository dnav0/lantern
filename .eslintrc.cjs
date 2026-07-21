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
  },
  overrides: [
    {
      // The guardrail test scans the source tree from disk, which needs
      // Node's fs/path — it runs under Vitest/Node, never ships to the
      // browser, so the pure-web restriction above doesn't apply here.
      files: ['src/errors.guardrail.test.ts'],
      rules: {
        'no-restricted-imports': 'off'
      }
    },
    {
      // detailForConsole() is local-only human detail (see src/errors.ts) —
      // the telemetry layer must only ever see toTelemetrySafe()'s output.
      files: ['src/telemetry/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "CallExpression[callee.property.name='detailForConsole']",
            message:
              'detailForConsole() is local-only human detail (src/errors.ts) — the telemetry layer must never read it. Use toTelemetrySafe() instead.'
          }
        ]
      }
    }
  ]
}
