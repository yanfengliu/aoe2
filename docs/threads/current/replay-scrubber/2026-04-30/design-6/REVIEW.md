# Replay Scrubber Design Iter-6 Review

**Date:** 2026-04-30
**Iteration:** design-6 → produces design-7
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ITERATE (Codex 1 MAJOR; Claude ACCEPT with 1 MINOR + 3 NITs — both reviewers converge on the same root cause)

## Convergent finding (Codex MAJOR + Claude MINOR — same issue, different framings)

**Replay-world context channel — accessor + visibility cell get lost between `createReplayWorldOnly` and downstream consumers.**

Codex framing: `createReplayWorldOnly()` constructs `VisibilityCell` + `BridgeStateAccessor` and registers replay systems against them, then returns ONLY `GameWorld`. `makeReplayBridge(world)` later receives only that world — but `_playState.accessor.reset()` (§5.4) and the bridge ops need the SAME accessor instance the systems hold (single-accessor invariant from §5.1). The context isn't recoverable from civ-engine: `SessionReplayer.openAt()` returns only the World (`session-replayer.ts:242`).

Claude framing: §5.4's `_currentReplayContext = { world, bridge, tick }` is missing the `accessor` field, but `_playState = { ..., accessor, ... }` reads it from there. Implementation can't proceed without resolving how `makeReplayBridge` exposes accessor to `_currentReplayContext`.

**Root cause:** the design didn't specify a context-passing channel between the worldFactory (constrained by civ-engine's signature) and the bridge/controller layer.

**v7 fix:** introduce a module-level `WeakMap<GameWorld, ReplayWorldContext>` (Codex's suggestion; equivalent to Claude's "tighten §5.3/§5.4"):
```ts
// src/game/simulation/replayWorldContext.ts (NEW)
export interface ReplayWorldContext {
  accessor: BridgeStateAccessor;
  visibilityCell: VisibilityCell;
  matchState: MatchState;
}
const REPLAY_WORLD_CONTEXTS = new WeakMap<GameWorld, ReplayWorldContext>();
export function attachReplayWorldContext(world, ctx): void;
export function getReplayWorldContext(world): ReplayWorldContext; // throws if not attached
```
`createReplayWorldOnly(snapshot)` calls `attachReplayWorldContext(world, ctx)` before returning. `makeReplayBridge(world)` reads `getReplayWorldContext(world).{accessor,visibilityCell,matchState}`. `_currentReplayContext` carries all five fields so `play()` can spread it directly into `_playState`. WeakMap → GC reclaims when world unreachable.

`makeReplayBridge` is also tightened to expose `replayBridge.accessor / .visibilityCell / .matchState` so `_currentReplayContext = { ...replayBridge.{accessor, visibilityCell, matchState}, world, bridge, tick }` is mechanical.

## Claude NITs (folded into v7)

### NIT — `BridgeStateAccessor` lazy getter promised "clear error" but the class doesn't implement one

§5.1 line 347 promised premature calls "throw a clear error" but the body just dereferenced `_getWorld()` directly — yielding a generic `TypeError: Cannot read properties of undefined`.

**v7 fix:** explicit guard via `requireWorld()` private helper:
```ts
private requireWorld(): World<...> {
  const w = this._getWorld();
  if (w === undefined) throw new Error('BridgeStateAccessor used before world bound');
  return w;
}
```
`get` and `flush` now call `this.requireWorld()` instead of `this._getWorld()` directly. Getter type changes from `() => World<...>` to `() => World<...> | undefined` so the guard is the type-correct way to extract.

### NIT — `seedFreshTiles` scope ambiguous vs current `seedFreshScenario`

§5.6 didn't say whether `seedFreshTiles` was just the tile grid or the full scenario seeder.

**v7 fix:** explicit narrow scope — `seedFreshTiles` is JUST the tile-grid construction (formerly `createTileGrid`); building/unit/resource scenario seeding stays inside `wireBridgeOps` via the existing `seedFreshScenario` helper. The skeleton-then-tiles-then-wireBridgeOps order maps 1:1 onto current `createWorld`.

### NIT — `makeReplayBridge` accessor-sharing under-specified

Resolved by the WeakMap channel (above): `makeReplayBridge(world)` reads `getReplayWorldContext(world).accessor` so the bridge ops + already-registered systems share the SAME accessor instance, satisfying §5.1's single-accessor invariant.

## Other findings cross-checked clean

Both reviewers verified iter-5 fixes that landed correctly:
- `VisibilityCell` pattern works (cell.get() each step, cell.replace post-applySnapshot reaches all 3 visibility-using system factories: AI, visibility, fog memory)
- Lazy `() => world` accessor pattern resolves correctly (registration happens before any `execute` fires)
- `createReplayWorldOnly` reuses `createWorldSkeleton` correctly; replay path = schema-2 load path structurally
- No civ-engine API changes required
- §5.2 ordering-test wording, §5.1 input cast, dedupe paragraphs, ADR 4 direct setState — all clean

## v7 changes summary

1. **NEW: `replayWorldContext.ts` module** with `attachReplayWorldContext` / `getReplayWorldContext` over a `WeakMap<GameWorld, ReplayWorldContext>`. No civ-engine changes.
2. **§5.3 `createReplayWorldOnly`** populates the context via `attachReplayWorldContext` before returning. **`makeReplayBridge`** reads it and exposes accessor/cell/matchState on the `ReplayBridge` interface.
3. **§5.4 `_currentReplayContext`** carries `{ world, bridge, accessor, visibilityCell, matchState, tick }` (was `{ world, bridge, tick }`). `play()` spreads directly into `_playState`.
4. **§5.1 `BridgeStateAccessor`** adds `requireWorld()` guard with explicit domain error. Getter signature widened to `() => World | undefined`.
5. **§5.6 `seedFreshTiles`** scope clarified — tile grid only; `seedFreshScenario` stays inside `wireBridgeOps`.

## Process notes for design-7 reviewer

- v7 diff vs v6: new `replayWorldContext.ts` module; §5.3/§5.4/§5.1 tightened; §5.6 wording.
- Verify the WeakMap channel actually closes the gap: does `makeReplayBridge` reach the same accessor that systems hold? does `_playState.accessor.reset()` operate on the right caches?
- Verify the `requireWorld()` guard fires for premature calls but not during normal operation (registration completes before any step).
- Verify `MatchState` mutation invariant is preserved: `Object.assign(matchState, msState)` mutates the existing reference; closures captured during registration still see updates.
- Both reviewers should converge to ACCEPT this round; v7 closes the last MAJOR cleanly. If a real correctness issue remains, escalate; otherwise this is plan-ready.
