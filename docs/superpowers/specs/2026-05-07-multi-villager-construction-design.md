# Multi-villager construction with per-tick progress

## Problem

Two related defects in the construction loop today:

1. **Selecting N villagers and placing a building only assigns ONE builder.** `confirmBuildingPlacement` (placementOps.ts:151) picks `getSelectedHumanVillagerIds()[0]` and ignores the rest. The remaining selected villagers do nothing. The simulation already supports linear scaling (each villager at the site does `buildProgressTicks += 1` per tick in playerCommandsSystem.ts:376), so the bottleneck is purely at the command-issue site.
2. **Right-clicking a half-built site with selected villagers does NOT route them to help.** `routeUnitContextAtEntityCommandDirect` (unitCommandOps.ts:369-405) has branches for attack-enemy, garrison-complete-building, gather-resource, and move-fallback. There is no own-team-building-under-construction branch, so additional villagers cannot join an in-progress site.
3. **The construction progress bar does NOT update tick-by-tick.** The "progress bar" is the HP bar (`buildingHealth.currentHp` ramps from 10% → 100% during construction). The projector reads `health.currentHp` each time it runs, but `buildingHealthStates` lives in a side-map (`world.state.aoe2.buildingHealthStates`) and the side-map's per-tick mutations do NOT mark the building entity dirty. The renderAdapter therefore never re-projects the building during construction; the HP bar only updates when *some other* event marks the building dirty (selection, completion, damage). Visually the bar appears stuck.

## Goal

- Selecting N villagers and confirming a placement assigns the build command to all N.
- Right-clicking an own-team in-progress building site with selected villagers routes each villager to that site's build command.
- Each tick during construction, the building entity is dirty for the renderAdapter, so the HP-bar fill smoothly tracks build progress.
- Linear scaling: N villagers complete a building in 1/N the time. (Already true in the per-tick loop; this spec just unblocks the path.)

## Non-goals

- No Wonder/Castle special caps. (No such cap exists in this codebase today.)
- No repair behavior. (Repair is not implemented.)
- No AI-side multi-villager build orchestration. AI continues to pick one builder per placement intention; the change to `building.placeConfirm` is backward-compatible so AI paths keep working.
- No cost change. Resources are spent once per placement, regardless of how many villagers are assigned.
- No new visual progress bar. The HP bar continues to serve as the progress indicator.
- No change to `civ-engine`.

## Design

### Command schema (backward compatible)

`building.placeConfirm` payload extends to include an optional list of additional builders:

```ts
'building.placeConfirm': {
  builderId: number;                        // primary builder (unchanged)
  buildingType: BuildableBuildingType;
  position: Position;
  additionalBuilderIds?: number[];          // NEW — others who join immediately
};
```

`additionalBuilderIds` is optional so existing replays and AI code paths that submit only `builderId` continue to work without migration. The validator and handler accept either shape.

### Validator changes

`buildingPlaceConfirmValidator.ts` adds a check for each id in `additionalBuilderIds`: must be a current entity, owned by the same player as `builderId`, and a villager. Mismatched / missing extra builders are silently dropped at handler time (best-effort), but the validator rejects the whole command if the entire selection is invalid (e.g., zero valid builders, including the primary).

### Handler changes

`buildingPlaceConfirmHandler.ts` passes the full builder list to a new `startConstructionWithBuildersDirect(builderIds, buildingType, anchor)` helper in `trainingMarketOps.ts`. The new helper is a generalization of the existing `startConstruction(builderId, ...)`:

- Use the primary builder's `unit.owner` for affordability + build-options check (same as today).
- Spend resources once.
- Create the building entity once.
- For each id in the full list (primary + additional), if it is still a current entity, owned by the same player, and a villager: `clearGathererOrder(id)` + `setUnitCommand(id, { type: 'build', target, buildingRef })`. Skip-on-mismatch is silent (best-effort, matches existing AI tolerance for stale ids).

The existing `startConstruction(builderId, ...)` becomes a thin wrapper that calls `startConstructionWithBuildersDirect([builderId], ...)`. AI paths keep their current shape.

### HUD entry point

`placementOps.ts:confirmBuildingPlacement` collects all selected human villagers (via `getSelectedHumanVillagerIds()`), uses index 0 as the primary, and submits the rest as `additionalBuilderIds`. Existing rejection-toast behavior is unchanged.

### Right-click on construction site

`unitCommandOps.ts:routeUnitContextAtEntityCommandDirect` adds a new branch immediately after the existing own-building / garrison branch:

```
if (targetBuilding && targetBuilding.owner === unit.owner) {
  const construction = accessor.get(constructionStatesCodec).get(targetEntityId);
  if (construction && !construction.isComplete && unit.unitType === 'villager') {
    return setUnitBuildCommandDirect(unitId, targetEntityId);
  }
  // (existing garrison branch follows)
}
```

`setUnitBuildCommandDirect(unitId, buildingId)` is a new direct helper inside `unitCommandOps.ts`: it looks up the building's anchor position + EntityRef, clears the unit's gatherer order, and sets `unit.command = { type: 'build', target: anchor, buildingRef }`.

This branch reuses the existing tick-loop in `playerCommandsSystem` — no new system, no new state.

### Per-tick render-dirty mark

In `playerCommandsSystem.ts` after the increment block (lines 376-387), add:

```
world.patchComponent(buildingId, 'renderable', (renderable) => renderable);
```

