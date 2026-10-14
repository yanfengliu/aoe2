# Civilization bonuses do what Definitive Edition's do, and the in-game civilization text says so

Status: active
Owner: Coordinator worker w120-civ-bonuses (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-14

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

Four milestones, each landing separately:
- **M1:** the Indian, Aztec, Goth boar, hunting (deer) and Inca armour defects, with the comments.
- **M2:** the Chinese sight bonus and the CSV, embedded-copy and in-game-text sync.
- **M3** and **M4:** the code made to match DE where M2 found it departs (M3 and M4 under Implementation steps).

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
- [x] M2: the Chinese sight bonus (after work 118 if it needs `buildingVisionSources.ts`), and the CSV, embedded-copy and in-game-text sync.
  - 2026-10-11: implemented, tested and committed on branch `civ-bonus-corrections`; shipped in v0.3.251 on 2026-10-12 (see Outcome). DE has the Chinese line ("Town Centers +7 line of sight and provide +15 population space"), and the sight now rides `teamBuildingVisionBonus`, the owner's alone. Thirteen CSV rows changed where the code already followed DE (the Vietnamese one after work 117 landed); the embedded copy changed with them, and the in-game panel reads it. The empty `buildingAttack` seam is deleted.
  - Rows where the code itself departs from DE were left as they are; they are M3.
- [x] M3: make the code match DE wherever it departs, for items 1–6, 11 and 12 below. Each item is reproduced first, then fixed, then gated. None was meant to go on the spec's open list; items 11 and 12 did, by the coordinator's decision below. The source is DE's civilization help text in aoe2techtree `3bb43b14` (DE update 185872).
  - 2026-10-12: the coordinator split the original twelve-item M3. Items 1–6, 11 and 12 stay in M3, dispatched to worker `civ-bonus-m3` on branch `civ-bonus-m3`; items 7–10 move to M4. The numbers are the original list's, so a reference to an item keeps its meaning.
  - 2026-10-12 to 13: items 1–6 implemented, tested and committed on branch `civ-bonus-m3`, phase 1, for the coordinator's acceptance (the account's weekly limit cut the session from 04:25 on 10-12 to 19:55 on 10-13). Each was reproduced first, through the seams every site reads and in a match against a Britons control (two new test files, 14 of 14 red), fixed at its seam and gated; nine mutations, each restored, turned every gate red. Saves keep stored sight, armor, hit points and reload until a line upgrade rebuilds the unit, work 115's precedent; speed and prices apply at once.
  - Items 11 and 12 were checked; both depart from DE, and both were stopped and reported rather than guessed. The Hun line has no implementation, and DE's "Trebuchets fire more accurately at units and small targets" gives no number; the accuracy roll here also skips buildings, so every trebuchet always hits a building. The Saracen Transport Ship has DE's +100% hit points and no capacity bonus, and DE's base ship differs from this build's (garrison 20 with no Dock technology adding to it, HP 70, armor 0/2, against units.csv's 5 rising to 20, 100 and 4/8), so "+20 carry capacity" has no matching base here.
  - Seen on the way and reported, not changed: the Petard counts as infantry here, so every infantry bonus reaches it, where DE's data gives it no infantry armor class; the Mayan foot-archer discount covers the Archer line alone, where DE labels the Plumed Archer a Foot Archer; DE's Spanish "Cannon Galleons fire more accurately at moving targets" has no implementation (a Cannon Galleon leads a moving target only once its owner has Ballistics, as every shooter does), and the CSV still words it as "benefit from Ballistics"; and a train button's tooltip shows the base price (`formatTrainTooltip` reads `trainingCost`), so an Italian Fishing Ship reads 75 wood where it is charged 64, as every civilization unit discount reads.
  - 2026-10-13: the Civilizations panel was looked at in the real game (this worktree's build, `scripts/captureMapScreenshot.mjs` with `HOTKEY`): the Celtic, Ethiopian, Italian, Vietnamese and Spanish rows show DE's new lines.
  - 2026-10-13, the coordinator's decisions on the phase-1 handoff: items 11 and 12 go on spec §11.11's open list with their reasons, and their CSV lines stay as they are, because a line changes only where the code follows DE; both are queued as cards, the trebuchet card taking the Spanish Cannon Galleon accuracy too. `FOOT_ARCHERS` stays DE's Foot Archer class, unique foot archers included, and the Berber consolidation is accepted. The four findings seen on the way are queued as cards, not fixed here. An independent read-only review runs on `f5be4f51`; the landing follows works 121 and 122, and the M3 devlog entry goes into whichever detailed file is active then.
  - 2026-10-13: the independent review of `f5be4f51` found nothing blocking, and the coordinator accepted the landing after its fixes. Its three should-fix gaps are closed and gated, with three more mutations red: the age the step executor passes was untested (an Imperial-Age walk, and `age` a required argument), the Berber rule's Castle and Imperial values were unasserted (a CSV pair over all four ages), and the spec called the Mayan rule "foot archers" (now "the Mayan Archer line", with the Plumed Archer gap, the Petard and converted units added to §11.11's open list). Its two nits are fixed: the Italian unique technologies are DE's Silk Road and Pirotechnia, and a test header cites §9.2.2.
  - 2026-10-14: shipped in v0.3.253 as `05bfcfab` (see Outcome).
  1. Celts: "Infantry moves +5/10/15/20% faster in Dark/Feudal/Castle/Imperial Age". The code gives +15% in every age.
  2. Ethiopians, team bonus: "Outposts +3 line of sight and cost no stone". The code gives the +3 to towers too, and Outposts still cost stone.
  3. Italians: "Fishing Ships cost -15%". The code takes 15 wood off instead.
  4. Italians: "Foot Archers and Condottieri +1 melee/+1 pierce armor" has no implementation.
  5. Vietnamese: "Foot Archers and Skirmishers +20% HP". The code gives it to every Archery Range unit.
  6. Spanish: "Gunpowder Units attack +18% faster". The code's line covers the Hand Cannoneer, Bombard Cannon and Cannon Galleon, not the Conquistador.
  11. Check first, then fix if the code departs: the Hun trebuchet accuracy (the CSV says "35% more accurate"; DE says "Trebuchets fire more accurately at units and small targets").
  12. Check first, then fix if the code departs: the Saracen Transport Ship capacity (the CSV says "2x HP and carry capacity"; DE says "+100% HP, +20 carry capacity").
- [ ] M4 (the coordinator dispatches it after M3 lands): items 7–10 of the original M3 list, on the same terms.
  - 2026-10-14: dispatched to worker `civ-bonus-m4` on branch `civ-bonus-m4` from main `9e4a320b` (v0.3.253). Items 7–10 implemented, tested and committed, phase 1, for the coordinator's acceptance; none was stopped. Each line was sourced against DE's help text (aoe2techtree `3bb43b14`). Items 9 and 10 give no rate or method there, so both come from DE's patch notes on ageofempires.com: 73855 for the Portuguese (a 33% wood trickle, held in DE's data as 33.33% of the forager's work rate), and 34699, 42848 and 185872 for the Khmer (no drop-off, 5% slower, the gather task's "auto-collection"). This build has no Fire Lancer.
  - Eight cases were red before the fix: four gathering match checks, the Turkish census and panel, the Chinese census and voyage. The gathering seam censuses, the pure swing cases and the reseed check were written with the fix and proved by mutation instead; fourteen mutations, each restored, turned every gate red. Saves: speed and the two gathering bonuses apply at once in a loaded game; a scout standing in a game saved before M4 keeps its armor until a line upgrade rebuilds it.
  - For the coordinator: the part of a unit a gatherer has earned toward the stockpile is a new optional field of the gatherer component (`creditTenThousandths`), which the world snapshot, so a save and a replay, carries. It touches neither the save schema nor the hydrate files, which this plan rules out, but it is new persisted state. Seen on the way and not changed: relic gold pays 1 per tick, 10 a second, against the spec's 0.5 a second; a villager retasked to another resource keeps its load relabelled as the new one (5 wood became food); `civOpeningSeed.ts` says fixtures get no opening units, and they do; the Portuguese CSV row names Carrack where DE names Circumnavigation, and the Khmer row gives Battle Elephants +15% where DE gives +10% (this build has no Battle Elephant).
  - 2026-10-14: the coordinator's independent review of `64d07754` found nothing blocking, accepted the saved field `GathererComponent.creditTenThousandths`, and queued the findings seen on the way as cards. Its findings are fixed and gated, with four more mutations red. A gather swing went below 0 when a gatherer held more than the new resource lets it carry: the node gained food for every civilization, which predates this work, and a Portuguese forager was paid -1 wood that the save never saw. Nothing gated the in-place payment's save flag, or the Portuguese wood's AI scaling. The docs it asked for are written (`ARCHITECTURE.md`, the drift log, a decision, the spec, the changelog). Its world-digest comparison, rerun on the fixed tree against `9e4a320b` on the all-AI boot map, was identical at ticks 3,500, 7,000, 10,500 and 14,000 for 2 players, for 4, and for 4 with a Chinese seat.
  7. Turks: "Scout Cavalry-line +1 pierce armor" has no implementation.
  8. Chinese: "Fire Lancers and Fire Ships move +5/10% faster in Castle/Imperial Age" has no implementation for the Fire Ship.
  9. Portuguese: "Foragers generate wood in addition to food" has no implementation.
  10. Khmer: "Farmers don't require Mills or Town Centers to drop off food" has no implementation.

