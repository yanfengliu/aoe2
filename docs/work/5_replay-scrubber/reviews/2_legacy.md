# Replay Scrubber Design Iter-3 Review

**Date:** 2026-04-30
**Iteration:** design-3 → produces design-4
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ITERATE (Codex 1 BLOCKER + 4 MAJORs; Claude 1 MAJOR + 6 minors/NITs; substantive iter-2 fixes verified clean)

## Codex BLOCKER (real, addressed)

### B1 — Schema-2 load underspecified for visibility + matchState
v3 removed top-level `visibility` / `matchState` from `SaveBlobV2` saying `world.applySnapshot` is enough — but current `createSimulationBridge.ts:148-149` constructs `VisibilityMap.fromState(savedGame.visibility)` BEFORE `createWorld` returns. For schema-2 where visibility lives in `world.state.aoe2.visibility`, the constructor path can't work as-is.

**Fix in v4:** new §5.6 spells out the schema-2 load flow:
1. Construct world via createWorld scaffolding without `savedGame.visibility` (key: `savedGame: null` for the visibility/matchState construction step).
2. `world.applySnapshot(savedGame.worldSnapshot)` — populates `world.state.aoe2.*`.
3. Extract `VisibilityMapState` from `world.getState('aoe2.visibility')` and call `visibility.applyState(...)` (new mutate-in-place method on VisibilityMap).
4. Extract `SerializedMatchState` from `world.getState('aoe2.matchState')` and `Object.assign` into the live `MatchState` object.

`VisibilityMap.applyState(state)` is identified as a new method needed (mutate-in-place version of `fromState`) so existing references to the live VisibilityMap instance (held by `bridge.projector`, etc.) don't dangle.

## Convergent MAJORs

### M1 — `pause()` flow loses played-to tick (Codex MAJOR)
v3 `pause()` flow nulled `_playState` BEFORE assigning `_currentReplayContext.tick = _playState?.tick ?? _currentReplayContext.tick`. By the time the assignment runs, `_playState` is null, so `??` falls through to the stale value. Resuming play would submit commands for an old tick against a world that already advanced.

**Fix in v4:** §5.4 reorders — capture `_playState?.tick` into a local first, then null `_playState`, then update `_currentReplayContext` from the local.

### M2 — Test plan contradicts ADR 10 (Codex MAJOR)
v3 §8 still asserted "`play()` calls `replayer.openAt`, NOT `world.step()`" — leftover wording from v2. ADR 10 says the opposite (stateful play uses `world.step()` directly).

**Fix in v4:** §8 inverted. Now: "`play()` reuses cached `_playState.world` across frames; calls `submitWithResult` + `world.step()` directly per frame, NOT `replayer.openAt(tick+1)` per frame (per ADR 10). Regression test spies on `replayer.openAt` and asserts it's called at most once per `scrubTo()` / `enterReplay()`."

### M3 — Ordering invariant wording inconsistent (Codex MAJOR)
v3 §5.2 was correct (registration-order tiebreaker) but the file-layout listing, architecture diagram, and ADR 2 still said "last via `before: []`."

**Fix in v4:** all three places normalized to "registered LAST in createWorld's output-phase registration sequence; CI-protected by ordering test."

### M4 — Tier-1 count "34" still in 4 places (Codex MAJOR + Claude Finding 2)
§1 / §7 / §9 / §12 all said "34 Tier-1" while §3 table has 35.

**Fix in v4:** search-replace `34 Tier-1` → `35 Tier-1` throughout.

### M5 — Stale §5.1 duplicate API block (Claude Finding 1 — MAJOR)
Lines ~370-398 of v3 §5.1 still showed v2's retired API: `accessor.getMap<K, V>(slot)` (string-keyed) and `mutate(accessor, slot: string, fn)` — contradicting the codec-keyed API defined a few lines earlier.

**Fix in v4:** stale duplicate block deleted. The earlier codec-keyed `accessor.get(combatStatesCodec)` example is now the single reference pattern.

