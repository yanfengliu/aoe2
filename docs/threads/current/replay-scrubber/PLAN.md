# aoe2 v0.1.6 Implementation Plan — Phase A: Bridge-State Migration

**Status:** Draft v1 (2026-04-30). Scope: Phase A of the replay-scrubber DESIGN spec only. Phases B-F (ReplayController, TimelinePanel UI, scrubber, playback) are deferred to v0.1.7 pending architectural decision per the iter-11 finding (`design-11/REVIEW.md`).

**Spec reference:** `docs/threads/current/replay-scrubber/DESIGN.md` v12.

## Goal

Migrate aoe2's 35 Tier-1 + 3 Tier-3 bridge-state slots into `world.state.aoe2.*` so every `world.serialize()` snapshot captures the full bridge layer. This is independently valuable (cleaner schema-2 saves, bridge-state visibility in BundleViewer/Hotspots for AI/agent analysis) AND is the prerequisite for any future replay model.

## Non-goals (v0.1.6)

- ReplayController, TimelinePanel UI, scrubber controls, replay-mode bridge swap.
- ADR 6 / 7 / 8 / 9 / 10 (replay-side decisions) are forward-looking design only.
- `wireReplaySystems`, `createReplayWorldOnly`, replay-side WeakMap context channel — all deferred.

## Phases (each lands as a standalone commit on `main`)

### Phase A1 — Codec dispatch + `BridgeStateAccessor` (v0.1.5 → 0.1.5.1)

**Deliverable:** the per-slot serializer/deserializer table + accessor class. No call-site migrations yet.

**Files:**
- `src/game/simulation/bridge/bridgeStateSerialize.ts` (NEW) — `SlotCodec<TNative, TJson>` interface + 35 Tier-1 codecs + `SLOT_CODECS_BY_KEY` lookup. Each codec mirrors existing `SerializedSideMaps` JSON shape per `saveSchema.ts:103-227`.
- `src/game/simulation/bridge/bridgeStateAccessor.ts` (NEW) — `BridgeStateAccessor` class with `requireWorld()` guard, lazy `() => World | undefined` getter, `get<TNative, TJson>(codec)`, `markDirty(slot)`, `flush()`, `reset()`, plus `mutate(accessor, codec, fn)` helper.
- `src/game/simulation/bridge/visibilityCell.ts` (NEW) — `VisibilityCell` class with `_dirty` flag, `markDirty()`, `replace()`, `isDirty()`, `clearDirty()`.
- `src/game/simulation/bridge/replayWorldContext.ts` (DEFER to v0.1.7) — not needed for migration.

**Tests:**
- `tests/bridge/bridgeStateAccessor.test.ts` — cache materialize / dirty-track / flush / reset; requireWorld guard fires on premature call.
- `tests/bridge/bridgeStateSerialize.test.ts` — round-trip every codec (e.g., `Map<number, Set<X>>` → JSON → `Map<number, Set<X>>` preserves identity).
- `tests/bridge/visibilityCell.test.ts` — dirty-bit semantics; `replace` auto-marks dirty.

**Gates:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Multi-CLI review on the diff. No version bump until A1 + A2 + A3 land together (since each phase alone is incomplete without the others).

### Phase A2 — `tier3SyncSystem` + `bridgeSnapshotSystem` + `registerOutputTail`

**Deliverable:** the output-phase tail systems and registration helper.

**Files:**
- `src/game/simulation/bridge/tier3SyncSystem.ts` (NEW) — factory `makeTier3SyncSystem(visibilityCell, matchState)` returning `SystemRegistration` with `phase: 'output'`. Body: gated visibility write via `visibilityCell.isDirty()` + `serializeMatchState` (strips derived fields).
- `src/game/simulation/bridge/bridgeSnapshotSystem.ts` (NEW) — factory `makeBridgeSnapshotSystem(accessor)` returning `SystemRegistration` with `phase: 'output'`. Body: `accessor.flush()`.
- `src/game/simulation/bridge/registerOutputTail.ts` (NEW) — `registerOutputTail(world, accessor, visibilityCell, matchState)` registers the two systems via `world.registerSystem` in the order `[tier3Sync, bridgeSnapshot]`.
- `src/game/simulation/saveSchema.ts` (MOD) — add `PersistedMatchState = Omit<SerializedMatchState, 'wonderCountdownTicks' | 'relicCountdownTicks'>`. Add `serializeMatchState(m: MatchState): PersistedMatchState`. Add `stripDerivedFields(m: SerializedMatchState): PersistedMatchState`.

