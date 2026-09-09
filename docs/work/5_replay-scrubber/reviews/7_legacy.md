# Replay Scrubber Design Iter-8 Review

**Date:** 2026-04-30
**Iteration:** design-8 → produces design-9
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ITERATE (Codex BLOCKER + MAJOR + MINOR; Claude MAJOR + 3 MINOR + 2 NIT — convergent on the perf claim, plus Codex caught a separate bootstrap-snapshot BLOCKER)

## Codex BLOCKER — initial recorder snapshot incomplete

`SessionRecorder.connect()` writes `world.serialize()` immediately on connect, BEFORE any tick runs (`session-recorder.ts:150`). v8's fresh bootstrap only seeded `aoe2.bridgeMeta` before returning; `tier3SyncSystem` + `bridgeSnapshotSystem` were output-phase only. So the initial snapshot would be missing `aoe2.visibility`, `aoe2.matchState`, and any Tier-1 slots populated during scenario seed. `enterReplay(startTick)` would open with stale/missing Tier-3 data.

**Fix in v9:** new `bootstrapFlush(world, accessor, visibilityCell, matchState)` helper called once after `wireBridgeOps` (post `seedFreshScenario`) in PATH A, and after `Object.assign(matchState, msState)` in PATH B/C. Forces the same writes as one tick of `tier3SyncSystem` + `bridgeSnapshotSystem` BEFORE the recorder connects. New test `bootstrapFlush.test.ts` verifies initial snapshot completeness.

## Convergent MAJOR — `tier3SyncSystem` perf claim factually wrong

**Codex framing:** `world.setState()` always runs `assertJsonCompatible` (linear in nested object size) and marks the key dirty. `getStateDirty` SKIPS fingerprint for already-dirty keys (`world.ts:1577`), so equal repeated `setState`s are NOT deduped — the construction + traversal cost is paid every tick. Plus the recorder writes the full visibility into `diff.state.set` every tick (`session-recorder.ts:413`).

**Claude framing:** `VisibilityMapState` is NOT Uint8Array — it's a plain JSON object whose `players[].explored` is a sorted `number[]` materialized fresh every call by `[...explored].sort(...)` (`visibility-map.ts:128`). For an 8-player late-game with ~30k explored cells/player → ~240k integers cloned + sorted + JSON-traversed every tick at 60 TPS, plus source/visible recomputation.

**Fix in v9:**
1. **`VisibilityCell` dirty bit** — `markDirty()` set by visibility-mutating ops modules (mirrors Tier-1 `accessor.markDirty(slot)`); `tier3SyncSystem.execute` skips the visibility write when `!cell.isDirty()` and clears on write.
2. **§9 + M6 perf benchmark extended** to cover 8-player late-game scenario with full exploration. Combined `tier3Sync` + `bridgeSnapshot` + recorder sink writes < 5 ms/tick.
3. **`MatchState` write stays unconditional** (small flat object; cost trivially bounded).

The "Uint8Array" claim is replaced with the real `VisibilityMapState` shape in §3.

## Codex MINOR + Claude MINOR — §8 ordering test out of date

Both reviewers caught: §8 still asserted "LAST entry … is `'bridgeSnapshot'`" and the perf test only covered Tier-1. v8's §5.2 was updated to `['tier3Sync', 'bridgeSnapshot']` but §8 was not.

**Fix in v9:** §8 ordering test now asserts the LAST TWO entries are `['tier3Sync', 'bridgeSnapshot']`. Perf benchmark extended to cover Tier-1 + Tier-3 + recorder sink writes (8-player late-game scenario) and the `VisibilityCell` dirty-bit gate.

## Claude MINOR — §3 missing `bridgeMeta` row + §1 stale wording

§3 still said "Tier 3 — 2 slots" without the `bridgeMeta` row. §1 said "35 Tier-1 + visibility + matchState" without bridgeMeta.

**Fix in v9:** §3 Tier-3 list now lists 3 slots (visibility, matchState, bridgeMeta) with explicit JSON shape for `VisibilityMapState`. §1 wording updated to "35 Tier-1 + 3 Tier-3 (visibility + matchState + bridgeMeta)."

## Claude MINOR — `createWorldSkeleton` scope ambiguity

v8 said skeleton "registers all components, validators, handlers, systems." But `wireBridgeOps` already calls `registerBridgeSystems` → `registerAllSystems` for gameplay systems (`wireBridgeOps.ts:324-377`). Reading literally would imply double-registration.

**Fix in v9 (Claude option A):** skeleton scope NARROWED to "registers ECS component types only." The new output-tail systems (`tier3SyncSystem` + `bridgeSnapshotSystem`) are registered by a new `registerOutputTail(world, accessor, visibilityCell, matchState)` helper called as the LAST action in `wireBridgeOps` after `registerBridgeSystems`. Gameplay system closure-capture is already correct because `matchState` is passed by reference through `wireBridgeOps` → `registerBridgeSystems` (`registerBridgeSystems.ts:41, 122`); the v8 ordering inversion (`matchState` created before skeleton) is what makes the new tier3Sync registration valid.

