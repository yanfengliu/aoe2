// Per-tick cache layer that reads/writes bridge state through `world.state`
// via slot codecs. Phase 2A scaffolding — instantiated in Phase 2C, consumed
// by ops modules in Phase 2D, flushed in `bridgeSnapshotSystem` (Phase 2B).
//
// Why a cache layer: civ-engine's `world.state` only stores JsonValue. Codec
// `serialize`/`deserialize` round-trip Maps/Sets through arrays. Per-tick mutators
// touch the same slot many times (every gather progress increment, every combat
// hit, every queue tick); calling `world.getState()` + `codec.deserialize()`
// per touch would re-deserialize the whole Map for every read. The accessor
// caches the deserialized Native value the first time a slot is read, returns
// the same cached reference for every subsequent read in the tick, and marks
// the slot dirty when a mutator writes through it. At tick end (or before
// `saveGame()`), `flush()` re-serializes only the dirty slots back to
// `world.state`.

import type { GameWorld } from './pureHelpers';
import type { SlotCodec } from './bridgeStateSerialize';
import { SLOT_CODECS_BY_KEY } from './bridgeStateSerialize';

export class BridgeStateAccessor {
  // Lazy world getter — sidesteps the construction-order chicken-and-egg
  // (`createWorldSkeleton` registers `bridgeSnapshotSystem` BEFORE the world
  // reference is fully assembled; the accessor needs the world reference to
  // call `getState`/`setState`). The getter is supplied at construction and
  // typically returns `undefined` for one frame during scaffolding. Calls
  // before the world is bound throw an explicit domain error rather than
  // an opaque `Cannot read property 'getState' of undefined`.
  private readonly _getWorld: () => GameWorld | undefined;
  private readonly _cache = new Map<string, unknown>();
  private readonly _dirty = new Set<string>();

  constructor(getWorld: () => GameWorld | undefined) {
    this._getWorld = getWorld;
  }

  private requireWorld(): GameWorld {
    const w = this._getWorld();
    if (w === undefined) {
      throw new Error(
        'BridgeStateAccessor used before world bound — check construction order',
      );
    }
    return w;
  }

  /** Lazy-materialize from `world.state` via the codec; cache the result.
   *  Subsequent reads in the same tick return the same cached reference, so
   *  `accessor.get(codec).set(...)` mutations are visible across same-tick
   *  reads (the cache-coherence invariant).
   *
   *  The JSON read from `world.getState` is `structuredClone`'d before
   *  passing to `codec.deserialize`. Without this clone,
   *  `flatMapCodec.deserialize`'s `new Map(j ?? [])` shallow-wraps the
   *  value-references `world.state` holds, so mutating
   *  `accessor.get(codec).get(id).field` would alias-mutate `world.state`
   *  directly, bypassing dirty-tracking. The contract is enforced on BOTH
   *  read and write boundaries (matching clone in `flush()`).
   *
   *  **Mutation footgun**: if you mutate the returned native value (push to a
   *  productionQueue array, set on a combatStates Map, etc.), you MUST pair
   *  it with `markDirty(codec)` or the change won't be persisted to
   *  `world.state` at flush time. Snapshot/replay won't see the mutation.
   *  Prefer the `mutate(codec, fn)` helper, which guarantees the markDirty
   *  pairing. */
  get<TNative, TJson>(codec: SlotCodec<TNative, TJson>): TNative {
    if (!this._cache.has(codec.slot)) {
      const json = this.requireWorld().getState(codec.slot) as
        | TJson
        | undefined;
      const decoupled = json === undefined
        ? undefined
        : (structuredClone(json) as TJson);
      this._cache.set(codec.slot, codec.deserialize(decoupled));
    }
    return this._cache.get(codec.slot) as TNative;
  }

  /** Mark a slot dirty after a mutation. Codec-typed overload prevents
   *  string typos at the call site; the string overload exists for tests
   *  that exercise the unknown-slot error path.
   *
   *  `flush()` THROWS if a dirty slot's key is not in `SLOT_CODECS_BY_KEY`
   *  — see flush's docstring for rationale. Tier-3 slots
   *  (`aoe2.visibility`, `aoe2.matchState`, `aoe2.bridgeMeta`) are NOT in
   *  the Tier-1 registry; they are written by `tier3SyncSystem`, not
   *  through the accessor. Do not call `markDirty` for Tier-3 slots —
   *  flush will throw.
   *
   *  Cheap (one Set.add). The slot's codec is consulted at `flush()` time. */
  markDirty<TNative, TJson>(codec: SlotCodec<TNative, TJson>): void;
  markDirty(slot: string): void;
  markDirty<TNative, TJson>(arg: string | SlotCodec<TNative, TJson>): void {
    this._dirty.add(typeof arg === 'string' ? arg : arg.slot);
  }

