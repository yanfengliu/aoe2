import type { ProjectedEntityView } from '../../../game/simulation/types';

// Terrain-layer cache signature (perf, v0.1.131). Terrain is a deterministic
// pure function of cell kind + coordinates (see terrainRenderer) and is
// immutable for a bridge's lifetime, so the scene draws the ~2160 iso-diamond
// terrain fills once and lets the camera transform pan/zoom the layer for free
// instead of re-filling every frame. This function is the change detector: a
// cheap integer checksum (no allocation) folded over each terrain cell's
// position and tint. It flips only on a real terrain change (initial draw, a
// bridge swap, or any future in-place re-tint), so the per-frame cost is an
// O(n) integer fold — microseconds — instead of O(n) polygon fills.
export function computeTerrainSignature(entities: readonly ProjectedEntityView[]): string {
  let count = 0;
  let checksum = 0;
  for (const entity of entities) {
    if (entity.layer !== 'terrain') {
      continue;
    }
    count += 1;
    checksum =
      (Math.imul(checksum, 31) + entity.x * 73856093 + entity.y * 19349663 + entity.tint) | 0;
  }
  return `${count}:${checksum}`;
}

export interface TerrainCache {
  // Redraw the terrain layer only when the terrain set has changed since the
  // last redraw. Invokes `onRedraw` with the terrain-only subset (the caller
  // clears + repaints the layer) and returns whether it redrew this frame.
  renderIfChanged(
    entities: readonly ProjectedEntityView[],
    onRedraw: (terrainCells: ProjectedEntityView[]) => void,
  ): boolean;
  // Force the next renderIfChanged to redraw (used on a bridge swap so the
  // cached layer repaints against the rehydrated world).
  reset(): void;
}

// Stateful terrain-layer change detector holding the last-drawn signature.
// Keeping the state here (rather than as a closure variable inside the scene
// renderer) makes the skip/redraw/reset contract unit-testable with a spy
// onRedraw, independent of Phaser.
export function createTerrainCache(): TerrainCache {
  let signature = '';
  return {
    renderIfChanged(entities, onRedraw) {
      const next = computeTerrainSignature(entities);
      if (next === signature) {
        return false;
      }
      signature = next;
      onRedraw(entities.filter((entity) => entity.layer === 'terrain'));
      return true;
    },
    reset() {
      signature = '';
    },
  };
}
