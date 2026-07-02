# Squires (infantry +10% speed) — adversarial review, iteration 1 (2026-07-02)

**Reviewer:** in-process Workflow (AGENTS.md default), scaled to 2 dimension finders (correctness+seam-wiring; AoE2-conformance+tests+docs) proportionate to a small additive change, each grounding claims in the live tree (31 and 33 tool calls). Model opus-4-8. Multi-CLI not run — this is an additive derived tech with no persistence/security/concurrency surface, so the in-process pass is the mandated default.

**Verdict: ZERO findings.** Both finders returned empty after reading the actual files: the `movementSpeedPercent` branch (no mounted/infantry class overlap, so the flat return never double-counts), every seam surface consistent (`squires` in the union, cost {food:200}, time 400, the barracks RESEARCHES row, the optionsRules Castle-age block with drop-once-researched, the exhaustive formatters switch), no other exhaustive switch over the tech union mishandling it, the fixture registration complete, prototypeEconomyRules within the 500-LOC cap (499), CSV-accurate values (200 food / 40 s → 400 ticks), correct Barracks/Castle gating with no regression to Husbandry's Stable/Castle gate, and the tests pinning the real contract (infantry race, non-infantry knight-control equality, live-research race, Feudal-barracks negative).

This is the convergence bar on the first pass — reviewers found nothing to fix. The change is a faithful one-branch parallel of the already-heavily-reviewed Husbandry seam (v0.1.66), which explains the clean result.

## Post-review state

All four gates green (typecheck, lint, build, full suite 1619/2, +11 tests). No production-code changes required by the review. Committed as v0.1.68.
