# Review 4: implementation

## Target

aoe2 commit 1c4dc261 on branch `ai-dark-age-1105` (work 144 M2), the merge of main 19e4ffeb (work 145, v0.3.270: villagers share a resource node as in DE) into ade6578c, the branch round 3 reviewed plus its records. A focused re-review, as `git diff ade6578c 1c4dc261 -- src tests` (work 145's code as the merge applied it), of whether work 145 breaks an assumption of work 144 M2's readers of gathering state (`aiDarkAgeFarms.ts`, `deDarkAgeFarmsWanted`, the farms-only split, the hit census's eaten-farm rule), and of the merge's docs resolution.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from fleet's ignored `tmp/review-runs/aoe2-144-m2-r4`, with the worktree as `--cd`. The runbook's Codex check printed `keep` (no failed command). The lane cited `src/game/simulation/bridge/systems/aiDarkAgeFarms.ts:48` and `tests/simulation/playerHitCensus.test.ts:135`, both outside the diff, and both say what it says. Its delegated pass failed to start on an agent-service error, and it reviewed directly.
- One lane. The worktree's `git status --porcelain` and `git diff HEAD` were empty before and after the run; the lane changed nothing.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

No merge-specific findings in **1c4dc261** against **ade6578c**.

- **Gathering counts remain compatible.** Outside the diff, [aiDarkAgeFarms.ts:48](src/game/simulation/bridge/systems/aiDarkAgeFarms.ts:48) counts each villager's target independently. Sharing a sheep preserves the natural-food gatherer count; farmers walking or delivering remain assigned, so their farms are not counted idle.
- **Depletion preserves the readers' assumptions.** Gatherers are retargeted or cleared before node destruction. The census uses its previous reading, so same-tick retargeting does not erase its farmer evidence: [playerHitCensus.test.ts:135](tests/simulation/playerHitCensus.test.ts:135), outside the diff.
- **The farm limit introduces no AI mismatch.** Its arrival check applies to human-controlled villagers; the AI retains its previous farming behavior, as explicitly documented.
- **Docs resolution is coherent.** Unreleased precedes 0.3.270; both summary entries survive. The summary has **50 total lines: one heading and 49 entries**, matching both parents. The detailed log retains work 145 before work 144 M2, with the displaced rows preserved verbatim at [lines 394 and 414](docs/devlog/detailed/2026-11-04_2026-11-04.md:394).

No files changed or test suites run. Remote CI was unverifiable because network access was blocked. The delegated pass failed to start due to an agent-service error; I completed the review directly.

## Findings and disposition

- No finding. The lane's reading agrees with the measurement: B2 with work 145 merged plays the A/B's 55 matches record for record as B2 did (plan 144, "M2: the landing").

## Verification

No repair to verify. The lane's reading was checked against the play instead: B2 with work 145 merged played the A/B's 55 matches (castle configuration, lab, idle boot match) and every record is identical to B2's, less the wall time and the fingerprints (`tmp/m2/same-records.mjs`, plan 144). The merged tree's unit suite passed every self-play gate (`aiReachesCastleAge`, `playerHitCensus`, `aiEconomySelfPlay` and the coverage census); the full gate's result is in plan 144.

## Round outcome

No finding on the merge. No further round.
