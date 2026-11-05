# Review 0: implementation

## Target

aoe2 commit 9bad65d7 on branch `ai-economy-1104` (work 141 M1), reviewed as `git diff a37deeee..9bad65d7` (27 files, 899 insertions, 97 deletions). The prompt (sha256 c9f4050e…67c8) and raw logs stayed in fleet's ignored `tmp/review-runs/aoe2-141-m1-r0/`.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0). The command check is `keep`, with 0 failed commands. It re-ran both 9,000-tick gate scenarios and a 300-tick save/load continuation in memory, read files outside the diff, and could not reach remote CI (network denied).
- Claude `claude-opus-5-5[1m]`, `--effort max`, Claude Code 2.1.308. Tools were Read, Glob, Grep, Task and Bash limited to git diff/log/show, in `dontAsk` mode with no MCP servers (checked in its `system/init`). `modelUsage` had one key, the pin, and the report command returned `keep`. It ran nothing, because a verify was in progress in the tree, and it read DE's Promisory scripts to check the citations.
- The tree's `git status --porcelain` and `git diff HEAD` were empty before and after both lanes.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths, with the link syntax removed; nothing else was changed.

Reviewed `9bad65d7` against `a37deeee`. No files changed.

1. **R1 — Medium: multiple soldiers can consume the Villager reserve.** `src/game/simulation/bridge/systems/aiSystemProductionPhase.ts:284` checks every purchase against the unchanged stockpile; pushes do not deduct pending expenditure. Reproduced through the live handlers: a Feudal AI with 130 food queues a Spearman, Scout, then Villager. The soldiers consume 115 food, leaving 15, and the Villager is refused. Account for earlier purchases or enqueue the reserved Villager first. The Dark Age self-play gate cannot expose this multi-producer case.

2. **R2 — Medium: the emergency housing branch bypasses the hard-cap guard.** `src/game/simulation/ai.ts:182` accepts `missing('house')` even when `houseWanted` rejected further housing. Reproduced at the supported 25-population limit: population remained 25/25 while Houses increased from four to five and wood fell from 100 to 75. Subsequent completions allow the waste to repeat. The hard-cap decision must govern both housing paths.

3. **R3 — Medium: Feudal housing does not implement the cited DE conditions.** `src/game/simulation/bridge/systems/aiSystemBuildingPhase.ts:157` treats an unfinished Blacksmith as sufficient for eight-slot headroom. Reproduced with seven free population and an unstarted Blacksmith: the phase requests a House. DE’s `buildings.per:1655` requires `building-type-count blacksmith`, whereas its earlier clause explicitly uses `building-type-count-total`. Additionally, `src/game/simulation/aiHousing.ts:51` drops the strategy, producer and age-time conditions surrounding DE’s six/eight-slot rule. Restore those conditions or accurately describe this as an approximation.

4. **R4 — Medium: the twelve-Villager transition is incorrectly attributed to DE.** `design/spec-final.md:1821` calls 55/45 “from 12” DE’s rule. The cited `gatherers.per:22–29` instead checks the Feudal transition or at least nineteen Villagers with sufficient food, within a strategy-gated block. The plan acknowledges substituting twelve, but the authoritative spec and test describe it as sourced behavior. With M1’s ten-Villager cap, the new late branch is normally unreachable, including while Feudal research runs. Implement the sourced condition or explicitly document the deferred approximation.

5. **R5 — Low: the no-soldier assertion does not test the saving latch.** `tests/simulation/aiVillagerReserve.test.ts:58` stays satisfied without the military latch: this fixture qualifies for Feudal, so its separate 500-food reserve already blocks Militia against 320 food. Use a case without age prerequisites to isolate that latch, or label this assertion a regression floor.

6. **R6 — Low: “never housed” contradicts the measurement.** `design/spec-final.md:1828` says the human-idle arrangement was never housed. The reviewed revision produces a 31-tick, **3.1-second** housed run; the plan also reports approximately three seconds.

The two complete 9,000-tick scenarios passed all four self-play assertions when re-executed in memory. A 300-tick save/load continuation also matched economy samples. I inspected files outside the diff, including charging handlers, producer gating and fixture consumers. The rush/corridor fixture changes and House-by-id assertion preserve their stated purposes.

