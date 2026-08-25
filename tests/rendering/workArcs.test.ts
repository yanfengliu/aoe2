// Per-verb work arcs (spec §14.5, v0.3.121): the axe swings the classic
// overhead arc, the pick strikes twice per loop and shallower, the picking
// hand reaches low and gently — three different working silhouettes.

import { describe, expect, it } from 'vitest';

import { builderWorkArc, workArcForVerb } from '../../src/rendering/voxel/aoeVoxelBuilderWorkPose';

describe('workArcForVerb', () => {
  it('chopping and building keep the classic arc; legacy gathering too', () => {
    for (const phase of [0.1, 0.3, 0.55, 0.8]) {
      expect(workArcForVerb('chopping', phase)).toBe(builderWorkArc(phase));
      expect(workArcForVerb('building', phase)).toBe(builderWorkArc(phase));
      expect(workArcForVerb('gathering', phase)).toBe(builderWorkArc(phase));
    }
  });

  it('mining strikes twice per loop and shallower', () => {
    // The pick repeats: phase 0.2 and 0.7 are the same point of its double loop.
    expect(workArcForVerb('mining', 0.2)).toBeCloseTo(workArcForVerb('mining', 0.7), 10);
    // And never loads as high as the axe.
    const peak = (verb: string) => Math.max(...Array.from({ length: 40 }, (_, i) => Math.abs(workArcForVerb(verb, i / 40))));
    expect(peak('mining')).toBeLessThan(peak('chopping') * 0.75);
  });

  it('foraging is a low gentle reach', () => {
    const peak = Math.max(...Array.from({ length: 40 }, (_, i) => Math.abs(workArcForVerb('foraging', i / 40))));
    expect(peak).toBeLessThan(0.5);
    expect(peak).toBeGreaterThan(0.2);
  });
});
