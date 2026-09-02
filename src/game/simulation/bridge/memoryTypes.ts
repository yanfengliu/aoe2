// Snapshot of a static entity (building or resource) captured the last time
// the player saw it. Used by fog memory rendering. Purely a data value — no
// ECS component involved — so it survives after the source entity is
// destroyed or leaves vision.

import type { Position } from 'civ-engine';
import type { ProjectedEntityView } from '../types';

export interface MemoryEntry {
  kind: 'building' | 'resource';
  entityType: ProjectedEntityView['entityType'];
  // Entity-ref generation captured when the snapshot was taken. civ-engine
  // recycles entity ids (generation bumps on reuse), so the fog-memory cleanup
  // must compare generation (via world.isCurrent) — a raw-id existence probe is
  // fooled by a recycled id into keeping a destroyed-under-fog ghost forever.
  generation: number;
  position: Position;
  footprintWidth: number;
  footprintHeight: number;
  tint: number;
  owner: number | null;
  size: number;
  visualVariant: ProjectedEntityView['visualVariant'];
  /** Building set at snapshot time (v0.3.105); absent = pre-architecture save. */
  architecture?: ProjectedEntityView['architecture'];
}

// REMOVED 2026-09-02: `lastSeenTick`. It was written for every visible entity
// every tick and READ NOWHERE in game logic — only round-tripped through the
// save. That per-tick write was two thirds of a 537 MB replay bundle (the
// codec diffs a slot whole), and the v0.3.188 fix — write an entry only when
// its APPEARANCE changes — left the field recording the first tick the current
// appearance was seen rather than the last time it was seen, so its name was a
// lie that round-tripped through saves. A future "last seen N seconds ago" or
// an age-out of stale memory would have read it and been silently wrong.
// Deleted rather than renamed: dead data with a truthful name is still dead.
// Old saves carrying the key load fine; it is ignored.