Full verification, browser checks, original mutation proofs and scale benchmarks were not rerun. Remote CI was unavailable because network access was denied. No browser or GUI was launched.

**Verdict: material findings R1, R2, R3 and R4.**

### Claude (claude-opus-5-5[1m])

Kept as written; its headings are two levels lower here.

#### Review: work 141 M1 at 9bad65d7 (base a37deeee)

I made no changes and ran no tests. A `npm run verify` on 9bad65d7 started in this worktree at 21:13 UTC and was still running, so running anything there would have overwritten its reports. I read DE's Promisory scripts directly to check the citations.

##### Material findings

**F1 — Medium. DE fidelity and records: the Feudal House rule is not DE's.**
- Where: `src/game/simulation/aiHousing.ts:14-15` and `:50-51`; the same claim is in `design/spec-final.md:1820`, `docs/changelog.md:9`, `docs/work/141_ai-economy/plan.md:36`, the commit message and the comment at `corridorSeal.ts:146-148`.
- buildings.per 1584-1596 applies in every age; its age test is commented out at 1587. From `sn-current-age >= dfeudal` (const.per 1339: the Feudal research and every age after it), it wants a House under 4 free once population is 8 or more.
- The Feudal rule at 1623-1634 (cited as 1626-1633) asks for a House under 6 only with a Blacksmith (`count-total`, so a foundation counts). Otherwise it asks under 3.
- "Under 6, or under 8 with a Blacksmith" is the rule at 1646-1659. The jump at 1636-1645 (`up-jump-rule 7`, ending at "; end mini jump", 1743) skips it whenever strategy-type is not feudal-war and the AI has fewer than two Barracks, two Archery Ranges and two Stables.
  - Standard resets every strategy to usual (init.per 9577-9590).
  - Usual is strategy-type imperial-war unless the enemy is flushing (init.per 10141-10153).
  - This AI never builds a second of any of those buildings.
- So DE Standard's Feudal rule for this AI is under 4, or under 6 with a Blacksmith. The shipped rule is 2 higher in both cases.
- The cited 1656-1672 is the tail of rule 1646 plus rule 1660, which needs two Archery Ranges.
- The plan's "not modelled: the 4 while Feudal researches" reads `>= dfeudal` as `== dfeudal`.
- The re-recorded census was measured under this rule.

**F2 — Medium. Correctness and records: Houses are still built at the hard population limit.**
- The claim is "No House is wanted once the population cap reaches the hard limit" (spec `:1820`; `aiHousing.ts:29-31`). It is false once the population is full.
- At current ≥ cap = hard limit:
  - `aiSystem.ts:157-160` sets `populationBlocked`.
  - `aiSystemBuildingPhase.ts:159-165` makes `missing('house')` true whenever no House is under construction.
  - `ai.ts:181-183` then returns `['house']`. `houseWanted`'s own guard at `aiHousing.ts:45` is correct, but this path bypasses it.
- A seat at 200/200 therefore places a House it can never use each time the last one finishes. That branch never falls through, so it builds nothing else while it stays full: no new farms, no Siege Workshop, Monastery or Castle.
- This is older than M1. But M1 edits that exact line, its records claim the opposite, and it makes the state likelier because the army is no longer throttled by housing.
- The gate cannot see it: the instrument's `housed` excludes `popCap >= hardPopCap` (`aiEconomyTrace.ts:188`).
- I did not measure whether the coverage-lab seats reach 200. That is worth checking before putting all three lost producers down to wood shortage.

**F3 — Medium. Test: the "trains no soldier" half of `aiVillagerReserve.test.ts` passes without the latch.**
- Where: the claim at `:28-29`, the describe name at `:31`, the assertion at `:58`.
- The fixture qualifies for Feudal (`scoutingAndRush.ts:316-319`), so `militaryReserve` is the 500-food Feudal cost (`aiSystemProductionPhase.ts:130`, `:155-157`).
- A Militia then needs 60 + 500 + 50 = 610 food. The fixture has 320 and no income, so it is refused with or without `savingForAgeUp`.
- The latch is also on only at the first decision. The first villager drops food to 270, below the 60% line of 300, so the remaining ~670 ticks run with the latch off.
- The villager half is a valid red proof. This file was the latch's only named test, so its remaining job (holding soldiers and research) is now untested.

