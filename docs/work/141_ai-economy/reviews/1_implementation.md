# Review 1: implementation

## Target

aoe2 commit 49c0b997 on branch `ai-economy-1104` (work 141 M1), reviewed as `git diff 9bad65d7..49c0b997`: the repair of [round 0](0_implementation.md)'s findings. The prompt (sha256 18f26be3bbfe…) gave round 0's findings with their dispositions, stated that F2 (the Feudal House rule) was deferred to M2 by the coordinator, and asked whether each repair is correct, tested and recorded. The raw logs stayed in fleet's ignored `tmp/review-runs/aoe2-141-m1-r1/`.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0). The runbook's command check printed `keep`, with 0 failed commands. It re-ran both 9,000-tick gate scenarios in memory, probed the cumulative Feudal pricing, the House boundaries and the hard-limit paths, and could not reach remote CI (network denied).
- Claude `claude-opus-5-5[1m]`, `--effort max`, Claude Code 2.1.308. Its `system/init` shows the tools Task, Bash, Glob, Grep and Read, `permissionMode` `dontAsk` and no MCP servers; `modelUsage` had one key, the pin, and the report command printed `keep`. Its calls were 29 Read, 26 Grep, 13 Bash and 6 Glob. It ran no test, and read DE's Promisory scripts to check the citations.
- The tree's `git status --porcelain` and `git diff HEAD` were empty before both lanes. No after-snapshot was saved; the next status of the tree showed only the worker's own repair edits.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths, with the link syntax removed; nothing else was changed.

- **R1 — P2: Cumulative soldier pricing can suppress a needed Imperial Market trade.** `src/game/simulation/bridge/systems/aiSystemProductionPhase.ts:289` now rejects units against cumulative spending, but still puts only their raw cost into `unaffordableWants`. The Market’s shortfall calculation (`src/game/simulation/aiMarketPlanning.ts:191`) compares those costs against the original stockpile. With no blocked plan costs, a villager due, and **100 food / 30 wood / 1,000 gold**, the Spearman consumes the available wood budget. The rejected Archer nevertheless looks affordable to the Market, takes priority over wood-starved siege units, and produces no trade. A read-only phase comparison emitted `buy-wood` before the repair and no trade afterward. Market targeting needs the same effective spending budget, covered by a regression test.

- **R2 — P2: The plan still specifies the split that F3 removed.** `docs/work/141_ai-economy/plan.md:37` still says the implemented plan uses **55% food / 45% wood from 12 villagers**. The repaired code always returns 3:1 in Dark Age, and the revised spec defers sourcing the later split to M2. Correct this active implementation record so M2 does not inherit the rejected rule.

Both self-play arrangements completed 9,000 ticks and passed the gate’s assertions. Focused checks passed for cumulative Feudal spending, housing boundaries, and the hard-limit farm, Watch Tower, Wonder and blocked-cost paths. Full `npm run verify` was not run; remote CI was unavailable because network access was denied. No files changed.

**Verdict: material findings R1 and R2.**

### Claude (claude-opus-5-5[1m])

Kept as written; its headings are three levels lower here.

#### Review round 1 (Claude lane): the repairs in `9bad65d7..49c0b997`

The repairs are mostly sound, but three findings are material: two of the behaviour repairs have no test that fails without them, and the plan still describes the Dark Age split that F3 removed.

I modified no file and ran no test (vitest writes `tmp/test-times`). HEAD is 49c0b997 and the tree is clean. Outside the diff I read `ai.ts`, `aiMarketPlanning.ts`, `aiResourceReserve.ts`, `playerQueries.ts`, `bridgeConstants.ts`, `createSimulationBridge.ts` and `aiBuildOrderAffordable.test.ts`, plus DE's `buildings.per`, `units.per`, `dawn.per`, `gatherers.per` and `init.per`.

##### Each repair against its round-0 finding