Civ-engine treats `patchComponent` as an explicit write that marks the entity dirty in the next tick's diff (api-reference.md line 1240, strict mode default), regardless of whether the value actually changed. The renderAdapter then re-projects the entity, the projector re-reads `health.currentHp` from the side-map, and the HP bar fills tick by tick.

This is one extra patchComponent call per builder-villager-at-site per tick. For N villagers building one site, the patchComponent is called N times against the same entity in the same tick — civ-engine's strict-mode dirty set deduplicates by entity id, so the projector still re-runs only once per tick per building.

### Save / replay compatibility

- `building.placeConfirm` payload extension is additive (`additionalBuilderIds?` is optional), so old replays still parse and reproduce the original "single primary builder" behavior. No replay schema bump.
- `constructionStates`, `buildingHealthStates`, and unit-command side-maps are unchanged on disk.
- Replays of new sessions that exercised multi-villager placements correctly capture all N builder ids in the recorded `building.placeConfirm` command, so deterministic replay is preserved.

## Test plan

### Vitest (simulation, behavior-level)

- `multiVillagerConstruction.test.ts` (new):
  - **Single-villager baseline:** place a House with one villager, advance tick-by-tick, assert `buildProgressTicks` increments by 1 per tick, completes at `totalBuildTicks`.
  - **Five-villager linear scaling:** place a House with 5 villagers selected (all in range), advance, assert `buildProgressTicks` increments by 5 per tick (after they all reach the site), completes at ~`totalBuildTicks/5` ticks plus walking distance.
  - **Mid-build join:** place with 1 villager, advance halfway, then route 4 more via `unit.contextAtEntity` on the building, assert their unit commands are `{ type: 'build', buildingRef }` and the construction completes before the original 1×ticks budget.
  - **HP ramp scales linearly:** with 5 villagers, the HP at `totalBuildTicks/5` ticks is at full HP (consistent with the existing per-tick-per-villager `(maxHp - startHp)/totalBuildTicks` formula).
- `placeConfirmBuilders.test.ts` (new):
  - Validator accepts shapes with and without `additionalBuilderIds`.
  - Validator rejects when neither primary nor any additional id is a valid villager owned by the placing player.
  - Handler skips silently when an additional id is no longer current (e.g., killed between submit and handle), but still completes for the rest.
- Extend `hasPendingUnitCommand.test.ts` to confirm `building.placeConfirm` matches **every** id in `additionalBuilderIds` plus `builderId` (autoAggression must skip every villager already queued to build).
- `routeUnitContextAtEntity.test.ts` (extend if exists, else add):
  - Right-clicking own in-progress building with a villager selected sets the build command.
  - Right-clicking own *complete* building with a villager continues to attempt garrison (existing behavior unchanged).
  - Non-villagers right-clicking own in-progress building fall through to move (no-op for the build branch).
- `playerCommandsSystem.construction.test.ts` (extend if exists, else add): asserting the per-tick `patchComponent('renderable', …)` call fires for the building during construction (mocked world.patchComponent or via render-diff observation).

### Browser (Playwright)

- `multiVillagerBuild.spec.ts` (new):
  - Seed a scenario with 5 villagers; HUD-select all five; place a House; assert the `unit.command.type === 'build'` for all five via `window.__AOE2_TEST__`.
  - Assert HP-bar visual state advances at multiple intermediate ticks (use the existing health-bar visual state seam exposed via `getRenderState`).

### Gates

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build` — all four green per AGENTS.md.

## Risks

- **patchComponent every tick** during construction is a new write. Each construction site triggers one entity-dirty mark per tick (deduplicated across N builders). Negligible cost relative to ECS query/path work.
- **Stale extra builder ids** at handler time. Mitigated by silent skip on mismatch (consistent with existing AI tolerance pattern in `routeMonkContextAtEntityCommandDirect` etc.).
- **`additionalBuilderIds` carries a list** so the command payload size grows with selection. Bounded by villager count; worst case maybe a few dozen entries. Trivial.
- **Replay determinism** is preserved as long as recorded commands carry the full builder list. `building.placeConfirm` is the only mutator and it's serialized in full.

## Files touched

- `src/game/simulation/commands.ts` — extend `building.placeConfirm` payload.
- `src/game/simulation/handlers/building/buildingPlaceConfirmValidator.ts` — accept new field.
- `src/game/simulation/handlers/building/buildingPlaceConfirmHandler.ts` — pass full list.
- `src/game/simulation/bridge/registerCommandHandlers.ts` — wire the new direct helper.
- `src/game/simulation/bridge/wireBridgeOps.ts` — pass-through.
- `src/game/simulation/bridge/trainingMarketOps.ts` — generalize `startConstruction` → `startConstructionWithBuildersDirect`.
- `src/game/simulation/bridge/placementOps.ts` — collect all selected villagers in `confirmBuildingPlacement`.
- `src/game/simulation/bridge/unitCommandOps.ts` — add `setUnitBuildCommandDirect` and the in-progress-site branch in `routeUnitContextAtEntityCommandDirect`.
- `src/game/simulation/bridge/systems/playerCommandsSystem.ts` — add `world.patchComponent('renderable', …)` after the per-tick increment.
- Tests as listed above.
- Devlog detailed entry + summary line.
- Changelog entry (user-visible behavior change).
- `package.json` patch-version bump.
