# Phase-6.C.1 visual oracle wiring + HTML dashboard — impl-1 review synthesis

Date: 2026-05-09. Iteration 1. Reviewers: Codex (gpt-5.5 xhigh), Claude (Opus 4.7 1M, max effort).

## Verdict

**Both reviewers found substantive issues.** Codex 4 MED + 1 LOW; Claude 1 HIGH + 3 MED + design discussion. The HIGH (Claude-only) breaks the dashboard's central feature on day one. All addressed inline; iter-2 review next.

## HIGH (Claude-only)

### H1 — Dashboard baseline thumbnails always 404; seed/maxTicks columns always empty

**Issue:** `RunnerEnvelope` interface declared `stopReason, ticksRun, decisionsRun, totalCostUsd, runStartedAt, runCompletedAt, errorMessage, observation, winner, visualOracle` but NOT `seed` or `maxTicks`. The dashboard's `baselineRoot(seed)` resolves to literal `tests/playtest/baselines/undefined` → every `<img src=>` 404s in the browser. Run table's "Seed" and "maxTicks" columns also empty.

**Fix applied:**
- Added optional `seed?: string` and `maxTicks?: number` to `RunnerEnvelope` (optional so unit-test envelope construction doesn't have to populate them).
- Runner script stamps both onto `result.envelope` after `runLlmPlaytest` returns (the runner doesn't know these — only the script's args do).

## MEDIUM (overlap + Codex-only)

### M1 — Non-aligned checkpoint ticks fire with the wrong-tick screenshot (Codex 1)

**Issue:** Runner fired captures for any checkpoint `<= tickAfter`, but the captured PNG was always the post-advance state at `tickAfter` — not the actual checkpoint tick. With `decisionInterval=250` and checkpoints `[100, 200, 400]`, both 100 and 200 entries got the tick-250 screenshot, generating false visual diffs against real tick-100/tick-200 baselines.

**Fix applied:** changed comparison from `<=` to `===` (exact match). Misaligned checkpoints are now SKIPPED with a `console.warn` listing the misalignment + advice to align `decisionIntervalTicks` to baseline ticks. The visual oracle's `missingTicks` field naturally surfaces the skipped checkpoints.

### M2 — `missingTicks` dropped when no checkpoint screenshots captured (Codex 2)

**Issue:** Script wrapped the entire oracle invocation in `if (result.checkpointScreenshots.length > 0)`, so an early-stop run (or all captures failing) yielded NO `envelope.visualOracle` field — even though the oracle's `missingTicks` is exactly the right signal for that case.

**Fix applied:** invocation gating loosened to "any baselines exist" instead of "any captures exist". Empty `runScreenshots` produces a result with all baselines as `missingTicks`. Operator log line shows the count.

### M3 — Dashboard escaping incomplete for `formatWinner` output + integer fields (Codex 3 + Claude MED)

**Issue:** `renderRunRow` interpolated `formatWinner(env.winner)` raw, plus `env.maxTicks`, `env.ticksRun`, `env.decisionsRun`, and `d.tick` without escaping. Today's envelopes are well-typed but the script reads JSON from disk; future engine drift could introduce a string field whose unsanitized value would land in the rendered HTML.

**Fix applied:** wrapped `formatWinner(env.winner)` call site + all integer/observation fields in `escapeHtml(...)`.

### M4 — Spec §15.7 missing visual-oracle + dashboard documentation (Codex 4 + Claude MED)

**Fix applied:** added two bullets to §15.7 covering:
1. The visual-regression oracle's behavior — checkpoint-alignment requirement, `deltas`/`violations`/`missingTicks` semantics, oracle skip when no baselines, the `envelope.seed`/`maxTicks` stamping that downstream tooling depends on.
2. The HTML drift dashboard — `npm run playtest:corpus-dashboard` invocation, layout, dependency-free static HTML.

## LOW (Codex)

### L1 — `playtest-llm.mjs` over the 500-line ceiling (~539 lines; Claude MED 1 same finding)

**Disposition:** Deferred. The fileSizeBudget test only checks `src/` and `tests/` for `.ts`/`.tsx` extensions — `.mjs` scripts aren't subject to it. The file IS getting unwieldy (post-run side-effects: visual oracle, observation oracle, file writes). Splitting into a sibling helper module that takes `(args, result)` is the natural next step but is a refactor that doesn't add immediate value. Filed as a follow-up consideration.

## Claude verified-clean items

- Checkpoint detection correctness for the aligned-test-config case: walked through [250, 500, 1000] with `decisionInterval=250` and `maxTicks=1000`; all three fire including the boundary checkpoint at `maxTicks`.
- Failure isolation: `nextCheckpointIdx += 1` is in the while body but outside the try/catch — both throw and undefined-return paths advance the index correctly.
- Disk persistence: `writeFileSync(path, Uint8Array)` writes raw bytes (no double encoding). Retention pruner correctly groups `*-screenshots` dirs with their sibling envelope/bundle/trace files.
- Visual oracle wiring: `RunVisualOracleInput` shape matches the call site; `readFileSync` returns Buffer (structurally Uint8Array) which satisfies `BaselineEntry.pngBytes`.
- Stamp-prefix matching: `f.startsWith(stamp)` correctly isolates same-day cross-invocation runs.
- Newest-by-mtime corpus discovery: correct.

## Open question (Claude design discussion)

### Diff PNG persistence

Currently the visual oracle constructs the diff PNG in-memory only. The dashboard's third column is a placeholder "(diff overlay not persisted)". Persisting would require extending `RunVisualOracleResult` with `diffs?: Array<{tick, pngBytes}>` and serializing each via `PNG.sync.write` in the script.

**Disposition:** Deferred to a follow-up. The dashboard is useful without the diff column (baseline + run side-by-side gives the eyeball-able signal); persisting diffs is a polish item.

## Disposition

1 HIGH (Claude) + 4 MED (Codex+Claude overlap) addressed inline. 1 LOW + 1 design-discussion item deferred with rationale. Re-review next iteration.
