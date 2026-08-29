// The drop-off door sustains a convoy (v0.3.160). Twelve villagers cycling
// ONE Town Center at spec §12.4.2 walk speed must keep delivering — AoE2's
// villager ball, not a single-file queue that livelocks. Pre-fix, carriers
// stacked on the door's one blessed approach cell, arrivals outpaced the
// drain, deliveries flatlined, and the traffic election's recursive closure
// over the ball made single ticks cost seconds (profiled on the
// ai-feudal-stone fixture at tick ~8,300: 400ms sustained, 6.5s bursts).
import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('drop-off door under convoy load', () => {
  it('twelve carriers keep one Town Center door flowing', () => {
    const bridge = createSimulationBridge('dropoff-convoy-fixture');
    const foodBefore = bridge.getEconomyState().playerResources[2]?.food ?? 0;

    // One berry carry is 320 gather ticks; the walk is ~9 cells each way at
    // 0.8 tiles/s. Unjammed, each villager completes a cycle in ~550 ticks,
    // so 4,000 ticks is ~7 cycles × 12 villagers × 10 food ≈ 840 ideal.
    for (let i = 0; i < 4000; i += 1) bridge.step(100);

    const foodAfter = bridge.getEconomyState().playerResources[2]?.food ?? 0;
    const delivered = foodAfter - foodBefore;
    // Half the unjammed ideal: generous under honest congestion, red when
    // the door clots (pre-fix the ball forms after the first wave and
    // throughput decays toward zero).
    expect(delivered).toBeGreaterThanOrEqual(420);
  }, 240_000);
});
