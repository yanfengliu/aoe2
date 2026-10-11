# The Vietnamese reveal and the AI's base scan measure from a footprint's centre

Status: planned
Owner: Claude session from the task card 'Centre the Vietnamese reveal and the AI's base scan' (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-11

## Problem and outcome

Building sight is measured from the middle of a building's footprint (`buildingVisionSources.ts`, spec §12.2). Two circles still start at a Town Center's top-left anchor cell.

The first is the Vietnamese reveal. `vietnameseReveal.ts` sets a radius-5 source at each enemy Town Center's anchor, so it reveals 5 cells past the west and north edges but only 2 past the east and south. It also runs on every load and in every replay world, through `wireBridgeOps.ts` and then `wirePostSeedOps.ts`. So a Vietnamese human who loads a save gets the ground around Town Centers that the enemy built mid-game marked explored. In Definitive Edition the bonus reveals enemy Town Centers' positions at the start of the game.

The second is the AI's base-sighting scan in `systems/aiSystem.ts`. It is a circle of radius `AI_BASE_VISION_RADIUS = 12` (`ai.ts`) around the Town Center's anchor. With Town Watch, the Town Center's centred sight reaches about 14 cells from that corner along the south-east diagonal, so part of what it sees falls outside the scan. The scan is a heuristic.

The independent review of the building-sight change found both.

Outcome: both circles measure from the footprint's centre, and the reveal applies once, at the start of the game, as Definitive Edition's does.

## Scope

Reserved for this work while the six task cards of 2026-10-10 run: `vietnameseReveal.ts`, `wirePostSeedOps.ts`, `systems/aiSystem.ts` and `ai.ts`. It may add exports to `buildingVisionSources.ts`, which work 118 may edit.

The save format belongs to work 114. If the reveal needs a saved marker, wait for 114 to land.

In the spec, write the rule as its own paragraph. Do not edit two lines that other cards own:
- the §12.2 line starting "Every completed building sees", which belongs to 118;
- the line starting "Still open, listed rather than dropped", which belongs to the Teuton-list card.

## Approach

Reproduce each defect first, with a unit test or a debug snapshot. Then measure both circles from the footprint's centre, reusing `buildingVisionSources.ts`'s geometry. Check Definitive Edition's reveal behaviour and cite the source before making the reveal apply only at game start. The batch protocol is in `docs/policies/local-rules.md`.

## Acceptance criteria

- Tests reproduce both off-centre circles, pass after the fix, and turn red under mutation.
- A loaded save and a replay world gain no reveal for a Town Center built mid-game.
- The change carries a defect-register entry, the spec rule, a changelog line and a version bump. `npm run verify` exits 0 under the gate lock, and the change is merged to main and pushed.

## Implementation steps

- [ ] Reproduce, fix, gate and land. Nothing here waits for the other cards unless the reveal needs a save-format change.

## Outcome

Pending.
