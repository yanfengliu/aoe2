# A garrisoned unit keeps the sight upgrades researched while it is inside

Status: planned
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

## Acceptance criteria

- A test garrisons a unit, researches the upgrade, ungarrisons the unit and compares it with an identical unit that stayed outside. It is red before the fix and green after, a mutation turns it red again, and it covers both the unit-line upgrade and Tracking.
- A garrisoned unit saved and loaded mid-match comes out with the upgraded sight.
- The change carries a defect-register entry, a spec rule, a changelog line and a version bump. `npm run verify` exits 0 under the gate lock, and the change is merged to main and pushed.

## Implementation steps

- [ ] Reproduce, fix, gate and land. Nothing here waits for the other five cards.

## Outcome

Pending.
