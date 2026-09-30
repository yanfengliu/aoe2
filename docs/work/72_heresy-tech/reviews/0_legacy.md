# Heresy (converted units die) — adversarial review, iteration 1 (2026-07-02)

**Reviewer:** in-process Workflow (AGENTS.md default), 2 dimension finders (conversion-path correctness + blast radius; AoE2-conformance + tests + docs), each grounding claims in the live tree (26 and 40 tool calls). Model opus-4-8. Multi-CLI not run — a derived outcome-flip at one conversion site, byte-identical for existing conversions, fully covered by TDD + full-suite-green (real exit code).

**Verdict: ZERO code defects; 1 confirmed LOW doc-discipline finding, fixed.** The conversion-correctness finder returned EMPTY after verifying the load-bearing points: Heresy is keyed on `targetUnit.owner` (your own tech makes your unit die); it fires only at the flip threshold and returns before `flipConvertedUnit`; `destroyUnitEntity` clears conversion state + population + all side-maps so nothing dangles; the converting monk re-evaluates gracefully when its target is destroyed mid-convert (targets die in combat too); determinism + save/replay hold (`heresy` is persisted, destroy has no random/time); and the `destroyUnitEntity` threading (wirePostSeedOps → monkTaskOps → createMonkTaskAppliers) is complete. The conformance finder confirmed the CSV values, the seam wiring, the 4-tech monasteryTechs Castle set, and the live test's discrimination.

The one finding: the mandatory per-task detailed devlog entry for Heresy was missing at review time (summary/changelog/spec were present). **Fixed** — a full entry appended to `docs/devlog/detailed/2026-06-30_2026-07-02.md`.

## Post-review state

All four gates GREEN, verified with real exit codes (typecheck/lint/build 0; **TEST EXIT 0**; 1633 passed / 2 skipped / 0 failed). No production-code changes required by the review. Committed as v0.1.71.
