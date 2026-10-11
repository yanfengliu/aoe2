# Civilization bonuses do what Definitive Edition's do, and the in-game civilization text says so

Status: planned
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

- [ ] M1: sourced code defects, tests, comments, spec items; land after work 119 if the spec lines are still 119's.
- [ ] M2: the Chinese sight bonus (after work 118 if it needs `buildingVisionSources.ts`), and the CSV, embedded-copy and in-game-text sync.

## Outcome

Pending.
