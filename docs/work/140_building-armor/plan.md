# Buildings take Definitive Edition's armor in combat, and the panel shows total armor

Status: active
Owner: building-armor worker for the Claude coordinator
Created: 2026-11-04
Updated: 2026-11-04

## Problem and outcome

On main 6b5e9871 a hit on a building takes no armor at all: `deliverUnitAttackOnBuilding` deals the attack stat plus one anti-building number per attacker (siege only), times a Siege Engineers multiplier on the whole total, and the projectile path lands that total raw. The selection panel reads 0/0 for every building (a lobby-default Town Center shows melee 0, pierce 0) and shows only the armor-technology bonus for units.

Outcome: every hit on a building is DE's per-class damage, `max(1, sum over the attack classes the building has armor in of max(0, attack - armor))` (spec §10.1), against the building's DE melee, pierce and class armor (Building 11, Stone Defense 13, Standard Building 21, Wall & Gate 22, Castle 26) by its owner's age and technologies, with each attacker's DE attacks against those classes. The panel's Melee armor and Pierce armor rows show the selected unit's or building's total armor, base plus upgrades, as DE's panel does.

## Scope

Included: building armor by age and technology (Masonry and Architecture, Guard Tower and Keep, Fortified Wall); every attacker's DE attack against the building classes, the deferred infantry +1 to +4 and the per-kind Petard and Tarkan figures included; Sappers, the Goths ladder, the Saracen and Hindustani team bonuses and Siege Engineers in DE's classes; one seam that every damage path into a building reads; the panel's two armor rows for units and buildings; `structures.csv`, `units.csv` and the spec where DE differs.

Excluded: unit base attack values (24 roster units differ from the pinned dataset; reported, not changed), building hit points by age, blast damage on buildings (not a path in this game), the AI (`src/game/simulation/ai*.ts`, `bridge/ai*.ts`, `bridge/systems/ai*.ts` belong to work 141), HUD layout, civ-engine and voxel.

Dependencies: the pinned DE dataset (SiegeEngineers/aoe2techtree `3bb43b14`, DE update 185872, `data.json` SHA-256 `66a43997...`) for base stats, and DE's dat for update 147949 (HSZemi/aoe2dat `c0cec9ba`, `data/full.json.xz`) for the age-up and technology effects the dataset does not carry.

## Approach

Derive, never store: building armor comes from the building type, its owner's age and researched set at damage time; an attacker's class attacks come from its type and its owner's researched set, civilization, age and side at the moment the blow lands. A shot keeps its launch-time attack stat, and its class attacks and the building's armor are read when it lands, as Parthian Tactics' bonus already is. No saved field is added.

## Acceptance criteria

- [ ] A damage census over every attacker type against every building type, in every age, with and without the armor technologies, equals DE's formula over the sourced tables, through the real melee and projectile paths; red with the old formula.
- [ ] Hand-checked DE values: an Archer on a House 1, a Militia on a Dark Age Town Center 1, a Battering Ram on a Town Center 150, a Villager on a Palisade Wall 4; red with the old formula.
- [ ] A panel census: every unit's and building's panel armor equals the armor its damage path uses; red with the old panel.
- [ ] A real-click browser check: the Dark Age Town Center's panel reads 3/5.
- [ ] Before and after captures and a pixel diff confined to the panel's armor rows.
- [ ] Self-play match resolution measured before and after on the gates' seeds, and every baseline that moves re-recorded with its reason.
- [ ] `npm run verify` green with a certified receipt; an independent review recorded under `reviews/`.

## Implementation steps

- [x] Remove work 106's "buildings show 0/0 armor" card, pointing here.
- [ ] Source the DE tables and record them as pinned fixtures.
- [ ] Tests first: damage census, hand-checked values, panel census.
- [ ] The armor seam and the per-class attack table; every path reads it.
- [ ] The panel rows; the browser check; captures and diff.
- [ ] Self-play before and after; baselines; records; review; gate.

## Outcome

Pending.
