# Review 1: implementation

## Target

Correction treefe56d8f3ffd953e38664d01cd1c518e5d2aab1de against original review tree8ed3c8f6e2ebf642e6f4a90c5baeedb1b3c3b67c.

## Reviewers and coverage

Independent in-session gpt-6-astra/xhigh, read-only exact correction and bounded cross-consumer guard census. No reviewer CLI source export or execution.

## Reports

### gpt-6-astra / xhigh

A1 is resolved in staged tree `fe56d8f3ffd953e38664d01cd1c518e5d2aab1de`, reviewed against `8ed3c8f6e2ebf642e6f4a90c5baeedb1b3c3b67c`. Git comparisons confirmed only the two stated files changed and the working files matched the frozen correction.

`scripts/check-engine.mjs:51` now uses the existing `runDirectly()` helper. The census and junction probe at `tests/scripts/runDirectly.test.ts:142` include the guard without weakening existing checks. The probe requires diagnostic output and exit1 through both paths.

Retained evidence shows the valid RED failing on the census and empty junction output, followed by22 passing tests. The earlier harness mismatch is distinguishable from that valid RED. No new material findings in the correction.

The same original A1 guard remains at line50 in all four inspected primary files: farm/scripts/check-engine.mjs, City/scripts/check-engine.mjs, idle-life/scripts/check-engine.mjs and civ-sim-web/scripts/check-engine.mjs. These need bounded follow-ups for the same silent-success failure class.

Bounds: read-only inspection and retained-log review only; no tests, gates, edits, network requests, or other review records accessed. Cross-repository inspection covered only those four guard files. AoE2’s corrected full verify run and receipt remain required.

## Findings and disposition

A1 closed for this exact AoE2 correction. Root assigned bounded follow-ups in all four other consumers, preserving their existing dependency pins and runtime-validation contracts.

## Verification

22 focused checks passed, including actual direct/junction CLI behavior and all13 installation fixtures. The valid RED is retained separately from the initial harness expectation mismatch. Corrected full verify, clean-tree receipt and hosted acceptance remain root-owned and are recorded in the work plan once completed.

## Round outcome

Independent review accepted. Full local/hosted gate acceptance is still required before delivery.