## Outcome

**M1 shipped in v0.3.248 as `843eea5f` on 2026-10-11.** It landed on top of main at `5329e4dc` under the gate lock. Works 119, 117 and 114 each landed first and each moved the register entry this branch had named at the time, so the landing moved the next one the gate named, the 2026-09-29 worktree-copies entry, verbatim. `npm run verify` exited 0 in 20 min 33 s (10:22:51 to 10:43:24 local). Its log shows the whole chain: 580 unit-test files and 4,457 tests passed (3 skipped), the typecheck, 236 browser specs passed and 2 skipped in 14.0 minutes, lint, and the build.

That was the second run. The first exit file also held 0, but its log stops at browser spec 139 of 238, with no Playwright summary and no lint or build, so it was not taken as a pass. Re-running the wrapper's shape on a small three-step npm chain shows how a cut chain can read 0. `taskkill /F` exits with code 1 and was reported as a failure wherever it struck (the leaf, the chain's `cmd`, the outer npm). A console Ctrl+C killed the wrapper too, so no exit file was written. But WMI's `Win32_Process.Terminate`, which exits with code 0 (`Invoke-CimMethod -MethodName Terminate`, `wmic ... call terminate`), on the outer npm or on the chain's `cmd` wrote 0 while the last step never ran. What terminated run 1 at 10:19:42 is not known; no script in this repo or the fleet docs uses WMI to terminate. The coordinator took the gate-reading question for its own card.

