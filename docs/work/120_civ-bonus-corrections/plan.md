# Civilization bonuses do what Definitive Edition's do, and the in-game civilization text says so

Status: active
Owner: Coordinator worker w120-civ-bonuses (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-11

## Problem and outcome

On 2026-10-11 the docs-only spec worker checked spec §11.11 against the code, calling each bonus function in scratch probes. It found places where the code does not do what Definitive Edition (DE) does:
- **Indian scout-line attack against buildings counts twice.** An Indian owner's own Scout line hits buildings for +4, where DE gives +2. The Indians entry in `CIV_BONUSES` adds +2 through `civBuildingAttackBonus`, and `teamBuildingAttackBonus` in `teamCombatBonuses.ts` has added the same team line for the owner's side since v0.3.144.
- **The Aztec train-time rule is `unit !== 'villager'`.** It therefore also speeds the Fishing Ship, Transport Ship, Trade Cog and Trade Cart, which are not the CSV's "Military units".
- **The Goth villagers' "+5 attack versus wild boar" has no implementation.** `deliverUnitAttackOnAnimal` reads no civilization.
- **The Mongol hunting rate and the Goth hunter carry name boar only.** Deer, a huntable since v0.3.167, get neither. This is latent, because generated maps do not place deer yet.
- **The Chinese "Town Centers +7 line of sight" line has no implementation anywhere.** Source it against current DE first.
- **Inca villagers may miss Feudal armour.** An Inca villager already standing when the Castle Age lands may never get the Scale or Chain Mail researched in the Feudal Age, because the armour scope is checked only at research time and at creation. This comes from reading the code, not from a run.

Some `design/stats/civilizations.csv` rows also lag current DE where the code follows DE on purpose, and the same rows are embedded in `src/game/simulation/civProfiles.ts`, which the in-game civilization text reads (`src/ui/hud/civCompendiumModel.ts`):
- Franks Castles;
- Goth infantry cost;
- the Goths' old +1 against buildings beside the new age ladder;
- Celt siege reload;
- Mayan resource duration;
- the two conflicting Persian clauses.

Code comments still describing rules from before the v0.3.144–153 audit:
- `prototypeBuildingRules.ts:368`;
- `bridge/trainingMarketOps.ts:225`;
- `handlers/queue/queueTrainValidator.ts:91`;
- the old constants' comments in `civBonusEffects.ts`;
- `farmReseed.ts:28`;
- `aiSystemProductionPhase.ts:257`.

Outcome: each bonus matches current DE, cited against the pinned SiegeEngineers/aoe2techtree data at `3bb43b14` (DE update 185872) or another primary source. The CSV, the embedded copy and the in-game text say what the code does, and the spec's open list no longer names these items.

## Scope

This work overlaps Codex work 106's unassigned milestone M4, "civilization and technology semantics". It records the claim here, so that work does not start on the same lines.

It may edit:
- the `CIV_BONUSES` entries in `civBonusTable.ts` (the header comment belongs to work 119 until 119 lands);
- `civBonusEffects.ts` and `teamCombatBonuses.ts`;
- the animal-attack path in `bridge/attackDelivery.ts`;
- the hunting rate and carry paths, including `bridge/systems/villagerEconomySystem.ts`;
- the Inca armour scope;
- `design/stats/civilizations.csv` and `civProfiles.ts`, together;
- the listed comments.

It must not edit:
- the save format, including the hydrate files (work 114);
- the files of workers 115–119.

If the Chinese sight bonus needs `buildingVisionSources.ts` (work 118's), it waits for 118 to land.

Spec text: the §11.11 bonus paragraphs and the line that starts "Still open, listed rather than dropped". Work 119 also edits that line and the "Civilization-bonus breadth" paragraph, so make the spec edits last, on top of 119's landing.

## Approach

Two milestones, each landing separately:
- **M1:** the Indian, Aztec, Goth boar, hunting (deer) and Inca armour defects, with the comments.
- **M2:** the Chinese sight bonus and the CSV, embedded-copy and in-game-text sync.

Each fix is sourced, reproduced by a test first, and gated by a mutation. The batch protocol is in `docs/policies/local-rules.md`.

## Acceptance criteria

- Every changed bonus cites its DE source, and a test independent of the table under test fails before the fix and turns red again when the fix is reverted.
- The CSV rows, the `civProfiles.ts` copy and the in-game civilization text agree with the code, and `tests/content/civProfiles.test.ts` passes.
- Spec §11.11 and its open list say what the code does.
- Each milestone carries defect-register entries, a changelog line and version bump, and `npm run verify` exits 0 under the gate lock. Each is merged to main and pushed.

## Implementation steps

- [x] M1: sourced code defects, tests, comments, spec items; land after work 119 if the spec lines are still 119's.
  - 2026-10-11: implemented, tested and committed on branch `civ-bonus-corrections`; the coordinator accepted the phase-1 handoff, and M1 shipped in v0.3.248 (see Outcome). The spec edits went in at the landing rebase, on top of work 119's text, with §11.11's v0.3.88 Vietnamese reveal sentence pointing at work 117's §12.2 paragraph.
  - Sourcing changed three items. DE's Goth line is "Hunters carry +15; hunted animals last +20% longer": DE has no "+5 attack vs. wild boar", so that was not implemented and the 20% was. The Aztec time is divided by 1.15, a judgement from DE's wording the coordinator accepted: DE's data holds no effect values, and its Conscription text calls the Conquerors' x0.75 "+33% faster". And a Mayan node outlasted its food by about twenty minutes of game time, found while giving the Goths the same rule, and fixed with it.
  - Unverified against DE and kept, by the coordinator's decision: Monks count as "Military Units" (Aztec time, Inca food), and the Mayan duration bonus skips farms, as since v0.3.151.
  - Found and not fixed; the spec's open list now names the first four (coordinator's decision): Teuton "+1/+2 melee armor" also adds pierce armor; DE's Inca llama is a team bonus and the code gives it to the owner only, and DE has no Inca "Farms built 50% faster", which the code still gives the side; DE's Magyar "Villagers defeat wolves with one strike" has no implementation; the factory and the age-up sweep give a Mongol Scout with Bloodlines different hit points (74 against 78). A hunt order leaving villagers idle after the kill is not a civilization bonus; the coordinator queued it for its own card.
  - For M2: the `buildingAttack` table field and `civBuildingAttackBonus` have no entries left; delete them if that is a small, contained change, otherwise leave them.
- [ ] M2: the Chinese sight bonus (after work 118 if it needs `buildingVisionSources.ts`), and the CSV, embedded-copy and in-game-text sync.
  - 2026-10-11: implemented, tested and committed on branch `civ-bonus-corrections`; not yet on main. DE has the Chinese line ("Town Centers +7 line of sight and provide +15 population space"), and the sight now rides `teamBuildingVisionBonus`, the owner's alone. Twelve CSV rows changed where the code already followed DE; the embedded copy changed with them, and the in-game panel reads it. The empty `buildingAttack` seam is deleted.
  - Rows left as they are, because the code itself departs from DE there (for the coordinator to list or assign): Celtic infantry move +15% in every age (DE: +5/10/15/20% by age); the Ethiopian team sight reaches towers too, and its Outposts still cost stone (DE: "Outposts +3 line of sight and cost no stone"); Italian Fishing Ships cost 15 wood less (DE: -15%), and DE's "Foot Archers and Condottieri +1/+1 armor" has no implementation; Vietnamese +20% hit points reach every Archery Range unit (DE: Foot Archers and Skirmishers); the Spanish gunpowder attack speed covers the Hand Cannoneer, Bombard Cannon and Cannon Galleon but not the Conquistador (DE: "Gunpowder Units attack +18% faster"); DE's Turkish "Scout Cavalry-line +1 pierce armor", Chinese Fire Ship speed, Portuguese foragers' wood and Khmer farmers' drop-off have no implementation. Not checked: the Hun trebuchet accuracy and the Saracen Transport Ship capacity, whose wordings differ from DE's.

## Outcome

**M1 shipped in v0.3.248 as `843eea5f` on 2026-10-11.** It landed on top of main at `5329e4dc` under the gate lock. Works 119, 117 and 114 each landed first and each moved the register entry this branch had named at the time, so the landing moved the next one the gate named, the 2026-09-29 worktree-copies entry, verbatim. `npm run verify` exited 0 in 20 min 33 s (10:22:51 to 10:43:24 local). Its log shows the whole chain: 580 unit-test files and 4,457 tests passed (3 skipped), the typecheck, 236 browser specs passed and 2 skipped in 14.0 minutes, lint, and the build.

That was the second run. The first exit file also held 0, but its log stops at browser spec 139 of 238, with no Playwright summary and no lint or build, so it was not taken as a pass. Re-running the wrapper's shape on a small three-step npm chain shows how a cut chain can read 0. `taskkill /F` exits with code 1 and was reported as a failure wherever it struck (the leaf, the chain's `cmd`, the outer npm). A console Ctrl+C killed the wrapper too, so no exit file was written. But WMI's `Win32_Process.Terminate`, which exits with code 0 (`Invoke-CimMethod -MethodName Terminate`, `wmic ... call terminate`), on the outer npm or on the chain's `cmd` wrote 0 while the last step never ran. What terminated run 1 at 10:19:42 is not known; no script in this repo or the fleet docs uses WMI to terminate. The coordinator took the gate-reading question for its own card.

M2 is on its branch, awaiting the coordinator's review.
