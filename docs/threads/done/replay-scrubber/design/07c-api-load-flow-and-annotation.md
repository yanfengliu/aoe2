### 5.6 createWorld split + Schema-2 load flow

For schema-2 SaveBlobs (and equivalently for `createReplayWorldOnly` consuming a snapshot from a SessionBundle), the external `VisibilityMap` and mutable `MatchState` objects must be rebuilt from `world.state.aoe2.*` AFTER `world.applySnapshot`. AI / visibility / fog systems take their `VisibilityMap` reference at registration time (`registerAllSystems.ts:28, 140, 308`), so the cell-indirection introduced in v6-deltas (`VisibilityCell`) is what lets the post-applySnapshot rebuilt instance reach those already-registered systems without re-registration.

The current `createWorld(seed, visibility, savedGame)` does TWO things conditionally: register components/systems/handlers (always), AND either seed fresh tiles (if `!savedGame`) OR apply a snapshot (if `savedGame`). Both are tied to the visibility instance passed in. v5/v6 splits these:

```ts
// src/game/simulation/bridge/createWorldSkeleton.ts (NEW)
/** v9-narrowed scope: registers ECS component types only. Does NOT seed
 *  tiles, does NOT register gameplay systems (those are registered later
 *  by `wireBridgeOps` → `registerBridgeSystems`), does NOT register the
 *  output tail (`tier3SyncSystem` + `bridgeSnapshotSystem` are registered
 *  by `registerOutputTail` at the END of `wireBridgeOps`).
 *
 *  Why pass accessor/cell/matchState in here even though skeleton doesn't
 *  use them: keeps the construction site DRY — the caller already constructed
 *  these mutable references, and threading them through the skeleton call
 *  signals the load-flow ordering (cell+matchState exist BEFORE any
 *  gameplay-system registration that might capture them). The skeleton
 *  itself does no closure-capture — gameplay closures form inside
 *  `registerBridgeSystems`, AFTER the skeleton returns.
 *
 *  TS-wise: the unused params are kept for ordering documentation;
 *  consider an ESLint exception or rename to `_accessor` etc. if linter
 *  complains. Plan-stage decision. */
export function createWorldSkeleton(
  seed: string,
  config: { mapWidth: number; mapHeight: number },
  _bridgeStateAccessor: BridgeStateAccessor,
  _visibilityCell: VisibilityCell,
  _matchState: MatchState,
): GameWorld;

// src/game/simulation/bridge/seedFreshTiles.ts (NEW — extracted from createWorld)
// JUST the tile-grid construction (formerly inline in `createWorld` via
// `createTileGrid`). Building/unit/resource scenario seeding still happens
// inside `wireBridgeOps` via the existing `seedFreshScenario` helper —
// scope is intentionally narrow so the skeleton + tiles + wireBridgeOps
// order maps 1:1 onto the current `createWorld` flow.
export function seedFreshTiles(world: GameWorld, seed: string): void;

// src/game/simulation/bridge/extractDimsFromSnapshot.ts (NEW)
// Resolution order:
//   1. snapshot.state['aoe2.bridgeMeta'] → { mapWidth, mapHeight } — preferred
//   2. snapshot.state['aoe2.visibility'].{width,height} — post-bridge-state-migration
//   3. throw MissingMapDimsError — pre-migration snapshots must be migrated
//      via the v0.1.6 migration step (`migrateLegacySaveBlobToWorldState`
//      seeds `aoe2.bridgeMeta` from the old top-level fields).
export function extractDimsFromSnapshot(
  snapshot: WorldSnapshot,
): { mapWidth: number; mapHeight: number };
```

The new Tier-3 slot `aoe2.bridgeMeta` (§3 row added) carries `{ mapWidth, mapHeight }` — written once at game start by the bridge bootstrap, persisted via `tier3SyncSystem` (so it survives in every snapshot). This decouples dimension recovery from `aoe2.visibility` (which may be absent in pre-migration snapshots).

