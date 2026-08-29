// Integration regression for the AI-vs-AI drop-off deadlock (2026-07-01,
// found by replaying an 8000-tick AI-vs-AI run: the AI's food froze at 121
// and it never left the Dark Age). The symmetric twin of the campaign-11
// gather reroute: a villager that gathered to a FULL carry, then found its
// nearest food drop-off (a Mill) boxed in by trees (all approach cells
// blocked), latched in `to-dropoff` forever and never deposited — because
// `findNearestDropOffBuilding` picks the nearest by distance with no
// reachability check and the loop retried that same unreachable nearest. The
// fix reroutes to the nearest REACHABLE drop-off (here the farther Town
// Center) so the villager deposits and food rises.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('villager drop-off reroute off an unreachable drop-off (AI-vs-AI grounding regression)', () => {
  it('villagers whose nearest drop-off is boxed reroute to a reachable one and net positive food', () => {
    const bridge = createSimulationBridge('dropoff-unreachable-reroute-fixture');
    const eco0 = bridge.getEconomyState();

    const villagers = eco0.units.filter((u) => u.owner === 2 && u.unitType === 'villager');
    expect(villagers.length).toBe(2);
    const foodBefore = eco0.playerResources[2]?.food ?? 0;

    // Long enough for both villagers to gather a full carry AND walk to the
    // farther reachable Town Center to deposit (the boxed Mill is nearer but
    // unreachable). Pre-fix they stay pinned in `to-dropoff` and never deposit.
    for (let i = 0; i < 3600; i += 1) bridge.step(100); // §6.3+§12.4.2 pacing: a berry carry is 320 gather ticks plus the long walks

    const eco1 = bridge.getEconomyState();
    const foodAfter = eco1.playerResources[2]?.food ?? 0;
    // Pre-fix: the food villagers latch on the unreachable-nearest Mill, food
    // flat. Post-fix: they reroute to the reachable Town Center and deposit.
    expect(foodAfter).toBeGreaterThan(foodBefore);

    // Discriminator: the berries were actually harvested (the villagers filled
    // up) AND the deposit landed (food rose by at least one carry load). A bare
    // "food > before" could in principle be satisfied by a stray gather, but a
    // full deposit cycle proves the drop-off leg completed.
    expect(foodAfter - foodBefore).toBeGreaterThanOrEqual(10);
  }, 60_000);
});
