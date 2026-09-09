# LLM-Agent Playtest — Phase 2 Implementation Review iter-1

Date: 2026-05-08

Reviewers:
- **Codex** (`gpt-5.5` xhigh, read-only sandbox). Produced 1 HIGH + 4 MEDIUM after spelunking through the diff and citing file:line.
- **Claude** (`claude-opus-4-7[1m]` max effort). Produced 6 MEDIUM with file:line citations and concrete repro paths.

## Disposition

**Iter-2 fixes applied inline.** Reviewers agreed on 5 substantive issues (cost-budget within-call overshoot, strategy-retry budget burn, fromSdkBlock unknown types, SDK error sanitization, schema drift comment). All addressed. Two non-blocking items (bundle-leak ESLint rule, ownerId in tactical prompt) handled with the prompt-side fix and a documentary update.

## Findings

### HIGH

**H1 (Codex H1 + Claude M1). Cost budget can be overshot in a single `decide()` call.**

The entry-time `rollingCostUsd >= costBudgetUsd` check (`llmAgent.ts:91`) only fires before any provider call. If the strategy call alone pushes cost over budget, the tactical call still fires unconditionally — punching the budget by tens of dollars on Opus before any guard kicks in.

**Fix.** Added a within-call cost check after `refreshStrategy()` and before the tactical call. If `rollingCostUsd >= costBudgetUsd` after the strategy call, bail out with `stopReason: 'cost-budget-exceeded'` and `commands: []`, skipping the tactical call. Updated existing tests (`llmAgent.test.ts`, `llmRunner.test.ts`) to reflect the tighter abort path: now the within-call abort produces 1 strategy call + 0 tactical calls instead of 1+1.

### MEDIUM

**M1 (Codex MED3 + Claude M5). Invalid strategy response burns budget on retry every decision.**

Per `llmAgent.ts:111`, `decisionsSinceStrategyRefresh` was only reset on a *valid* refresh. A null refresh (bogus targetAge) left the counter at `Infinity` so every subsequent `decide()` retried the Opus-priced strategy call — silently draining the budget while the operator saw zero diagnostics.

**Fix.** Reset `decisionsSinceStrategyRefresh = 0` regardless of whether the refresh validated. Log a `console.warn('[llm-agent] strategy refresh returned null …')` on the null branch. New regression test pins both behaviors: warn fires AND second `decide()` is tactical-only (no Opus retry).

**M2 (Codex MED4 + Claude M4). AnthropicProvider exposes raw SDK errors.**

The Anthropic SDK's `APIError` carries the request URL, headers (including `x-api-key`), and request body (which contains the system prompt + base64 screenshot). Phase 3's trace-logging path (which wraps `provider.call(...)` in try/catch and serializes the error) would dump auth headers + prompt content into `<out>.llm-trace.json`.

**Fix.** Wrapped `client.messages.create(...)` in a try/catch that throws a sanitized `LlmProviderError` with only `status`, `message`, and `request-id` from the original. Drops headers, request body, and the original Error's stack-derived request snapshot. New test asserts the sanitized error doesn't contain `sk-ant-`, `x-api-key`, or the request body's leaked content.

**M3 (Claude M3). `fromSdkBlock` malforms unknown SDK content block types.**

The function had only `text` / `tool_use` branches but used `else` unconditionally for everything else — meaning any future SDK addition (`thinking`, `redacted_thinking`, `web_search_tool_result`, `server_tool_use`) would produce `{ type: 'tool_use', toolName: undefined, toolInput: undefined }` and explode in `parseTacticalResponse` via `undefined.replace(...)`.

**Fix.** Explicit `tool_use` branch; unknown types log a `console.warn` and the block is dropped from the returned content array (`null`-filtered). New regression test exercises `thinking` injection: provider returns 3 blocks, agent receives 2, warn fires.

**M4 (Codex MED1). Unknown model IDs bypass cost accounting.**

The cost-table fallback was `?? { inputUsdPerMTok: 0, outputUsdPerMTok: 0 }`, so a model-name typo or new Anthropic model string silently zeroed out cost. The rolling budget gate would never fire on real spend.

