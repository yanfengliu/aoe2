# Replay Scrubber Design Iter-5 Review

**Date:** 2026-04-30
**Iteration:** design-5 → produces design-6
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ITERATE (Codex 1 MAJOR + 1 MINOR; Claude ACCEPT with 4 implementer notes — convergence narrowing: substantive design is sound, last open issue is `registerAllSystems` visibility-at-registration coupling)

## Codex MAJOR (real, addressed in v6)

### MAJOR — §5.6 createWorldSkeleton split is not implementable as written

The skeleton contract in v5 took only `seed`, dimensions, and `BridgeStateAccessor`. But `registerAllSystems(world, visibility, ...)` (`registerAllSystems.ts:28, 140, 308`) passes the `VisibilityMap` instance into AI / visibility / fog systems at registration time. v5's flow registered systems against a placeholder visibility, then expected `applySnapshot` + `cell.replace` to magically reach those already-registered systems — which it cannot, because systems hold a direct reference, not a cell.

**Fix in v6:** introduce `VisibilityCell` indirection (aoe2-side, no civ-engine changes):
```ts
export class VisibilityCell {
  private _current: VisibilityMap;
  constructor(initial: VisibilityMap) { this._current = initial; }
  get(): VisibilityMap { return this._current; }
  replace(next: VisibilityMap): void { this._current = next; }
}
```

`registerAllSystems` is updated (~20 call sites) so visibility-using systems take a `VisibilityCell`. Each step the system calls `cell.get().method(...)`. After `applySnapshot`, the schema-2/schema-1 path calls `cell.replace(VisibilityMap.fromState(...))` — every system reads the post-applySnapshot instance through the cell on the next step. `wireBridgeOps` runs on the same world with the now-current cell.

`createWorldSkeleton`'s signature in v6: `(seed, { mapWidth, mapHeight }, accessor, visibilityCell)`. The cell is passed to `registerAllSystems` internally so AI/visibility/fog systems pick it up.

`MatchState` does NOT need a cell — it's already a mutable object accessed through a long-lived reference; `Object.assign(matchState, msState)` mutates in place so existing closures see updates.

## Codex MINOR (folded into v6)

### MINOR — §5.2 ordering-test wording still says `fn:`

§8 + v5-deltas were normalized to `execute:` per iter-4 fixes; §5.2 line 436 still said `fn:`. v6 normalizes the last instance.

## Claude ACCEPT — 4 implementer notes

### F-1 (MINOR — §5.2 wording miss) — same as Codex MINOR above. Folded.

### F-2 (NIT — TS soundness on `BridgeStateAccessor.get`)

`codec.deserialize(json)` where `json: unknown` and `codec.deserialize` param is typed `TJson | undefined` won't compile without a cast. v6 adds `as TJson | undefined` on the input.

### F-3 (NIT — defer-to-plan: `BridgeStateAccessor` constructor / `setWorld` mismatch)

§5.1 constructor took `world`; §5.6 called `new BridgeStateAccessor(/* deferred */) + accessor.setWorld(world)` even though `setWorld` didn't exist on the §5.1 class. v6 picks the lazy-getter pattern: `new BridgeStateAccessor(() => world)`. The getter is only called inside `get`/`flush` after registration completes, so the deferred binding `let world; ...; world = createWorldSkeleton(...)` is safe.

### F-4 (NIT — duplicated v4-deltas paragraph)

Copy-paste artifact in v5 (lines 49+51 verbatim). v6 removes one. Same fix applied to a second duplicate (`**v5 deltas vs v4:**`) discovered during the same scan.

## Other findings cross-checked clean

Both reviewers verified iter-4 fixes that landed correctly:
- Direct `setState` in ADR 4 body (no `combatStatesCodec.serialize` call)
- `getState(...) as Type | undefined` cast pattern in §5.6
- Existing `VisibilityMap.fromState` static used (no new civ-engine method)
- `makeBridgeSnapshotSystem` factory + execute closure structure
- ADR 4 + ADR 10 architecture sound

## v6 changes summary

1. **NEW: `VisibilityCell` class** (aoe2-side) + `registerAllSystems` refactor (~20 call sites) to take `VisibilityCell` instead of `VisibilityMap`. No civ-engine changes.
2. **§5.6 rewritten** — three load paths use `let world` deferred binding, lazy `() => world` accessor getter, `VisibilityCell` for placeholder→hydrated swap.
3. **§5.3 `createReplayWorldOnly`** rewritten to reuse `createWorldSkeleton` + the same cell pattern (replay path = schema-2 load path now identical structurally).
4. **§5.1 `BridgeStateAccessor`** uses `_getWorld: () => World<...>` lazy getter; `get<TNative, TJson>(codec)` adds explicit cast on `getState` result.
5. **§5.2 ordering-test wording** normalized from `fn:` to `execute:`.
6. **Duplicate paragraph headers** removed (`**v4 deltas vs v3:**` and `**v5 deltas vs v4:**`).

## Process notes for design-6 reviewer

- v6 diff vs v5: §5.6 rewrite (cell pattern + lazy getter + deferred binding), §5.3 createReplayWorldOnly aligned, §5.1 input cast, §5.2 wording, dedupe paragraphs, top-level v6-deltas section.
- Verify `VisibilityCell` indirection covers all `registerAllSystems` call sites that take `visibility`.
- Verify the `let world` deferred binding pattern + lazy getter resolves correctly (no use of `world` before assignment in registration path).
- Verify `createReplayWorldOnly` end-to-end: skeleton → applySnapshot → cell.replace covers visibility hydration so `ReplayController.play()`'s subsequent `world.step()` calls see the right `VisibilityMap`.
- Both reviewers should converge to ACCEPT this round; v6 closes the last MAJOR. If a real correctness issue remains, escalate; otherwise this is the convergence point — the architecture is sound and the design is plan-ready.
