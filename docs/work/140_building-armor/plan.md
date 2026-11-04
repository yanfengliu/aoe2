# Buildings take Definitive Edition's armor in combat, and the panel shows total armor

Status: active
Owner: building-armor worker for the Claude coordinator
Created: 2026-11-04
Updated: 2026-11-04

## Problem and outcome

On main 6b5e9871 a hit on a building takes no armor at all: `deliverUnitAttackOnBuilding` deals the attack stat plus one anti-building number per attacker (siege only), times a Siege Engineers multiplier on the whole total, and the projectile path lands that total raw. The selection panel reads 0/0 for every building (a lobby-default Town Center shows melee 0, pierce 0) and shows only the armor-technology bonus for units.

Outcome: every hit on a building is DE's per-class damage, `max(1, sum over the attack classes the building has armor in of max(0, attack - armor))` (spec §10.1), against the building's DE melee, pierce and class armor (Building 11, Stone Defense 13, Standard Building 21, Wall & Gate 22, Castle 26) by its owner's age and technologies, with each attacker's DE attacks against those classes. The panel's Melee armor and Pierce armor rows show the selected unit's or building's total armor, base plus upgrades, as DE's panel does.

## Scope

Included: building armor by age and technology (Masonry and Architecture, Guard Tower and Keep, Fortified Wall); every attacker's DE attack against the building classes, the deferred infantry +1 to +4 and the per-kind Petard and Tarkan figures included; Sappers, the Goths ladder, the Saracen and Hindustani team bonuses and Siege Engineers in DE's classes; Masonry's hit points scoped to its armor's reach; one seam that every damage path into a building reads; the panel's two armor rows for units and buildings; `structures.csv`, `units.csv` and the spec where DE differs.

Excluded: unit base attack values (26 roster units differ from the pinned dataset; reported, not changed), building hit points by age, blast damage on buildings (not a path in this game), the AI (`src/game/simulation/ai*.ts`, `bridge/ai*.ts` and `bridge/systems/ai*.ts`, work 141's; the brief's `src/game/simulation/ai/**` does not exist), HUD layout, civ-engine and voxel.

Dependencies: the pinned DE dataset (SiegeEngineers/aoe2techtree `3bb43b14`, DE update 185872, `data.json` SHA-256 `66a43997...`) for every armor and attack value, and DE's dat at update 147949 (HSZemi/aoe2dat `c0cec9ba`, `data/full.json.xz`, SHA-256 `52e1118e...`) for the age-up units and the technology effects the dataset does not carry. `tests/content/fixtures/deBuildingCombat.json` pins both.

## Approach

Derive, never store: building armor comes from the building type, its owner's age and researched set at damage time (`buildingArmor.ts`); an attacker's class attacks come from its type and its owner's researched set, civilization, age and side at the moment the blow lands (`buildingAttack.ts`); `bridge/buildingHitDamage.ts` joins them for the melee delivery, the projectile pass and the panel. A shot keeps its launch-time attack stat and damage family, and its class attacks and the building's armor are read when it lands, as Parthian Tactics' bonus already is. No saved field is added; the shot's old `buildingDamage` field is no longer written or read. `docs/architecture/decisions.md` (2026-11-04) records the tradeoffs.

One milestone, not two: DE's formula needs the attacks split by class for the base case already (a Castle's Building armor of 8 must not absorb an infantry Standard Building attack), so the per-class table and Masonry's armor half were part of the seam rather than a later milestone.

## Acceptance criteria

- [x] A damage census over every attacker type against every building type, in every age, with and without the armor technologies, equals DE's formula over the sourced tables (`buildingDamageCensus.test.ts`, 151,380 hits: 87 attackers, 87 building and technology states, 4 ages, 5 owners), and every attacker lands a first hit through the real melee or projectile path (`buildingDamagePaths.test.ts`, 111 cases, and a shot saved before work 140); red with the old formula (11 census mutations, and review round 0's dropped second attack; 102 of the file's 112 tests on the pre-change tree; each path red when it bypasses the seam).
- [x] Hand-checked DE values: an Archer on a House 1, a Militia on a Dark Age Town Center 1, a Battering Ram on a Town Center 150, a Villager on a Palisade Wall 4, through the real paths; the old tree gave 4, 4, 127 and 3.
- [x] A panel census: every unit's and building's panel armor equals the armor its hits meet (`selectionArmorCensus.test.ts`); red with the old panel.
- [x] A real-click browser check: the Dark Age Town Center's panel reads 3/5 and the Scout Cavalry's 0/2 (`tests/browser/building-armor-panel.spec.ts`); red with the old panel.
- [x] Before and after captures and a pixel diff confined to the panel's armor rows.
- [x] Self-play match resolution measured before and after on the gates' seeds and the register's four maps; the coverage lab's census re-recorded with its reason.
- [ ] `npm run verify` green with a certified receipt; an independent review recorded under `reviews/`.

