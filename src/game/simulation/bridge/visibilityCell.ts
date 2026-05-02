// VisibilityCell wraps a `VisibilityMap` instance with a dirty flag so the
// Tier-3 sync system (Phase 2B's `tier3SyncSystem`) can skip the round-trip
// to `world.state.aoe2.visibility` when no visibility source moved this tick.
// Visibility traversal is the second-most expensive per-tick operation
// (behind A* path resolution), and re-serializing the map ten times a second
// when nothing has changed is pure waste.
//
// Lifecycle: writers (every system that mutates a `VisionSourceComponent` or
// adds/removes a visibility-emitting entity) call `cell.markDirty()` after
// the mutation. The output-phase `tier3SyncSystem` calls `cell.consumeIfDirty()`
// — if dirty, it re-serializes the visibility map into `world.state` and
// clears the flag. If clean, it skips.

import type { VisibilityMap } from 'civ-engine';

export class VisibilityCell {
  private readonly _map: VisibilityMap;
  private _dirty = true;

  constructor(map: VisibilityMap) {
    this._map = map;
  }

  /** Read-through to the underlying map. Mutators that touch the map
   *  directly should call `markDirty()` afterwards. */
  get map(): VisibilityMap {
    return this._map;
  }

  /** Mark the visibility map as having pending writes. Called by every system
   *  or op that mutates a vision source / adds or removes a visible entity. */
  markDirty(): void {
    this._dirty = true;
  }

  /** Tier-3 sync hook: returns `true` if the caller should re-serialize the
   *  visibility map into `world.state.aoe2.visibility`. Clears the dirty flag
   *  if true. The caller (`tier3SyncSystem`) is the sole consumer. */
  consumeIfDirty(): boolean {
    if (!this._dirty) return false;
    this._dirty = false;
    return true;
  }

  /** Test / replay hook: explicitly mark clean (e.g., after replay-bridge
   *  hydration when the map was rebuilt from a snapshot). */
  markClean(): void {
    this._dirty = false;
  }

  /** Test hook. */
  get isDirty(): boolean {
    return this._dirty;
  }
}
