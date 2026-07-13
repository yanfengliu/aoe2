import { describe, expect, it, vi } from 'vitest';
import type { WorldDebugSnapshot } from 'civ-engine';

import { createRenderMetricsCapture } from '../../src/game/simulation/renderMetricsCapture';

describe('createRenderMetricsCapture', () => {
  it('reports HUD metrics without serializing the simulation world', () => {
    const metrics = {
      durationMs: { total: 3.25 },
    } as WorldDebugSnapshot['metrics'];
    const serialize = vi.fn(() => {
      throw new Error('render metrics must not serialize the world');
    });
    const world = {
      getAliveEntities: () => [4, 7, 9].values(),
      getMetrics: () => metrics,
      serialize,
    };
    const capture = createRenderMetricsCapture(world);

    expect(capture.capture()).toEqual({
      entityCount: 3,
      metrics,
    });
    expect(serialize).not.toHaveBeenCalled();
  });
});
