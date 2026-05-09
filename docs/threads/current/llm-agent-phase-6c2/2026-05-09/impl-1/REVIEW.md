# Phase-6.C.2 post-hoc observation oracle — impl-1 review synthesis

Date: 2026-05-09. Iteration 1. Reviewers: Codex (gpt-5.5 xhigh), Claude (Opus 4.7 1M, max effort).

## Verdict

**Both reviewers found substantive issues.** Codex flagged 4 MEDIUM (final-screenshot timing, null-toolInput throw, cost rollup, spec-persistence). Claude flagged 3 LOW + 1 NIT (one overlap: null-toolInput; plus doc-comment drift, missing wrong-toolName test, type-import style). All addressed inline; one Codex MEDIUM (spec persistence) handled with a defensible disagreement note.

## MEDIUM (all Codex; 1 overlapping with Claude's LOW 2)

### M1 — `finalScreenshotPng` is the pre-advance screenshot, not final-tick

**Issue:** The runner stashed the screenshot at the start of each loop iteration (before `advanceTicks`). A 5000-tick run with 250-tick decisions returns a screenshot from ~tick 4750, not tick 5000. An engineHalt during advance loses the failing visual state entirely.

**Fix applied:** added a final post-loop `host.captureScreenshot()` call (inside try/catch — best-effort because engineHalt may have destabilized the page). Falls back to the in-loop value if the post-loop capture throws.

### M2 — `parseObservationResponse` could throw on null `toolInput`

Overlaps with Claude LOW 2.

**Fix applied:** added `if (typeof block.toolInput !== 'object' || block.toolInput === null) continue;` guard before the cast. Existing fallback path now reachable for the null/non-object case.

### M3 — Corpus cost rollup doesn't include observation oracle spend

**Issue:** `result.envelope.totalCostUsd` was `agent.cumulativeCostUsd` only, missing the oracle's own cost. SUMMARY-LLM.md tables underreported actual LLM spend by ~$0.10 per `observation: true` row.

**Fix applied:** after a successful oracle call, the script does `result.envelope.totalCostUsd += verdict.costUsd`. The `observation.costUsd` field stays for per-component transparency.

### M4 — Spec-persistence

**Codex position:** add an `observation oracle` section to `design/spec-final.md` per the spec-persistence rule.

**Claude position:** the spec is "the authoritative game definition" — gameplay rules, not operator-side QA tooling. Adding playtest-harness internals dilutes the framing.

**Disposition (driver):** Added §15.7 "LLM-Agent Playtest Harness (Internal Tooling)" to `design/spec-final.md`, explicitly marked as internal tooling. Captures the operator-visible flags (`--omniscient`, `--observation`, provider selection, cost-budget gate, determinism caveat) so future autonomous handoffs have a single source of truth without conflating it with game rules.

## LOW (all Claude)

### L1 — Doc-comment drift in `observationOracle.ts` header

**Issue:** Module header comment said "Skipped when stopReason='cost-budget-exceeded'" but (a) the skip is in the script, not the oracle, and (b) the literal `'cost-budget-exceeded'` is `errorMessage`, not `stopReason`.

**Fix applied:** rewrote the header comment to clarify the caller is responsible for the skip + cite the correct field.

### L2 — Same as Codex M2 (covered above).

### L3 — No test coverage for the wrong-`toolName` fallback branch

**Fix applied:** added a test that supplies a `tool_use` block with `toolName: 'set_strategy'` and asserts the verdict falls back to `inconclusive`.

### NIT — Inconsistent type-import style

**Issue:** `RunnerEnvelope.observation?` used inline `import('./types').ObservationVerdict` while the rest of `llmRunner.ts` imports types via the top-of-file `import type { ... }` block.

**Fix applied:** moved `ObservationVerdict` into the top-of-file import block.

## No-issue verifications

- **Failure isolation** (Claude): script's outer try/catch correctly suppresses oracle failures into a console warning without masking the run's primary `stopReason`. Engine errors are captured by `runLlmPlaytest`'s own try/catch BEFORE the script reaches the oracle block.
- **Cost-budget literal match** (Claude): `'cost-budget-exceeded'` is the same literal in `llmRunner.ts:144` and `playtest-llm.mjs:446`. Convention is consistent with the corpus runner's existing usage.
- **Screenshot lifecycle** (Claude): `lastScreenshotPng` is only written when `screenshot` is truthy. The oracle's `byteLength > 0` check correctly handles both undefined and zero-length cases.
- **Hard-coded model** (Claude): fine for v1. Sonnet 4.6 is the agent's tactical model; reusing it avoids new cost-table entries.
- **Schema parity** (Claude): rejects non-boolean, omits absent values, only forwards `--observation` when truthy.
- **Architecture** (Claude): `observationOracle.ts` 135 LOC, sibling to `visualOracle.ts`. Inline tool schema appropriate.
- **Integration coverage** (Claude): unit tests are sufficient; integration test would mirror the agent provider's path. Token-budget concern is overstated (~30K input budget vs Sonnet 4.6's 200K context).

## Disposition

All 4 MEDIUM + 3 LOW + 1 NIT addressed inline. Re-review next iteration.
