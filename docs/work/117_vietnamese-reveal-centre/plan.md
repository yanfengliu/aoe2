# The Vietnamese reveal and the AI's base scan measure from a footprint's centre

Status: complete
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

- [x] Reproduce, fix and gate, on branch `vietnamese-reveal-centre`. The reveal needed no save-format change: its explored cells and fog-memory entries were already saved and recorded. The coordinator assigned this work the `wirePostSeedOps({...})` call in `wireBridgeOps.ts` for the fresh-match flag.
- [x] Independent review, recorded as `reviews/0_implementation.md`: Codex and Claude, no blocker or major finding; F0 to F3 and F5 repaired, F4 and F6 handed to the coordinator.
- [x] Land under the gate lock: rebased onto `648b50cd` (v0.3.245 and work 119's docs-only close-out) as implementation `96ff5986` and review record `1d54e805`, the code unchanged from the reviewed `d965bcfc` by `git range-diff`; version 0.3.246; `npm run verify` exit 0; pushed to main as `04bdd87b`.

## Outcome

Shipped in v0.3.246. Main `04bdd87b` holds the implementation `96ff5986`, the review record `1d54e805` and the version commit `04bdd87b`, pushed as `648b50cd..04bdd87b`.

- **What changed.** The Vietnamese reveal and the AI's base-sighting scan are measured from the middle of a Town Center's footprint with `footprintVisionSources`. The reveal runs only when a fresh match is seeded (`revealEnemyTownCenters: !savedGame`), so a load or a replay world keeps exactly the explored cells and fog memory its save or recording holds. No save-format change was needed.
- **Source.** Definitive Edition's civilization text, "Enemy Town Centers are revealed at the start of the game": string 120180 in SiegeEngineers/aoe2techtree at `3bb43b14`, DE update 185872.
- **Checks.** `npm run verify` exited 0 under the gate lock on `f7476daa`, 09:07:55 to 09:27:40 (about 19.8 minutes). The unit suite passed 573 files and 4,413 tests, with 1 file and 3 tests skipped. The browser suite passed 236, with 2 skipped. Content validation, typecheck, lint and build passed. Main then gained work 119's docs-only close-out, so the branch was rebased once more. The only difference from the verified tree is three `docs/work` files, and the architecture suite, which includes `checkoutLineEndings.test.ts` and `workDocsIntegration.test.ts`, passed 150 of 150 on it.
- **Gates.** `vietnameseRevealAtStart.test.ts`, `vietnameseRevealReplay.test.ts` and `aiBaseSightingCentre.test.ts`, each proved red by putting the defect back (`docs/learning/gate-proofs.md`). The visual check is the before and after capture pair on `aoe2-prototype` as the Vietnamese: the delta is confined to the explored edge around the enemy Town Center and the minimap.
- **Review.** Round 0 (`reviews/0_implementation.md`): Codex `gpt-6-astra` at xhigh and Claude `claude-opus-5-5[1m]` at max, read-only. Neither found a blocker or a major issue. F0 to F3 and F5 are repaired. F4, a pointer from spec §11.11, went to work 120. F6, the town bell's lowest-id sighting and corner Manhattan distances, and the base scan counting an ally's unit as an enemy, are later cards.
- **Limits.** The reveal radius, 5, is this game's choice, because DE names none. Each test covers one map and 4x4 Town Centers only. A save or recording made before this change keeps whatever its old corner-measured reveal explored, and one from before v0.3.88 has no reveal. A recording made before this change runs its AI again with the new scan, so it can play out differently. The reveal still stamps an ally's Town Center, which shared allied sight shows anyway; it was left as it is.
