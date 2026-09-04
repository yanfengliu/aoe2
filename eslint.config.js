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
      // A `const` arrow used above its own definition is a runtime
      // ReferenceError that BOTH gates pass clean: `tsc` accepts it and eslint
      // did not check it. It bit for real on 2026-08-31 — moving a haul-cost
      // helper put it below the filter that called it, every gather assignment
      // threw, and the AI stopped gathering entirely with typecheck and lint
      // green. A reviewer had flagged the same hazard on a different file
      // hours earlier. Functions stay exempt: they hoist, and the codebase
      // relies on that for mutually-recursive helpers.
      '@typescript-eslint/no-use-before-define': [
        'error',
        { functions: false, classes: true, variables: true, typedefs: false },
      ],
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
    // A TEST may not ask `world.isAlive`. It takes a bare entity id with no
    // generation, and the engine recycles ids from a free list
    // (`../civ-engine/src/entity-manager.ts`), so an entity that DIED and
    // whose id was reused reads back as alive — and carries the same
    // components, so a follow-up `getComponent` check does not catch it
    // either. A test is exactly where that bites, because a test captures an
    // id, steps the simulation, and then asks whether the thing it captured
    // survived. Measured 2026-09-04: a critic reproduced `alive: false,true`
    // in `aiGarrisonedDefender.test.ts` for a villager that had been killed,
    // and the assertion it was closing an escape with was closing nothing.
    //
    // Production code is NOT restricted, and the boundary is deliberate: its
    // 27 call sites take the id from a live query and ask in the same tick,
    // where there is no time for a recycle. It is holding an id ACROSS a step
    // that makes the question unanswerable.
    files: ['tests/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='isAlive']",
          message:
            'world.isAlive(id) cannot tell a recycled id from a surviving entity. '
            + 'Take a ref BEFORE the step — world.getEntityRef(id) — and ask '
            + 'world.isCurrent(ref) after it; the ref carries the generation.',
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
