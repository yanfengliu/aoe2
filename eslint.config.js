import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: false,
      },
    },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      // An underscore prefix marks a parameter a seam keeps deliberately
      // unused (e.g. a DE-dead bonus hook whose callers stay wired). The
      // codebase already used the convention; the rule now honors it.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Phase-6.A.1: prevent @anthropic-ai/sdk from being statically
      // imported. The SDK is ~200 KB and would silently inflate the
      // production bundle. Approved callers below; everything else
      // must route through the dynamic-import pattern in
      // src/game/playtest/llmProviders/anthropicProvider.ts or use
      // ClaudeCodeProvider (which shells out to the `claude` CLI).
      //
      // Uses `patterns` (not `paths`) to also catch subpath imports
      // like `@anthropic-ai/sdk/error` — those subpath modules
      // cross-import the SDK internals and would defeat the guard
      // (Claude impl-1 finding 1).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@anthropic-ai/sdk', '@anthropic-ai/sdk/*'],
              message:
                'Static import of @anthropic-ai/sdk (or any subpath) leaks the SDK into the '
                  + 'production bundle. Use the dynamic `await import(\'@anthropic-ai/sdk\')` '
                  + 'pattern in src/game/playtest/llmProviders/anthropicProvider.ts, '
                  + 'or use ClaudeCodeProvider instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // The dynamic-import file itself + its tests need to reference the
    // SDK to type the stub client. Vite never bundles this module's
    // graph because the import inside it is dynamic and Node-only.
    files: [
      'src/game/playtest/llmProviders/anthropicProvider.ts',
      'tests/playtest/anthropicProvider.test.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
);
