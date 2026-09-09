# Replay Scrubber Design Iter-7 Review

**Date:** 2026-04-30
**Iteration:** design-7 → produces design-8
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ITERATE (Codex 2 MAJORs; Claude 1 MAJOR + 2 NITs — different surfaces, but all real correctness gaps that v7 introduced or left open)

## Codex MAJOR — `enterReplay()` doesn't seed `_currentReplayContext`

v7's `enterReplay` flow stopped at `bridgeCell.replace(replayBridge)` + `emit('replay')`. `_currentReplayContext` was only populated in `scrubTo()`. Pressing "play" right after entering replay would dereference undefined or miss the accessor.

**Fix in v8:** §5.4 `enterReplay(tick)` now seeds `_currentReplayContext = { world, bridge, accessor: replayBridge.accessor, visibilityCell: replayBridge.visibilityCell, matchState: replayBridge.matchState, tick }` after `makeReplayBridge`, mirroring `scrubTo`'s tail. Emits `onTickChange(tick)` too.

## Codex MAJOR — `matchState` lifecycle inverted

v7's PATH B/C in §5.6 created `matchState` AFTER `createWorldSkeleton(...)`. But skeleton internally calls `registerAllSystems` which captures `matchState` in closures (`registerBridgeSystems.ts:178` + `wireBridgeOps.ts:80`). Closures captured at registration cannot see an object that doesn't yet exist.

**Fix in v8:** `createWorldSkeleton` signature now takes `matchState` as the 5th argument. PATH A/B/C all create `matchState = createDefaultMatchState()` BEFORE the skeleton call, then `Object.assign(matchState, msState)` mutates the SAME reference post-applySnapshot — closures see the hydrated values on the next step.

## Claude MAJOR — Tier-3 per-tick sync unspecified (recurring gap)

§3 puts `VisibilityMap` + `MatchState` in Tier-3 (mutable instances outside `world.state`). Live mutations (`cell.get().setSource(...)`, `matchState.outcome = ...`) bypass `accessor.markDirty(...)` and never reach `world.state.aoe2.visibility` / `world.state.aoe2.matchState`. v7's `bridgeSnapshotSystem.execute` only flushed the Tier-1 codec table.

**Impact:** any recorder snapshot at tick > load carried stale Tier-3 data. Replay opening from such a snapshot would have wrong fog-of-war / wrong match outcome. saveGame round-trip silently corrupted. §7's "round-trips perfectly for all Tier-1 + Tier-3 state" invariant fails.

This gap persisted since iter-3 (which fixed load-time hydration but not per-tick mutation→world.state).

**Fix in v8:** new `tier3SyncSystem` registered as the SECOND-TO-LAST output-phase system (immediately before `bridgeSnapshotSystem`):
```ts
export function makeTier3SyncSystem(visibilityCell, matchState): SystemRegistration {
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
§5.2's ordering invariant extended to assert the LAST TWO output entries are `['tier3Sync', 'bridgeSnapshot']`. `flushBridgeStateToWorld()` (saveGame path) does the same pair so saved snapshots match recorder snapshots. Tier-3 writes are unconditional (no dirty-track) since live mutations bypass dirty-mark — costs are bounded by `visibility.getState()` (Uint8Array shape) and `serializeMatchState(matchState)` (small flat object).

## Claude NITs (folded into v8)

### NIT — `extractDimsFromSnapshot(snapshot)` was unspecified

v7 referenced this helper but never spelled out the resolution order or fallback. v7 PATH B's "snapshot pre-dates aoe2.visibility migration" branch had no source for dims.

**Fix in v8:** new Tier-3 slot `aoe2.bridgeMeta = { mapWidth, mapHeight }` written once at game start; persisted via `tier3SyncSystem`. Resolution order:
1. `snapshot.state['aoe2.bridgeMeta']` (preferred)
2. `snapshot.state['aoe2.visibility'].{width,height}` (post-migration fallback)
3. throw `MissingMapDimsError` (pre-migration; the v0.1.6 `migrateLegacySaveBlobToWorldState` seeds `bridgeMeta` from old fields so this branch is unreachable for valid v0.1.6 inputs)

### NIT — `makeReplayBridge.getMatchState()` derived-field plumbing under-specified

Live `assembleBridgeApi.ts:55-61` layers `wonderCountdownTicks` / `relicCountdownTicks` over base `matchState`. v7's `ReplayBridge.matchState: MatchState` was a passthrough — consumers calling `bridge.getMatchState()` would get un-derived shape.

**Fix in v8:** §5.3 `ReplayBridge.getMatchState(): MatchState & { wonderCountdownTicks; relicCountdownTicks }`. Implementation extracted into shared helper `getReplayMatchStateDerived(world, humanPlayerId)` reused by both replay + live bridges so shapes match exactly.

## Other findings cross-checked clean

Both reviewers verified iter-6 fixes that landed correctly:
- WeakMap channel closes the accessor + cell sharing gap (Codex traced path; Claude traced single-instance invariant)
- `SessionReplayer.openAt` calls `worldFactory(snapshot)` synchronously (`session-replayer.ts:242`) so `attachReplayWorldContext` runs before `openAt` returns
- Lazy `() => world` accessor pattern + `requireWorld()` guard fire correctly
- No civ-engine API changes required
- All iter-1 → iter-5 fixes still hold

## v8 changes summary

1. **NEW: `tier3SyncSystem`** — output-phase system registered before `bridgeSnapshotSystem`. Writes `aoe2.visibility` + `aoe2.matchState` unconditionally each tick. Closes Claude iter-7 MAJOR.
2. **NEW: `aoe2.bridgeMeta` Tier-3 slot** — `{ mapWidth, mapHeight }`. Written at game start, persisted via tier3Sync.
3. **`createWorldSkeleton` signature** now takes `matchState` (5th arg). All three load paths create matchState BEFORE skeleton.
4. **`enterReplay` flow** seeds `_currentReplayContext` after `makeReplayBridge`.
5. **`extractDimsFromSnapshot` helper spec** with bridgeMeta-first / visibility-fallback / throw order.
6. **`ReplayBridge.getMatchState()` derived-field shape** matched to live via shared `getReplayMatchStateDerived` helper.
7. §3 Tier-3 row added (visibility + matchState + bridgeMeta = 3, was 2).
8. §5.2 ordering invariant updated to assert `['tier3Sync', 'bridgeSnapshot']` as the last two output entries.

## Process notes for design-8 reviewer

- v8 diff vs v7: §5.2 expanded with tier3SyncSystem; §5.6 createWorldSkeleton signature + matchState ordering; §5.4 enterReplay seeds context; §5.3 getMatchState derived; §3 row added.
- Verify `tier3SyncSystem` actually closes the load → mutate → snapshot → reload round-trip: write a quick mental trace of "fresh game → 100 ticks → snapshot → replay opens at tick 100".
- Verify `serializeMatchState` exists or is straightforward to add (existing path serializes via JSON-compatible `Object.assign({}, matchState)` for the `MatchState` flat shape).
- Verify `tier3Sync` writing every tick doesn't violate any existing engine invariant (writing the same value as a prior tick is a no-op for fingerprinting per `world.ts:1490-1497`).
- Both reviewers should converge to ACCEPT this round; v8 closes the last 3 substantive gaps. NITs that surface should be plan-stage fold-ins.
