# Replay Scrubber Design Iter-4 Review

**Date:** 2026-04-30
**Iteration:** design-4 → produces design-5
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ITERATE (Codex 1 BLOCKER + 2 MAJORs + 1 MINOR; Claude ACCEPT with 5 implementer notes — both reviewers converge: substantive issues from iter-3 verified clean; remaining ones are spec-vs-ground-truth API formalism)

## Codex BLOCKER (real, addressed)

### B1 — §5.6 createWorld(savedGame: null) takes fresh-bootstrap path
v4's §5.6 said "construct world via createWorld scaffolding without savedGame.visibility (savedGame: null)" — but `createWorld(seed, visibility, null)` triggers the FRESH-bootstrap path, seeding fresh tiles before any later snapshot application. `wireBridgeOps` would then close over fresh-world tile ids superseded by `applySnapshot`, breaking schema-2 load/replay equivalence.

**Fix in v5:** §5.6 redesigned. Split `createWorld` into:
- `createWorldSkeleton(seed, dims, accessor)` — registers components/systems/handlers + `bridgeSnapshotSystem`. Does NOT seed tiles or apply snapshot.
- `seedFreshTiles(world, seed)` — extracted fresh-bootstrap logic.

Three load paths converge:
- Fresh: skeleton → seedFreshTiles → fresh visibility/matchState → wireBridgeOps.
- Schema-2: skeleton → applySnapshot → rebuild visibility/matchState from world.state via existing `VisibilityMap.fromState` (no new method needed) → wireBridgeOps.
- Schema-1: skeleton → applySnapshot → migrateLegacySaveBlobToWorldState → (then identical to schema-2 tail) → wireBridgeOps.

**Eliminates dependency on `VisibilityMap.applyState`** (the iter-3 v4 fix had introduced this as a new civ-engine method). v5 keeps the "no civ-engine changes required" goal intact.

## Codex MAJOR (real, addressed)

### M1 — `world.getState<T>(...)` doesn't accept value-type generic
v4 used `world.getState<VisibilityMapState>('aoe2.visibility')` — civ-engine's overload takes the key as the type parameter; the value overload returns `unknown`.

**Fix in v5:** explicit cast: `world.getState('aoe2.visibility') as VisibilityMapState | undefined`. Same pattern in §5.6 + ADR 4 + `BridgeStateAccessor.get` (which already does this internally via `as TNative`).

### M2 — System registration shape: `execute:` not `fn:`, no `ctx` param
v4's `bridgeSnapshotSystem` example used `fn: (world, ctx) => …` — civ-engine's `SystemRegistration` requires `execute: (world) => void` (`world.ts:74-87` / `:51-56`). No `ctx` parameter.

**Fix in v5:** §5.2 specifies a factory pattern `makeBridgeSnapshotSystem(accessor)` that captures the accessor in the system's `execute` closure. `createWorldSkeleton` constructs ONE accessor instance and registers this system with it — bridge ops + system share the same accessor reference.

### M3 — §5.2 vs §8 vs v4-deltas ordering-test mechanism inconsistent
§5.2 said "trace each system's `fn`"; §8 said "test introspects the system list"; v4-deltas line 16 said "probe-system pattern."

**Fix in v5:** all three normalized to the canonical mechanism — instrument each output-phase system's `execute` (test-only setup) to push its `name` onto a per-tick trace array; after one `world.step()`, assert the LAST entry whose `phase === 'output'` is `'bridgeSnapshot'`.

## Codex MINOR / Claude minors (folded)

### F1 — ADR 4 body still says `combatStatesCodec.serialize(map)`
v4-deltas line 13 promised the fix but ADR 4 body wasn't updated. The codec call would fail because `savedGame.sideMaps.combatStates` is already `Array<[K,V]>`, not a `Map`.

**Fix in v5:** ADR 4 body now uses direct `world.setState('aoe2.combatStates', savedGame.sideMaps.combatStates)` — no codec.serialize call needed because `SerializedSideMaps` is already in the codec JSON shape per `saveSchema.ts:103-227`.

### F2 — VisibilityMap.empty / VisibilityMap.applyState don't exist
v4 §5.6 used `VisibilityMap.empty(seed, mapWidth, mapHeight)` and `visibility.applyState(visState)` — neither exists in civ-engine's `visibility-map.ts`.

**Fix in v5:** §5.6 uses existing `new VisibilityMap(W, H)` constructor for placeholder/fresh; existing `VisibilityMap.fromState(state)` static for hydrate. No new methods needed.

### F3 — createWorld({...}) object-form signature doesn't exist
v4 §5.6 used `createWorld({ seed, mapWidth, mapHeight, savedGame: null })` — current signature is positional `createWorld(seed, visibility, savedGame)`.

**Fix in v5:** introduced `createWorldSkeleton(seed, { mapWidth, mapHeight }, accessor)` with config-object form. Existing positional `createWorld` is decomposed into skeleton + (seedFreshTiles | applySnapshot) + wireBridgeOps. The legacy positional signature is replaced; existing callers update to the new flow during Phase A.

### F4 — Tier-1 count "34" still appears in v2-deltas paragraph (NIT)
Historically accurate (v2 indeed said 34 in the body; v3 fixed to 35). The v4-deltas paragraph that describes "v2 said 34, fixed to 35" is correct documentation of the change history.

**Left unchanged.** Not a content bug; it's a historical record.

## Claude ACCEPT verification (all 8 iter-3 fixes verified clean)

Claude ran a comprehensive verification table; every iter-3 specified fix was found landed correctly in v4 against ground truth (lines/file paths cited). The 5 minor findings above are formal API-name mismatches caught during Claude's careful spec-vs-source audit — none invalidate the architecture.

## Process notes for design-5 reviewer

- v5 diff vs v4: §5.6 replaced with the createWorldSkeleton split (3 load paths); §5.2 system shape fixed to `execute:` + factory pattern; §8 + ADR 4 body wording aligned; cast pattern for `getState` documented.
- Verify `createWorldSkeleton` + `seedFreshTiles` decomposition is feasible against the current `createWorld` body (`createWorld.ts`).
- Verify the accessor-via-closure pattern in `makeBridgeSnapshotSystem` actually works (no circular dependency between accessor and world).
- Verify the cast pattern `as VisibilityMapState | undefined` is sound (cast is necessary because `getState` returns `unknown`).
- Both reviewers should converge to ACCEPT in this round; design has reached the convergence point per Claude's iter-4 conclusion ("reviewers are now nitpicking spec API formalism rather than finding real correctness bugs").
