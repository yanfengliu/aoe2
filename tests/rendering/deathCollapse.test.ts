// Death collapse (spec §14.5, v0.3.119): a witnessed unit death rebuilds the
// unit's own recipe as a transient corpse that TIPS OVER and sinks across the
// death-feed window — AoE2's fall, not a static debris pile. Deterministic
// from (death, frame.tick): the same death always falls the same way.

import { describe, expect, it } from 'vitest';

import { createAoeVoxelOverlayParts } from '../../src/rendering/voxel/aoeVoxelOverlayParts';
import type { ProjectedFrameView } from '../../src/game/simulation/renderViewTypes';

function frameWithDeath(tick: number): ProjectedFrameView {
  return {
    tick,
    playerId: 1,
    seed: 'test',
    mapWidth: 30,
    mapHeight: 30,
    visibleCells: [],
    exploredCells: [],
    recentUnitDeaths: [{
      id: 77,
      tick: 100,
      x: 10.5,
      y: 10.5,
      owner: 2,
      unitType: 'militia',
      tint: 0xcc4444,
      size: 1,
      witnessedBy: [1],
    }],
    projectiles: [],
  } as unknown as ProjectedFrameView;
}

function corpseParts(tick: number) {
  return createAoeVoxelOverlayParts([], {
    selectionPreviewEntityIds: [],
    selectionMarqueeWorldCorners: null,
    placementPreview: null,
    frame: frameWithDeath(tick),
  } as never).filter((part) => part.key.includes('death') && !part.key.includes('debris'));
}

describe('the death collapse', () => {
  it('rebuilds the unit body and tips it over the feed window', () => {
    const fresh = corpseParts(100);
    const fallen = corpseParts(109);
    expect(fresh.length).toBeGreaterThan(3);
    expect(fallen.length).toBe(fresh.length);
    // The body's highest point drops as it falls.
    const peak = (parts: typeof fresh) => Math.max(...parts.map((p) => p.centerY));
    expect(peak(fallen)).toBeLessThan(peak(fresh) * 0.8);
    // And the fall is a rotation, not a melt: parts acquire pitch.
    const pitched = fallen.filter((p) => Math.abs(p.pitch ?? 0) > 0.4).length;
    expect(pitched).toBeGreaterThan(fallen.length / 2);
  });

  it('the same death always falls the same way', () => {
    const a = corpseParts(105);
    const b = corpseParts(105);
    expect(a).toEqual(b);
  });
});
