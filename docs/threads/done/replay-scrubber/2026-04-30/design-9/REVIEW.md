# Replay Scrubber Design Iter-9 Review

**Date:** 2026-04-30
**Iteration:** design-9 → produces design-10
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ITERATE (Claude BLOCKER + MINOR + NIT; Codex MAJOR + 2 MINOR — convergent on the dirty-bit ineffectiveness; Claude separately caught a system-registration gap that v9's skeleton-narrowing introduced)

## Claude BLOCKER — `createReplayWorldOnly` registers no gameplay systems

v9 narrowed `createWorldSkeleton` to "ECS components only" and moved gameplay-system registration into `wireBridgeOps` → `registerBridgeSystems`. But §5.3 `createReplayWorldOnly` only calls skeleton + `applySnapshot`, never `wireBridgeOps`. Result: replay world has zero systems → `SessionReplayer.openAt` advances `world.tick` but runs no simulation → replay state frozen at start snapshot. Combat, movement, AI, `tier3SyncSystem`, `bridgeSnapshotSystem` all silently absent.

This is the load-bearing gap: the spec's whole purpose is functional replay scrubbing, and v9 narrowed the only seam through which the replay world used to acquire its systems without filling in a replacement.

**Fix in v10:** new `wireReplaySystems(world, accessor, visibilityCell, matchState)` helper extracted from `wireBridgeOps`. Constructs ops modules + calls `registerBridgeSystems` + `registerOutputTail`, but skips scenario seeding, hydration, and UI ops. `createReplayWorldOnly` now calls it after `applySnapshot` and hydration. `wireBridgeOps` refactored to call `wireReplaySystems` then layer live-only UI + scenario seeding on top, preserving DRY.

## Convergent MAJOR — `VisibilityCell` dirty bit is ineffective in steady state

**Codex framing:** `syncVisibilitySources` (the only setSource caller) is invoked every tick by `visibilitySystem` and unconditionally calls `cell.get().setSource(...)` for every active source. So `cell.markDirty()` fires every tick a single visionSource exists. Gate fires only on no-source ticks (paused / no entities).

**Claude framing:** Same finding. `VisibilityMap.setSource` early-returns at `visibility-map.ts:55-62` for no-op writes, but it returns void — `syncVisibilitySources` can't tell if the call was a no-op, and unconditionally calls `markDirty()`.

**Fix in v10:** `syncVisibilitySources` adds a per-(player, sourceId) `{ x, y, radius }` fingerprint cache. Only when an actual change occurs is `cell.get().setSource(...)` invoked AND `cell.markDirty()` called. Steady-state ticks (no movement among vision sources) skip the visibility write entirely. Trades 3 number comparisons per entity for a meaningful gate.

§5.2 framing also re-stated to avoid overclaiming: "the dirty bit is the gate; effectiveness depends on `syncVisibilitySources` fingerprinting source changes." §9 perf fallbacks (every-Nth-tick batching, larger snapshotInterval) preserved as safety nets.

## Codex MINOR — `registerOutputTail` uses non-existent `world.addSystem`

civ-engine API is `world.registerSystem(...)`, not `addSystem` (`civ-engine/src/world.ts:646-661`). v9 §5.2 sample code used `addSystem`.

**Fix in v10:** `registerOutputTail` body uses `world.registerSystem(makeTier3SyncSystem(...))` and `world.registerSystem(makeBridgeSnapshotSystem(...))`. No civ-engine API change.

## Codex MINOR — `serializeMatchState` typecheck issue

v9 stripped derived fields but typed the return as `SerializedMatchState`, which still requires those fields. Doesn't compile.

**Fix in v10:** introduce `PersistedMatchState = Omit<SerializedMatchState, 'wonderCountdownTicks' | 'relicCountdownTicks'>`. `serializeMatchState` returns this. Load paths use `world.getState('aoe2.matchState') as PersistedMatchState | undefined`. `Object.assign(matchState, msState)` accepts the partial shape — mutation-target's missing fields keep their pre-existing values (or get recomputed by live API on next read). Schema-1 `migrateLegacySaveBlobToWorldState` strips legacy stored derived fields the same way.

## Claude NIT — `_currentReplayContext.world` aliasing note belongs in code

§5.4's note ("future contributors should NOT add an assertion ...") is appropriate guidance but decays in spec form and stays evergreen as JSDoc on the field declaration in `ReplayController.ts`.

**Fix in v10:** §5.4 trimmed to a one-line summary referring to the inline JSDoc.

## Other findings cross-checked clean

Both reviewers verified iter-8 fixes that landed correctly:
- `bootstrapFlush` traces correctly: `freshGameFlow` → `wireBridgeOps` (with new tail) → `bootstrapFlush` → `recording.connect()`. Initial snapshot has Tier-3 + Tier-1 populated. ✓
- `registerOutputTail` ordering: tier3Sync + bridgeSnapshot are the only output-phase systems; with registration order = tiebreaker, tail order is fixed at `[tier3Sync, bridgeSnapshot]`. ✓
- `serializeMatchState` strip is sound — derived fields are recomputed live + by replay; nothing reads them off `world.state.aoe2.matchState`. ✓
- `bridgeMeta` row in §3 + §1 wording. ✓
- §8 ordering test asserts last TWO entries `['tier3Sync', 'bridgeSnapshot']`; perf benchmark extended to 8-player late-game. ✓
- iter-1..7 fixes (matchState lifecycle inversion, WeakMap context channel, lazy accessor getter, stateful `play()`, schema-1 migration, Tier-1 inventory of 35, frame-coalesced drag) all intact. ✓

## v10 changes summary

1. **NEW: `wireReplaySystems(world, accessor, visibilityCell, matchState)` helper** — closes Claude iter-9 BLOCKER. Extracted from `wireBridgeOps`'s system-registration tail.
2. **`syncVisibilitySources` fingerprinting** — closes Codex+Claude iter-9 MAJOR. Per-(player, sourceId) `{ x, y, radius }` cache; only call `cell.get().setSource(...)` + `cell.markDirty()` on actual change.
3. **`registerOutputTail` uses `world.registerSystem`** (not `addSystem`).
4. **NEW: `PersistedMatchState` type** — `Omit<SerializedMatchState, 'wonderCountdownTicks' | 'relicCountdownTicks'>`. `serializeMatchState` returns it; load paths cast `world.getState('aoe2.matchState') as PersistedMatchState`.
5. **§5.4 aliasing note** trimmed — JSDoc-on-field is the long-term home.

## Process notes for design-10 reviewer

- v10 diff vs v9: §5.3 createReplayWorldOnly + new wireReplaySystems; §5.2 syncVisibilitySources fingerprint; PersistedMatchState type + serializeMatchState typecheck; addSystem → registerSystem; §5.4 trim.
- Verify `wireReplaySystems` extraction is feasible: trace `wireBridgeOps`'s body and confirm the system-registration tail can cleanly factor out without breaking the live-only UI path.
- Verify `syncVisibilitySources` fingerprinting closes the gate effectively — what fraction of ticks have ANY source change? Likely all ticks during active play (units move every tick). Steady-state may only be: pause, idle non-moving units, fully-explored map with no scout movement. The gate is effective for those edge cases but probably not in typical play. The perf benchmark must verify the steady-state cost regardless.
- Verify `wireBridgeOps` refactor (extract tail into `wireReplaySystems`) doesn't break any of the ~25 deps it currently takes.
- Both reviewers should converge to ACCEPT this round; the BLOCKER + MAJOR are both addressed structurally, and the MINORs are mechanical fixes.
