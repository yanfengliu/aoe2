# Provider-error retry + distinct stopReason (campaign-2 backlog #1, HIGH)

Objective: a transient `claude -p` subprocess failure must not kill an otherwise-healthy LLM playtest. Across campaign-2 (4250 ticks), the first Opus attempt (decision 0), and campaign-3 (5000 ticks), an occasional `claude exit 1` threw from `agent.decide()`, hit the runner's catch-all, and was misclassified as `engineHalt` — ending the run early and suppressing the winner oracle on a game the observation oracle graded "looked-fun".

## Root cause

`runLlmPlaytest` wraps the whole decision loop in one `try { … } catch (err) { stopReason = 'engineHalt' }`. Every throw — a genuine engine/sim crash AND a transient LLM-subprocess failure — collapses to `engineHalt`. The provider (`ClaudeCodeProvider.call`) throws a plain `Error("[claude-code-provider] claude exit 1: …")` on exit≠0; that propagates out of `decide()` (the call is the last thing decide does before recording cost, so nothing is half-recorded on failure).

## Fix

1. **Typed provider error.** New `ProviderCallError extends Error` (`src/game/playtest/llmProviders/providerError.ts`). `ClaudeCodeProvider` throws it at all six LLM-call failure sites (exit≠0, is_error envelope, empty stdout, no result event, schema-result-not-JSON, schema-result-not-object) AND wraps any rejection from its `runFn` (spawn error, timeout) at the `call()` boundary — the runFn IS the subprocess call, so every way it can fail is a provider-call failure. `AnthropicProvider` throws it on the SDK call failure ONLY; the missing-API-key (constructor) and missing-cost-table-row throws stay plain `Error` — deterministic config errors that must fail loud immediately (→ engineHalt), not retry. Operator message text is unchanged — only the class. The marker lets the runner distinguish a provider transient from an engine/host crash without guessing by call-site.

2. **Retry-with-backoff at the PROVIDER layer (iter-2).** Retry lives in a `RetryingProvider` wrapper (`retryingProvider.ts`) that wraps the real provider: on `ProviderCallError`, sleep with exponential backoff (`backoffMs * 2^attempt`) and retry up to `maxRetries` (campaign script: 2 → 3 total attempts, ~9s of backoff). A succeeding retry returns the call result normally — the dominant case (a one-off subprocess blip resumes instead of killing the run). `sleep` is injected so tests are instant. Wrapping the *call* (not `agent.decide`) keeps each decision idempotent: `decide()` runs exactly once, so a tactical retry never re-charges a strategy refresh or drifts the cadence counter (the iter-1 reviewers' finding — retrying `decide()` re-ran the strategy refresh for `strategyEvery=1`).

3. **Distinct `providerError` stopReason.** When `agent.decide()` still throws a `ProviderCallError` (the wrapper exhausted its retries), the runner sets `stopReason='providerError'` and `break`s the loop. Because it is NOT `engineHalt`, the existing post-loop logic runs unchanged: the winner oracle scores the game, the final screenshot captures, and the bundle exports cleanly — all valid because on a provider failure the game/page is healthy; only the LLM call died (and each post-loop step keeps its own safety net that flips to `engineHalt` if the page turns out unusable). Any non-`ProviderCallError` throw (host calls: snapshot/dispatch/advanceTicks/exportBundle, or an agent bug) keeps the catch-all `engineHalt`.

## Why the post-loop logic already does the right thing

The winner gate is `stopReason !== 'engineHalt'`; the final-screenshot branch keys on `=== 'engineHalt'`; bundle export always runs. `providerError` falls on the healthy side of all three — so the only structural change needed is making the new stopReason not-engineHalt. That is the design's leverage: classify correctly and the rest is free.

## Config + surface

- `RetryingProvider(inner, { maxRetries, backoffMs }, sleep?)` (`retryingProvider.ts`): the retry config lives on the wrapper, NOT on `LlmRunnerConfig`; `sleep` is the wrapper's injectable backoff (default real setTimeout). `scripts/playtest-llm.mjs` constructs `new RetryingProvider(selectProvider(args), { maxRetries: 2, backoffMs: 3000 })`. The runner has no retry config — it only classifies the exhausted `ProviderCallError`.
- New `StopReason` variant `'providerError'`.
- Corpus CI: `isLlmCorpusRegression` (`corpusRegression.ts`, extracted + unit-tested) exempts `providerError` alongside `cost-budget-exceeded`; the dashboard colours it amber. (Surfaced during iter-2 verification — the corpus gate keyed on any `errorMessage`, so a `providerError` run would have re-created the false-positive one layer up.)
- The script's exit code is unchanged (it always exits 0 on a completed run — stopReason is informational in the envelope).

## Classification scope (Codex iter-2 MED-2)

The runner classifies throws from INSIDE the decision loop. `host.waitForBoot()` and the initial `host.setPaused(true)` run BEFORE the loop's `try`, so a boot-time host failure rejects `runLlmPlaytest` outright (handled by the script's top-level fatal path) rather than producing an `engineHalt` envelope. This is pre-existing and out of scope for this thread — the provider-error fix only governs the per-decision path. So the precise contract is: throws from `agent.decide()` → `providerError` (exhausted) or `engineHalt` (non-provider); throws from in-loop host calls → `engineHalt` envelope; throws from pre-loop boot → script fatal (no envelope).

## Non-goals

- Observation-oracle retry (it lives in the script, succeeded in campaign-3, and is advisory — lower value; a follow-up if it ever flakes).
- Boot-failure envelope semantics (the pre-loop path above) — pre-existing, untouched.
- No game-behavior change → no version bump (internal tooling, same scope as playtest-fixes). Spec §15.7 gains a stop-reason-classification note; devlog entry.

## Determinism / fog

None — harness reliability only; no simulation, snapshot, or render change.
