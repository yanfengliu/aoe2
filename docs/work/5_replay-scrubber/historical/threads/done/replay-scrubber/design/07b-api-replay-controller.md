### 5.3 `worldFactory` + `makeReplayBridge` (split per BLOCKER fix)

`SessionReplayer.openAt()` calls `worldFactory(snapshot): World` (`session-replayer.ts:242`) and returns ONLY the rebuilt world. But the replay path needs the accessor + visibility cell + matchState that `createReplayWorldOnly` constructed internally — `makeReplayBridge(world)` and `ReplayController.play()` cache resets (§5.4) all operate on those instances. v7's solution: a module-level `WeakMap<GameWorld, ReplayWorldContext>` channel.

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

```ts
// src/game/simulation/createReplayWorld.ts
/** Factory matching SessionReplayer's worldFactory signature: (snapshot) → World.
 *  Reuses createWorldSkeleton + wireReplaySystems so replay world has the
 *  full gameplay-system roster the engine's openAt step loop needs to
 *  advance state correctly. Structurally identical to PATH B's load
 *  pattern minus scenario seeding + UI ops. */
export function createReplayWorldOnly(snapshot: WorldSnapshot): GameWorld {
  const { mapWidth, mapHeight } = extractDimsFromSnapshot(snapshot);
  // Construct mutable instances FIRST (closures will capture these references):
  const visibilityCell = new VisibilityCell(new VisibilityMap(mapWidth, mapHeight));
  const matchState = createDefaultMatchState();
  let world: GameWorld;
  const accessor = new BridgeStateAccessor(() => world);
  world = createWorldSkeleton(extractSeed(snapshot), { mapWidth, mapHeight }, accessor, visibilityCell, matchState);
  world.applySnapshot(snapshot);
  // Hydrate the SAME instances (closures already captured) from snapshot:
  const visState = world.getState('aoe2.visibility') as VisibilityMapState | undefined;
  if (visState) visibilityCell.replace(VisibilityMap.fromState(visState));
  const msState = world.getState('aoe2.matchState') as PersistedMatchState | undefined;
  if (msState) Object.assign(matchState, msState);
  // v10 (Claude iter-9 BLOCKER fix): register gameplay systems + output tail.
  // Without this, openAt's step loop would advance world.tick but run no systems.
  wireReplaySystems(world, accessor, visibilityCell, matchState);
  attachReplayWorldContext(world, { accessor, visibilityCell, matchState });
  return world;
}

// src/game/simulation/bridge/wireReplaySystems.ts (NEW in v10)
/** Constructs the system-needed ops modules (movement, AI, visibility,
 *  combat, fogMemory, transformation, etc.) and calls registerBridgeSystems
 *  + registerOutputTail. Skips:
 *    - seedFreshScenario / hydrateFromSavedGame (caller already populated state)
 *    - selection / placementMode / enqueueRejection (replay is read-only)
 *    - input handlers (no UI commands during replay)
 *  This helper is extracted from wireBridgeOps's tail. wireBridgeOps now
 *  calls wireReplaySystems then layers live-only UI ops + scenario seeding
 *  on top, so DRY is preserved across the live + replay paths. */
export function wireReplaySystems(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  visibilityCell: VisibilityCell,
  matchState: MatchState,
): void {
  // ... extract ops module construction from current wireBridgeOps body ...
  // registerBridgeSystems(world, /* deps incl. visibilityCell, matchState, accessor */);
  // registerOutputTail(world, accessor, visibilityCell, matchState);
}

// src/game/simulation/makeReplayBridge.ts
export interface ReplayBridge {
  readonly world: GameWorld;
  readonly accessor: BridgeStateAccessor;        // same instance the systems hold
  readonly visibilityCell: VisibilityCell;       // same instance the systems hold
  readonly matchState: MatchState;               // same mutable object
  // Read-only surface (no setPaused, no step, no setRenderState mutations):
  getRenderState(): RenderState;
  getHudState(): HudState;
  /** v8 — derived-field parity with live bridge (per Claude iter-7 NIT).
   *  Layers `wonderCountdownTicks` / `relicCountdownTicks` for the human
   *  player over `matchState`, sourced from `world.state.aoe2.wonderCountdowns`
   *  / `aoe2.relicCountdowns`. Same algorithm as `assembleBridgeApi.ts:55-61`,
   *  extracted into shared helper `getReplayMatchStateDerived(world, humanPlayerId)`
   *  used by both replay + live bridges so shapes match exactly. */
  getMatchState(): MatchState & { wonderCountdownTicks: number; relicCountdownTicks: number };
  getSelectionState(): SelectionState;
  // ... all the read-only getters from the live SimulationBridge
}

/** Build a fresh bridge over a hydrated replay World. Retrieves the
 *  shared accessor/cell/matchState from the WeakMap context channel so
 *  the bridge ops + already-registered systems share the SAME instances
 *  (single-accessor invariant from §5.1). */
export function makeReplayBridge(world: GameWorld): ReplayBridge {
  const { accessor, visibilityCell, matchState } = getReplayWorldContext(world);
  // ... wire read-only ops over (world, accessor, visibilityCell, matchState)
}
```