**M2 shipped in v0.3.251 as `223d4d0f` on 2026-10-12**, under the gate lock, on top of main at `80ac4a95`. `npm run verify` ran on the release tree (`584117ab`, on `b46fcf6b`) and exited 0 in 25 min 09 s (02:47:40 to 03:12:49 local). Its log shows the whole chain: 587 unit-test files and 4,522 tests passed (3 skipped), the typecheck, 236 browser specs passed and 2 skipped in 15.0 minutes, lint, and the final build ("built in 5.86s"). During the run, main gained one docs-only commit, work 123's register closure. The rebase onto it changed nothing outside `docs/`. It redid the register rollover, because that closure had moved the entry this branch named. The four docs checks those files have (the rollover, work-docs integration, line endings and thread hygiene) passed before the push.

**M3 shipped in v0.3.253 as `05bfcfab` on 2026-10-14**, under the gate lock, on top of main at `c71496a9` (v0.3.252), and was rebased onto work 121's docs-only closure `76d8a83b` before the push; main is `1b6c41f7`. `npm run verify` ran on the release tree (`6438684f`, tree `786a79fd`) twice. Run 1 (22:28 to 22:50 local on 2026-10-13) exited 1: `tests/browser/command-deck-fits.spec.ts:251`, the Market card at 800x600 on `trade-route-fixture`, timed out in a `page.evaluate` after 30 s, while 235 specs passed. The spec passed alone (3 of 3 in 16.6 s), and other sessions' work loaded the machine around it: 15 headless Chrome processes that were not this run's, started at 22:56, and 50 to 76% CPU. Run 2 (22:58 to 23:18) exited 0. Its log shows the whole chain: 597 unit-test files and 4,593 tests passed (3 skipped), the typecheck, 236 browser specs passed and 2 skipped in 10.0 minutes, lint, and the final build ("built in 3.57s"). `node scripts/verify-receipt.mjs check` accepted the receipt for the pushed tree, which differs from the gated one only in docs (work 121's closure and this landing's devlog note), after `tests/architecture` passed (15 files, 150 tests). At the rebase onto `c71496a9`, work 121 had already moved the 2026-09-30 recording-connections entry this branch had moved, so the register rolled over again: the closed 2026-10-01 CRLF-index entry moved verbatim, with a note in the archive. The M3 devlog entry moved into work 121's new active file, `2026-10-13_2026-10-13.md`, and work 120's two summary lines became one, keeping the summary at 50 lines.

M4 is the next milestone; the coordinator dispatches it.