- **F0 (soldiers priced together):** the code is correct. The comment's own case, a Spearman and a Scout (35 + 80 food out of 130), now stops at the Scout. It has no test (R1-2), and its scope has gaps (R1-6).
- **F1 (the housed path and the hard limit):** the code is correct.
  - Below the hard limit, the housed path behaves exactly as at 9bad65d7. Only a seat at the hard limit behaves differently.
  - At the limit I checked each consumer. Farms need no population. The Wonder and watch-tower paths don't read the flag. `blockedBuildTarget` now feeds the Market's plan costs a real want; before, the Imperial Market could aim at a useless 25-wood House.
  - The villager demand still reads `populationBlocked`, so no villager food is held back at the limit.
  - Nothing I found assumed "blocked means build nothing". It has no test (R1-1).
- **F3 (the removed late split):** the code is clean. No caller passes a villager count any more (`aiSystem.ts:136`, `bridgeHelpers.ts:105`). The plan was missed (R1-3).
- **F4 (the relabelled floor):** the new label is accurate. A Militia costs 50 food and 20 gold (`trainingCosts.ts:14`), and the 500-food age-up reserve blocks it at 320 food whatever the latch does.
- **F6 (the House table test):** the table is sound. It uses literal expected numbers, with a control at 199 beside the 200 limit. It has two gaps (R1-5).
- **F14 (the gate's completion assertion):** it holds (`aiEconomySelfPlay.test.ts:115`). `step(100)` is one tick (`createSimulationBridge.ts:310-331`). One side effect: if the engine halts, the loop spins until the 150 s timeout. That is still red, just without the message.
- **Citations:** these match the 2026-10-06 files: `units.per` 328-386 and 409-415; `buildings.per` 1646-1659, 1767-1779, 1789-1801, 1598-1609, 1758-1766 and 1484-1493; `dawn.per` 72-78. Three others are one line off (R1-8).

##### Findings

**R1-1 (material): no test fails if F1's wiring is reverted.**
- `aiHousing.test.ts:73-78` pins the hard-limit guard inside `houseWanted` (`aiHousing.ts:59`). 9bad65d7 already had that guard, at its line 45.
- The repair itself is in the caller (`aiSystemBuildingPhase.ts:166-169`, passed in at :233 and :241). The self-play gate never gets near population 200.
- Restoring 9bad65d7's closure, or passing `populationBlocked` where `housed` goes, leaves every test green.
- That revert is also the natural reading of the code. `ai.ts:170-183` still names the parameter `populationBlocked` ("Pop block pre-empts everything"), and `aiBuildOrderAffordable.test.ts:108-113,164-170` call the branch "pop-blocked".
- AGENTS.md:46,72 and `plan.md:89` require a red proof.
- Fix: add a bridge test at a small population limit (`createSimulationBridge(seed, { populationCap })`, as `setupScreen.test.ts:127` does). It should assert that no House is placed at the limit and some other building is. Rename the parameter in `ai.ts` to `housed`.

**R1-2 (material): F0 has no test.**
- No test touches the cumulative pricing.
- The gate's window is mostly Dark Age, where the unit mix has one entry (`ai.ts:116-117`). Only one seat gets about a minute of Feudal.
- The `aiVillagerReserve` fixture is Dark Age.
- Removing `soldiersAsked` at `aiSystemProductionPhase.ts:289,294,321` leaves every test green.
- Fix: a Feudal fixture with an idle Barracks and Stable, a villager due and 130 food. Assert that the villager gets trained, or that at most one soldier is queued.

**R1-3 (material, records): the plan still says M1 ships the removed split.**
- `plan.md:37`, under "At every level (M1, implemented)", still says 55% food and 45% wood, "which this plan uses from 12 villagers". The code no longer does this (`aiEconomyPlan.ts:57-66`).
- Spec `:1821` and `aiEconomyPlan.ts:54-56` both say M2 sources DE's split from 12 villagers. The plan's M2 list (`plan.md:92-98`) has no such item, and the plan is what M2's fresh worker reads.
- Smaller: the villager table (`plan.md:14-20`) says its M1 bundles predate the Spies fix, but not that they predate F0. F0 changes Feudal soldier pricing, so every cell after a seat reaches Feudal may have moved, including the 20:00 column and the gold figure.

**R1-4 (low, records): one comment presents the interim Blacksmith count as DE's.**
- `aiSystemBuildingPhase.ts:158` says "Any Blacksmith placed, as DE's `building-type-count-total` counts it."
- `-total` is the count in the "usual" rule (`buildings.per` 1628). The 6/8 rule M1 actually ships counts `building-type-count`, a standing Blacksmith only (1655). `aiHousing.ts:18-20` records exactly this as a deviation.
- The defect register (`defect-register.md:23,29`) doesn't mention the interim Feudal rule or its deferral either.

**R1-5 (low, test): the House table's header credits the gate with coverage it doesn't have.**
- `aiHousing.test.ts:6-7` says the self-play gate covers the pending count and the Blacksmith wiring.
- Lines 2-3 of the same header say the gate can't catch a pending count that is too generous. No seat gets far enough into Feudal within 9,000 ticks for 6 against 8 to matter.
- So nothing pins `ownsBlacksmith`, or the too-generous side of the pending count (AGENTS.md:47).
- The Castle step at population 64 is pinned only from above (`:61-62`). Moving it anywhere from 43 to 63 stays green.

**R1-6 (low): `soldiersAsked` leaves three gaps.**
- (a) In the Imperial Age, research is asked for before soldiers (`aiSystemProductionPhase.ts:221`, `aiMarketPlanning.ts:290-292`), and `soldiersAsked` doesn't count it. Research plus soldiers can still leave the villager short, which contradicts `aiEconomyPlan.ts:110`.
- (b) A soldier refused only because of the villager reserve or `soldiersAsked` goes into `unaffordableWants` with no shortfall against the raw stockpile.
  - The Market's unit-queue branch targets the want with the smallest shortfall (`aiMarketPlanning.ts:211-219`) and then returns no trade (:235-261).
  - So that soldier can block a trade toward a want with a real gap.
  - This only matters when the plan costs are empty, which was measured never to happen (:175-184).
- (c) The reason the accumulation runs only while a villager is due (:294) isn't written down. When no villager is due, two soldiers can still breach the age-up reserve together. That predates M1, and the latch recovers it a decision later.

**R1-7 (low, records): the spec and changelog lag the repair.**
- Spec `:1823` doesn't state that soldiers in one decision are priced together.
- Its "not housed" now conflicts with `:1820`, where a seat full at the limit is not housed. The villager demand actually uses `populationBlocked` (`aiVillagerDemand.ts:55`), though its doc says "not housed" (:29).
- `changelog.md:9-14` omits a change players can see: at the hard limit the computer no longer builds useless Houses, and its build order carries on.

**R1-8 (nit): citations are slightly off.**
- The repair cites whole rules for the Castle and Imperial Ages. On that convention, three citations are one line off:
  - Dark Age: 1584-1595 should be 1584-1596.
  - "Usual" Feudal: 1622-1633 should be 1623-1634.
  - The jump: 1635-1644 should be 1636-1645. This one leaves out line 1645, `(up-jump-rule 7)`, the very jump the deferral rests on.
- They appear at `aiHousing.ts:12,17-18`, spec `:1820`, `plan.md:36,97`, `aiHousing.test.ts:36,43` and `aiEconomySelfPlay.test.ts:7`.
- `plan.md:36` says `aiHousing.ts` lists what is not modelled. That list (`aiHousing.ts:27-33`) omits 1598-1609, which `plan.md:97` schedules for M2, and the fast-Imperial jump at 1780-1788.
- `aiSystemProductionPhase.ts:423` still has a stale "~555" line reference, right next to the two the repair fixed.

**R1-9 (low, records): round 0's finding IDs can't be looked up.**
- `aiHousing.test.ts:1-2` cites "finding F4", which is Claude's F4. In the commit's numbering, F4 is the relabelled floor.
- The code also cites Codex's numbers: "R1" at `aiSystemProductionPhase.ts:254` and "R5" at `aiVillagerReserve.test.ts:60`.
- No round-0 record is tracked yet: `docs/work/141_ai-economy/` holds only `plan.md` (AGENTS.md:49). When round 0's write-up lands, the IDs in the code should match it.

The interim Feudal rule is called interim, in the same terms as the deferral, in `aiHousing.ts`, spec §13.2, the plan and the test. The changelog says "for now". The only place that contradicts it is R1-4.

##### Verdict

Material findings: **R1-1, R1-2, R1-3**.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| Codex R1 | A soldier refused only for the shared budget (the villager due and the soldiers asked before it) went to the Imperial Market at its bare price, which could look affordable, so the Market aimed at it and made no trade. Claude R1-6b found the same. | Accepted. | The want is the whole budget the check used (`aiSystemProductionPhase.ts`). `aiSoldierBudget.test.ts`'s Market case, on the new `ai-market-budget-fixture` with the plan-first aim off, expects `buy-wood` in the first decision; at the bare price it trades a decision later. |
| Codex R2, Claude R1-3 | The plan still says M1 ships a 55/45 split from 12 villagers, and its M2 list lacks that item; the villager table does not say its bundles predate F0. | Accepted. | The plan's line says M2 sources the split and the M2 list gains it. The table is re-measured on the final tree. |
| Claude R1-1 | No test fails with F1's wiring reverted, and `buildWants` still names its parameter `populationBlocked`. | Accepted. | `aiHousedAtLimit.test.ts` on `ai-planner-fixture` at a population limit of 4: no House, some other building. Red with full read as housed (nothing placed) and with the pre-F1 wiring (two Houses). The parameter is `housed`, and `aiBuildOrderAffordable.test.ts` calls the branch housed. |
| Claude R1-2 | F0 has no test. | Accepted. | `aiSoldierBudget.test.ts` on the new `ai-soldier-budget-fixture` (Feudal, idle Barracks and Stable, 130 food): the villager is queued and no Scout is. Red with `soldiersAsked` removed: Spearman and Scout queued, the Town Center empty, 15 food. |
| Claude R1-4 | A comment calls the placed-Blacksmith count DE's, and the register omits the interim Feudal rule. | Accepted. | The comment says interim; the register names the rule and its deferral. |
| Claude R1-5 | The House table's header credits the gate with coverage it lacks, and the Castle step at 64 is pinned only from above. | Accepted. | The header names what no test pins: the pending count and the Blacksmith the phase passes in, now on the M2 list. A case at population 63 pins the step from below. |
| Claude R1-6 | Three gaps in `soldiersAsked`: (a) Imperial research asked first is not counted; (b) the Market want (Codex R1); (c) the accumulation's scope is unstated. | (b) accepted, as Codex R1. (a) and (c) deferred to M2's spending work: (a) needs research and units on one budget, and (c) predates M1 and the latch recovers it a decision later. | (c)'s reason is now in the comment. (a) and (c) are on the M2 list. |
| Claude R1-7 | The spec does not state soldiers priced together; its "not housed" conflicts with the hard-limit rule; the changelog omits the hard-limit change. | Accepted. | The spec states the shared budget and the Market's want, and says "below its population cap", as does the villager demand's doc. The changelog gains the hard-limit bullet. |
| Claude R1-8 | Three citations one line off, two DE rules missing from the not-modelled list, a stale line reference. | Accepted. | 1584-1596, 1623-1634 and 1636-1645 everywhere; `aiHousing.ts` lists 1598-1609 and 1780-1788; "~555" reads "above". |
| Claude R1-9 | Code cites reviewers' own finding numbers, and no round-0 record exists yet. | Accepted. | Code cites round 0's record (F0, F4, F6), which lands with this round's. |

## Verification

- Before the repairs, `npm run verify` passed on 49c0b997 with PREVIEW_PORT=4322: vitest 5,043 passed and 3 skipped, playwright 272 passed and 2 skipped, receipt OK.
- After the repairs, on the same base: 27 affected test files (210 tests, the architecture suite included), typecheck and lint passed; each new case went red as the table says.
- The coverage lab's census, from the probe that plays the test's own match, was byte-identical to variant A, the checked-in expectation.
- The full gate on the repairs, rebased onto work 140, is recorded in review 2's verification.

## Round outcome

Material findings Codex R1 and R2 and Claude R1-1, R1-2 and R1-3 are repaired, with tests for each behaviour repair. The low findings are repaired except R1-5's untested inputs and R1-6a/c, which are on the M2 list. Review 2 covers the round-1 repair diff.