  /** Convenience: read + mutate + markDirty in one call.
   *  ```ts
   *  accessor.mutate(combatStatesCodec, (m) => m.set(unitId, newState));
   *  ```
   *  Use this rather than calling `get` + `markDirty` separately so the
   *  dirty-tracking cannot be skipped by a forgetful caller. */
  mutate<TNative, TJson>(
    codec: SlotCodec<TNative, TJson>,
    fn: (native: TNative) => void,
  ): void {
    fn(this.get(codec));
    this._dirty.add(codec.slot);
  }

  /** Tick-end (or pre-`saveGame()`) flush: re-serialize dirty caches back to
   *  `world.state` via codecs. Iterating the dirty set keeps the cost
   *  proportional to mutated slots, not the full 35-slot table.
   *
   *  Each serialized slot is `structuredClone`'d before `setState` so that
   *  `world.state` does NOT alias the cached Map's value-objects. Without
   *  this clone, `accessor.get(codec).get(id)` returns a value-reference
   *  shared with `world.state`, and any property mutation on that reference
   *  (e.g. `combatState.currentHp -= 5`) propagates to `world.state`
   *  immediately, bypassing the dirty-tracking contract. `structuredClone`
   *  is used over `JSON.parse(JSON.stringify(...))` because it preserves
   *  `undefined` values that JSON.stringify silently drops.
   *
   *  A dirty slot whose key is not in `SLOT_CODECS_BY_KEY` is an explicit
   *  error: silent skip would lose the write AND clear the dirty flag,
   *  causing silent data loss. Validation runs as a single pre-pass so an
   *  unknown slot does not strand subsequent valid writes mid-iteration —
   *  if the throw fires, no slot has been flushed yet and the dirty set is
   *  intact for the next call. */
  flush(): void {
    if (this._dirty.size === 0) return;
    const w = this.requireWorld();
    // Pre-pass: validate every dirty slot BEFORE writing any. A throw
    // mid-loop would strand later slots in `_cache` with `_dirty`
    // un-cleared and would also leak partial writes to `world.state`,
    // breaking the atomic-flush contract.
    //
    // Two checks:
    // 1. Slot is registered in SLOT_CODECS_BY_KEY (else: typo'd
    //    markDirty / unmigrated codec).
    // 2. Slot has a cached native value (else: markDirty without a
    //    prior get/mutate — the cache is the source of truth, so a
    //    silent flush would leave `world.state.aoe2.<slot>`
    //    permanently stale). Full-review iter-2 (Codex + Claude
    //    MEDIUM) — moved into pre-pass for true atomicity.
    for (const slot of this._dirty) {
      if (!SLOT_CODECS_BY_KEY.has(slot)) {
        throw new Error(
          `BridgeStateAccessor.flush: slot '${slot}' was marked dirty but is not in SLOT_CODECS_BY_KEY. ` +
            `Either register the slot's codec in TIER_1_CODECS, or stop calling accessor.mutate/markDirty for this slot.`,
        );
      }
      if (!this._cache.has(slot)) {
        throw new Error(
          `BridgeStateAccessor.flush: slot '${slot}' was marked dirty but no native value is cached. ` +
            `Did you call accessor.markDirty without a prior accessor.get/mutate? ` +
            `Use accessor.mutate(codec, ...) so the cache is populated, or read via accessor.get(codec) before markDirty.`,
        );
      }
    }
    for (const slot of this._dirty) {
      // SLOT_CODECS_BY_KEY.get + _cache.get are non-null after the pre-pass.
      const codec = SLOT_CODECS_BY_KEY.get(slot)!;
      const native = this._cache.get(slot)!;
      const serialized = codec.serialize(native);
      const decoupled = structuredClone(serialized);
      w.setState(slot, decoupled as Parameters<typeof w.setState>[1]);
    }
    this._dirty.clear();
  }

  /** After `applySnapshot` / `enterReplay` / `exitReplay`: drop caches.
   *  Next read re-materializes from `world.state` via `codec.deserialize`. */
  reset(): void {
    this._cache.clear();
    this._dirty.clear();
  }

  /** Test hook: how many slots are currently cached? */
  get cacheSize(): number {
    return this._cache.size;
  }

  /** Test hook: how many slots are dirty? */
  get dirtySize(): number {
    return this._dirty.size;
  }
}
