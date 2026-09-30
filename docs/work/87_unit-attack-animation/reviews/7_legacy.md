# Review iteration 8

## Scope

OpenAI Codex externally re-reviewed the iteration-7 implementation with the read-only live-code directive and a focused anti-regression checklist for tower ordering, mutation-aware visibility invalidation, construction completion, replay suppression, and max-pop work. Two independent in-process verifiers then reproduced the findings against the live bridge and focused tests. Anthropic Claude remained unavailable under the recorded tenant export boundary and was not retried or routed around.

## Findings and disposition

- **MEDIUM — lethal tower fire refreshed visibility inside the tower loop. Confirmed and fixed.** Refreshing immediately after each kill let an earlier building's kill remove a later building's pass-start target, making damage depend on entity order and repeating the full visibility-source scan once per kill. `towerCombatSystem.ts` now keeps the ordinary visibility snapshot immutable for the complete authoritative tower pass, records whether any unit died, and performs exactly one final refresh after the successful pass. A production-bridge regression proves a later Town Center still fires using pass-start LOS after an earlier Castle kills the sole spotter, while final LOS is false after the pass; a focused system regression proves two kills cause one refresh.
- **MEDIUM — recursive building destruction invalidated visibility even when no bounded entity was a vision source. Confirmed and fixed.** The conservative unconditional mark made neutral walls, houses, farms, and vision-free garrisons invalidate the player-command attack-feed cache. `runBuildingDestructionVisibilityMutation` now snapshots the building plus its bounded garrison IDs and compares their actual `(playerId, coarse x, coarse y, radius)` fingerprints after the real mutation. Explicit vision removal and partial throwing mutations still invalidate; neutral building and garrison removal does not. Construction completion now reports whether it actually added a vision source, including the pre-existing-explicit-source case.

## Result

The two iteration-8 findings are closed. Focused verification passed the tower/replay batching checks and the exact building-destruction/construction invalidation cases. The full headless gate subsequently passed with 2,015 Vitest tests passed and 2 skipped, 106 browser tests passed and 2 skipped, and 526 modules built. Because iteration 8 found substantive issues, iteration 9 must independently re-review the repaired diff before convergence.
