# Review iteration 9

## Scope

OpenAI Codex performed a final read-only review of the complete iteration-8 diff, with the live-code verification directive and an explicit request to refute the tower-pass, building-destruction, construction, replay, visibility, movement, picking, pause, and Three-identity claims. The run completed successfully after 16.8 minutes. Anthropic Claude remained unavailable under the recorded tenant export boundary and was not retried or routed around.

## Findings and disposition

- **MEDIUM — a valid attack whose presented source and target roots coincide produced no animation. Confirmed and fixed.** Packed-cell overflow and later ownership conversion can leave opposing actors on the same presented root, while distance-zero combat remains valid. `sampleUnitAttack` previously treated that zero-length direction as an invalid event and returned `null`. It now preserves the attack timing and pose, retaining the actor's prior deterministic facing or its authored forward on first observation. A red-green rendering regression covers the coincident-root attack.
- **MEDIUM — canonical architecture still described immediate tower visibility refresh. Confirmed documentation drift.** The live implementation intentionally targets every building from the immutable pass-start visibility snapshot and refreshes once after a successful pass containing one or more kills. Canonical spec, architecture, decision, drift, and thread design wording are being reconciled to that exact contract.
- **MEDIUM — closeout evidence still named the pre-repair gate and iteration 7 as final. Confirmed documentation drift.** The summary, changelog, detailed devlog, review history, and final commit evidence are being updated after the repaired full gate.

## Result

All iteration-9 findings were grounded against the live repository. The coincident-root regression failed before the sampler fix (`idle` instead of `attacking`) and passed afterward with 25 focused rendering tests. Because iteration 9 found a substantive behavior defect, iteration 10 must independently re-review the final code and reconciled documentation before convergence.