**Tests:**
- `tests/bridge/outputTail.test.ts` — register tier3Sync + bridgeSnapshot in a fresh `World<GameEvents, GameCommands>`. Mutate visibility cell + matchState + a Tier-1 slot. Run one `world.step()`. Assert `world.getState('aoe2.visibility')`, `'aoe2.matchState'`, and the Tier-1 slot all reflect the mutations.
- `tests/bridge/orderingTest.test.ts` — instrument every output-phase system's `execute` to push name to a trace array. After one `step()`, assert last two entries are `['tier3Sync', 'bridgeSnapshot']`. (CI-protected ordering invariant.)
- Perf benchmark `tests/bridge/bridgeSnapshotPerf.test.ts` — measure combined Tier-1 + Tier-3 + recorder sink writes < 5 ms/tick under representative load (8-player late-game scenario, ~30k explored cells/player).

### Phase A3 — `createWorldSkeleton` + `seedFreshTiles` split + load paths + `bootstrapFlush`

**Deliverable:** the 3-path load flow with explicit ordering: `matchState` before skeleton, applySnapshot, hydrate-in-place, `wireBridgeOps`, `bootstrapFlush`.

**Files:**
- `src/game/simulation/bridge/createWorldSkeleton.ts` (NEW) — `createWorldSkeleton(seed, dims, _accessor, _visibilityCell, _matchState): GameWorld` registers ECS components only. Underscore-prefixed unused params signal documentation-only role for the construction-order ordering.
- `src/game/simulation/bridge/seedFreshTiles.ts` (NEW) — `seedFreshTiles(world, seed)`: tile-grid construction extracted from current `createWorld.ts`. Building/unit/resource scenario seeding stays inside `wireBridgeOps`/`seedFreshScenario`.
- `src/game/simulation/bridge/extractDimsFromSnapshot.ts` (NEW) — resolution order: `aoe2.bridgeMeta` → `aoe2.visibility.{width,height}` → throw `MissingMapDimsError`.
- `src/game/simulation/bridge/bootstrapFlush.ts` (NEW) — `bootstrapFlush(world, accessor, visibilityCell, matchState)` runs the same writes as one tick of tier3Sync + bridgeSnapshot, called BEFORE `RecordingService.connect()`.
- `src/game/simulation/bridge/createWorld.ts` (MAJOR REFACTOR) — replaced by the 3-path flow:
  - `freshGameFlow(seed, mapWidth, mapHeight)`
  - `schema2Flow(savedGame: SaveBlobV2)`
  - `schema1Flow(savedGame: SaveBlobV1)` (uses `migrateLegacySaveBlobToWorldState` to migrate top-level fields)
  - Each ends with `wireBridgeOps(world, visibilityCell, matchState, accessor, ...)` then `bootstrapFlush(...)` then `return bridge`.
- `src/game/simulation/bridge/wireBridgeOps.ts` (MOD) — at the END of body, after `registerBridgeSystems`, call `registerOutputTail(world, accessor, visibilityCell, matchState)`. No other behavior change.
- `src/game/simulation/bridge/scenarioSeedOps.ts` (MOD) — `migrateLegacySaveBlobToWorldState(world, savedGame, dims)` extended to also seed `aoe2.bridgeMeta = dims` and strip derived fields from legacy `savedGame.matchState` via `stripDerivedFields`.

**Tests:**
- `tests/bridge/loadPaths.test.ts` — fresh, schema-2, schema-1 all reach a structurally equivalent bridge state. Closure capture invariant verified: `matchState` mutated by `Object.assign` is seen by registered system closures.
- `tests/bridge/bootstrapFlush.test.ts` — initial recorder snapshot (taken on `RecordingService.connect()`) carries `aoe2.visibility`, `aoe2.matchState`, `aoe2.bridgeMeta`, plus a sample Tier-1 slot. Equivalence test: `replayer.openAt(startTick)` from the resulting bundle reconstructs the same bridge state.

