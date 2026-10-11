# A garrisoned unit keeps the sight upgrades researched while it is inside

Status: active
Owner: Claude session from the task card 'Keep sight upgrades for garrisoned units' (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-11

## Problem and outcome

`src/game/simulation/bridge/garrisonOps.ts` copies a unit's `visionSource` into the `garrisonedUnitVisionSourcesCodec` side map and removes the component when the unit enters a building. It restores the stored copy when the unit leaves. The sight upgrades change the component in place, and only on units that still have one:
- the unit-line upgrade sweep in `technologyUnitSweeps.ts` (`vision.radius = unitVisionRadius(to) + bonusVisionRadius(...)`);
- the Tracking effect in `visionTechEffects.ts`.
So a Militia garrisoned during the Man-at-Arms upgrade, or an infantry unit garrisoned during Tracking, comes out with its old sight for the rest of the match. The independent review of the building-sight change found it (`docs/threads/done/building-vision/2026-09-25/2/REVIEW.md`, "seen on the way").

Outcome: a unit that leaves a building has the sight of an identical unit that stayed outside.

## Scope

Included: every effect that changes a unit's sight in place while the unit is garrisoned.

Reserved for this work while the six task cards of 2026-10-10 run: `garrisonOps.ts`, `technologyUnitSweeps.ts` and `visionTechEffects.ts`. The save format belongs to work 114 (`bridgeStateSerialize.ts` and the hydrate files). A fix that needs a format change waits for 114 to land.

Excluded: the garrison eligibility gap CL-4 in Codex work 106, milestone M2, which is unassigned.

## Approach

Either apply the sweeps to the stored copies as well, or derive the radius when the unit leaves. Then check save and load of a garrisoned unit through the existing paths. The batch protocol is in `docs/policies/local-rules.md`.

Chosen (2026-10-11): apply the change to the stored copy. `changeUnitSight` in `garrisonOps.ts` changes the component on a unit in the field, or replaces the kept copy through `accessor.mutate`, and the upgrade sweep goes through it. Deriving on the way out was rejected because units carry sight their type's table does not give: a real map's starting Scout sees 6 against the Scout's 4, and fixtures name their own, so a derived exit would change the sight of units that were never upgraded.

Correction to the card: Tracking was retired with DE in v0.3.140 (spec §12.2) and `visionTechEffects.ts` holds no unit effect, so the class today is the line-upgrade sweep alone. A census over all 143 technologies stands in for the Tracking half of the first criterion, and fails if any technology other than a line upgrade starts moving unit sight.

## Acceptance criteria

- A test garrisons a unit, researches the upgrade, ungarrisons the unit and compares it with an identical unit that stayed outside. It is red before the fix and green after, a mutation turns it red again, and it covers both the unit-line upgrade and Tracking.
- A garrisoned unit saved and loaded mid-match comes out with the upgraded sight.
- The change carries a defect-register entry, a spec rule, a changelog line and a version bump. `npm run verify` exits 0 under the gate lock, and the change is merged to main and pushed.

## Implementation steps

- [x] Reproduce: `tests/simulation/garrisonedSightUpgrades.test.ts`, the player's controls on `castle-upgrades-fixture`, 3 of 3 red before the fix (6 against 7).
- [x] Find the class: `tests/simulation/garrisonedSightCensus.test.ts`, 158 twin pairs apart before the fix, all on the 39 land rows of the upgrade table.
- [x] Fix, gate and prove the gate by mutation; affected tests, typecheck and lint green in the worktree (phase 1, branch `garrison-sight-upgrades`).
- [ ] Land: gate lock, rebase, version, `npm run verify`, push (phase 2, after the coordinator accepts).

## Outcome

Pending.