`ReplayController.scrubTo(tick)` calls:
1. `replayer.openAt(tick)` → returns the rebuilt `world` (engine API; under the hood civ-engine calls our `createReplayWorldOnly` worldFactory which attaches the context)
2. `makeReplayBridge(world)` → reads `getReplayWorldContext(world)` and wires bridge over the shared accessor/cell/matchState
3. `bridgeCell.replace(replayBridge)` → renderer reassigns

### 5.4 `ReplayController`

```ts
// src/game/replay/ReplayController.ts
export type ReplayMode = 'live' | 'replay';

export interface ReplayController {
  readonly mode: ReplayMode;
  readonly currentTick: number;
  readonly bundleMetadata: SessionMetadata | null;
  readonly world: GameWorld | null;

  enterReplay(bundle: SessionBundle, atTick?: number): void;
  exitReplay(): void;

  /** Calls replayer.openAt(tick) and rebuilds the replay bridge.
   *  Internally frame-coalesced for drag UX (only commits on mouseup-tick). */
  scrubTo(tick: number, options?: { coalesce?: boolean }): void;
  commitPendingScrub(): void;
  stepForward(): void;
  stepBackward(): void;
  jumpToMarker(markerId: string): void;

  /** Stateful play mode (ADR 10): keeps the current replay world+bridge cached.
   *  Scheduled frames accumulate elapsed time at TPS, submit recorded commands,
   *  and call world.step() directly until the accumulator is drained. Returns
   *  to openAt-from-snapshot only on committed scrubTo() jumps. */
  play(): void;
  pause(): void;
  isPlaying(): boolean;

  onModeChange(listener: (mode: ReplayMode) => void): () => void;
  onTickChange(listener: (tick: number) => void): () => void;
}
```

**2026-05-05 implementation note:** `src/game/replay/ReplayController.ts` implements this contract with a closure-local `replayContext` cell plus `displayedTick`; older `_currentReplayContext` / `_playState` names are historical design-iteration terminology only. `commitPendingScrub()` is the explicit mouseup/drag-end hook for ADR 9: coalesced `scrubTo(tick, { coalesce: true })` updates the displayed tick without rebuilding, and `commitPendingScrub()` or non-coalesced `scrubTo(tick)` performs the `openAt` + bridge replacement. `makeReplayBridge(world)` reads the WeakMap-attached replay API and returns a full read-capable `SimulationBridge`; its scene-frame `step(delta)` intentionally does not advance replay time, so only `ReplayController.play()` calls `world.step()`. Replay entry captures the live pause state before forcing replay pause and restores that exact state on normal exit or failed bridge replacement.

**`enterReplay` flow:**
1. Capture `priorPaused = isLivePaused()`; replay-controller hosts must provide the live pause-state getter because `SimulationBridge` intentionally has no pause getter
2. `liveBridge` reference saved in closure
3. `replayer = SessionReplayer.fromBundle(bundle, { worldFactory: createReplayWorldOnly })`
4. `const tick = atTick ?? bundle.metadata.startTick;`
5. `world = replayer.openAt(tick)`
6. `replayBridge = makeReplayBridge(world)`
7. `liveBridge.setPaused(true)` — pause live game immediately before the bridge swap
8. `bridgeCell.replace(replayBridge)` — renderer reassigns; on failure, restore `priorPaused`
9. Seed `replayContext = { bundle, replayer, world, bridge: replayBridge, commandsByTick }` and set `displayedTick = tick`; required so `play()` can advance the cached world without reopening snapshots.
10. emit `onModeChange('replay')`; emit `onTickChange(tick)`

