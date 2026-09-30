# Replay Scrubber Design Iter-1 Review

**Date:** 2026-04-30
**Iteration:** design-1 → produces design-2
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ITERATE (both reviewers convergent)

## Convergent BLOCKERs

### B1 — `setState` rejects `Map`/`Set` (Codex BLOCKER + Claude H3)
civ-engine's `world.setState` calls `assertJsonCompatible`, which rejects any object whose prototype is not `Object.prototype` or `null` — `Map` and `Set` instances both fail. v1's `world.state.set('aoe2.combatStates', combatStatesMap)` example would throw at runtime.

**Fix in v2:** All Tier-1 storage uses `Array<[K, V]>` form (mirrors existing `SerializedSideMaps`). New `BridgeStateAccessor` materializes Maps lazily on read, dirty-tracks writes, flushes back as arrays at tick-end. §5.1 has the full code pattern.

### B2 — `createReplayWorld` API mismatch with `SessionReplayer.worldFactory` (Codex BLOCKER)
v1 wanted `createReplayWorld(snapshot) → { world, bridge }`, but `SessionReplayer.fromBundle({ worldFactory })` requires the factory to return only `World`, and `openAt()` returns only `World`. ReplayController had no reliable way to retrieve the replay bridge.

**Fix in v2:** Split into two helpers: `createReplayWorldOnly(snapshot) → World` (matches engine API) and `makeReplayBridge(world) → ReplayBridge` (aoe2-side; reads `world.state.aoe2.*` slots). `ReplayController.scrubTo(tick)` calls `replayer.openAt(tick)` then `makeReplayBridge(world)`. ADR 3 documents this.

## Convergent MAJORs

### M1 — Inventory missing `conversionState` and `buildingCombatStates` (both reviewers)
Both are real `BridgeState` fields, persisted today via SaveBlob. `conversionState` carries in-flight monk-conversion progress; `buildingCombatStates` carries tower attack/range/cooldown.

**Fix in v2:** Both added to Tier-1 in §3. Inventory total: 34 Tier-1 (was 27) + 4 Tier-2 (was 5; villagerOrdinals moved to Tier-1) + 2 Tier-3 + 5 presentation-only.

### M2 — `villagerOrdinals` misclassified (Claude H2 + Codex MAJOR)
v1 said "rebuild by counting villagers per owner." But `entityCreateOps.ts` uses it as a monotonic counter for canonical AoE2 role assignment ("4th villager spawns on gold"). After villager deaths, live-count drops but ordinal does not — they are NOT equivalent. Rebuilding by query would non-deterministically reassign roles for post-load villagers.

**Fix in v2:** moved to Tier-1; storage as `Array<[number, number]>`.

### M3 — `saveGame()` must flush bridge state before serialize (Codex MAJOR)
ADR 4 said new saves write only `worldSnapshot`, but user actions outside `world.step()` (queueing training, market trades, AI overrides) mutate bridge maps directly. Saving immediately after such a mutation would serialize stale `world.state`.

**Fix in v2:** new ADR 5 — `saveGameOps.saveGame()` calls `accessor.flush()` before `world.serialize()`. Closes the gap.

### M4 — ADR 2 perf rationale wrong (Claude H4 + Codex MAJOR/PERF)
v1 cited "one TickDiff entry per setState call" — but `world.ts:1577-1593`'s `getStateDirty` deduplicates via `stateDirtyKeys` Set. Actual costs are `assertJsonCompatible` traversal, `jsonFingerprint` on dirty keys, structured-clone allocation pressure. Tick-end sync is still the right conclusion; the rationale was wrong.

**Fix in v2:** ADR 2's rationale rewritten to cite the real costs.

### M5 — Phase name "LATE" doesn't exist (Codex MAJOR)
civ-engine phases are `input | preUpdate | update | postUpdate | output`. v1's "LATE phase" is fictional.

**Fix in v2:** `output` phase, registered last via `before: []`. §5.2 + ADR 2 corrected.

### M6 — Save-schema strict version check rejects schema-1 once we bump (Claude H5 + Codex MAJOR)
`createSimulationBridge.ts:140-144` throws unconditionally on `savedGame.schema !== SAVE_SCHEMA_VERSION`. ADR 4 said "back-compat for schema 1" but the loader as-written rejects schema 1 the moment we bump to 2.

**Fix in v2:** ADR 4 explicitly relaxes the check to `(savedGame.schema === 1 || savedGame.schema === 2)`. New `migrateLegacySideMapsToWorldState(world, sideMaps)` step copies schema-1 SaveBlob.sideMaps into `world.state.aoe2.*` after `applySnapshot`.