### Phase A4 — Migrate ops modules to use `BridgeStateAccessor`

**Deliverable:** every Tier-1 ops module reads/mutates via the accessor + codec, replacing direct `BridgeState` field access.

**Approach:** incremental — one slot per commit (or a small group of related slots per commit). 35 Tier-1 slots → estimated 8-12 commits. Each commit:
1. Pick a slot or group (e.g., `combatStates` + `buildingHealthStates`).
2. Update the relevant ops modules to call `accessor.get(slotCodec)` + `accessor.markDirty(slotCodec.slot)` instead of `state.combatStates`.
3. Verify the system that consumes this slot still works (test + manual smoke).

**Slot ordering** (least-coupled first, to validate the pattern):
1. `marketExchangeRates` (plain object, single mutator).
2. `combatStates` + `buildingCombatStates` + `buildingHealthStates` (combat triple).
3. `wildlifeStates`, `conversionState`.
4. `visibilityCell` + `matchState` (Tier-3, already cell/object — wire dirty-bit + serializeMatchState).
5. `wonderCountdowns` + `relicCountdowns` + `relicCountdownOverrides`.
6. `garrisonedByBuilding` + `monksByOwner` (Tier-2 derivations stay in-memory; verify still derivable post-load).
7. `playerResources`, `population`, `playerScoreCounters`.
8. `productionQueues`, `inFlightTechByOwner`.
9. `unitCommands`, `movePathCache`, `gathererDropOffStuckSinceTick`, `sheepMoveOrders`.
10. `lastSeenStatic` (per-player fog memory; the most complex — Map<K, Map<K2, V>>).
11. `trackedVisibilitySources` (with the new fingerprint cache for `syncVisibilitySources`).
12. `researchedTechnologies` (Map<K, Set<V>>).
13. … remaining slots …

**Tests:**
- After each slot commit: re-run the existing suite. Add a slot-specific round-trip test (mutate via ops module → flush → serialize → deserialize → assert structural equality).

### Phase A5 — `syncVisibilitySources` fingerprint cache + dirty-bit lifecycle

**Deliverable:** the v11 lifecycle fix for the visibility dirty bit. Per-(player, sourceId) `{ x, y, radius }` cache; cleanup on removeSource + player-change scenarios.

**Files:**
- `src/game/simulation/bridge/visibility.ts` (MOD) — `syncVisibilitySources` adds the fingerprint cache. Active loop, removeSource loop, and player-change cleanup all maintain the invariant `fingerprints.has(key) ⟺ trackedSources.has(sourceId) AND trackedSources.get(sourceId) === currentPlayerOf(sourceId)`.

**Tests:**
- `tests/bridge/syncVisibilitySources.test.ts` — scenarios from iter-11 review:
  1. No movement: cell.markDirty NOT called.
  2. Source moves: setSource called, cell.markDirty called.
  3. Source removed: removeSource called, fingerprint deleted, cell.markDirty called.
  4. Sheep claim flip: source removed (fingerprint dropped), then re-added at same coords by same player (fingerprint absent → setSource fires).
  5. Monk conversion: source's playerId changes; old-player fingerprint dropped, new-player fingerprint set, cell.markDirty fires.
  6. Garrison/ungarrison: source removed on garrison, re-added on ungarrison; lifecycle clean.

### Phase A6 — Schema-2 save format + version bump (v0.1.5.x → 0.1.6)

**Deliverable:** `SAVE_SCHEMA_VERSION = 2`. New saves contain `seed + worldSnapshot` only (Tier-1 + Tier-3 all in `world.state.aoe2.*`). Legacy schema-1 saves continue to load via `migrateLegacySaveBlobToWorldState`.

