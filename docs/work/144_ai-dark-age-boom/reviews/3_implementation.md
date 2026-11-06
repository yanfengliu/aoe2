# Review 3: implementation

## Target

aoe2 commit b3330359 on branch `ai-dark-age-1105` (work 144 M2, the landing worker's phase 1), reviewed as `git diff 1e16571b b3330359 -- src tests design scripts`: the computer's Dark Age boom as DE's ranged flush (B2), option 2's farm count backed out, DE's `feudal-f2` for the Italians, the Dark Age farm limit back at 6, the four gate changes under the coordinator's decisions, the re-recorded census and spec §13.2. The plan and records under `docs/` were read in the tree.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from fleet's ignored `tmp/review-runs/aoe2-144-m2-r3`, with the worktree as `--cd`. The runbook's Codex check printed `keep` (no failed command). The lane read the Promisory scripts it cited (init.per, const.per, buildings.per) and cited `src/game/simulation/bridge/systems/gatheringStep.ts:190`, outside the diff, which says what it does.
- One lane, by the coordinator's preference for Codex. The worktree's `git status --porcelain` and `git diff HEAD` were empty before and after the run; the lane changed nothing.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

Reviewed **b3330359 against 1e16571b**. Five medium findings and one low finding:

1. **Medium — Training thresholds omit carried resources.** [aiVillagerDemand.ts:86](src/game/simulation/bridge/systems/aiVillagerDemand.ts:86) passes only deposited resources. DE adds qualifying gatherers' carried food and gold to its totals (`Promisory/init.per:1552–1567,1592–1610`). With 25 villagers, Feudal available, 450 deposited food and 30 carried, this code trains another villager; DE's 470-food flush stop applies. The same discrepancy affects the Feudal Castle-cost test, spending food DE would preserve.

2. **Medium — The farm wood threshold belongs to the wrong civilization.** [aiDarkAgeBoom.ts:174](src/game/simulation/aiDarkAgeBoom.ts:174) applies 215 everywhere. `Promisory/const.per:4265–4293` defines **215 for Teutons, 209 for Malians and 235 otherwise**. For example, 20 villagers, three worked farms, six natural-food gatherers, one Lumber Camp, 220 wood and 100 food trigger another farm here but fail DE's cited rule. The new test at `aiDarkAgeBoom.test.ts:139` reinforces this incorrect threshold.

3. **Medium — The cheap Dark Age farm rule remains active during Feudal research.** [aiSystemBuildingPhase.ts:223](src/game/simulation/bridge/systems/aiSystemBuildingPhase.ts:223) checks only the completed age. DE switches its strategic age to `dfeudal` when research becomes pending (`init.per:4005–4010`), which skips these rules (`buildings.per:4220–4226`). Here, spending the Feudal food can immediately reactivate farm purchases throughout research. DE's separate transition rules can permit farms, but require the larger `flushprep-cost` (`buildings.per:4378–4399`); this implementation retains the cheaper trigger.

4. **Medium — Farm eligibility omits DE's wood-distance condition.** [aiDarkAgeBoom.ts:197](src/game/simulation/aiDarkAgeBoom.ts:197) checks only that a Lumber Camp exists. DE's primary rule also requires `dropsite-min-distance wood < 5` (`buildings.per:4239`). With one distant camp, three worked farms, fewer than nine food gatherers and 60 wood, this code can spend the remaining wood on another farm when the examined DE rules refuse. This omission is not among the documented exceptions.

5. **Medium — The farm exemption hides the missing-hit defect the census should detect.** [playerHitCensus.test.ts:144](tests/simulation/playerHitCensus.test.ts:144) treats a vanished, unstruck farm with ≤1 food as depleted. An idle farm with one food killed by an **unrecorded** enemy hit therefore disappears from the census. Low remaining food does not establish harvesting. Outside the diff, [gatheringStep.ts:190](src/game/simulation/bridge/systems/gatheringStep.ts:190) reduces the resource to zero before depletion removal; the gate needs independent depletion evidence and a control for an unrecorded kill on a nearly empty farm.

6. **Low — The documented split duration contradicts the retained implementation.** [spec-final.md:1849](design/spec-final.md:1849) promises 33/58/9 until an Archery Range stands. `aiEconomyPlan.ts:84–113` switches immediately to 7/6/1/1 upon reaching Feudal, regardless of the Range. Plan line 291 explicitly retains that Feudal split, so correct the spec and matching code comments to describe the adopted boundary.

The numerical villager thresholds, Italians' 425 stop, accepted caps and retained farm limits check out. I found no active old-cap statement in the spec. The fixed 30-tick idle budget measures play rather than importing the AI's demand predicate. `villagersTrained` can undercount simultaneous births and deaths, as documented, which tightens that budget.

Performance observation: `darkAgeFoodSituation` runs twice per normal Dark Age decision—before rebalance and during building selection—despite its "once" comment. I did not profile its cost.

No files changed or test suites run. Checks used source inspection, in-memory probes and a serial delegated review. Remote CI was unverifiable because network access was blocked.

## Findings and disposition

Each of findings 1-4 was checked against the installed scripts by the worker and holds (the wood-distance line is buildings.per 4235 in this install, where the lane cited 4239). Each changes the measured game, so fixing it means another A/B and gate round, with the drop rule if an Age is lost. The worker put that choice to the coordinator, who decided on 2026-11-06: land B2 as measured, and card findings 1-4.

- **R3-1 (medium), accepted as a card: DE's totals count carried loads.** Plan 106's new card "DE's totals count the loads its gatherers carry (work 144)" (init.per 1546-1612): every Dark and Feudal threshold here fires on about 50-100 more food than DE's. Spec §13.2's "Not modelled" names it.
- **R3-2 (medium), accepted as a card, and said plainly: `farmmb-cost` is per civilization.** The code comment on `DE_FARM_SPARE_WOOD` and spec §13.2 now say 215 is the Teutons' value (const.per 4265-4293: 209 for the Malians, 235 for everyone else), applied to every civilization and measured that way. DE's value per civilization joins plan 106's farm-model card, under its rule (measured on both configurations, adopted only when neither loses an Age).
- **R3-3 (medium), accepted as a card: the Dark Age farm rule runs through the Feudal research.** In plan 106's farm-model card (init.per 4005-4010, buildings.per 4216-4226 and 4378-4399).
- **R3-4 (medium), accepted as a card: the wood drop site within 5 tiles of wood.** In plan 106's farm-model card (buildings.per 4235).
- **R3-5 (medium), accepted and repaired: the eaten-farm rule could hide an unrecorded kill.** The census now also reads whether a villager is gathering each farm, and a farm counts as eaten only if it held a farmer at its last reading, besides at most one swing's food and no blow; its bounds say so. All seven eaten farms of the all-AI window held a farmer, and the census passes (86 losses and 13 deaths, all recorded). Red: with the rule removed, and with the farmer never seen, the window fails on its seven farms (7 of 106 unrecorded). No case in any census scenario kills an unfarmed, nearly empty farm, so that branch has no live control; the bounds name what stays unchecked (a blow killing a farm in its farmer's last swing).
- **R3-6 (low), accepted and repaired: the flush split's end.** Spec §13.2 and `aiDarkAgeBoom.ts` now say the split runs from the click to the Feudal Age, where this AI's Feudal split takes over, while DE keeps it until an Archery Range stands (the coordinator's decision 2 scoped it to the Dark Age).
- **Performance observation, noted.** `darkAgeFoodSituation` runs twice per Dark Age decision (the split before the rebalance and the building phase). Plan 144's open items keep it as a low-priority item; no measurement of its cost was made.

## Verification

The repairs change no game code: R3-5 is in `tests/simulation/playerHitCensus.test.ts`, R3-6 and R3-2's statement are comments and spec text. `tests/simulation/playerHitCensus.test.ts` passes (13 tests; the all-AI case 67.4 s of its 300 s), and the two new mutants are red (`tmp/m2/mutate-gates.mjs`). The full gate ran after the repairs (plan 144, "M2: the landing").

## Round outcome

Four medium findings on DE's model, carded by the coordinator's decision; one medium finding on a gate, repaired with its proof; one low finding on wording, repaired. No further round: the repairs change no game code and no assertion's reach beyond the narrower farm rule, each with its red proof.