## Claude HIGH (real, addressed)

### H6 — Versioning inconsistent
v1 said "0.1.5 → 0.1.6 b-bump" — but per AGENTS.md b-bump = "bump b and reset c" → 0.2.0. With back-compat for schema-1, this is non-breaking → c-bump → 0.1.6.

**Fix in v2:** picked **0.1.6 c-bump** with rationale documented in §11.

## Claude MEDIUMs (addressed)

### M2 (Claude) — Cache-coherence model hand-waved
Where does the per-tick Map cache live? When invalidated?

**Fix in v2:** Full `BridgeStateAccessor` class spec in §5.1. Cache lives per-bridge instance; lazy-materialize on first read; dirty-tracked per-slot; flushed at tick-end. Reset events: after `applySnapshot`, on `enterReplay`/`exitReplay`.

### M3 (Claude) — `play()` semantics ambiguous (potential divergence bug)
v1 said "step every animation frame" — could be misread as `world.step()` on the replay world (which has no command queue → diverges immediately).

**Fix in v2:** §5.4 explicitly pins `play()` to `replayer.openAt(currentTick + 1)` per frame. Implementer note added: do NOT call `world.step()` on the replay world.

### M4 (Claude) — `bridgeSnapshotSystem` ordering not specified
For replay-equivalence to hold, the system must commit before the recorder's snapshot.

**Fix in v2:** registered last in `output` via `before: []`. Recorder snapshots fire after output completes (per `world.ts:1746-1763`).

### M5 (Claude) — RecordingService should keep observing live world during replay
Annotation-ui design noted "consumers must call `bridgeRef().world` rather than capturing this reference once" — but the recorder SHOULD capture the live world reference once and keep it.

**Fix in v2:** §5.6 explicit callout — RecordingService binds to live world via direct reference (NOT through bridgeRef().world). Replay-mode bridge swaps don't move it. Live recording continues in background.

### M6 (Claude) — Perf estimate too optimistic
v1 claimed `<1ms per tick`. Realistic with 32-34 slots × JSON validation: 5-20 ms.

**Fix in v2:** §9 revised. `bridgeSnapshotPerf.test.ts` mandatory pre-Phase B; if cost is prohibitive, fallback options documented (batch every-Nth-tick, reduce snapshotInterval, engine-side Map support).

### M7 (Claude) — Scrub UX 500ms latency floor for drag
v1 deferred frame-coalescing to v0.1.7 — but that ships interactive scrubbing with a 500ms-per-drag latency floor, coloring the whole feature.

**Fix in v2:** new ADR 9 — frame-coalesced drag promoted into v0.1.6 scope. Mid-drag shows placeholder; only final mouseup triggers `openAt`. Click and keyboard scrubbing still commit immediately.

## Claude LOWs (folded silently)

### L1 — Phase A timeline optimistic
1.5 weeks for 34 slots × ~150-200 mechanical refactor sites + cache design + dirty tracking + serialization + back-compat plumbing → unrealistic. Realistic: 2.5-3 weeks for Phase A alone.

**Fix in v2:** Phase A budget revised to ~3 weeks; total ~4 weeks.

### L2 — Most Open Questions had obvious answers
Q3 (engineHalted during replay), Q4 (mid-tick entry), Q5 (annotation hotkeys disabled) are not really ambiguous.

**Fix in v2:** §12 Open Questions narrowed to Q1 (Alt+T) and Q2 (panel placement). Others moved to settled positions.

### L3 — Test strategy missing perf regression
**Fix in v2:** `bridgeSnapshotPerf.test.ts` added to test plan.

### L4 — Live-bundle "round-trip" unnecessary
v1 said current-session loader "exports the live bundle and loads it" — JSON-roundtripping the in-memory bundle is wasted work.

**Fix in v2:** §5.5 doesn't specify export-then-import; v2 implementer can pass the in-memory reference directly.

## Process notes for design-2 reviewer

- v2 is largely a rewrite of §5 (API), §3 (inventory), and ADRs 1-9; same overall architecture.
- Verify the `BridgeStateAccessor` cache model is sound and won't cause cross-system staleness within a tick.
- Verify the `worldFactory` + `makeReplayBridge` split actually works against `SessionReplayer.fromBundle`'s contract.
- Verify the schema-1 → schema-2 migration path is complete (every Tier-1 slot has a legacy → new mapping).
- Verify the perf-benchmark threshold (5ms target) is realistic given the JSON validation cost.
