## 7. ADRs

### ADR 1 — Bridge state lives in `world.state` as `Array<[K, V]>` form

**Decision:** All Tier-1 + Tier-3 state migrates into `world.state` via `setState`, stored as JSON-compatible array form (entity-keyed maps as `Array<[K, V]>`; structured records as plain objects). State keys are namespaced under `aoe2.*` (e.g., `aoe2.combatStates`, `aoe2.visibility`, `aoe2.matchState`).

**Rationale:** Spec §15 explicitly preferred this over a parallel BridgeSnapshot artifact. Civ-engine's `setState` requires JsonValue-compatible inputs (rejects `Map`/`Set` instances via `assertJsonCompatible`); the array-form pattern matches the existing `SerializedSideMaps` shape used by SaveBlob today. This makes every `world.serialize()` snapshot complete; `SessionRecorder`'s periodic snapshots therefore capture full bridge state without aoe2-specific recorder hooks.

### ADR 2 — Bridge state syncs at tick-end (output-phase, last) via `BridgeStateAccessor`

**Decision:** Ops modules mutate bridge maps via a `BridgeStateAccessor` that lazily materializes Maps on first read per tick and dirty-tracks slot writes. At tick-end, the `bridgeSnapshotSystem` (registered LAST in `createWorld`'s output-phase registration sequence; ordering enforced by registration-order tiebreaker per `world.ts:2089-2134`; CI-protected by an ordering test that fails if a later output system is registered) flushes dirty values back to `world.state` via per-slot codecs. `assertJsonCompatible` cost is paid once per dirty slot per tick, not per write.

**Rationale (corrected from v1+v2):** The dominant per-call write cost is `assertJsonCompatible` traversal per `setState` call (visits every nested element of the value). For hot paths (combat damage, resource gathering), per-write setState would call `assertJsonCompatible` hundreds of times per tick on entire bridge-state slot snapshots, blowing the tick budget.

Other costs that contribute (less dominant):
- `clearStateDirty` (`world.ts:1490-1497`) at tick start fingerprints non-dirty keys via `JSON.stringify` to detect external mutation. This is a fixed per-tick cost (independent of write frequency); tick-end sync doesn't change it.
- `getStateDirty` (`world.ts:1577-1593`) SKIPS dirty keys (`if (changed.has(key)) continue`); it fingerprints only non-dirty keys to catch out-of-band mutation. So per-call setState cost is `assertJsonCompatible` only, not fingerprint.
- Allocation / GC pressure from the structured-clone path in `applySnapshot`.

Tick-end sync collapses to one `setState` (and one `assertJsonCompatible`) per slot per tick (or zero if unchanged), which is amortizable.

### ADR 3 — `worldFactory` returns `World`; `makeReplayBridge` builds the bridge separately

**Decision:** `SessionReplayer.fromBundle({ worldFactory })` is given a factory that returns only `World` (matching engine API). A separate aoe2 helper, `makeReplayBridge(world)`, constructs a fresh bridge over the hydrated world. `ReplayController` orchestrates: `openAt(tick)` → `makeReplayBridge(world)` → bridge-cell reassignment.

**Rationale:** civ-engine's `worldFactory: (snapshot) => World` signature is fixed. Splitting bridge construction into a separate aoe2-side helper preserves engine-API compatibility while giving the controller a clear bridge handle. Replay bridges are full siblings of the live bridge — same surface, hydrated state — so no new abstraction is needed.

### ADR 4 — Save/load schema bumps to 2 with permissive loader for legacy schema-1

**Decision:** `SAVE_SCHEMA_VERSION` bumps from 1 to 2. New schema-2 saves contain only `seed + worldSnapshot` (which now includes all Tier-1 + Tier-3 state via `world.state.aoe2.*`); `SaveBlob.sideMaps`, `SaveBlob.visibility`, and `SaveBlob.matchState` become optional and are no longer written. Legacy schema-1 SaveBlobs continue to load:

- The strict-equality check at `createSimulationBridge.ts:140-144` is relaxed to `(savedGame.schema === 1 || savedGame.schema === 2)`.
- For schema-1: a new `migrateLegacySaveBlobToWorldState(world, savedGame)` runs after `world.applySnapshot(savedGame.worldSnapshot)` — copies all THREE legacy top-level fields into `world.state.aoe2.*` via the codecs:
  - `savedGame.sideMaps[fieldName]` → directly `setState`'d into the matching `aoe2.<fieldName>` slot via plain `world.setState('aoe2.combatStates', savedGame.sideMaps.combatStates)` (no codec.serialize call needed — `SerializedSideMaps` is already in the codec JSON shape per `saveSchema.ts:103-227`, mirroring v5's codec output field-for-field)
  - `savedGame.visibility` (`VisibilityMapState`) → `world.setState('aoe2.visibility', savedGame.visibility)`
  - `savedGame.matchState` (`SerializedMatchState`) → `world.setState('aoe2.matchState', stripDerivedFields(savedGame.matchState))` where `stripDerivedFields` produces a `PersistedMatchState` (omits `wonderCountdownTicks` / `relicCountdownTicks` per v10's stale-field fix; legacy v0.1.5 saves carry the derived fields, but they get recomputed on next live-API read regardless)
- For schema-2: standard path; `world.applySnapshot(savedGame.worldSnapshot)` populates everything because `world.state.aoe2.*` is already in the snapshot.

**Type discriminator:** `SaveBlob` becomes a discriminated union:
```ts
export type SaveBlob = SaveBlobV1 | SaveBlobV2;
export interface SaveBlobV1 {
  schema: 1;
  seed: string;
  worldSnapshot: WorldSnapshot;
  visibility: VisibilityMapState;        // Top-level, not in sideMaps
  matchState: SerializedMatchState;       // Top-level, not in sideMaps
  sideMaps: SerializedSideMaps;
}
export interface SaveBlobV2 {
  schema: 2;
  seed: string;
  worldSnapshot: WorldSnapshot;           // Contains aoe2.* slots
  // No sideMaps / visibility / matchState — all in worldSnapshot.state
}
```

**Rationale:** Existing user save files in IDB / on disk shouldn't break. The migration happens once per old file at load time. New saves use the cleaner schema-2 format. Per AGENTS.md versioning, this is non-breaking from a user-visible perspective (loaders accept both), so it ships as a c-bump (0.1.6).

### ADR 5 — `saveGame()` flushes bridge state before serializing

**Decision:** `saveGameOps.saveGame()` calls `accessor.flush()` (or equivalent `flushBridgeStateToWorld()`) BEFORE `world.serialize()`. This ensures bridge mutations made between the last `world.step()` and the save trigger (e.g., user queueing training, market trades, AI decision overrides) are captured in the new schema-2 saves.

**Rationale:** ops modules that run outside `world.step()` (UI input handlers, market trades, etc.) mutate bridge maps directly. Without explicit flush, those mutations would only land in `world.state` at the next tick's `output` phase — but if the user saves between mutation and step, the save would contain stale bridge state. Flush-before-serialize closes that gap.

### ADR 6 — TimelinePanel and ReplayController are aoe2-side; civ-engine unchanged

**Decision:** No civ-engine changes for v0.1.6.

**Rationale:** The engine already provides everything we need (Spec 1's `openAt`, Spec 4's BundleViewer if richer navigation is needed, v0.8.13's `bundleHotspots`). Bridge-snapshot is an aoe2-side concern.

### ADR 7 — Three load sources, single Replay action (future Phase 3D)

**Decision:** Future `ReplayLoadDialog` supports three sources (live current, IDB Prior Session, file import); all resolve to a `SessionBundle` and invoke `replayController.enterReplay(bundle)`. The "Prior Sessions" v0.1.5 panel adds a "Replay" button alongside the existing Export/Discard. This is not implemented in v0.1.7 Phase 3C.

**Rationale:** All three sources are useful. Current-session covers "I just had something interesting happen, scrub back." Prior Sessions covers "yesterday's run had a weird bug." File import covers cross-session sharing (agent-recorded bundles).

### ADR 8 — Replay mode pauses live; exit restores

**Decision:** `enterReplay` captures the current live pause state, calls `liveBridge.setPaused(true)`, and stores the live bridge. `exitReplay` restores the captured pause state, so a game that was manually paused before replay remains paused after replay exit. Live World instance is preserved across the replay session.

**Rationale:** Simple model that preserves the user's session. RecordingService continues observing the live world (via direct binding, not bridge cell), so the live recording isn't corrupted by replay scrubbing.

### ADR 9 — Frame-coalesced drag scrubbing (v0.1.7 Phase 3C scope)

**Decision:** While the user drags the scrubber thumb, `scrubTo(tick, { coalesce: true })` does NOT call `replayer.openAt(tick)` immediately. Instead the panel renders a placeholder ("Scrubbing to tick N…") and only commits the openAt on mouseup. Click-on-track and keyboard navigation always commit immediately.

**Rationale:** worst-case `scrubTo` latency is O(snapshotInterval × stepCost) ≈ 500ms. Without coalescing, dragging through a 10-second timeline would cost ~30 seconds of replay churn. Coalescing makes drag feel instant; only the final commit pays the openAt cost.

### ADR 10 — Stateful play() mode caches replay world+bridge across frames

**Decision:** `play()` does NOT call `replayer.openAt(currentTick + 1)` per animation frame. Instead, the controller reuses the `replayContext.world` materialized by `enterReplay()` or the last committed `scrubTo()`, accumulates frame time at `1000 / TPS`, and advances the cached world while the accumulator contains whole ticks:
1. Submit recorded commands at `submissionTick === replayContext.world.tick` via `world.submitWithResult(rc.type, rc.data)` — same algorithm as `SessionReplayer.openAt`'s internal step loop.
2. Call `world.step()` directly on the cached world.
3. Reset the replay accessor from `getReplayWorldContext(world)` so bridge caches re-materialize from freshly-stepped state.
4. Re-read `world.tick` into `displayedTick`.
5. Schedule the next frame only if playback is still active.

Returns to `openAt`-from-snapshot only on committed `scrubTo()` jumps, which replace `replayContext.world` with a fresh world from the closest snapshot. Coalesced scrubs may update `displayedTick` for UI feedback, but failed commits roll display state back to the last committed replay context.

**Rationale:** `replayer.openAt(currentTick + 1)` per frame is O(snapshotInterval) per call. Near tick 999 of a 1000-tick snapshot interval, every frame replays 999 ticks → ~500ms per frame → 2 fps. Stateful play caches the world between frames, paying only one `step()` per simulation-tick advance — same cost as live game. Caveat: this requires us to manually trickle in `bundle.commands` per tick (which is what `openAt` does internally) — the controller pre-builds a `commandsByTick: Map<number, RecordedCommand[]>` from `bundle.commands` once per `enterReplay`.

**Determinism check:** `world.submitWithResult(rc.type, rc.data)` followed by `world.step()` reproduces the exact same execution as the original recording (the engine's command queue + system pipeline are deterministic). Verified by the equivalence invariant in §7.

