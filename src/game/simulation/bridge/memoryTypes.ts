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
  lastSeenTick: number;
}
