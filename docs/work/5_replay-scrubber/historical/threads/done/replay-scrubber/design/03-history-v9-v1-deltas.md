**v9 deltas vs v8:** addresses iter-8 review (Codex BLOCKER + MAJOR + MINOR; Claude MAJOR + 3 MINOR + 2 NIT — convergent on the two substantive issues).

- **BLOCKER (Codex — initial recorder snapshot can be incomplete):** `SessionRecorder.connect()` writes `world.serialize()` immediately on connect, BEFORE any tick runs (`session-recorder.ts:150`). v8's fresh bootstrap only seeds `aoe2.bridgeMeta` before returning — Tier-3 sync (`tier3SyncSystem`) and Tier-1 codec flushes (`bridgeSnapshotSystem`) are output-phase only, so the initial snapshot would be missing `aoe2.visibility`, `aoe2.matchState`, and any Tier-1 slots populated during scenario seed. Result: `enterReplay(startTick)` opens with stale/missing Tier-3 data.

  v9 introduces a **`bootstrapFlush(world, accessor, visibilityCell, matchState)`** helper called once after `wireBridgeOps` (and `seedFreshScenario`) in PATH A, and after `Object.assign(matchState, msState)` in PATH B/C. It runs the same writes as `tier3SyncSystem.execute` + `accessor.flush()` BEFORE `RecordingService` connects. The bootstrap path becomes:
  ```ts
  const bridge = wireBridgeOps(world, visibilityCell, matchState, accessor, /* ... */);
  bootstrapFlush(world, accessor, visibilityCell, matchState);
  // …only now is recording.connect() safe.
  ```
  `RecordingService.start()` already gates on bridge readiness; the helper just needs to land before `connect()`. Test: `initialSnapshot.state['aoe2.visibility']`, `aoe2.matchState`, `aoe2.bridgeMeta`, and a sample Tier-1 slot are all present after bootstrap.

- **MAJOR (Codex + Claude — `tier3SyncSystem` perf claim factually wrong; per-tick `visibility.getState()` cost not bounded):** v8 said "costs are bounded by Uint8Array shape." Ground truth: `VisibilityMapState` is `{ width, height, players: Array<[id, { sources: Array<[id, VisionSource]>, explored: number[] }]> }` — `explored` is a sorted `number[]` materialized fresh each call (`visibility-map.ts:128`). Plus: `world.setState()` always runs `assertJsonCompatible` and marks the key dirty (`world.ts:1371`); `getStateDirty` SKIPS fingerprint for already-dirty keys (`world.ts:1577`), so equal repeated `setState`s are NOT deduped — the construction + traversal cost is paid every tick. Plus the recorder writes the full visibility into `diff.state.set` every tick (`session-recorder.ts:413`).

  v9 adds a **dirty bit to `VisibilityCell`** (Claude option 1):
  ```ts
  export class VisibilityCell {
    private _current: VisibilityMap;
    private _dirty = true;          // initial = needs first write
    constructor(initial: VisibilityMap) { this._current = initial; }
    get(): VisibilityMap { return this._current; }
    /** Marks the cell dirty and returns the live map for mutation;
     *  systems mutating `cell.get()` must also call `cell.markDirty()`. */
    markDirty(): void { this._dirty = true; }
    /** Replaces the inner map and marks dirty (used post-applySnapshot). */
    replace(next: VisibilityMap): void { this._current = next; this._dirty = true; }
    isDirty(): boolean { return this._dirty; }
    clearDirty(): void { this._dirty = false; }
  }
  ```
  Visibility-using ops modules (the ones that call `cell.get().setSource(...)` etc.) call `cell.markDirty()` after the mutation — same pattern as Tier-1 `accessor.markDirty(slot)`. `tier3SyncSystem.execute` skips the visibility write when `!cell.isDirty()` and clears on write. `MatchState` gets the same treatment via a `MatchStateDirty` flag set by ops modules that mutate it (or, more conservatively, kept unconditional since `MatchState` is small — design choice deferred to plan stage with default = unconditional matchState write since the cost is bounded).

  M6 perf benchmark (§9) extended to cover an 8-player late-game scenario with full exploration (~30k explored cells/player). Pass criterion: tier3Sync + bridgeSnapshot combined < 5 ms/tick.

