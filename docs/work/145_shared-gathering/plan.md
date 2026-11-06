# Villagers share a resource as in Definitive Edition

Status: active
Owner: shared-gathering worker for the Claude coordinator
Created: 2026-11-06
Updated: 2026-11-06

## Problem and outcome

The coordinator's play session of 2026-11-05 (v0.3.268, lobby defaults): three villagers boxed with a sheep and right-clicked onto the sheep behind the Town Center; two ate it, the third (2205) stood idle beside it, stayed idle when ordered alone, and did not carry on to the three sheep within a few cells. The brief blamed `MAX_GATHERERS_PER_RESOURCE = 2`.

Outcome: villagers share a resource as DE's do. A player's order putting several villagers on one sheep, carcass, tree, mine or berry bush is honoured up to DE's limit, no ordered villager goes idle beside a resource it could work, and the campaign-4 tree gridlock does not come back.

## Scope

- Included: the gather systems (`toResourceStep.ts`, `gatheringStep.ts`, `gatherCarryOn.ts`, `villagerGatherAssignment.ts`, `villagerEconomySystem.ts`), the approach path search where gathering needs it (`movementPlanOps.ts`), their tests and fixtures, spec §6.4 and §6.6's reseed sentence, and these records.
- Excluded: the AI's own files (work 144), input, HUD and combat, civ-engine and voxel. Herdable movement (a sheep may still stop on a unit's cell; the unit can now walk off). Where the computer differs from the human player it is reported, not changed (Measurements).
- Dependencies: work 144 changes the computer's Dark Age economy at the same time; whoever lands second merges and measures again.

## What reproduction showed (worktree build e714b4c0, port 4323, `tmp/repro/sheepOpening.mts`, real mouse, headless)

- Three villagers selected alone (a double-click) and right-clicked onto the sheep at (6,10): all three eat it at once, ticks 42-457. The cap refuses no player order: nothing on the order path reads it.
- Three villagers boxed together with two sheep, right-click on the sheep: the boxed sheep walk toward the clicked one, and sheep 2163 stops on (6,9), the cell where all three villagers stand. A resource claims its whole cell, and civ-engine's `findGridPath` returns null for a blocked start, so every path search from (6,9) fails: the gather order ends (idle when empty), the carry-on finds no reachable sheep, and a carrier never reaches the drop-off (all three stood in `to-dropoff` holding food from tick 81 to 459). This is what the coordinator saw: the brief's cause is wrong.
- Where the caps do act on the player's villagers: the walk fan-out (`toResourceStep`: more than 2 on the node and 400 ticks walked, so a group ordered onto a node more than 32 tiles away is split), and the carry-on ranking (2 or 4 per node before a crowded one, so six shepherds whose sheep runs out split 4 and 2). The computer's automatic assignment reads 4 (idle) and 2 (reroutes).
- Shift-click did not add a villager to the selection (input, out of scope; for plan 106).

## DE's rule, and its sources

- DE's own text (`resources\en\strings\key-value\key-value-strings-utf8.txt`, read only): 26149, the Farm: "Only one Villager may work a Farm at a time."; 26895, the Khitan Pasture: "Only two Villagers may work a Pasture at a time."; tutorial 44433: "Each Farm needs only one villager working on it." No string names a limit for sheep, carcasses, trees, mines or bushes, and `_common\dat\airesourcetypes.json`, `dropsites.json` and `AIConsts.json` hold none.
- The limit for those is the room beside the node. AoE2 DE forum 101012 (2020-11-21, airkeukenrol): "Try it with 15 villagers on a single tree", "12 of them will just wait and stare at the tree instead of picking another one".
- Players put six or more on one sheep under the Town Center (the opening in every build-order guide; aoe2-guide.pages.dev's scout opening, ageofnotes.com's fast castle).
- What a farmer extra to a taken Farm does: not in DE's text; player reports (Steam discussions 3681064390585351430 and 1741134478138014340, 2019-2020) have surplus farmers idle, or taking a free farm nearby. Closest sourced behaviour: the carry-on (work 131), a free Farm within 5 cells or the order ends. For the owner.

## Approach

