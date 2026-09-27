const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'dist/**',
      'web-build/**',
      '.expo/**',
      'node_modules/**',
      'coverage/**',
      '**/*.glb',
      // Deno (Supabase Edge Functions) code, not part of the RN bundle.
      'supabase/functions/**',
    ],
  },
  {
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      // The import resolver isn't picking up RN/Expo package exports correctly under flat
      // config yet, producing false positives on real, working imports (e.g. @expo/vector-icons).
      'import/no-unresolved': 'off',
      'import/namespace': 'off',
      // React Compiler-readiness rules — not applicable since this project doesn't use the
      // React Compiler; they flag long-standing, working patterns across the existing codebase.
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
    },
  },
  {
    files: ['**/__tests__/**/*.js', '**/*.test.js', 'jest.setup.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        global: 'readonly',
      },
    },
  },
];
