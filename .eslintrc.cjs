// Structural leak guardrail for src/errors.ts's discipline: a native Error (or
// subclass) built with interpolated content is exactly the shape that leaked a
// passage reference into a message a generic handler (window.onerror, an error
// boundary, telemetry) can read. AST-based rather than the narrower regex scan
// in src/errors.guardrail.test.ts, so it's comment-safe and catches subclasses
// (TypeError, RangeError, ...) and assign-then-throw (`const e = new Error(...)
// ; throw e`) for free — the selector matches the construction itself, not its
// parent ThrowStatement. CodedError is never matched: its message is always the
// fixed code (see src/errors.ts), so it is the correct pattern this protects.
const LEAK_CTORS = 'Error|TypeError|RangeError|EvalError|ReferenceError|SyntaxError|URIError'
const INTERPOLATED_THROW_RULES = [
  {
    selector: `NewExpression[callee.name=/^(${LEAK_CTORS})$/][arguments.0.type='TemplateLiteral'][arguments.0.expressions.length>0]`,
    message:
      'A native Error (or subclass) built with an interpolated template literal can leak user content (e.g. a passage reference) into a message a generic handler can read. Use CodedError instead (see src/errors.ts).'
  },
  {
    selector: `NewExpression[callee.name=/^(${LEAK_CTORS})$/][arguments.0.type='BinaryExpression'][arguments.0.operator='+']`,
    message:
      'A native Error (or subclass) built by string concatenation can leak user content into a message a generic handler can read. Use CodedError instead (see src/errors.ts).'
  }
]

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
      // Scoped to src/** only — scripts/migrate-sqlite.ts is a one-off
      // migration script outside the pure-web app and is not part of this
      // discipline (and already carries its own pre-existing lint errors).
      files: ['src/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-syntax': ['error', ...INTERPOLATED_THROW_RULES]
      }
    },
    {
      // detailForConsole() is local-only human detail (see src/errors.ts) —
      // the telemetry layer must only ever see toTelemetrySafe()'s output.
      // This override matches the same files as the one above and, per
      // ESLint's cascade, fully replaces `no-restricted-syntax` rather than
      // merging with it — so the interpolated-throw selectors are repeated
      // here too.
      files: ['src/telemetry/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "CallExpression[callee.property.name='detailForConsole']",
            message:
              'detailForConsole() is local-only human detail (src/errors.ts) — the telemetry layer must never read it. Use toTelemetrySafe() instead.'
          },
          ...INTERPOLATED_THROW_RULES
        ]
      }
    }
  ]
}
