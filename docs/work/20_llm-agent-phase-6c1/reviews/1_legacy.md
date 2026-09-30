# Phase-6.C.1 visual oracle wiring + HTML dashboard — impl-2 review synthesis

Date: 2026-05-09. Iteration 2. Reviewers: Codex (gpt-5.5 xhigh), Claude (Opus 4.7 1M, max effort).

## Verdict

**Codex 1 HIGH (corpus runner missing visual-gate). Claude APPROVE with 4 observations (O1-O4).** All 5 iter-2 fixes verified by both reviewers. The new HIGH (Codex iter-2) demanded an iter-3 fix; Claude observations O1+O2 also addressed inline.

## HIGH (Codex iter-2 finding 1)

### H2 — corpus runner doesn't gate on visualOracle violations

**Issue:** The runner script writes `oracleResult.violations` to the envelope, but `playtest-corpus-llm.mjs` only sets `anyHigh` for `engineHalt` or unexpected `errorMessage` — never inspecting `env.visualOracle.violations`. A ≥5% visual diff would surface in the envelope while the corpus exits 0, contradicting the spec (§15.7) which says violations should gate.

**Fix applied:** corpus runner now sets `anyHigh = true` when ANY high-severity (≥5%) violation appears in any envelope. Medium-severity (≥0.5%) violations are informational and do NOT gate. The SUMMARY-LLM.md table gains a "visual" column showing `{H}H/{V}V/{M}M` (high / total violations / missing ticks).

## Claude APPROVE per-claim verifications

- **H1 (seed/maxTicks stamp)** — Claude verified: stamping at `playtest-llm.mjs:476-477` lands BEFORE the visual-oracle invocation AND BEFORE the envelope JSON write. Survives oracle failures via the wrapping try/catch.
- **M1 (`===` exact match)** — Claude walked the prompt-stipulated `[100, 200, 400]` / decisionInterval=250 / tickAfter=250 case: 100 and 200 both warn-and-skip, 400 stays queued. Behavior matches spec.
- **M2 (oracle gated on baselines, not captures)** — Claude verified: empty runScreenshots → all baselines reported as missingTicks via the oracle's existing path.
- **M3 (escapeHtml coverage)** — Claude inspected every `${...}` interpolation in the dashboard renderer and confirmed all dynamic values flow through escapeHtml (or numeric `.toFixed(...)`).
- **M4 (spec §15.7 documentation)** — Claude verified each clause matches the live behavior.

## Claude observations (non-blocking)

### O1 — operator-log advice is targeted at misalignment but missingTicks fires for other reasons too

**Fix applied:** `playtest-llm.mjs` branches the missing-ticks log message on `result.checkpointScreenshots.length === 0` (zero captures → "check screenshotEnabled / early-exit / capture failures") vs > 0 (some captures missing → "align decisionIntervalTicks").

### O2 — dashboard hides missingTicks signal when deltas is empty

**Fix applied:** dashboard run table gains a "visual" column showing the same `{H}H/{V}V/{M}M` summary as SUMMARY-LLM.md. Cell highlighted (halted class) when high violations exist. Operators see the signal without opening JSON.

### O3 — `extractSeedFromName` is a stub

**Disposition:** Acceptable. New envelopes carry `env.seed` (post-H1 fix), so the fallback never matters going forward. Pre-H1 envelopes need a re-run; documented in the dashboard script's comment.

### O4 — robustness: screenshot-write errors are uncaught

**Disposition:** Deferred. Pre-existing failure mode; iter-2 didn't introduce it. Low-priority hardening to wrap the persist loop in its own try/catch would mirror the oracle's pattern.

## Disposition

H2 (Codex HIGH) addressed inline. O1+O2 addressed inline. O3+O4 deferred with rationale. Iter-3 review next.
