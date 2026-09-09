# Replay Scrubber Design Iter-2 Review

**Date:** 2026-04-30
**Iteration:** design-2 → produces design-3
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ITERATE (both reviewers convergent on 2 BLOCKERs + 3 MAJORs + 2 minors)

## Convergent BLOCKERs

### B1 (Codex BLOCKER + Claude M-1) — `world.state.get/set` API doesn't exist
v2's `BridgeStateAccessor` used `this._world.state.get<T>(slot)` / `this._world.state.set(slot, value)`. civ-engine's actual API is `world.getState(key)` / `world.setState(key, value)` as METHODS (`world.ts:1369-1394`); `stateStore` is a private Map with no public `.state` property. Code wouldn't compile.

**Fix in v3:** `BridgeStateAccessor` (§5.1) now uses `world.getState<T>(slot)` / `world.setState(slot, value)` throughout. Verified against `world.ts:1369-1394`.

### B2 (Codex BLOCKER + Claude M-5) — Generic `Array.from(map)` insufficient for nested Maps/Sets
- `researchedTechnologies: Map<number, Set<ResearchableTechnologyType>>` — `Array.from` preserves the inner `Set`.
- `lastSeenStatic: Map<number, Map<number, MemoryEntry>>` — `Array.from` preserves the inner `Map`.
- `marketExchangeRates: { food, wood, stone }` — already plain object; `Array.from` would produce nonsense.

`assertJsonCompatible` rejects all three.

**Fix in v3:** `bridgeStateSerialize.ts` introduces a `SlotCodec<TNative, TJson>` interface with explicit `serialize` / `deserialize` per slot. Each Tier-1 slot has its own codec mirroring the existing `SerializedSideMaps` shape. `BridgeStateAccessor.flush()` dispatches via `SLOT_CODECS_BY_KEY.get(slot)`. §5.1 has worked examples for the four shape patterns (flat Map, Map<Set>, Map<Map>, plain object).

## Convergent MAJORs

### M1 (Codex MAJOR + Claude M-3) — `before: []` doesn't make a system run last
civ-engine's topological scheduler treats empty `before`/`after` as default (no constraints). Constraint-free systems sort by registration order. A future output system declared without constraints could be registered after `bridgeSnapshotSystem` and run after the flush.

**Fix in v3:** §5.2 + ADR 2 corrected. The ordering invariant is now: register `bridgeSnapshotSystem` LAST in `createWorld`'s output-phase registration sequence; an ordering test enforces that no later output system is registered. Documented as a CI-protected invariant.

### M2 (Codex MAJOR + Claude M-2) — Schema-1 migration omits visibility + matchState
v2's `migrateLegacySideMapsToWorldState` only handled `savedGame.sideMaps`. But schema-1 `SaveBlob` carries `visibility: VisibilityMapState` and `matchState: SerializedMatchState` as TOP-LEVEL fields, NOT in sideMaps. After a schema-1 load, `world.state.aoe2.visibility` and `world.state.aoe2.matchState` would be undefined.

**Fix in v3:** ADR 4 expanded. Migration helper renamed to `migrateLegacySaveBlobToWorldState(world, savedGame)` (accepts the full SaveBlob); copies all THREE legacy top-level fields (sideMaps + visibility + matchState) into `world.state.aoe2.*` slots. SaveBlob made a discriminated union (`SaveBlobV1 | SaveBlobV2`) so the type system enforces the migration contract.

### M3 (Codex MAJOR/PERF) — `play()` per-frame `openAt` is O(snapshotInterval)
v2 specified `play()` calls `replayer.openAt(currentTick + 1)` per animation frame. Each `openAt` rebuilds from the closest snapshot, so playback near tick 999 of a 1000-tick interval would replay ~999 steps per frame → ~2 fps.

**Fix in v3:** new ADR 10 — stateful play mode. Controller maintains `_playState = { world, bridge, accessor, tick }` cell across frames. Each frame submits recorded commands at `submissionTick === _playState.tick`, calls `world.step()` directly, increments tick. Same algorithm as `openAt`'s internal step loop, but per-tick instead of from-snapshot. Returns to `openAt`-from-snapshot only on `scrubTo()` jumps. §5.4 + §10 spell out the flow.

## Claude MEDIUM (real, addressed)

### M-4 — ADR 2 fingerprint citation wrong
v2 said `jsonFingerprint` runs "per dirty key per tick during `getStateDirty`." Actually `getStateDirty` SKIPS dirty keys (`if (changed.has(key)) continue`); fingerprint runs in `clearStateDirty` (`world.ts:1490-1497`) at tick start for non-dirty keys. The dominant per-call write cost is `assertJsonCompatible` (linear in nested object size), not fingerprint.

**Fix in v3:** ADR 2 rewritten with the corrected cost model. Tick-end sync conclusion unchanged.

## Minors (folded silently)

### m-1 — Tier-1 count off
v2 prose said 34, table has 35 entries. Actual count: 35 Tier-1 + 4 Tier-2 + 2 Tier-3 + 5 presentation-only = 46 total inventoried items.

**Fix in v3:** prose corrected to 35.

### m-2 — Line number off
strict-eq check is at `createSimulationBridge.ts:140-144` (the throw is on lines 141-143), not just :140.

**Fix in v3:** corrected.

## Verified clean (Claude spot-checks)

- Storage shape `Array<[K, V]>` IS JsonValue-compatible (where `K`/`V` are themselves JsonValue) — the issue was nested Maps/Sets, not the array shape itself.
- `worldFactory: (snapshot) => World` signature + `openAt` return type — `createReplayWorldOnly` + `makeReplayBridge` split correctly aligns with engine API.
- Recorder snapshot timing (`world.serialize()` fires after output phase completes via diff-listener loop) — `bridgeSnapshotSystem` flushing in output (last) → world.state ready before serialize. Confirmed.
- BridgeStateAccessor cache model for cross-system reads in same tick — single accessor per bridge, lazy materialize, cached refs stable within tick.
- ADR 4 sideMaps mapping — every field in `SerializedSideMaps` maps cleanly to a Tier-1 codec.
- Versioning 0.1.6 c-bump — appropriate given schema-1 back-compat preserved.

## Process notes for design-3 reviewer

- v3 is a tight surgical revision: §5.1 rewritten with codec dispatch + correct API; §5.2 ordering invariant; §5.4 stateful play flow; ADR 4 expanded for visibility+matchState migration; new ADR 10 for play(); ADR 2 perf rationale corrected; counts/line numbers fixed.
- Verify each codec example actually produces JsonValue output (no Map/Set leaking through).
- Verify ADR 10's stateful play correctly reproduces openAt's deterministic step-loop semantics.
- Verify SaveBlobV1 | SaveBlobV2 discriminated-union pattern is sound (loader can dispatch on `savedGame.schema`).
- Verify the ordering test design actually catches a misregistered output system.