**`exitReplay` flow:**
1. `replayBridge` discarded (GC)
2. `bridgeCell.replace(liveBridge)`
3. `liveBridge.setPaused(priorPaused)` — restore the live pause state that existed before replay entry
4. emit `onModeChange('live')`

**`scrubTo(tick)` flow:**
1. `pause()` — stop any active playback (so `play()` doesn't keep racing past the new scrub target)
2. `world = replayer.openAt(tick)` — replay from closest snapshot. (`openAt` calls our `createReplayWorldOnly` worldFactory under the hood, which attaches `ReplayWorldContext` to the returned world.)
3. `replayBridge = makeReplayBridge(world)` — bridge reads the WeakMap-attached accessor/cell/matchState
4. `bridgeCell.replace(replayBridge)` — renderer reassigns
5. cache the replay context as `replayContext = { ...current, world, bridge: replayBridge }` and clear `pendingScrubTick`
6. emit `onTickChange(tick)`

**`play()` flow** (per ADR 10 — stateful playback):
1. Require replay mode and command payloads; bundles without command payloads fail loudly instead of trying to synthesize forward playback.
2. Set `playing = true`, reset the playback accumulator/last-frame clock, and schedule the next frame.

**scheduled frame body:**
1. Accumulate elapsed frame time in milliseconds at `1000 / TPS`. The first frame starts with one tick of accumulated time so Play advances immediately.
2. While the accumulator has at least one tick, compute the incomplete-aware upper bound. If the current tick is already at the upper bound, pause and reset the playback clock.
3. `replayUpperBoundFor(bundle)` folds the first `metadata.failedTicks` entry into the upper bound, so playback stops at the last known-good tick and does not step into a recorded failure boundary.
4. Submit recorded commands at `submissionTick === currentTick` via `world.submitWithResult(rc.type, rc.data)`. **Defensive parity with `openAt`**: before each submit, check `world.hasCommandHandler(rc.type)` and throw `ReplayHandlerMissingError` if absent (mirrors `session-replayer.ts:247-252`).
5. Try `world.step()`. Step exceptions propagate through the scheduled frame callback after playback is stopped; `ReplayController` currently exposes mode/tick listeners only, not a replay-error listener.
6. Re-read `world.tick`, reset the replay accessor cache, update `displayedTick`, emit `onTickChange`, update interpolation alpha from the remaining accumulator, and schedule the next frame if still playing.

**`pause()` flow:**
1. cancel pending requestAnimationFrame
2. `playing = false`
3. reset the playback accumulator, last-frame timestamp, and interpolation alpha

**`stepForward()` / `stepBackward()`** call `scrubTo(currentTick ± 1)`. Cheap because adjacent snapshots are usually 1 tick apart in `openAt`'s loop, but worst-case is O(snapshotInterval).

**Note on `replayContext.world` post-play semantics:** the implementation keeps `replayContext` as a closure cell in `ReplayController.ts`, not as the older `_currentReplayContext` field from earlier design iterations. Post-`play()`, `replayContext.world` references the played-to world, NOT a fresh `openAt(currentTick)` result. Subsequent committed `scrubTo(t)` rebuilds via `openAt(t)`; subsequent `play()` resumes from the same cached world.

### 5.5 `TimelinePanel` (UI)

Bottom-strip overlay (full-width, below the game canvas — does not overlap game). Visible only in replay mode. Hotkey toggle: **Alt+T**.

Implementation note (2026-05-05): the panel is mounted in the HUD root as a fixed bottom strip. While `.timeline-panel:not([hidden])` is present, CSS reserves bottom viewport space for `#game-root` and offsets `.hud-bottom`; desktop and mobile visual checks verify the playfield and bottom HUD do not overlap the panel.

Renders:
- A horizontal track [0, bundle.metadata.endTick]
- Draggable scrubber thumb (frame-coalesced per M7)
- Marker pins (from `bundle.markers`) — colored by category
- Hotspot pins (from `bundleHotspots(bundle, { includeMarkers: false })`) — colored by severity (red high, yellow medium)
- Play/pause button, ±1 step buttons, current/total tick display, exit button
- Pointer + keyboard input

