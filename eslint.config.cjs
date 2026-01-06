const globals = require('globals');

module.exports = [
  // Fichiers à ignorer
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
    ],
  },

  // Lint du gulpfile (Node)
  {
    files: ['gulpfile.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        ...globals.node,   // globals Node (process, __dirname, require, module, etc.)
        ...globals.es2021, // globals ES2021 si besoin
      },
    },
    rules: {
      // ❌ Interdire var
      'no-var': 'error',

      // ✅ Encourager const
      'prefer-const': 'error',

      // ❌ Variables non déclarées (attrape les globals implicites)
      'no-undef': 'error',

      // Qualité générale
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-redeclare': 'error',

      // Lisibilité / sécurité
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
    },
  },
];