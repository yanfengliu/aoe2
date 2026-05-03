// Reapplies vision-source mutations to the visibility map every tick.
// `syncVisibilitySources` lives in `bridge/visibility`; this system just
// schedules it on the bridge's tick.

import { VisibilityMap } from 'civ-engine';
import type { GameWorld } from '../pureHelpers';
import { syncVisibilitySources, type VisibilitySourceFingerprint } from '../visibility';
import type { VisibilityCell } from '../visibilityCell';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';

export interface VisibilitySystemDeps {
  world: GameWorld;
  visibility: VisibilityMap;
  // Phase 2D: trackedVisibilitySources slot is read/written via accessor
  // (replaces the direct `Map<number, number>` reference that lived in
  // BridgeState). syncVisibilitySources fetches the cached Map once and
  // marks dirty exactly once per tick.
  accessor: BridgeStateAccessor;
  // Phase 2E: vision-cell dirty bit. syncVisibilitySources only marks
  // the cell dirty when a source's fingerprint changed (or a source was
  // added/removed), so steady-state ticks with no movement skip the
  // visibility-state re-serialize at output phase.
  visibilityCell: VisibilityCell;
  // Phase 2E: fingerprint cache shared with the bootstrap
  // syncVisibilitySources call. Sharing the cache means the per-tick
  // path inherits bootstrap's (x,y,radius) snapshots and recognizes
  // tick 1 as steady-state (no markDirty), preserving the dirty-bit
  // optimization across the bootstrap → first-tick boundary.
  fingerprints: Map<number, VisibilitySourceFingerprint>;
}

export function registerVisibilitySystem(deps: VisibilitySystemDeps): void {
  const { world, visibility, accessor, visibilityCell, fingerprints } = deps;

  world.registerSystem({
    name: 'prototypeVisibility',
    phase: 'update',
    after: ['prototypeHerdableOwnership'],
    execute(activeWorld) {
      syncVisibilitySources(
        activeWorld,
        visibility,
        accessor,
        fingerprints,
        visibilityCell,
      );
    },
  });
}