- The human player's villagers: no rule limit on a sheep, carcass, tree, mine or bush. The count fan-out of the walk (more than 2 on the node after 400 ticks) is the computer's alone, so a group sent any distance works the node it was sent to; one that never gets beside it is carried on by the 600-tick backstop, as before. Their carry-on takes the nearest node of the kind however many work it.
- A Farm takes one of the human player's villagers: one that arrives at a Farm another villager works takes a free Farm within 5 cells (`findCarryOnTarget`'s `freeFarm`), or its order ends.
- Every unit: the approach and drop-off path searches (`movementPlanOps.findMovementPathToCandidates`) and the move-order search (`moveDestinationSearch.ts`, from review round 0) count the searcher's own cell as open, so a unit on a cell a resource has stopped on walks off it.
- A Farm is free while its farmer is away delivering, as DE's is; the farmer coming back to a taken Farm takes a free one (review round 0).
- The computer keeps its spread (4 on idle assignment and its carry-on, 2 on its reroutes and walk fan-out) and may put two on a Farm. The first version held it to the human's rules (the carry-on's rank and the Farm for every owner); that moved two self-play gates, so by "drop, don't tune" it was dropped for the computer (Measurements).

## Acceptance criteria

- [x] Browser, real clicks: six villagers on one sheep under the Town Center all eat, and carry on together to the next sheep (`tests/browser/shared-gathering.spec.ts`).
- [x] Simulation: per kind, a group on one node all work it with per-villager rates unchanged; a long-walk group is not split; a Farm takes one and the extra carries on or idles; a villager under a sheep works; the campaign-4 pile does not jam. Each red with the defect put back.
- [ ] selfplay-ab against the noise floor; census moves named both ways.
- [ ] Spec §6.4, register, changelog (Unreleased — work 145), devlog vNEXT; verify and receipt; Codex review.

## Files