**Files:**
- `src/game/persistence/saveGameOps.ts` (MOD) — `saveGame()` calls `accessor.flush()` + tier3Sync writes BEFORE `world.serialize()`. Output is `SaveBlobV2 = { schema: 2, seed, worldSnapshot }`. Drops `sideMaps`, `visibility`, `matchState` top-level fields.
- `src/game/persistence/loadGameOps.ts` (MOD) — discriminated-union `SaveBlob = SaveBlobV1 | SaveBlobV2`. v2 path goes through `schema2Flow`; v1 path goes through `schema1Flow`.
- `src/game/persistence/saveSchema.ts` (MOD) — bump `SAVE_SCHEMA_VERSION = 2`. Define both `SaveBlobV1` and `SaveBlobV2` interfaces.

**Tests:**
- `tests/persistence/schema2RoundTrip.test.ts` — fresh game → save (schema 2) → load → bridge state structurally equal.
- `tests/persistence/schema1BackCompat.test.ts` — load a legacy v0.1.5 save (schema 1) → migration runs → bridge state matches expected.

### Phase A7 — Equivalence invariant test + perf gate (v0.1.6 release)

**Deliverable:** `tests/replay/bridge-state-roundtrip.test.ts` — the §7 core invariant (sans the play-by-step assertion that's deferred to v0.1.7): after running N ticks of a fresh game, `world.serialize()` followed by load + `applySnapshot` reconstructs an equivalent bridge state. Frame-by-frame deep equality of all Tier-1 + Tier-3 slots.

**Tests:**
- The equivalence test runs across multiple game shapes: small skirmish, mid-game (with monk conversions), late-game (with tower combat + wonders).
- Perf benchmark passes (combined Tier-1 + Tier-3 + recorder sink < 5 ms/tick).

**Version bump:** `0.1.5.x → 0.1.6` final commit.

**Docs updates** (per AGENTS.md mandatory checklist):
- `docs/changelog.md` — v0.1.6 entry: "bridge-state migration to world.state.aoe2.*; schema-2 saves; schema-1 back-compat. Replay scrubber UI deferred to v0.1.7."
- `docs/devlog/summary.md` + `docs/devlog/detailed/<latest>.md` — full task entry.
- `docs/architecture/ARCHITECTURE.md` — Component Map row for the new bridge-state migration; Boundaries paragraph; tick lifecycle ASCII reflects the new tier3Sync + bridgeSnapshot output tail.
- `docs/architecture/drift-log.md` — entry for the migration.
- `docs/architecture/decisions.md` — Key Architectural Decision: bridge state lives in world.state via per-slot codecs.
- `docs/api-reference.md` — N/A (no public API changes; aoe2 is the consumer).
- `docs/guides/<relevant>.md` — `systems-and-simulation.md` if it mentions bridge state shape; `concepts.md` if it tracks side-map slots.
- `package.json` — version bump.
- README badge.

## Multi-CLI review checkpoints

Each phase commit triggers multi-CLI review per AGENTS.md. Synthesize into `docs/threads/current/replay-scrubber/<date>/impl-N/REVIEW.md`. Address findings before proceeding to the next phase.

## Risks + mitigations

- **Slot-by-slot migration touches many files** — mitigate via incremental commits (one slot or small group per commit) with full test suite green before each.
- **Closure capture invariant subtle** — covered by `tests/bridge/loadPaths.test.ts` verifying the `Object.assign(matchState, msState)` mutation is seen by registered system closures.
- **Schema-1 back-compat regression** — explicit test `tests/persistence/schema1BackCompat.test.ts` runs against a captured legacy SaveBlob fixture.
- **Performance regression on tier3Sync write path** — perf benchmark (Phase A2) verifies combined cost < 5 ms/tick. If exceeded, fallback ladder: every-Nth-tick batching, larger snapshotInterval, or expose `setSource` boolean return from civ-engine (deferred to v0.1.7).

## Out-of-scope notes

The replay UI sections of DESIGN.md (§5.3 createReplayWorldOnly, §5.4 ReplayController, §5.5 TimelinePanel, §5.7 Annotation UI replay mode, ADRs 6-10) describe the v0.1.7+ surface. Phase A delivers the foundation; the architectural decision (commandify aoe2 input vs diff-playback via BundleViewer vs other) goes to v0.1.7 with user input.