**F4 — Medium. Coverage: `houseWanted` has no test of its own.**
- Nothing in `tests/` references `aiHousing` or `houseWanted`.
- The gate runs 9,000 ticks. That is the Dark Age plus about a minute of Feudal for one all-AI seat, and that seat places no Feudal House in that minute (its first Feudal House is at 15:28 in the worker's bundle).
- The gate is also one-sided: it fails if Houses come too late, never if they come too early or at wrong thresholds. For example, `headroom < 30` everywhere would stay green.
- So the Blacksmith clause, the Castle and Imperial thresholds and pending counts, and the hard-limit guard ship with no red proof. The bound in `aiEconomySelfPlay.test.ts:33-37` doesn't say so.
- `houseWanted` is a pure function, so a table test would be cheap (AGENTS.md:72, TDD).

##### Minor findings

- **F5 — Low (DE, records).** The 55/45 split "from 12" is not DE Standard's.
  - gatherers.per 11-20 jumps over 21-56 unless the strategy is s-flush; line 24 is commented "s-flush feudal".
  - `scoutmicro` is set to no (init.per 374), and its only "yes" is commented out (interaction.per 1316).
  - In the Dark Age from 12 villagers, DE uses dawn.per's per-villager counts (80-385) instead.
  - No gameplay effect, since the Dark Age cap is 10 (`aiEconomyPlan.ts:53`). But spec `:1821`/`:1832`, plan `:37`, `aiEconomyPlan.ts:48-51` and `darkAgeTuning.test.ts:13-16`/`:30-33` all record 11:9 as DE's.
- **F6 — Low (records).** The citation units.per "391-397" points into a Dark-Age rule that needs two Town Centers (388-400). The Feudal villager rule is at 409-415 and 433-438. Cited at spec `:1822`, plan `:38`, `aiSystemProductionPhase.ts:402`, `aiVillagerReserve.test.ts:20` and `aiEconomySelfPlay.test.ts:9-10`.
- **F7 — Low (design).** `aiVillagerDemand.ts:1-3` says the demand is "asked ONCE" so the soldier check and the villager push agree. But the villager push recomputes its own copy (`aiSystemProductionPhase.ts:393-414`). The two differ when the age-up is pushed between them (`:365-367`). The effect today is a harmless one-decision over-reserve.
- **F8 — Low.** The villager reserve is per soldier, not per decision. Every soldier is checked against the same unspent stockpile (`aiSystemProductionPhase.ts:254-323`). From Feudal on there are several producers, so two soldiers can each leave 50 food and together take the villager's food. The comment at `aiEconomyPlan.ts:111-114` ("a soldier never takes the Town Center's food") overstates this. The Dark Age is safe because it has one producer.
- **F9 — Low.** Comments that now contradict M1:
  - `aiSystemProductionPhase.ts:410-412` says the latch banks food.
  - `scoutingAndRush.ts:288-299` and `:324-326` say the latch suppresses villagers.
  - `aiEconomyPlan.ts:26` says "THE VALUES ARE UNCHANGED".
  - `aiEconomyPlan.ts:39-42` says 6:2 (75% food) starves wood. The shipped 3:1 is that same 75%.
- **F10 — Low (records).** Spec `:1828` says owner 2 with the human idle was "never housed". But plan `:16` gives 3 s, and the worker's bundle shows a 3 s stall at 05:16, inside the 9,000-tick window (`tmp/m141/idle-m1.metrics.txt:28`). The two may come from different trees; the records should say which. Separately, `aiEconomySelfPlay.test.ts:12-13` names an ignored tmp path, which `aiMarketPlanning.ts:115-117` says comments should not do.
- **F11 — Low (DE).** These DE rules are neither modelled nor on the "not modelled" list:
  - buildings.per 1484-1493: no House while spare wood is below a House's cost.
  - The time-boxed delays at 1517-1583.
  - The Castle rule starting at the Castle research (`>= fcastlea`, 1770), and its 15 s jump (1758-1766).
  - The Imperial 30 when civilians are maxed (1795).
- **F12 — Info (unmeasured).** The research plan scan records each producer's first option (`aiSystemProductionPhase.ts:174-185`). Once a Castle has researched everything listed before Spies, Spies' real price becomes its want. The Imperial-Age Market logic would then sell surplus toward it whenever it is the closest want (`aiMarketPlanning.ts:211-258`).
- **F13 — Info (unmeasured).** The Dark Age build order still includes a mining camp (`ai.ts:197-198`), though nobody gathers gold or stone before Feudal now. That is 100 wood for an unused building at a 25% wood split.
- **F14 — Low (test).** The gate's loop stops if the match ends (`aiEconomySelfPlay.test.ts:86`), and nothing asserts that all 9,000 ticks ran.
- **F15 — Low (process).** The commit has no line in `docs/devlog/summary.md`, and the new instrument is not listed in `docs/debugging/instruments.md`.

##### Checked and found sound

- **DE rules.** These match the scripts:
  - Dark Age under 3 with none pending.
  - Castle 10/16/20 with fewer than two pending.
  - Imperial under 20 with fewer than three pending.
  - `houseWanted`'s own hard-limit return.
  - The 75/25 split below 12 villagers.
- **Pending Houses.** Both unstarted and started foundations count. At most one House is pushed per decision, and the next decision sees its foundation.
- **Rebalance.** The zero-target guard and the no-inversion short-circuit are correct.
- **Order.** The order of pushes matches the order the handlers charge them; the age-up is charged before the villager.
- **Determinism and saves.** No randomness, wall-clock reads or new saved state.
- **Cost.** The new scans add a few full unit and building scans per AI decision, which is small next to the scans those phases already run.
- **Tests and fixtures.** These are sound:
  - The Spies test and its fixture.
  - The `aiPlayer` split case discriminates.
  - The Siegeworkshop-by-id change is more precise, not weaker.
  - The corridor-seal House is needed under DE's real rule too.
  - The rush fixture change is documented. It means the AI's opening is no longer what those tests exercise.
- **Census.** The re-recorded census matches the commit message move for move, in both directions.

##### Not checked

- I ran nothing: no mutations, so the red proofs are taken from the records.
- Verify status, from the worker's logs:
  - The first run on 9bad65d7 passed the unit suite (652 files, 5,038 tests) and typecheck.
  - Its browser stage stopped at 36/274 with exit 1 and no failure printed.
  - No receipt exists, and the second run was in progress.
- Whether DE's `population` counts units in training. This game counts only spawned units (`productionQueueSystem.ts:148-155`), so if DE does count them, our free population reads about one higher per busy producer.
- M2's citations, apart from init.per 9577-9621.
- `snapshotSource` against civ-engine's snapshot format.
- Whether the lab seats reach 200/200 (F2).

**Verdict:** material findings F1, F2, F3, F4.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | The villager reserve is per soldier, so several soldiers in one decision can together take the next villager's food (Codex R1, Claude F8). | Accepted. Handlers charge in the order asked and none of a decision's pushes is charged yet. | While a villager is due, each soldier is priced on top of those already asked for (`soldiersAsked`, `aiSystemProductionPhase.ts`). Census probe: no effect on the lab. Its test is review 1's (R1-2). |
| F1 | The housed path bypasses the hard-limit guard and builds useless Houses; full at the limit, the build order builds nothing else (Codex R2, Claude F2; older than M1). | Accepted. | `missing('house')` returns the House rule, and full at the hard limit is not treated as housed. Census probe: no effect on the lab. Its test is review 1's (R1-1). |
| F2 | The Feudal House rule is DE's Feudal-war rule; for this AI DE's is under 4, or under 6 once a Blacksmith is placed (Claude F1). Codex R3 asked for a standing Blacksmith under the same skipped rule. | Accepted as a finding, with Codex R3 superseded: the jump at buildings.per 1636-1645 skips 1646-1659 for the usual strategy. The coordinator deferred it to M2 on 2026-11-04. The census probe showed that adopting the usual-strategy rule (4/6), or a standing-Blacksmith-only 6/8, each moves the coverage lab beyond the approved variant A, losing whole buildings. With every other repair, 6/8 with a placed Blacksmith keeps variant A exactly. | M1 keeps 6/8 at every level, recorded as INTERIM in spec §13.2, `aiHousing.ts` and plan 141. M2's criteria pick the rule per level and strategy after the spending fix, and add DE's second Dark Age rule (buildings.per 1598-1609). |
| F3 | The 55/45 split "from 12" is not DE's (Codex R4, Claude F5). | Accepted. It is unreachable under the cap of 10. | Removed; M2 sources the 12-to-click split from gatherers.per with the per-level counts. |
| F4 | The no-soldier half of `aiVillagerReserve.test.ts` passes without the latch (Codex R5, Claude F3). | Accepted. The age-up reserve also blocks the Militia there, and it did before M1, so the soldier latch was never isolated. | Relabelled a floor in the test; the villager half stays the latch's red proof. An isolating case is left to M2's spending work. |
| F5 | "never housed" contradicts the 3.1 s measured (Codex R6, Claude F10). | Accepted. | Spec says at most 3.1 s. |
| F6 | `houseWanted` has no test, and the gate is one-sided (Claude F4). | Accepted. | `tests/simulation/aiHousing.test.ts`, a table from DE's rules, red under five mutations (the Dark and Feudal thresholds, the Castle step at 42, the Imperial pending count and the hard-limit guard). Its wiring test is review 1's (R1-1). |
| F7 | units.per "391-397" points into a two-Town-Center Dark Age rule (Claude F6). | Accepted. | Cited as 409-415 (and the Dark Age rules as 328-386) everywhere. |
| F8 | `aiVillagerDemand.ts` says "asked ONCE", but the villager push recomputes (Claude F7). | Accepted. | The comment states the one-entry difference and its direction (over-reserve). |
| F9 | Stale comments (Claude F9). | Accepted. | `aiSystemProductionPhase.ts`, `scoutingAndRush.ts` and `aiEconomyPlan.ts` corrected. |
| F10 | The gate's header names an ignored tmp path (Claude F10). | Accepted. | The header names the regeneration command and the plan's table. |
| F11 | DE House rules neither modelled nor listed (Claude F11). | Accepted. | Listed in `aiHousing.ts`'s "not modelled". |
| F12 | Once a Castle has bought everything before Spies, Spies' real price becomes its plan want, and the Imperial Market sells toward it (Claude F12, unmeasured). | Deferred to M2 (spending). | Recorded in plan 141's M2 scope. |
| F13 | The Dark Age build order still builds a Mining Camp nobody uses (Claude F13). | Deferred to M2 (spending and build order). | Recorded in plan 141's M2 scope. |
| F14 | The gate does not assert that its window completed (Claude F14). | Accepted. | `expect(ticks).toBe(WINDOW_TICKS)`. |
| F15 | No devlog line, and the instrument is missing from `instruments.md` (Claude F15). | Accepted. | Both added in the records commit. |

## Verification

- Before the repairs, `npm run verify` passed on 9bad65d7 with PREVIEW_PORT=4322: vitest 5,038 passed and 3 skipped, playwright 272 passed and 2 skipped, receipt OK.
- After the repairs, these passed: `aiHousing.test.ts` (red under five mutations), `darkAgeTuning`, `aiVillagerReserve`, `aiPlayer`, `aiPlacementKeepsMapConnected`, `aiResearchRealPrice`, `scoutWanderCorner`, `aiEconomySelfPlay` and the architecture suite.
- Coverage lab census, from the probe that plays the test's own match, compared with the variant-A expectation:
  - every repair applied, with DE's usual-strategy Feudal rule: owner 1 loses its Monastery building and Castle research; owner 2 loses its Castle and Watch Tower buildings and its Castle and Siege Workshop training;
  - the same with F0 reverted, or with F1 reverted: the same losses;
  - every repair with the interim 6/8 rule (shipped): an exact match;
  - the interim 6/8 counting only a standing Blacksmith: further losses (owner 1's Monastery and Siege Workshop buildings, among others).
- The full gate on the repaired commit 49c0b997 is recorded in review 1's verification.

## Round outcome

Material findings F0, F1, F3, F4 and F6 are repaired, F2 is deferred to M2 by the coordinator, and F12 and F13 are M2 leads. The minor findings are repaired. Review 1 covers the repair diff 9bad65d7..49c0b997.