- **MINOR (Claude — `createWorldSkeleton` scope ambiguous vs `wireBridgeOps`'s existing `registerBridgeSystems`):** v8 said skeleton "registers all components, validators, handlers, systems." But `wireBridgeOps` today calls `registerBridgeSystems` → `registerAllSystems` for gameplay systems (`wireBridgeOps.ts:324-377`). Reading literally would imply double-registration.

  v9 picks Claude's option (A): **skeleton registers ONLY `tier3SyncSystem` + `bridgeSnapshotSystem` plus the bridge-state component-types**; `wireBridgeOps` continues to register gameplay systems via `registerBridgeSystems`. Gameplay systems' closure-capture is already correct because `matchState` is passed by reference through `wireBridgeOps` → `registerBridgeSystems` (`registerBridgeSystems.ts:41, 122`). The v8 ordering inversion (`matchState` created before skeleton) is what makes the skeleton's `tier3SyncSystem` registration valid; gameplay system closures already worked correctly under (A).

  Skeleton signature stays as v8 (`seed, dims, accessor, visibilityCell, matchState`), but its body is narrower than v8 implied:
  ```ts
  function createWorldSkeleton(seed, dims, accessor, visibilityCell, matchState): GameWorld {
    const world = new World<...>(extractConfig(seed, dims));
    registerComponentTypes(world);   // ECS components
    // Output-phase tail (registered LAST so the order is fixed before
    // wireBridgeOps adds gameplay systems — which become PRE-tier3Sync).
    world.addSystem(makeTier3SyncSystem(visibilityCell, matchState));
    world.addSystem(makeBridgeSnapshotSystem(accessor));
    return world;
  }
  ```
  Wait — that puts the tail FIRST, not last. Correct order: skeleton registers components only. `wireBridgeOps` registers gameplay systems via `registerBridgeSystems` AS BEFORE, then immediately registers the two output-tail systems via a new `registerOutputTail(world, accessor, visibilityCell, matchState)` helper. The tail is the LAST set of registrations in the output phase. This preserves the existing wireBridgeOps flow with one new call at its tail. v9 §5.2 + §5.6 reflect this corrected scope.

- **MINOR (Codex — §8 ordering-test description out of date):** v8 fixed §5.2 to `['tier3Sync', 'bridgeSnapshot']` but §8 still said "LAST entry … is `'bridgeSnapshot'`" + perf-test only covered Tier-1. v9 §8 normalizes both: ordering test asserts the LAST TWO entries; perf benchmark covers Tier-1 + Tier-3 + recorder sink.

- **MINOR (Claude — §3 missing `bridgeMeta` row + §1 stale wording):** v9 adds `aoe2.bridgeMeta` row to §3 Tier-3 list (3 slots total: visibility, matchState, bridgeMeta). §1 wording updated from "35 Tier-1 + visibility + matchState" to "35 Tier-1 + 3 Tier-3 (visibility + matchState + bridgeMeta)."

- **NIT (Claude — `serializeMatchState` may persist stale derived fields):** `MatchState` carries `wonderCountdownTicks` / `relicCountdownTicks` fields, but live API recomputes them per-call. `Object.assign({}, matchState)` would persist stale values into `world.state.aoe2.matchState`. Replay's `getReplayMatchStateDerived` ignores these fields (computes fresh from `aoe2.wonderCountdowns/relicCountdowns`), so functionally harmless — but anything else reading the slot directly sees stale. v9 `serializeMatchState` explicitly nulls the derived fields:
  ```ts
  function serializeMatchState(m: MatchState): SerializedMatchState {
    const { wonderCountdownTicks: _wc, relicCountdownTicks: _rc, ...rest } = m;
    return rest;
  }
  ```
  Loud-fail (undefined values) preferred over silent stale.

- **NIT (Claude — `_currentReplayContext.world` post-play aliasing):** `play()` advances `_playState.world` in place; `pause()` updates `_currentReplayContext.tick` but `_currentReplayContext.world` remains the played-to world, NOT a fresh `openAt(_currentReplayContext.tick)`. Future contributors might assert equivalence. v9 §5.4 adds one-line note: "*`_currentReplayContext.world` is the most recently materialized replay world (post-play if applicable), NOT a fresh `openAt(currentTick)` result. Subsequent `scrubTo(t)` rebuilds via `openAt(t)`.*"

**v8 deltas vs v7:** addresses iter-7 review (Codex 2 MAJORs; Claude 1 MAJOR + 2 NITs — different surfaces, but all real correctness gaps).

- **MAJOR (Codex — `enterReplay()` doesn't seed `_currentReplayContext`):** v7 had `play()` snapshot from `_currentReplayContext`, but `_currentReplayContext` was only populated in `scrubTo()`. The natural "enter replay then press play" UX path would dereference `undefined` or hit a guard. v8 §5.4 `enterReplay(tick = startTick)` now: opens world, builds replay bridge, seeds `_currentReplayContext = { world, bridge, accessor, visibilityCell, matchState, tick }` from `replayBridge`, emits `onTickChange(tick)`. Same shape as `scrubTo`'s tail.

- **MAJOR (Codex — `matchState` lifecycle inverted):** v7's PATH B/C created `matchState` AFTER `createWorldSkeleton(...)`, but skeleton internally calls `registerAllSystems` which captures `matchState` in system deps closures (`registerBridgeSystems.ts:178`). Closures captured at registration cannot see an object that doesn't yet exist. v8 flips the order:
  ```ts
  // PATH B (schema-2):
  const matchState = createDefaultMatchState();   // FIRST
  const visibilityCell = new VisibilityCell(new VisibilityMap(W, H));
  let world: GameWorld;
  const accessor = new BridgeStateAccessor(() => world);
  world = createWorldSkeleton(seed, dims, accessor, visibilityCell, matchState);  // matchState passed in
  world.applySnapshot(savedGame.worldSnapshot);
  // Hydrate the SAME matchState reference (mutate in place):
  const msState = world.getState('aoe2.matchState') as SerializedMatchState | undefined;
  if (msState) Object.assign(matchState, msState);
  // Closures captured during skeleton registration see the post-hydration matchState.
  ```
  `createWorldSkeleton` signature becomes `(seed, dims, accessor, visibilityCell, matchState)`. PATH A (fresh) creates matchState first too — same shape, no need for default-then-mutate since fresh start.

- **MAJOR (Claude — Tier-3 per-tick sync to `world.state.aoe2.*` was unspecified):** §3 puts `VisibilityMap` + `MatchState` in Tier-3 (lives outside `world.state` in mutable instances). Live systems mutate them via `cell.get().setSource(...)` and direct field writes — neither path touches `world.state.aoe2.visibility` / `world.state.aoe2.matchState`. v7's `bridgeSnapshotSystem.execute` only called `accessor.flush()` which iterates the Tier-1 codec table. Net result: any recorder snapshot at tick > load carries STALE Tier-3 data; replay opens with stale visibility/matchState; saveGame round-trip is broken. The §7 core invariant fails.

  v8 introduces a dedicated **`tier3SyncSystem`** registered immediately BEFORE `bridgeSnapshotSystem` in the output phase. Its `execute(world)` does:
  ```ts
  // src/game/simulation/bridge/tier3SyncSystem.ts (NEW)
  export function makeTier3SyncSystem(
    visibilityCell: VisibilityCell,
    matchState: MatchState,
  ): SystemRegistration<...> {
    return {
      name: 'tier3Sync',
      phase: 'output',
      execute: (world) => {
        world.setState('aoe2.visibility', visibilityCell.get().getState());
        world.setState('aoe2.matchState', serializeMatchState(matchState));
      },
    };
  }
  ```
  `serializeMatchState` is the existing `MatchState → SerializedMatchState` mapper (mirror of `Object.assign({}, matchState)` for the JSON-shaped fields). Registration order in `createWorldSkeleton`'s output phase: `…all-other-systems… → tier3Sync → bridgeSnapshot`. Both ordering invariants are CI-protected by extending §5.2's trace test to assert the LAST two output-phase entries are `['tier3Sync', 'bridgeSnapshot']`. `flushBridgeStateToWorld()` (used by `saveGameOps.saveGame()` per ADR 5) calls both `tier3Sync` writes AND `accessor.flush()` so the saved snapshot captures Tier-1 + Tier-3 together.

- **NIT (Claude — `extractDimsFromSnapshot(snapshot)` unspecified):** v8 §5.6 spells out: read `mapWidth`/`mapHeight` from `snapshot.state['aoe2.bridgeMeta']` (NEW Tier-3 slot — written once at game start, carries `{ mapWidth, mapHeight }`). Fallback to `snapshot.state['aoe2.visibility'].width/height` if present (post-migration snapshots have it). Throws `MissingMapDimsError` if neither exists — guards against pre-migration snapshots that the v0.1.6 migration step is supposed to seed.

- **NIT (Claude — `makeReplayBridge.getMatchState()` derived fields):** v8 §5.3 spells out that the replay bridge's `getMatchState()` constructs derived fields (`wonderCountdownTicks`, `relicCountdownTicks`) by reading `world.state.aoe2.wonderCountdowns` / `aoe2.relicCountdowns` for the human player — same algorithm as live `assembleBridgeApi.ts:55-61`, just sourced from the replay world. Helper extracted into `getReplayMatchStateDerived(world, humanPlayerId)` and reused by both replay bridge + live bridge to guarantee identical shape.

**v7 deltas vs v6:** addresses iter-6 review (Codex 1 MAJOR; Claude ACCEPT with 1 MINOR + 3 NITs — both reviewers converge on the same root cause framed differently).

- **MAJOR / MINOR (replay-world context channel — accessor + cell get lost between `createReplayWorldOnly` and `makeReplayBridge` / `_playState`):** v6's `createReplayWorldOnly(snapshot): GameWorld` constructs an accessor + `VisibilityCell` internally and registers replay systems against them, then returns only the `world`. Downstream, `makeReplayBridge(world)` and `_playState.accessor.reset()` (§5.4) need the same accessor + cell instances — but they were dropped on the floor. SessionReplayer's `worldFactory(snapshot): World` engine signature can't be widened (`session-replayer.ts:242`).

  v7 introduces a module-level `WeakMap<GameWorld, ReplayWorldContext>` (per Codex's suggestion, equivalent in spirit to Claude's "tighten §5.3/§5.4"):
  ```ts
  // src/game/simulation/replayWorldContext.ts (NEW)
  export interface ReplayWorldContext {
    accessor: BridgeStateAccessor;
    visibilityCell: VisibilityCell;
    matchState: MatchState;
  }
  const REPLAY_WORLD_CONTEXTS = new WeakMap<GameWorld, ReplayWorldContext>();
  export function attachReplayWorldContext(world: GameWorld, ctx: ReplayWorldContext): void {
    REPLAY_WORLD_CONTEXTS.set(world, ctx);
  }
  export function getReplayWorldContext(world: GameWorld): ReplayWorldContext {
    const ctx = REPLAY_WORLD_CONTEXTS.get(world);
    if (!ctx) throw new Error('Replay world context not attached — was world built via createReplayWorldOnly?');
    return ctx;
  }
  ```
  `createReplayWorldOnly(snapshot)` calls `attachReplayWorldContext(world, { accessor, visibilityCell, matchState })` before returning. `makeReplayBridge(world)` and `_currentReplayContext` initialization read the context via `getReplayWorldContext(world)` so all three (accessor, cell, matchState) thread through to `_playState`. WeakMap means GC reclaims the entry when the world is no longer reachable.

- **MINOR (Claude — `_currentReplayContext` was missing `accessor` field):** v6 had `_currentReplayContext = { world, bridge, tick }` but `_playState = { world, bridge, accessor, tick }`. v7's `_currentReplayContext` carries `{ world, bridge, accessor, visibilityCell, matchState, tick }` so `play()` can spread it directly into `_playState`. Resolves Claude's MINOR + tightens §5.4.

- **NIT (Claude — `BridgeStateAccessor` lazy getter promises a "clear error" but the class doesn't implement one):** v7 adds `if (this._world === undefined) throw new Error('BridgeStateAccessor used before world bound')` guard in `get`/`flush`. The getter is now `() => world | undefined` and the guard converts the implicit `undefined` deref into an explicit domain error.

- **NIT (Claude — `seedFreshTiles` scope is ambiguous vs current `seedFreshScenario`):** v7 §5.6 disambiguates: `seedFreshTiles(world, seed)` is JUST the tile-grid construction (formerly `createTileGrid`); the building/unit/resource scenario seeding still happens inside `wireBridgeOps` via the existing `seedFreshScenario` helper. The skeleton-then-tiles-then-wireBridgeOps order is preserved.

- **NIT (Claude — `makeReplayBridge` accessor sharing under-specified):** Resolved by the WeakMap channel above: `makeReplayBridge(world)` reads `getReplayWorldContext(world).accessor` so the bridge ops + already-registered systems share the SAME accessor instance.

**v6 deltas vs v5:** addresses iter-5 review (Codex 1 MAJOR + 1 MINOR; Claude ACCEPT with 4 implementer notes). All other issues from iter-1 → iter-4 verified clean. Design now at convergence point — both reviewers find architecture sound.

- **MAJOR (`registerAllSystems` needs `visibility` at registration time, conflicts with skeleton-then-applySnapshot ordering):** `registerAllSystems(world, visibility, ...)` (`registerAllSystems.ts:28, 140, 308`) passes the `visibility` instance into AI / visibility / fog systems at registration time. v5's skeleton-then-applySnapshot-then-rebuild-visibility flow would register those systems against a placeholder `VisibilityMap` that gets replaced after `applySnapshot`, leaving systems with a stale closed-over reference.

  v6 introduces a `VisibilityCell` indirection (aoe2-side, no civ-engine changes):
  ```ts
  // src/game/simulation/bridge/visibilityCell.ts (NEW)
  export class VisibilityCell {
    private _current: VisibilityMap;
    constructor(initial: VisibilityMap) { this._current = initial; }
    get(): VisibilityMap { return this._current; }
    replace(next: VisibilityMap): void { this._current = next; }
  }
  ```
  Systems take a `VisibilityCell` (not a `VisibilityMap` directly) and call `cell.get().method(...)` per-step. After `applySnapshot`, the schema-2 / schema-1 paths call `cell.replace(VisibilityMap.fromState(world.getState('aoe2.visibility') as VisibilityMapState))` — every system now reads the post-applySnapshot instance through the cell. `wireBridgeOps` runs on the same world with the now-current cell. Same indirection pattern (`MatchStateCell` or just continued `Object.assign`) for matchState — already mutable so `Object.assign(matchState, msState)` mutates in place; no cell needed there.

  This is a small refactor of `registerAllSystems` (~20 call sites: visibility-using systems take `VisibilityCell` instead of `VisibilityMap`). No civ-engine changes; no `VisibilityMap.applyState` needed.

- **MINOR (§5.2 ordering-test wording still says `fn:`):** v5 fixed §8 + v5-deltas, but missed §5.2 line 436. v6 normalizes the last instance.

- **NIT (Claude F-2 — `BridgeStateAccessor.get` deserialize input cast):** `codec.deserialize(json)` where `json: unknown` and param type is `TJson | undefined` won't compile. v6 adds `as TJson | undefined` on the input.

- **NIT (Claude F-3 — `BridgeStateAccessor` constructor / `setWorld` signature mismatch):** §5.1 constructor took `world`, §5.6 called `new BridgeStateAccessor(/* deferred */) + accessor.setWorld(world)`. v6 picks the lazy-getter pattern: `new BridgeStateAccessor(() => world)` — accessor stores a getter, calls it on first read. This sidesteps the chicken-and-egg without a separate setter method.

- **NIT (Claude F-4 — duplicated v4-deltas paragraph header):** copy-paste artifact in v5 that v6 removes (only one v4-deltas section retained).

**v5 deltas vs v4:** addresses iter-4 review (Codex 1 BLOCKER + 2 MAJORs + 1 MINOR; Claude ACCEPT with 5 implementer notes). Both reviewers converge: substantive iter-3 fixes verified clean; remaining issues are spec-vs-ground-truth API formalism.

- **B1 (BLOCKER — §5.6 createWorld(savedGame: null) takes fresh-bootstrap path):** v4's §5.6 said "construct world via createWorld scaffolding without savedGame.visibility (savedGame: null)" — but `createWorld(seed, visibility, null)` takes the FRESH-bootstrap path (`createWorld.ts:81`+), seeding fresh tiles before any snapshot application. wireBridgeOps would close over fresh-world tile ids that get superseded by `applySnapshot`. v5 redesigns: split `createWorld` into `createWorldSkeleton(seed, { mapWidth, mapHeight })` (registers components/systems/handlers but does NOT seed tiles or apply snapshot) and a separate `seedFreshTiles(world)` step. For schema-2 / replay: skeleton → applySnapshot → rebuild visibility+matchState from `world.state` → `wireBridgeOps`. For fresh game: skeleton → seedFreshTiles → fresh visibility/matchState → wireBridgeOps. For schema-1: skeleton → applySnapshot → migrateLegacySaveBlobToWorldState → (then identical to schema-2) → wireBridgeOps.

  **The `VisibilityMap.applyState` mutate-in-place method is no longer needed** — schema-2 just constructs a fresh `new VisibilityMap(W, H)` then immediately replaces it via `VisibilityMap.fromState(world.getState('aoe2.visibility'))` BEFORE wireBridgeOps closes over the reference. Eliminates the v4 dependency on a new civ-engine method.

- **MAJOR (`world.getState<T>(...)` doesn't accept value-type generic):** v4's `world.getState<VisibilityMapState>('aoe2.visibility')` — civ-engine's overload takes the key as the type parameter; the value overload returns `unknown`. v5 uses explicit cast: `world.getState('aoe2.visibility') as VisibilityMapState | undefined`. Same pattern in `BridgeStateAccessor.get` (already does this internally) and §5.6.

- **MAJOR (System registration shape: `execute:` not `fn:`, no `ctx` param):** v4's `bridgeSnapshotSystem` example used `fn: (world, ctx) => …` — civ-engine's `SystemRegistration` requires `execute: (world) => void` (`world.ts:74-87` / `:51-56`). No `ctx` parameter. v5 specifies `execute:` and routes the `BridgeStateAccessor` to the system via **closure capture** in `createWorldSkeleton`: the accessor instance is created inside the skeleton factory, captured by the system's `execute` closure, and held by the bridge. Same accessor instance shared across all bridge ops + `bridgeSnapshotSystem`.

- **MAJOR (§5.2 vs §8 ordering-test mechanism inconsistent):** §5.2 line 406 said "trace each system's `fn`"; §8 line 720 said "test introspects the system list." Plus v4-deltas line 16 said "probe-system pattern" — yet a different mechanism. v5 normalizes everywhere to the single canonical mechanism: **instrument each output-phase system's `execute` (during test fixture setup) to push its `name` onto a per-tick trace array; assert the LAST output-phase entry is `'bridgeSnapshot'`.** §5.2, §8, and v4-deltas/v5-deltas all agree.

- **MINOR (ADR 4 body still says `combatStatesCodec.serialize(map)`):** v4-deltas line 13 promised the fix but ADR 4 body wasn't updated. v5 ADR 4 body uses direct `setState`: `world.setState('aoe2.combatStates', savedGame.sideMaps.combatStates)` — `SerializedSideMaps` already mirrors codec JSON shape per `saveSchema.ts:103-227` field-for-field.

- **NIT (Tier-1 count "34" in v2-deltas):** v4-deltas line 41 description of "v2 said 34" — historically accurate (v2 indeed said 34); not a content bug. Left unchanged.

**v4 deltas vs v3:** addresses iter-3 review (Codex 1 BLOCKER + 4 MAJORs; Claude 1 MAJOR + 6 minors/NITs).

- **B1 (Schema-2 load underspecified for visibility + matchState):** v3 removed top-level `visibility` / `matchState` from `SaveBlobV2` saying `world.applySnapshot` is enough — but current `createSimulationBridge.ts:148-149` constructs `VisibilityMap.fromState(savedGame.visibility)` BEFORE `createWorld` returns a world (which is needed to construct visibility's projector). For schema-2 where visibility lives in `world.state.aoe2.visibility`, the constructor must rehydrate the external `VisibilityMap` and `matchState` objects AFTER `world.applySnapshot`. v4 §5.6 spells out the schema-2 load flow: 1) construct world via createWorld scaffolding (without savedGame.visibility), 2) `world.applySnapshot(savedGame.worldSnapshot)`, 3) extract `VisibilityMapState` from `world.getState('aoe2.visibility')` and rebuild the live `VisibilityMap` instance via `VisibilityMap.fromState(...)`, 4) extract `SerializedMatchState` from `world.getState('aoe2.matchState')` and copy fields into the live `MatchState` mutable object.
- **MAJOR (pause() loses played-to tick):** v3 said `pause()` flow nulls `_playState` before `_currentReplayContext.tick = _playState?.tick ?? _currentReplayContext.tick`. Order-of-operations bug: by the time the assignment runs, `_playState` is already null, so the `??` falls through to the stale value. v4 §5.4 reorders: 1) capture `_playState?.tick` into a local; 2) null `_playState`; 3) update `_currentReplayContext.tick` from the local.
- **MAJOR (test plan contradicts ADR 10):** v3 §8 still asserted "`play()` calls `replayer.openAt`, NOT `world.step()`" — leftover from v2. v4 §8 inverts the assertion: "`play()` cached `_playState` doesn't re-call `replayer.openAt(tick+1)` per frame; instead `world.submitWithResult` + `world.step()` are called directly on the cached world." Plus a regression test that asserts `replayer.openAt` is NOT called more than once per `scrubTo`/`enterReplay`.
- **MAJOR (ordering invariant wording inconsistent):** v3 §5.2 was correct but file-layout / architecture / ADR sections still said "last via `before: []`." v4 normalizes the wording everywhere — "registered LAST in createWorld's output-phase registration sequence; ordering enforced by registration order tiebreaker; CI-protected by ordering test."
- **MAJOR (Tier-1 count still 34 in 4 places):** §1 / §7 / §9 / §12 all said "34 Tier-1" while §3 table has 35. v4 search-replaces to 35 throughout.
- **MAJOR (stale §5.1 duplicate API block):** v3 left in a leftover v2 example block (lines ~370-398) using the retired `accessor.getMap(slot)` string-keyed API and string-keyed `mutate` helper, contradicting the current codec-keyed `accessor.get(codec)` API defined a few lines earlier. v4 deletes the duplicate block.
- **minor (ADR 4 migration wording):** v3 said `combatStatesCodec.serialize(savedGame.sideMaps.combatStates)` — but `savedGame.sideMaps.combatStates` is ALREADY `Array<[K,V]>` (the existing `SerializedSideMaps` shape), not a `Map`, so calling `serialize()` on it is wrong. v4 corrects: `world.setState('aoe2.combatStates', savedGame.sideMaps.combatStates)` directly — no re-serialization needed because the v3 codec JSON shapes mirror the existing `SerializedSideMaps` field-for-field.
- **minor (play() endTick uses incomplete-aware bound):** v4 ADR 10 + §5.4 use `upper = bundle.metadata.incomplete ? persistedEndTick : endTick` to match `openAt`'s upper bound, avoiding divergent play-vs-scrub semantics for incomplete bundles.
- **minor (defensive hasCommandHandler check):** ADR 10's `_advanceOneFrame` step 2 now defensively checks `world.hasCommandHandler(rc.type)` before `submitWithResult`, mirroring `openAt` (`session-replayer.ts:247-252`).
- **minor (ordering-test mechanism):** §5.2 now specifies the probe-system pattern: in test-only setup, register a no-op probe system AFTER `bridgeSnapshotSystem`; assert via on-execute capture that the probe runs after `bridgeSnapshot` in tick traces. Alternative considered: civ-engine `world.getSystemOrder()` helper — deferred since no-op probe avoids engine bump.
- **NIT (`accessor.get` cache-miss sentinel):** changed `if (cached === undefined)` to `if (!this._cache.has(codec.slot))` — robustness against a future codec returning `undefined` as a valid native.
- **NIT (ADR 2 fingerprint citation):** v3's "fingerprints non-dirty keys" prose was slightly inaccurate; `clearStateDirty` (`world.ts:1490-1497`) fingerprints ALL keys at tick-start regardless. v4 wording: "`clearStateDirty` fingerprints every key at tick-start; `getStateDirty` skips already-dirty keys to avoid redundant work." Conclusion (per-tick cost is fixed, write-frequency-independent) unchanged.

**v3 deltas vs v2:** addresses iter-2 review (Codex + Claude convergent ITERATE; 2 BLOCKERs + 3 MAJORs + 2 minors).

- **B1 (API method names — `world.state.get/set` doesn't exist):** civ-engine API is `world.getState(key)` / `world.setState(key, value)` as methods (`world.ts:1369-1394`); `stateStore` is private. v2's `world.state.get(...)` / `world.state.set(...)` example wouldn't compile. v3's `BridgeStateAccessor` (§5.1) uses `world.getState<T>(slot)` / `world.setState(slot, value)`.
- **B2 (Generic `Array.from(map)` insufficient for nested Maps/Sets):** v2 said all slots use `Array<[K, V]>` form, but `researchedTechnologies` is `Map<number, Set<...>>` and `lastSeenStatic` is `Map<number, Map<number, MemoryEntry>>` — bare `Array.from(outer)` preserves the inner `Set`/`Map`, both rejected by `assertJsonCompatible`. v3's `bridgeStateSerialize.ts` has per-slot serialize/deserialize functions matching the existing `SerializedSideMaps` shape (where tech `Set`s become `[]`s and nested maps become nested entry arrays). `BridgeStateAccessor.flush()` dispatches via this table.
- **MAJOR (`before: []` doesn't put system last):** civ-engine's topological scheduler treats empty `before`/`after` as the default — no constraints. Constraint-free systems sort by registration order. Any later-registered output system would run after `bridgeSnapshotSystem` and could mutate bridge state after the recorder-visible commit. v3's solution: register `bridgeSnapshotSystem` LAST in `createWorld`'s output-phase registration sequence; add an ordering test that fails if any output system is registered after it. Also documented as an invariant in ADR 2: "any future output-phase system MUST be registered before `bridgeSnapshotSystem`."
- **MAJOR (Schema-1 migration misses visibility + matchState):** schema-1 `SaveBlob` carries `visibility: VisibilityMapState` and `matchState: SerializedMatchState` as TOP-LEVEL fields, not inside `sideMaps`. v2's `migrateLegacySideMapsToWorldState` only migrated `sideMaps`. v3's migration helper renamed to `migrateLegacySaveBlobToWorldState(world, savedGame)` and accepts the full `SaveBlob`, copying visibility + matchState into `world.state.aoe2.visibility` / `world.state.aoe2.matchState` in addition to the side-map slots.
- **MAJOR/PERF (`play()` per-frame `openAt` is O(snapshotInterval)):** v2 said playback calls `replayer.openAt(currentTick + 1)` per frame. Each `openAt` rebuilds from the closest snapshot, so playback near the middle of a 1000-tick snapshot interval would replay hundreds of steps per frame. v3 introduces a stateful play mode: `enterReplay`/`scrubTo` materializes a `_playState = { world, bridge, accessor, tick }`; `play()`'s requestAnimationFrame loop submits next-tick recorded commands and calls `world.step()` directly — same algorithm as `openAt`'s internal step loop, but per-tick instead of from-snapshot. Returns to `openAt`-from-snapshot only on `scrubTo` jumps. Documented in §5.4 + new ADR 10.
- **ADR 2 fingerprint citation corrected:** `getStateDirty` (`world.ts:1577-1593`) SKIPS dirty keys (`if (changed.has(key)) continue`); fingerprint runs in `clearStateDirty` (`world.ts:1490-1497`) for non-dirty keys at tick-start. The dominant per-call write cost is `assertJsonCompatible` (linear in nested object size), not fingerprint. Tick-end sync conclusion unchanged; just the rationale.
- **m-1 (Tier-1 count off):** prose said 34, table has 35 entries. v3 prose corrected to 35.
- **m-2 (line number):** strict-eq check is at `createSimulationBridge.ts:140-144`, not just :140. Corrected.

**v2 deltas vs v1:** addresses iter-1 review (Codex + Claude convergent ITERATE; 2 BLOCKERs + 7 MAJORs + several mediums).

- **H1/H2 (Inventory completeness):** `conversionState` and `buildingCombatStates` added to Tier-1; `villagerOrdinals` moved from Tier-2 to Tier-1 (it's a monotonic creation counter for canonical-AoE2 role assignment, not equivalent to live villager count after deaths).
- **H3 (BLOCKER — storage shape):** civ-engine's `setState` requires JSON-compatible plain objects/arrays/primitives — `Map`/`Set` will be rejected by `assertJsonCompatible`. v2 storage uses `Array<[K, V]>` form for entity-keyed maps (mirrors existing `SerializedSideMaps`). Reads materialize a `Map`; writes serialize back at tick-end.
- **H4 (ADR 2 rationale):** rewritten to cite actual costs (`assertJsonCompatible` traversal, `jsonFingerprint` on dirty keys, structured-clone allocation pressure) — not the wrong "one TickDiff per write" claim. Conclusion (tick-end sync) unchanged.
- **H5 (ADR 4 schema gate):** explicitly relaxes the strict-equality version check at `createSimulationBridge.ts:140` to `(1 | 2)`. Documented loader migration: schema-1 saves still load via the existing `hydrateFromSavedGame` path; an additional step copies legacy `SaveBlob.sideMaps` into `world.state.aoe2.*` after `applySnapshot`.
- **H6 (versioning):** picked **0.1.6 c-bump** (not 0.2.0). Rationale: with back-compat for schema-1 SaveBlobs, this is non-breaking from a user-visible perspective. New saves use schema 2; old saves still load. The schema bump alone doesn't trigger b-bump under AGENTS.md (which scopes b-bump to "breaking changes" — and the load path remains compatible).
- **BLOCKER — `createReplayWorld` API mismatch with `SessionReplayer.worldFactory`:** `worldFactory` returns only `World`, and `openAt()` returns only `World`, so v1's `{ world, bridge }` factory shape was unbuildable. v2 splits the responsibility: `worldFactory` returns just `World` (matches engine API); a separate `makeReplayBridge(world)` constructs a fresh bridge from the hydrated world's `world.state.aoe2.*` slots. `ReplayController.scrubTo(tick)` calls `replayer.openAt(tick)` then `makeReplayBridge(world)` to rebuild the bridge.
- **MAJOR — phase name correction:** civ-engine phases are `input | preUpdate | update | postUpdate | output`. v1 said "LATE"; v2 specifies the `output` phase with `before: []` (last in output), so `bridgeSnapshotSystem` runs after every other system that mutates bridge state in this tick.
- **MAJOR — saveGame() must flush bridge state:** user actions outside `world.step()` (queueing training, market trades) mutate the bridge cache directly; `saveGame()` must explicitly call `flushBridgeStateToWorld()` BEFORE `world.serialize()` to ensure new schema-2 saves capture pending mutations.
- **M1 — count fixed:** total `BridgeState` slots ≈ 39; Tier-1 (fidelity-critical) 35, Tier-2 (pure derivation) 4, Tier-3 (external — visibility, matchState, bridgeMeta) 3 (v8 added bridgeMeta). Presentation-only items enumerated.
- **M2 — cache-coherence model specified** in §5.1: `BridgeStateAccessor` is a per-bridge-instance cache, materialized lazily on first read per tick, dirty-tracked per-slot, flushed at tick-end (and on demand for saveGame).
- **M3 — `play()` semantics pinned:** explicitly calls `replayer.openAt(currentTick + 1)` per animation frame. Implementer note: do NOT call `world.step()` directly — the replay world has no command queue and would diverge.
- **M4 — `bridgeSnapshotSystem` ordering:** registered as the LAST `output` phase system via `before: []` and explicit ordering tests. Recorder's snapshot hook fires AFTER `output` phase (existing engine behavior at `world.ts:1746-1763`).
- **M5 — RecordingService bound to live world:** explicit callout that the recorder stays attached to the live world via direct reference, NOT through `bridgeRef().world`. Replay-mode bridge swaps don't move the recorder. AnnotationController/MarkerListPanel disable in replay mode anyway (see §5.6).
- **M6 — perf benchmark required pre-Phase B:** Phase A includes a benchmark that asserts `bridgeSnapshotSystem` overhead < 5ms at game-end-state representative size. If realized cost is higher, options (in order of preference): batch the snapshot to every-Nth-tick instead of every tick, reduce `snapshotInterval` for the recorder so misses cost less to recover, pursue engine-side `Map`/`Set` support in setState.
- **M7 — scrub-UX mitigation in the historical full-v0.1.6 target:** frame-coalesced drag promoted from "deferred" into the scrubber scope. In the implemented split, this ships with v0.1.7 Phase 3C. Mid-drag the scrubber renders a placeholder; only the final mouseup tick triggers `openAt`. Reverse-step LRU cache stays deferred.
- **L1 — timeline padded:** Phase A budget revised from 1.5 weeks to ~3 weeks, total ~4 weeks.

---

**Author:** aoe2 team.

**Coordinated repos:** aoe2 only. No civ-engine changes required.

**Current scope:** ship full-fidelity replay in coherent increments. v0.1.6 moved bridge state into `world.state`, shipped schema-2 saves, and added replay-world/controller foundations; v0.1.7 ships the Phase 3C in-game TimelinePanel for already-entered replay mode. Loading bundles from current session / IDB Prior Sessions / imported files and browser scrubber e2e are still Phase 3D/3E follow-up work. Older references below to "full v0.1.6" are historical planning context, not the current release boundary.

**Related primitives (consumed, not modified):**
- `SessionReplayer.fromBundle(bundle, { worldFactory })` + `openAt(tick)` — civ-engine Spec 1
- `BundleViewer.atTick(tick)` — civ-engine Spec 4
- `bundleHotspots(bundle)` — civ-engine v0.8.13 (renders as timeline pin icons)
- `RecordingService` + `IndexedDBMirror` — aoe2 v0.1.5 (already provides Prior Sessions list)
