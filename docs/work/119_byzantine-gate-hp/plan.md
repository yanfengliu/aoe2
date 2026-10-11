# Byzantine gates get no age-scaled hit-point bonus, as in Definitive Edition

Status: complete
Owner: Coordinator worker w119-byzantine-gates (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-11

## Problem and outcome

`design/stats/civilizations.csv` gives Byzantine buildings "(except gates)" +10/20/30/40% hit points by age. `ageScaledBuildingHpFactor` in `src/game/simulation/ageScaledHp.ts` never reads the building type, because its comment at line 76 says "gates are not a BuildingType here". That is false: `stone-gate` and `palisade-gate` have been building types since v0.3.31, before the ladder landed in v0.3.86.

So a Byzantine gate gets the bonus too. The teuton-spec-list worker measured a Britons Stone Gate at 2,750 maximum hit points and a Byzantine one at 3,575, which is 2,750 × 1.3 in the Castle Age. It found this on 2026-10-11 while checking the spec's open civilization-bonus list against the code.

That worker also found code comments still describing rules from before the v0.3.144–148 sourcing:
- the `civBonusTable.ts` header, which lists free technologies, starting-resource deltas, age-scaled HP and carry capacity as things the seams cannot express, though all are now handled;
- `bridge/selectionStateOps.ts:224`, "Same Teuton 2x-tower multiplier";
- the header of `tests/simulation/ageScaledHp.test.ts`, which quotes the old +10/15/20 text for Vikings and the Vietnamese.

Outcome: gates get no age-scaled hit-point bonus, and those comments say what the code does.

## Scope

Reserved for this work: `ageScaledHp.ts`, `tests/simulation/ageScaledHp.test.ts`, `civBonusTable.ts` (header comment only) and `bridge/selectionStateOps.ts` (the comment only).

It must not edit the save and replay format, including the hydrate files, which belong to work 114. Nor may it edit any file the other batch workers own: 114–118, and the docs-only spec card.

Gates already in a save keep the raised hit points unless loading recomputes them. Decide that with the standing tiebreak (behaviour matches Definitive Edition) and a reversible default. If correcting saved gates needs a hydrate change, state the bound and leave it for after work 114 lands.

## Approach

Make the building factor return 1 for both gate types, at the one place every creation and age-up path reads it. Add a test that fails while gates get the bonus. The batch protocol is in `docs/policies/local-rules.md`.

## Acceptance criteria

- A test shows a Byzantine Stone Gate and Palisade Gate at the same maximum hit points as another civilization's, in every age, while other Byzantine buildings keep the ladder. Putting the old factor back turns it red.
- The comments listed above say what the code does.
- The change carries a defect-register entry, the spec text (the open-list line names this clause and is updated when it lands), a changelog line and a version bump. `npm run verify` exits 0 under the gate lock, and the change is merged to main and pushed.

## Decision: saves

A gate already standing in a game saved before this change keeps the raised hit points it was saved with. Measured on 2026-10-11 with the bridge's own save and load: a gate stored at 3,575 loads at 3,575 and stays there, because `hydrateFromSavedGame.ts` restores building hit points as stored and the age-up sweep now leaves gates alone. The standing tiebreak points the other way, since a Definitive Edition game never holds such a gate. Matching it means recomputing gate hit points on load, which is a change to `hydrateFromSavedGame.ts`, work 114's file in this batch. So the bound stands and is stated in the register entry, the changelog and the spec. It is the reversible default: loading is unchanged, and a save holds the civilization, age, technologies and building type that a later load-time correction would need.

## Implementation steps

- [x] Reproduce, fix and gate, on branch `byzantine-gate-hp` (phase 1). The teuton-spec-list worker landed first (`fd9d2c8d`), so this work removed the gate clause from the spec's open list and from the §11.11 breadth paragraph, as the coordinator's notes asked.
- [x] Land: rebased under the gate lock onto `b92b03fa`, took 0.3.245, ran `npm run verify` (exit 0), pushed (phase 2).

## Outcome

Shipped in v0.3.245 on 2026-10-11: main `10991b74`, with the code change in `d1d3ccb1`. A Byzantine Stone Gate and Palisade Gate now stand at the same hit points as any other civilization's in every age, and every other Byzantine building keeps the ladder. `tests/simulation/byzantineGateHp.test.ts` and the census case in `tests/simulation/ageScaledHp.test.ts` hold that on both paths, and five mutations turned them red. In the real game the selected gate read 3575 / 3575 before the fix and 2750 / 2750 after.

The landing `npm run verify` exited 0 in 21 m 42 s (08:36–08:58): 4,389 unit tests and 236 browser tests passed. An earlier run under the same lock (01:19–01:42) exited 1 on one browser timeout, `tests/browser/de-ground.spec.ts:139`, under heavy machine load; this change cannot reach it. That case passed alone at 71.7 s and in the landing run at 72.2 s, 80% of its 90 s timeout, so it has little headroom.

Left open, and queued by the coordinator: gates in games saved before v0.3.245 keep their raised hit points until a load-time correction lands after work 114 (see "Decision: saves"). Also queued from this work's findings, as a later card: walls and gates are offered from the Castle Age though `structures.csv` gives the Feudal Age; the Gate gets no Fortified Wall bonus; the header of `tests/simulation/civBuildingBonuses.test.ts` is stale; and ten comments still cite "spec §9.2" for civilization and team bonuses.
