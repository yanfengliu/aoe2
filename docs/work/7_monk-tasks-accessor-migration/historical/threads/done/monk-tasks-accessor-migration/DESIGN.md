# Monk tasks accessor migration design

## Context

`monkTasks` is the Phase 2D blocker called out by KAD-0007/KAD-0008. AI monk assignment now enters through `monk.contextAtEntity` intentions, so the remaining mutation sites are command handlers, deterministic monk behavior, entity cleanup, save/load hydration, and selection/activity projection. `unitCommands` remains the separate Tier-1 bridge-owned codec after this slice.

## Decision

Migrate `monkTasks` from `BridgeState.monkTasks` to `world.state.aoe2.monkTasks` via the existing `monkTasksCodec` and `BridgeStateAccessor`. Preserve the schema-1 `SaveBlob.sideMaps.monkTasks` surface for compatibility, but make save/load read and write through the accessor. Command handlers and deterministic monk behavior remain the authoritative mutation sites.

## Boundaries

- No new command type is introduced.
- `selectionActivity` still receives a `Map<number, MonkTask>`; callers pass the accessor-backed map.
- `monksByOwner` and `monkConvertProcessedThisTick` remain bridge-owned side maps.
- `unitCommands` remains bridge-owned in this slice.
