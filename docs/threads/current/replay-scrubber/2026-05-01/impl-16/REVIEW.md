# impl-16 multi-CLI review — Phase 1C AI intention refactor

**Date:** 2026-05-01
**Branch:** main (uncommitted)
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `claude-opus-4-7[1m]` max, Gemini `gemini-3.1-pro-preview` plan-mode
**Diff scope:** ~507 LOC across 5 files (`aiSystem.ts`, `wireBridgeOps.ts`, `registerBridgeSystems.ts`, `registerAllSystems.ts`, `registerAllSystemsTypes.ts`).

## Summary

Phase 1C replaces aiSystem's three direct mutator calls (`enqueueTraining` / `enqueueResearch` / `startConstruction`) with intention pushes (`pushQueueTrainIntention` / `pushQueueResearchIntention` / `pushBuildingPlaceConfirmIntention`) that append to `state.pendingCommands`; the dispatcher submits them between ticks via `world.submitWithResult`. Two structural changes were necessary to make the AI work end-to-end:

1. **Pending-aware gates** — aiSystem builds three lookups at the start of each `execute()` (`pendingTrainsByBuilding`, `pendingResearchKeys`, `pendingBuildsByOwner`) and folds them into queue-length / inFlightTechByOwner / ongoingBuilds checks, so the AI doesn't re-push every decision tick before the handler lands.
2. **pickUnitMix BEFORE villager training** — pre-1B trained barracks-rush militia at a single corner-case tick (barracks-complete + tcQueue full → villager skipped → food preserved). Post-1C the +1-tick handler delay shifts that corner case out of alignment, so a barracks-rush AI never reached the militia push. Reordering makes military priority explicit and FIFO-first for the handler.

## Reviewer findings (synthesized)

### Real issues addressed inline

| Finding | Source | Severity | Fix |
|---|---|---|---|
| Same-tick over-queuing for military units (feudal+ pickUnitMix returns multiple unit types per producer; second `findIdleProducerLocal` call sees stale pending count) | Gemini F2 | MEDIUM | Increment `pendingTrainsByBuilding` after each push in the mix loop. |
| Unsafe type casting in pendingCommands lookup (`cmd.data.buildingId as number` could surface `undefined`/`NaN`) | Gemini F4 | LOW | Replaced `as` casts with `typeof`-guards; malformed entries are skipped rather than corrupting the maps. |
| Dead-pass `startConstruction` / `enqueueResearch` / `enqueueTraining` through `RegisterAllSystemsDeps` after aiSystem dropped them | Claude F1 | LOW | Removed from `RegisterAllSystemsDeps`, `RegisterBridgeSystemsDeps`, and the `wireBridgeOps` → `registerBridgeSystems` call site. The `*Direct` aliases used by `registerCommandHandlers` are unchanged. |
| Watch-tower path missing `canAfford` gate (asymmetric vs wonder/nextBuild) | Claude F3 | LOW | Added explicit `canAfford(stockpile, watchTowerCost)` for symmetry. |
| TC pending-train count assumes villager-only (currentVillagers / villagerCap math would mis-count if a non-villager TC train ever lands) | Claude F2 | LOW | Comment pinning the assumption added at the lookup site so a future change to TC training options will surface the dependency. |
| Watch-tower push doesn't update `pendingBuildsByOwner` (calculation runs after watch-tower push, so its effect on `ongoingBuilds` budget was invisible — pre-1B `unitCommands` made it visible synchronously) | Self-discovered while addressing reviews | LOW | Increment `pendingBuildsByOwner` after the watch-tower push. |
| `pendingCommands` reference contract — dispatcher must mutate in place; reassigning would break aiSystem's captured reference | Claude F6 | INFO | Comment on the `pendingCommands` dep site in `wireBridgeOps`. Verified `dispatcher.ts:46` uses `queue.length = 0` (in-place). |

### Not actionable / explicitly invalid

| Finding | Source | Verdict |
|---|---|---|
| Same-tick double-push for age-up tech (per-building research loop iterates TC) | Gemini F1 | INVALID. The per-building research loop iterates `['blacksmith', 'archery-range', 'barracks', 'stable', 'siege-workshop', 'castle']` — `town-center` is NOT in the list. Age-up research has a single push site at TC; no double-push path exists. |
| Hardcoded military priority harms booming AI strategies | Gemini F3 | DEFERRED. The current AI is single-strategy (`pickUnitMix(age)` takes only `age`); there is no boom vs rush distinction to differentiate. Future work, if the AI grows multi-strategy, would condition the mix-vs-villager order on plan kind. Not a v0.1.6 blocker. |
| pendingResearchKeys skips destroyed building (getComponent null path doesn't add the key) | Claude F4 | ACCEPTED. Dead-building intentions silent-no-op at handler time; bounded; no spend. Adding a fallback would over-engineer an edge case the design explicitly accepts. |
| Doc surfaces (architecture/decisions, drift-log, debugging Verification section) | Claude F5 | Will be addressed in the same commit's doc updates (architecture decisions + drift-log + debugging doc Verification fill-in). |

### Codex unreachable

Codex's exec sandbox spent its context budget reading source files (227 KB output, mostly diff + file reads via PowerShell `Get-Content`) and emitted no findings. No structured review present in the output. Per AGENTS.md "If a CLI is unreachable, proceed with the remaining reviewers and note the unreachable CLI in the devlog." Two reviewers (Gemini + Claude) converged with substantive findings; useful signal regardless.

## Verification

- `npm run typecheck` ✓
- `npm run lint` ✓
- `tests/simulation/aiPlayer.test.ts` (20 tests) ✓
- `tests/simulation/createSimulationBridge.combat.test.ts` (5 tests) ✓
- Full suite: see commit's verification section.

## Disposition

All real findings addressed inline. Single iteration sufficed — both reachable reviewers converged on bugs that were fixable without restructuring. Re-review unnecessary; commit folds these fixes in.
