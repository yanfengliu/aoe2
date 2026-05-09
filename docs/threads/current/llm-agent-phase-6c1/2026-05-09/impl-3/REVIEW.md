# Phase-6.C.1 visual oracle wiring + HTML dashboard — impl-3 review synthesis

Date: 2026-05-09. Iteration 3. Reviewers: Codex (gpt-5.5 xhigh), Claude (Opus 4.7 1M, max effort).

## Verdict

**Both reviewers converged on 2 real findings.** Both fixes applied — Phase-6.C.1 has reached convergence.

- Codex: 2 MEDIUM (spec drift + dashboard escape) + extensive verified-clean items.
- Claude: 1 real finding (spec drift, same as Codex) + extensive verified-clean items + design observations.

## Findings

### M1 — Spec §15.7 says violations gate; impl gates only HIGH severity

**Surfaced by:** Both Codex and Claude (overlap).

**Issue:** The iter-2 spec edit said "violations are diffs ≥0.5% (medium) or ≥5% (high) **that should gate corpus runs**" — natural reading: both severities gate. The iter-3 implementation deliberately gates only HIGH; medium is informational. The code comment correctly documents "Medium ... does NOT gate" but the spec wasn't updated to match.

**Fix applied:** spec §15.7 now reads "diffs ≥0.5% (medium, informational) or ≥5% (high, gating). **Only HIGH-severity violations cause `playtest:corpus-llm` to exit non-zero**; medium violations surface in the run-table `visual` column without failing CI."

### M2 — Dashboard `visualSummary` interpolated without escapeHtml

**Surfaced by:** Codex iter-3.

**Issue:** Although `visualSummary` is constructed from `.length` integers, the dashboard reads JSON from disk without validating `missingTicks` as an array. A malformed envelope like `missingTicks: { length: "<img ...>" }` would inject the string literal into the unescaped cell. Defense-in-depth.

**Fix applied:** wrapped the visualSummary interpolation site in `escapeHtml(visualSummary)`. Already-existing escapeHtml calls on every other dynamic field were verified by Claude in iter-2.

## Verified clean (Codex + Claude overlap)

- `visualOracle.ts` emits exactly two severity values (`'high'` line 88+125, `'medium'` line 138). The `=== 'high'` filter correctly excludes medium.
- `OracleViolation.severity` is union `'low' | 'medium' | 'high'`; gate accommodates a future low-severity correctly.
- Corpus SUMMARY-LLM.md has 8 columns (header / separator / spawn-failed row / no-envelope row / success row all match).
- Dashboard run table has 10 columns (winner + observation + visual added on top of base 7).
- Operator-log "zero captures" branch correctly identified by `result.checkpointScreenshots.length === 0`.
- visualSummary format matches between dashboard cell and SUMMARY-LLM.md (`{H}H/{V}V/{M}M`).
- `(env.visualOracle?.violations ?? []).filter(...)` correctly handles missing visualOracle (yields empty array).
- Iter-3 changes are scripts-only (no .ts modifications); iter-2 unit tests stand.

## Claude design observations (informational)

- Iter-3's gating logic (`anyHigh = true` from three sources: engineHalt, unexpected errorMessage, high visual violations) keeps the variable name accurate — all three are HIGH-severity regressions.
- Visual cell position differs between SUMMARY (col 8, last) and dashboard (col 10, last) but same shape — operators see the same `{H}H/{V}V/{M}M` regardless of surface.

## Disposition

Both M1 + M2 addressed inline. Phase-6.C.1 converged. Both reviewers' substantive findings closed; only design-discussion items remain. Landing.
