/**
 * ESLint flat configuration.
 *
 * Deliberately self-contained: the repository has no package.json and no
 * node_modules, so this config imports nothing. That lets it run anywhere with
 * a single command and no install step:
 *
 *   npx --yes eslint@9 .
 *
 * The rule list below reproduces the useful half of `eslint:recommended` plus
 * the project's own conventions, written out explicitly rather than pulled in
 * from `@eslint/js`.
 */

/** Rules that catch outright mistakes. Mirrors eslint:recommended. */
const correctnessRules = {
  'constructor-super': 'error',
  'for-direction': 'error',
  'getter-return': 'error',
  'no-async-promise-executor': 'error',
  'no-class-assign': 'error',
  'no-compare-neg-zero': 'error',
  'no-cond-assign': 'error',
  'no-const-assign': 'error',
  'no-constant-binary-expression': 'error',
  'no-constant-condition': 'error',
  'no-control-regex': 'error',
  'no-debugger': 'error',
  'no-dupe-args': 'error',
  'no-dupe-class-members': 'error',
  'no-dupe-else-if': 'error',
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-empty': 'error',
  'no-empty-character-class': 'error',
  'no-empty-pattern': 'error',
  'no-ex-assign': 'error',
  'no-fallthrough': 'error',
  'no-func-assign': 'error',
  'no-import-assign': 'error',
  'no-inner-declarations': 'error',
  'no-invalid-regexp': 'error',
  'no-irregular-whitespace': 'error',
  'no-loss-of-precision': 'error',
  'no-misleading-character-class': 'error',
  'no-new-native-nonconstructor': 'error',
  'no-obj-calls': 'error',
  'no-octal': 'error',
  'no-prototype-builtins': 'error',
  'no-self-assign': 'error',
  'no-self-compare': 'error',
  'no-setter-return': 'error',
  'no-sparse-arrays': 'error',
  'no-this-before-super': 'error',
  'no-undef': 'error',
  'no-unexpected-multiline': 'error',
  'no-unreachable': 'error',
  'no-unsafe-finally': 'error',
  'no-unsafe-negation': 'error',
  'no-unsafe-optional-chaining': 'error',
  'no-unused-private-class-members': 'error',
  'no-unused-vars': ['error', { args: 'after-used', caughtErrors: 'all' }],
  'no-useless-backreference': 'error',
  'require-atomic-updates': 'error',
  'require-yield': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
};

/** Project conventions. */
const styleRules = {
  eqeqeq: ['error', 'smart'],
  'no-var': 'error',
  'prefer-const': 'error',
  'prefer-template': 'error',
  'object-shorthand': 'error',
  'no-else-return': 'warn',
  'no-lonely-if': 'warn',
  'no-param-reassign': 'error',
  'no-shadow': 'error',
  'no-throw-literal': 'error',
  'no-useless-return': 'warn',
  radix: 'error',
  'prefer-arrow-callback': 'warn',

  // Blocking dialogs are replaced by the in-app toast in js/ui.js.
  'no-alert': 'error',

  // `isNaN` coerces its argument; `Number.isNaN` does not.
  'no-restricted-globals': [
    'error',
    { name: 'isNaN', message: 'Use Number.isNaN instead.' },
    { name: 'isFinite', message: 'Use Number.isFinite instead.' },
  ],

  // Assigning strings to innerHTML is how markup injection gets in. Build
  // nodes with the helpers in js/dom.js instead.
  'no-restricted-properties': [
    'error',
    {
      property: 'innerHTML',
      message: 'Build nodes with the helpers in js/dom.js instead of innerHTML.',
    },
    {
      property: 'outerHTML',
      message: 'Build nodes with the helpers in js/dom.js instead of outerHTML.',
    },
  ],

  // Complexity budgets. If one of these trips, the fix is to split the
  // function, not to raise the number.
  complexity: ['warn', 12],
  'max-depth': ['warn', 3],
  'max-lines-per-function': ['warn', { max: 70, skipBlankLines: true, skipComments: true }],
  'max-params': ['warn', 4],
};

const browserGlobals = {
  AbortController: 'readonly',
  console: 'readonly',
  crypto: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  localStorage: 'readonly',
  navigator: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  clearTimeout: 'readonly',
  setTimeout: 'readonly',
  window: 'readonly',
  HTMLElement: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
};

const serviceWorkerGlobals = {
  caches: 'readonly',
  clients: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  self: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  URL: 'readonly',
};

export default [
  {
    ignores: ['node_modules/**'],
  },
  {
    // Application source: ES modules, browser environment.
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: browserGlobals,
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: { ...correctnessRules, ...styleRules },
  },
  {
    // The service worker is a classic script in a worker global scope.
    files: ['service-worker.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: serviceWorkerGlobals,
    },
    rules: {
      ...correctnessRules,
      ...styleRules,

      // Registration-time console warnings are the only diagnostics available
      // inside a service worker.
      'no-restricted-properties': 'off',
    },
  },
];