**Fix.** `AnthropicProvider.call` now throws `Error('AnthropicProvider: model X is not in the cost table; add an entry before calling.')` on unknown model. The `MockProvider` keeps the soft fallback (it's a test double; soft fallback simplifies test setup). Existing test updated to assert the throw.

### MEDIUM (informational / partial)

**M5 (Codex MED2). Owner-scoped command discipline.**

The LLM has full read of `EconomyState` (impl-1 H3 already noted this is cheat-mode for the smoke baseline) and could in principle target any owner's entities. The shape validator only owner-range-checks `market.action`. The `monk.contextAtEntity.expectedOwner` field is also absent from the tool schema (the LLM can't set the expected-owner guard).

**Fix (partial).** Added an explicit `You are player N. Only emit commands targeting your own units / buildings; commands targeting other owners' entities will be rejected by the dispatcher.` line at the top of the tactical prompt (Codex MED2). The `expectedOwner` schema addition is filed as a Phase-6 follow-up alongside per-owner visibility filtering.

**M6 (Claude M2). Tool-schema drift detection is documentary, not enforced.**

The comment said "a unit test rounds-trips every kind to catch drift" — but the test hard-codes the list of 15 kinds in the test body. Adding a 16th `GameCommands` discriminator wouldn't fail any test.

**Fix (documentary).** Updated the comment in `llmPromptBuilder.ts` to honestly state: "Manually mirrored… The companion test only pins per-tool shape — it does NOT import `keyof GameCommands` to assert completeness, so adding a 16th discriminator will not flag this file as out of date. Re-grep `commands.ts` whenever you touch the GameCommands surface." Implementing real drift-detection would require a runtime registry of GameCommands keys, which TypeScript's structural types don't expose without `satisfies` boilerplate; deferred.

**M7 (Claude M6). Dynamic import is documentary, not structural.**

Vite emits a code-split chunk for any dynamic import in its module graph. Today `dist/` size is unchanged because nothing in the production-bundle graph imports `llmProviders.ts`. A future commit that adds `import { AnthropicProvider } from '../playtest/llmProviders'` from a `src/main.ts`-reachable file would silently reintroduce the SDK chunk to the browser bundle.

**Fix (filed).** Documented as a known risk; ESLint `no-restricted-imports` rule would enforce it but adds toolchain friction. Filed as a Phase-6 follow-up. The current safeguard is the `vite build` smoke check (no `@anthropic-ai` string in `dist/assets/*.js`) which would catch the regression in CI if added.

## Verified clean

- 15 GameCommands discriminators correctly mirrored (sheepId / buildingId / unitId differentiation per impl-1 H2 already fixed).
- Image block media type translation (PNG/JPEG) correct.
- Strategy cadence math: `Infinity → 0 → 1 → … → strategyEveryN → refresh, reset to 0` confirmed by both reviewers.
- Production bundle excludes the SDK (verified: dist size unchanged at 553.37 kB; `@anthropic-ai` not present in any bundled chunk).

## Action plan

Iter-2 fixes applied inline:

1. **H1.** Within-call cost check after strategy refresh; bail out with `cost-budget-exceeded` before tactical call.
2. **M1.** Always reset cadence on strategy refresh (valid OR null); warn on null refresh.
3. **M2.** Sanitize SDK errors in `AnthropicProvider.call`; new regression test asserts no leakage.
4. **M3.** Explicit `tool_use` branch in `fromSdkBlock`; unknown types dropped with a warn; new regression test.
5. **M4.** `AnthropicProvider.call` throws on unknown model.
6. **M5.** `ownerId` threaded into tactical prompt.
7. **M6.** Schema-drift comment rewritten to be honest about the test's coverage scope.
8. **M7.** Bundle-leak risk documented; ESLint enforcement filed as Phase-6.

Cumulative test count: 87 playtest tests (was 84; +1 strategy-warn + +1 SDK-error-sanitization + +1 unknown-block-drop = +3).

## Next iteration

If iter-2 fixes converge, Phase 2 closes. Phase 4 (visual-regression oracle, independent of Phases 1-3) or Phase 3 review continuation is next, depending on what surfaces.
