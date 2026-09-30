# Implementation plan — provider-error-retry

TDD; affected tests while iterating, full gates before commit.

1. **ProviderCallError** (`src/game/playtest/llmProviders/providerError.ts`) — tagged Error with optional `cause`. Export from `llmProviders/index.ts`. ✅
2. **StopReason += 'providerError'** (`types.ts`). ✅
3. **Providers throw it**: ClaudeCodeProvider's five call/parse failure sites; AnthropicProvider's SDK-call failure (NOT the missing-key/cost-table-miss config errors — those stay plain Error → engineHalt, fail-loud immediately). Existing message-regex tests keep passing; add a `toBeInstanceOf(ProviderCallError)` pin on the exit≠0 case. ✅
4. **Retry layer (iter-2: at the PROVIDER call, not the decision)**: `RetryingProvider` (`retryingProvider.ts`) wraps the real provider and retries `ProviderCallError` with `backoffMs * 2^attempt` + injectable `sleep`. The runner just classifies: loop catches an exhausted `ProviderCallError` from `agent.decide()` → `stopReason='providerError'` + break (post-loop winner/screenshot/export run because it's not engineHalt); non-provider throws → outer catch → engineHalt. Tests: `retryingProvider.test.ts` (backoff/off-by-one/maxRetries=0/non-retryable-passthrough) + `llmRunner.providerError.test.ts` (recover, exhausted→providerError+winner-scored, first-decision providerError, non-provider→engineHalt, host-error→engineHalt). ✅
5. **Script**: `scripts/playtest-llm.mjs` wraps `selectProvider(args)` in `new RetryingProvider(..., {maxRetries:2, backoffMs:3000})`. ✅
6. **Corpus CI (iter-2 verification gap)**: extract `isLlmCorpusRegression` (`corpusRegression.ts` + test) so `providerError` is exempt from the HIGH-regression gate like `cost-budget-exceeded`; dashboard amber. ✅
7. Spec §15.7 provider-error-classification note ✅; devlog; full gates → multi-CLI review (iter-1: Claude `opus[1m]` + Codex + Gemini; iter-2: Codex + Gemini — Claude `-p` dropped as a reviewer after it bypassed `--allowedTools` read-only) → commit + push.
8. Re-run campaign-3 to confirm a real `claude exit 1` now retries/recovers (or stops as `providerError` with the game scored).