- `src/game/simulation/bridge/gatherCarryOn.ts`: the carry-on's crowding rank only for the computer's villagers (`spreadCap`), a Farm someone targets never a candidate, `freeFarm`, `farmWorkedByAnother`.
- `src/game/simulation/bridge/systems/toResourceStep.ts`: the walk fan-out the computer's only; the human player's villager arriving at a worked Farm.
- `src/game/simulation/bridge/movementPlanOps.ts`: the open start cell (500 lines, at the cap). `moveDestinationSearch.ts`: the same for move orders, and the walk-order message's reach.
- `src/game/simulation/bridge/systems/villagerEconomySystem.ts`, `gatheringStep.ts`: call sites.
- `src/game/simulation/fixtures/economyBasics/sharedGathering.ts` (new, registered in `scenarioRegistry.ts`): the opening, five kinds, the far walk, the Farm, the trap and the pile.
- Tests: `tests/simulation/sharedGathering.test.ts`, `villagerGatherPile.test.ts`, `sharedGatheringScenarios.test.ts` (new), `tests/browser/shared-gathering.spec.ts` (new), `movementPlanCandidateReach.test.ts` (changed, below).
- Spec §6.4 ("Several villagers on one node", the carry-on's "Which node", the assignment sentence) and §6.6's reseed sentence.

## Red proofs (the defect put back, one at a time, the file restored byte for byte; `tmp/mutate.mjs`, `tmp/mutate-browser.mjs` in the worktree)

- On main's code (the test files on the unfixed tree): all nine `sharedGathering.test.ts` cases red, each with its own message.
- On the final code: the human's carry-on given the computer's 4-per-node rank: the opening and all five kinds red (shepherds [B,B,B,B,C,C]; each kind 4 and 4), and the browser spec red (sheep C eaten to 82). The walk fan-out given back to the human: the far case red (a villager sent to the other pile). The Farm check off: the Farm case red (three on one Farm). The open start cell removed: the trap case, the blocked-start case and the equivalence case red.
- Round 0's two cases: the staggered Farm case red with the Farm check off (two farmers on one Farm); the move-order case red with the move search's open start removed (the villager stayed under the sheep).
- `villagerGatherPile.test.ts`: red under a two-per-node arrival rule, with the give-up path (4 villagers never filled a load) and without it (6); green with the give-up path alone removed, because one cell takes the whole pile today (18 gathered from (19,21) at once, overflow past 16 slots) and drop-offs rotate it. Bound: the gate holds that a pile all works, whatever stops it.

## Existing tests changed

- `monkCarriedRelic.test.ts` (work 128), "picks up a relic it stands on in a save made before work 128, and walks off with it": its premise read a refused move order as proof the Monk stood on blocked ground, which is the trap this work removes, so it failed the gate on e4791912. The premise is now the shared cell (the relic under the Monk); the case's claims are unchanged. Spec §6.9's sentence on such a unit now says it walks off.
- `movementPlanCandidateReach.test.ts`: its oracle (the pre-work-123 planner) takes the same open start cell as the planner, a blocked-start case is added, and its sample grew from 600 to 900 grids, because its floor of more than 50 rounds where every reachable search failed fell to 43 of 600 once a blocked start no longer ends a search. No assertion or floor changed.

## Live check (lobby defaults, Start Match, 1280x720, port 4323, `aoe2.audio.muted=1`; `tmp/repro/liveOpening.mts`)

- Main e714b4c0 (served build checked against `dist/index.html`): after the box with sheep, the three starting villagers stood in `to-dropoff` at (6,9) under sheep 2163 from the order to the end of the run (tick 1,862), carrying food.
- This branch: the same gesture has the three eat the clicked sheep together and go on together to the next. A double-click took all seven villagers and a right-click on the sheep at (6,9) put all seven to work at once (`most villagers gathering at once: 7`), three on the clicked sheep and four on the sheep at (7,5).
- Open, the same on main: the four villagers the Town Center trained, standing north-east of it, worked the sheep at (7,5) rather than the sheep west of the Town Center they were ordered onto, on both builds; their gather point, set by a right-click on the sheep under the Town Center, did not take in the live driver (in the simulation it does). Not investigated further in M1.
- Shift-click and Ctrl-click add nothing to a selection (input; plan 106).

## Measurements

- `npx tsx scripts/selfplay-ab.mjs --a <main e714b4c0> --b <this change> --seeds 5 --config castle --jobs 6`, the noise floor's configuration (plan 144): five maps, five seeds each, 45,000 ticks on the default map and 60,000 on the others; arm A a control worktree on main, arm B a frozen copy of the final game code. All 25 records are identical to main's but for wall time and fingerprints, and every row of the report reads no move (0 up, 0 down): villagers at the clicks and at 5 to 20 minutes, the age clicks, villager deaths, armies, ends. So the change is byte-neutral for the computer on these seeds; the open start cell, the only part that reaches it, changed no match. Bound: castle configuration, these 25 seeds; both seats are computers there, so the human player's rules do not run.
- The computer held to the human player's rules (the first version: the carry-on without its crowding rank and one villager a Farm, for every owner): `selfPlayContentCoverage.test.ts` red, "owner 1's siege-workshop researched nothing it hosts", and `aiReachesCastleAge.test.ts` red, the Crossbowman never exercised on the boot match's floor. The Farm rule alone for the computer: `selfPlayContentCoverage.test.ts` red, "owner 2 did not reach the Imperial Age in the lab" (it ended in the Castle Age). Both dropped for the computer; with the final code both gates pass and the census is unchanged (the census file is not re-recorded).

## Reviews

- Round 2 (`reviews/2_implementation.md`), Codex on c063fd2d: one low finding, a spec sentence still saying a unit under a relic could not walk off it, accepted and repaired; it confirmed both test changes.
- Round 1 (`reviews/1_implementation.md`), Codex on e4791912: one medium finding, the staggered Farm case passing the opposite rule too, accepted and repaired (it asserts who farms what; red with a Farm reserved through the delivery). It confirmed R0-1's disposition against the spec, with the bound that the source is a 2019 player report.
- Round 0 (`reviews/0_implementation.md`), Codex on a2c6789b: one medium finding, a Farm taken while its farmer delivers, rejected for the rule (DE's Farm is free then) with its regression test added; the worker found and repaired the same trap in the move-order search.

## Gates

- c063fd2d: `npm run verify` exit 0, `node scripts/verify-receipt.mjs check` OK on tree 935e666f29a7 (vitest 5,390 passed and 3 skipped, Playwright 321 passed and 2 skipped).
- e4791912: `npm run verify` failed its unit stage on `monkCarriedRelic.test.ts` (above); repaired in the next commit.
- a2c6789b: `npm run verify` exit 0, `node scripts/verify-receipt.mjs check` OK on tree 6ba72558cf2a (vitest 5,388 passed and 3 skipped, Playwright 321 passed and 2 skipped).

## Visual

The default view and one random view (FOCUS 37,22, ZOOM 1.7, 1280x720), main against this branch with the maintained pair: 0 of 480,000 and 0 of 921,600 pixels changed. Crowding does not move where villagers stand (the same approach cell and slots); the AI-base capture at tick 3,000 is fogged to the human and shows nothing. Bound: boot and fogged frames; the shared-gathering scene is checked by the browser spec and the live screenshots in `tmp/repro`.

## Implementation steps

- [ ] M1 as above.

## Outcome

Pending.
