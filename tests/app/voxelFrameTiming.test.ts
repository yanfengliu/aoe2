import { describe, expect, it } from 'vitest';

import {
  boundedVisibleSimulationDelta,
  MAX_VISIBLE_SIMULATION_FRAME_DELTA_MS,
} from '../../src/app/voxelFrameTiming';

describe('voxel frame timing', () => {
  it('preserves sustained 15 FPS elapsed time instead of slowing the simulation', () => {
    expect(boundedVisibleSimulationDelta(1_000 / 15)).toBeCloseTo(1_000 / 15);
  });

  it('bounds a long visible stall while hidden-tab transitions reset the host clock', () => {
    expect(boundedVisibleSimulationDelta(2_000)).toBe(MAX_VISIBLE_SIMULATION_FRAME_DELTA_MS);
    expect(boundedVisibleSimulationDelta(Number.NaN)).toBe(0);
  });
});
