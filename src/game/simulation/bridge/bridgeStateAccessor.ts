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
   *  **Mutation footgun**: if you mutate the returned native value (push to a
   *  productionQueue array, set on a combatStates Map, etc.), you MUST pair
   *  it with `markDirty(codec)` or the change won't be persisted to
   *  `world.state` at flush time. Snapshot/replay won't see the mutation —
   *  exactly the failure mode Phase 2 exists to prevent. Prefer the
   *  `mutate(codec, fn)` helper, which guarantees the markDirty pairing. */
  get<TNative, TJson>(codec: SlotCodec<TNative, TJson>): TNative {
    if (!this._cache.has(codec.slot)) {
      const json = this.requireWorld().getState(codec.slot) as
        | TJson
        | undefined;
      this._cache.set(codec.slot, codec.deserialize(json));
    }
    return this._cache.get(codec.slot) as TNative;
  }

  /** Mark a slot dirty after a mutation. Codec-typed overload prevents
   *  string typos at the call site. Untyped string overload kept for tests
   *  and any future caller that needs to mark a Tier-3 slot dirty by key
   *  without owning a codec instance — but flush silently skips slots
   *  whose key is not in `SLOT_CODECS_BY_KEY` (Tier-1 only).
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
   *  proportional to mutated slots, not the full 35-slot table. */
  flush(): void {
    if (this._dirty.size === 0) return;
    const w = this.requireWorld();
    for (const slot of this._dirty) {
      const codec = SLOT_CODECS_BY_KEY.get(slot);
      if (codec === undefined) continue;
      const native = this._cache.get(slot);
      if (native === undefined) continue;
      // Codec serialize() returns a JsonValue-compatible shape by contract;
      // cast to satisfy world.setState's strict signature without pulling in
      // the JsonValue alias (which is internal to civ-engine's json.ts module).
      w.setState(slot, codec.serialize(native) as unknown as Parameters<typeof w.setState>[1]);
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