## Implementation steps

- [x] Point work 106's "buildings show 0/0 armor" card here. Main marked it scheduled as work 140 (a37deeee); the rebase kept that line over this branch's own edit, which had removed the card.
- [x] Source the DE tables and record them as a pinned fixture.
- [x] Tests: content differential, damage census, hand-checked values, path census, panel census, browser check; red proofs.
- [x] The armor seam and the per-class attack table; every path reads it; the panel rows.
- [x] Captures and pixel diff; self-play before and after; the lab census.
- [x] Spec, CSVs, changelog, devlog, register, architecture records.
- [ ] Full gate, independent review, handoff; landing (phase 2): rebase onto `origin/main` under the gate lock, take the next patch version and give the changelog's `Unreleased — work 140` heading that number, replace `vNEXT` in the devlog, rerun the gate, mark work 106's two cards for this defect shipped (its plan's 2026-10-14 HUD card and 2026-11-04 Combat card), push, follow `npm run ci:status`, close this plan and retire the worktree.

## Findings outside this scope

- 26 roster units' base attack differs from the pinned dataset: Camel 5 (DE 6), Scorpion 12 (11), Champion 13 (14), Two-Handed Swordsman 11 (12), Galleon 8 (9), Fire Ship 2 (3), Fast Fire Ship 3 (4), Demolition Ship 110 (95), Heavy Demolition Ship 140 (120), Cannon Galleon 35 (50), Elite Cannon Galleon 45 (60), Jaguar Warrior 10 (15), Woad Raider 8 (11), Tarkan 7 (8), Samurai 8 (10), Mameluke 7 (8), Teutonic Knight 12 (14), Berserk 9 (12), Turtle Ship 50 (9), Longboat 7 (5), Elite Jaguar Warrior 12 (19), Elite Woad Raider 13 (15), Elite Chu Ko Nu 8 (10), Elite Conquistador 18 (19), Elite Turtle Ship 50 (13), Elite Longboat 8 (7).
- Building hit points differ from DE (pinned dataset and the 147949 age units): the House 550/750/900/900 by age (900 here), the Mill and camps 600/800/1000/1000 (1000), the Blacksmith 1800 in Feudal (2100), the Market 1800 in Feudal (2100), the Siege Workshop 1500/1750 (2100), the Watch Tower 850 in Feudal (1020), the Stone Wall 1080 (1800), the Gate 1650 and 4000 fortified (2750), the Palisade Wall 150 (250), the Palisade Gate 240 (250), the Fish Trap 250 (50).
- No blast reaches a building here; DE's data gives buildings a blast defense level, so some DE blasts do.
- Siege Engineers' +1 range reaches rams and the Petard here; DE takes it back from rams. Sappers' "+3 attack vs. rams" is not modelled.
- In the no-attack coverage lab, owner 2's Scout attacks owner 1's unfinished Market from tick 9,827 (the AI's lane, work 141).
- Unit combat takes no second base attack. DE's melee 0 on the Scorpion and Chu Ko Nu lines meets a unit's melee armor too, and the rams carry -3 melee armor here (`unitArmorTables.ts`), so a Scorpion takes 1 a bolt off a Battering Ram where the term would make it 4, and a Chu Ko Nu 1 where it would make 3 (review round 1's figures). Spec §10.1 says unit combat leaves it out.
- The Militia's reload is 10 ticks (`statTables.ts`) against `units.csv`'s 2 s, 20 ticks at 10 ticks a second; not checked against a deliberate rule.
- Stale research-hosting premises: spec §11.9's Bloodlines paragraph still says the tower, Siege Engineers and Sappers techs are hosted away from their AoE2 homes (§11.11's v0.3.131-133 paragraph says they now follow the CSV), and `bridge/blacksmithTechOptions.ts`'s header still lists Sappers among the Blacksmith's options.

## Outcome

Pending the full gate, the review and landing.