Note the chicken-and-egg resolution: `BridgeStateAccessor` is constructed before `world` exists (because the skeleton's `bridgeSnapshotSystem` closure needs it at registration time). Per v6 NIT-F3 fix, the accessor takes a lazy `getWorld: () => World<...>` getter. The `world` local is bound first via `let world: GameWorld;` then `world = createWorldSkeleton(..., accessor, cell, matchState)` — the getter `() => world` resolves correctly on first read because `getState`/`setState` only fire after registration completes.

**MatchState lifecycle (v8 fix for Codex iter-7 MAJOR):** create `matchState` BEFORE `createWorldSkeleton` so the skeleton's system registrations close over a real object. After `applySnapshot`, mutate the SAME reference in place via `Object.assign(matchState, msState)`; closures see the hydrated values on the next step.

Three load paths converge through this split:

```ts
// PATH A — Fresh game (no savedGame):
function freshGameFlow(seed: string, mapWidth: number, mapHeight: number): SimulationBridge {
  const visibility = new VisibilityMap(mapWidth, mapHeight);
  const visibilityCell = new VisibilityCell(visibility);
  const matchState = createDefaultMatchState();
  let world: GameWorld;
  const accessor = new BridgeStateAccessor(() => world);
  world = createWorldSkeleton(seed, { mapWidth, mapHeight }, accessor, visibilityCell, matchState);
  // Seed bridgeMeta so first snapshot carries dims:
  world.setState('aoe2.bridgeMeta', { mapWidth, mapHeight });
  seedFreshTiles(world, seed);
  const bridge = wireBridgeOps(world, visibilityCell, matchState, accessor, /* ... */);
  // (v9 — closes Codex iter-8 BLOCKER) Bootstrap flush BEFORE recorder connects:
  // ensures initial snapshot carries Tier-3 + freshly-seeded Tier-1 slots.
  bootstrapFlush(world, accessor, visibilityCell, matchState);
  return bridge;
}

// PATH B — Schema-2 SaveBlob (or createReplayWorldOnly):
function schema2Flow(savedGame: SaveBlobV2): SimulationBridge {
  const { mapWidth, mapHeight } = extractDimsFromSnapshot(savedGame.worldSnapshot);
  // Construct mutable instances FIRST (closures will capture these references):
  const visibilityCell = new VisibilityCell(new VisibilityMap(mapWidth, mapHeight));
  const matchState = createDefaultMatchState();
  let world: GameWorld;
  const accessor = new BridgeStateAccessor(() => world);
  world = createWorldSkeleton(savedGame.seed, { mapWidth, mapHeight }, accessor, visibilityCell, matchState);
  world.applySnapshot(savedGame.worldSnapshot);   // populates world.state.aoe2.*

  // Hydrate the SAME instances (closures already captured) from world.state:
  const visState = world.getState('aoe2.visibility') as VisibilityMapState | undefined;
  if (visState) visibilityCell.replace(VisibilityMap.fromState(visState));
  const msState = world.getState('aoe2.matchState') as PersistedMatchState | undefined;
  if (msState !== undefined) Object.assign(matchState, msState);

  const bridge = wireBridgeOps(world, visibilityCell, matchState, accessor, /* ... */);
  bootstrapFlush(world, accessor, visibilityCell, matchState);
  return bridge;
}

// PATH C — Schema-1 SaveBlob (legacy back-compat):
function schema1Flow(savedGame: SaveBlobV1): SimulationBridge {
  // schema-1 carries explicit visibility { width, height } at top level:
  const { width: mapWidth, height: mapHeight } = savedGame.visibility;
  const visibilityCell = new VisibilityCell(new VisibilityMap(mapWidth, mapHeight));
  const matchState = createDefaultMatchState();
  let world: GameWorld;
  const accessor = new BridgeStateAccessor(() => world);
  world = createWorldSkeleton(savedGame.seed, { mapWidth, mapHeight }, accessor, visibilityCell, matchState);
  world.applySnapshot(savedGame.worldSnapshot);
  // Migrate top-level visibility + matchState + sideMaps into world.state.aoe2.*
  // (also seeds aoe2.bridgeMeta from { mapWidth, mapHeight }).
  migrateLegacySaveBlobToWorldState(world, savedGame, { mapWidth, mapHeight });
  // Now identical to PATH B's tail:
  const visState = world.getState('aoe2.visibility') as VisibilityMapState | undefined;
  if (visState) visibilityCell.replace(VisibilityMap.fromState(visState));
  const msState = world.getState('aoe2.matchState') as PersistedMatchState | undefined;
  if (msState !== undefined) Object.assign(matchState, msState);
  const bridge = wireBridgeOps(world, visibilityCell, matchState, accessor, /* ... */);
  bootstrapFlush(world, accessor, visibilityCell, matchState);
  return bridge;
}

// src/game/simulation/bridge/bootstrapFlush.ts (NEW in v9 — closes Codex iter-8 BLOCKER)
/** Runs the same writes as one tick of `tier3SyncSystem` + `bridgeSnapshotSystem`,
 *  WITHOUT a world.step(). Called once at end of bridge construction so the
 *  initial recorder snapshot — which is captured immediately on
 *  RecordingService.connect() (`session-recorder.ts:150`) BEFORE any tick
 *  runs — sees the same Tier-3 + Tier-1 state that subsequent tick snapshots
 *  will carry. */
export function bootstrapFlush(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  visibilityCell: VisibilityCell,
  matchState: MatchState,
): void {
  // Tier-3 sync (force initial write regardless of dirty bit):
  world.setState('aoe2.visibility', visibilityCell.get().getState());
  visibilityCell.clearDirty();
  world.setState('aoe2.matchState', serializeMatchState(matchState));
  // bridgeMeta was set in PATH A's freshGameFlow before seedFreshTiles;
  // for PATH B/C it's already in the snapshot or migrated.
  // Tier-1 flush (writes any slots dirtied by scenario seed):
  accessor.flush();
}
```

Key insights:
- `wireBridgeOps` runs ONCE per bridge, AFTER all state is in place. It closes over the post-applySnapshot world's tile ids, the visibility CELL (not a stale instance), the rebuilt MatchState — all consistent.
- `registerAllSystems` is updated (~20 call sites) so visibility-using systems take a `VisibilityCell` instead of a `VisibilityMap`. Each tick the system calls `cell.get().method(...)`. After `applySnapshot`, `cell.replace(VisibilityMap.fromState(...))` swaps in the hydrated instance — every system sees it on the next read.
- No civ-engine changes. No `VisibilityMap.applyState` method needed. The `fromState` static + cell-replace pattern is sufficient.
- `BridgeStateAccessor` uses the lazy-getter form `(() => world)`. The getter is only called inside `get`/`flush` after registration completes, so the deferred binding `let world; ...; world = createWorldSkeleton(...)` is safe.

### 5.7 Annotation UI behavior in replay mode

- Alt+M (annotation form) — disabled when `mode === 'replay'`
- Alt+L (MarkerListPanel) — visible but read-only (no Export/Discard for the live bundle; the panel shows the replay bundle's markers, clickable to scrub-to-marker)
- `RecordingService` — bound to the live world via direct reference, NOT through `bridgeRef().world`. Replay-mode bridge swaps don't move the recorder. Live recording continues in the background while user scrubs (paused) or stops (replay-mode setPaused).