Skeleton signature kept as v8 (`seed, dims, accessor, visibilityCell, matchState`), but its body is narrower than v8 implied. Underscore-prefixed unused params signal documentation-only role; ESLint exception or rename deferred to plan stage.

## Claude NIT — `serializeMatchState` may persist stale derived fields

`MatchState` carries `wonderCountdownTicks` / `relicCountdownTicks` fields, but live API recomputes them per-call. `Object.assign({}, matchState)` would persist stale values into `world.state.aoe2.matchState`. Replay's `getReplayMatchStateDerived` recomputes fresh, so functionally harmless on the replay path — but anything else reading the slot directly sees stale.

**Fix in v9:** `serializeMatchState` strips derived fields explicitly:
```ts
function serializeMatchState(m: MatchState): SerializedMatchState {
  const { wonderCountdownTicks: _wc, relicCountdownTicks: _rc, ...rest } = m;
  return rest;
}
```
Loud-fail (undefined values) preferred over silent stale.

## Claude NIT — `_currentReplayContext.world` post-play aliasing

`play()` advances `_playState.world` in place per ADR 10. On `pause()`, `_currentReplayContext.tick` is updated from `_playState.tick`, but `_currentReplayContext.world` remains the played-to world reference, NOT a fresh `openAt(_currentReplayContext.tick)` result. Future contributors might add a self-check that they're equal.

**Fix in v9:** §5.4 adds a one-line note clarifying `_currentReplayContext.world` semantics: "the most recently materialized replay world (post-play if applicable), NOT a fresh `openAt(currentTick)` result. Subsequent `scrubTo(t)` rebuilds via `openAt(t)`."

## Other findings cross-checked clean

Both reviewers verified iter-7 fixes that landed correctly:
- `enterReplay()` seeds `_currentReplayContext` with same shape as `scrubTo()` so `play()`'s spread consumes either correctly. ✓
- `matchState` lifecycle inversion: created before skeleton, mutated in place via `Object.assign(matchState, msState)`. ✓
- `extractDimsFromSnapshot` resolution order is sound; `migrateLegacySaveBlobToWorldState` seeds `bridgeMeta` for schema-1 inputs. ✓
- `ReplayBridge.getMatchState()` derived-field plumbing via shared `getReplayMatchStateDerived` matches live algorithm. ✓
- Topological-sort tiebreaker is registration-order even when other systems carry constraints (`world.ts:2415-2480`). ✓
- Diff listeners fire after the output phase. ✓
- No civ-engine API changes required. ✓

## v9 changes summary

1. **NEW: `bootstrapFlush(world, accessor, visibilityCell, matchState)` helper** — closes Codex iter-8 BLOCKER. Called once before recorder connects. New test verifies initial snapshot completeness.
2. **NEW: `VisibilityCell` dirty bit** — closes Codex+Claude iter-8 MAJOR. visibility-mutating ops modules call `cell.markDirty()`; tier3Sync gates visibility write on `cell.isDirty()`.
3. **NEW: `registerOutputTail` helper** — closes Claude iter-8 MINOR. Skeleton scope narrowed to ECS components; tail registered at end of `wireBridgeOps`.
4. **`serializeMatchState`** strips derived fields.
5. **§3 Tier-3 list** now 3 slots (visibility, matchState, bridgeMeta) with explicit JSON shape.
6. **§1 wording** updated to "35 Tier-1 + 3 Tier-3."
7. **§8 ordering test** asserts last TWO entries `['tier3Sync', 'bridgeSnapshot']`.
8. **§8 perf benchmark** extended to 8-player late-game scenario; verifies dirty-bit gate.
9. **§5.4 one-line note** on `_currentReplayContext.world` post-play semantics.

## Process notes for design-9 reviewer

- v9 diff vs v8: bootstrapFlush helper, VisibilityCell dirty bit, registerOutputTail helper, serializeMatchState derived-field strip, §3 / §1 / §8 / §5.4 wording.
- Verify `bootstrapFlush` covers the BLOCKER: trace `freshGameFlow → wireBridgeOps → bootstrapFlush → recording.connect()` and confirm initial snapshot has Tier-3 + Tier-1 populated.
- Verify dirty-bit gate is correct: visibility-mutating ops modules listed in inventory (`visibilitySystem.ts`, `fogMemorySystem.ts`, anything calling `cell.get().setSource/removeSource/clearPlayer`) all need `cell.markDirty()` calls — flag any miss.
- Verify `registerOutputTail` ordering invariant holds: even if a gameplay system in registerBridgeSystems registered AFTER tier3Sync would break `['tier3Sync', 'bridgeSnapshot']` tail. Fix: tail must be registered AFTER all of `registerBridgeSystems`.
- Both reviewers should converge to ACCEPT this round; v9 closes the iter-8 BLOCKER + MAJOR cleanly. Remaining issues should be plan-stage fold-ins.