## Claude minors (real, addressed)

### F3 (minor) — ADR 4 migration wording misleading
v3 said `combatStatesCodec.serialize(savedGame.sideMaps.combatStates)`. But `savedGame.sideMaps.combatStates` is ALREADY in `Array<[K, V]>` form (the existing `SerializedSideMaps` shape), not a `Map`.

**Fix in v4:** ADR 4 updated to direct `setState`: `world.setState('aoe2.combatStates', savedGame.sideMaps.combatStates)` — no re-serialization needed because v3 codec JSON shapes mirror `SerializedSideMaps` field-for-field.

### F4 (minor) — `play()` endTick check ignores incomplete bundles
v3 used `bundle.metadata.endTick` as the upper bound. For incomplete bundles, `persistedEndTick < endTick`, and `openAt` enforces `persistedEndTick`. Stepping past `persistedEndTick` in stateful play would advance the world but be unreachable via `openAt` from any subsequent `scrubTo`.

**Fix in v4:** ADR 10 + §5.4 use `upper = bundle.metadata.incomplete ? persistedEndTick : endTick`, matching `openAt`'s upper bound at `session-replayer.ts:206`.

### F5 (minor) — `_advanceOneFrame` lacks `hasCommandHandler` defensive check
`openAt` (`session-replayer.ts:247-252`) checks `world.hasCommandHandler(rc.type)` before submit. v3's `_advanceOneFrame` elided this.

**Fix in v4:** ADR 10 step 2 now defensively checks; throws `ReplayHandlerMissingError` for parity with `openAt`.

### F6 (minor) — Ordering-test introspection mechanism unspecified
`World.resolvedSystemOrder` is private; v3 said "ordering test introspects the world's compiled system list" without saying how.

**Fix in v4:** §5.2 now specifies the trace pattern: instrument each output-phase system's `fn` (test setup) to push its `name` onto a per-tick trace array; assert the LAST output entry is `'bridgeSnapshot'`.

### F7 (NIT) — `BridgeStateAccessor.get` cache-miss sentinel
v3 used `if (cached === undefined)` — would always miss for any future codec returning `undefined` as a valid native.

**Fix in v4:** changed to `if (!this._cache.has(codec.slot))`.

## NIT — ADR 2 fingerprint citation slightly off (Claude verified clean)
v3's "fingerprints non-dirty keys during getStateDirty" — actually `clearStateDirty` (`world.ts:1490-1497`) fingerprints ALL keys at tick-start; `getStateDirty` SKIPS already-dirty keys.

**Fix in v4:** prose tightened. Conclusion (per-tick cost is fixed, write-frequency-independent) unchanged.

## Verified clean (Claude spot-checks)

All iter-2 substantive fixes verified holding:
- `world.getState/setState` API (`world.ts:1369-1394`) ✓
- All 4 codec shape patterns produce JsonValue ✓
- `bridgeSnapshotSystem` registration-order mechanism via `world.ts:2089-2134` + `2415-2480` ✓
- ADR 4 `SaveBlobV1 | SaveBlobV2` discriminated union ✓
- ADR 10 stateful play algorithm matches `session-replayer.ts:244-256` ✓
- Versioning 0.1.6 c-bump correct ✓

## Process notes for design-4 reviewer

- v4 diff vs v3: §5.1 stale block deleted; §5.4 pause() reordered; §5.2 ordering test mechanism specified; new §5.6 schema-2 load flow; ADR 10 hardened with `hasCommandHandler` + `incomplete-aware bound`; counts/wording normalized; accessor.get uses `has`.
- Verify `VisibilityMap.applyState(state)` is feasible (mutate-in-place semantics).
- Verify schema-1 path → migrateLegacySaveBlobToWorldState → applySnapshot → §5.6 step 4 still works (i.e., the schema-1 visibility/matchState top-level fields are correctly seeded into world.state by the migration helper before §5.6 reads from world.state).
- Verify ADR 10's `_advanceOneFrame` is bounded equivalent to `openAt`'s step loop.
