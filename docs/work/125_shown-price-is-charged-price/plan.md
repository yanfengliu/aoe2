# Every price the HUD shows is the price the game charges

Status: active
Owner: Coordinator worker w125-shown-price (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-14
Updated: 2026-10-14

## Problem and outcome

The train button's tooltip states the base price, not the price the player is charged. `formatTrainTooltip` (`src/ui/hud/tooltips.ts:90-94`) reads `trainingCost(unitType)`, while the queue charge, its validator and the button's affordability check read `effectiveTrainingCost`.
- Example: an Italian Fishing Ship shows 75 wood and is charged 64 (work 120 M3, v0.3.253).
- Every civilization discount on units has the same gap, and so may technology discounts (for example the Chinese -5/10/15% and the Italians' -25% on Dock and University technologies) wherever the HUD states a research price.
- Work 120 M3's worker found it, and its reviewer confirmed that the AI's affordability check also reads the base price.

Outcome: every price the player is shown (train, research and build tooltips, cards and any other cost text) is the price the game charges that player at that moment, for every civilization, age and technology state.

## Scope

- Reserved for this work: the HUD cost text (`src/ui/hud/tooltips.ts` and whatever else formats a cost for the player) and a new class gate with its tests.
- The AI's affordability check is in scope only if it is a one-line read of the same seam. Otherwise record it in the handoff as a separate card. Tell the coordinator before changing AI decisions, because that changes self-play.
- Off limits while they run: work 122 (placement: placementKnowledge, placementFootprint, foundationStart, placementBlockReport, the place-confirm validator), work 123 (browser specs near their limits, the playwright config reporters, .github/) and work 120 M4 (civBonusTable, civBonusEffects and the gather systems).

## Approach

Reproduce first in the real HUD path, and find every place that formats a price for the player. Make each one read the same per-owner cost seam the charge reads, so the two cannot differ by construction. Gate the class with a census: for every civilization, age and relevant technology state, and every trainable unit, researchable technology and buildable structure, the shown price equals the charged price. Prove it red by putting the base-price read back.

## Acceptance criteria

- A census test covering units, technologies and buildings across civilizations, ages and technology states finds no shown price differing from the charged one. It goes red with the base-price read restored.
- The real HUD shows the charged price, through the real controls, in a browser spec or a capture pair: for example an Italian Fishing Ship at 64 wood. A visual change needs before and after captures and a pixel diff.
- The register entry, changelog line, version bump at landing, devlog lines and spec rule are all present.
- `npm run verify` exits 0, its log runs through the build, `node scripts/verify-receipt.mjs check` prints OK, and the change is on main.

## Implementation steps

- [x] Reproduce, find every price surface, route each through the charge's seam, gate the class, capture, record (branch `shown-price`, devlog 2026-10-14; phase 1 handed to the coordinator for review).
- [ ] Land: rebase, version, `npm run verify`, receipt check, push, close.

## Outcome

Pending.
