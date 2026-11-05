import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { trainingCost } from '../../src/game/simulation/prototypeEconomyRules';

// v0.1.96: villager training is no longer coupled to the age-up reserve. v0.1.90
// had made the villager gate respect the full next-age reserve (symmetric with
// military), but replaying the default-seed corpus showed that DEADLOCKED the
// economy: once the AI qualified for the next age while still villager-poor, the
// reserve (e.g. {food:800} for Castle) blocked EVERY villager train, so the
// gathering engine could never grow to gather the food it was reserving — the AI
// froze at 7 Feudal villagers with food pinned at 339. Villagers are the engine
// that gathers the reserved resource, so gating them on it is self-defeating.
//
// Work 141 (2026-11-04) took villagers out of the `savingForAgeUp` latch too,
// for the same reason and on DE's own evidence. Once the stockpile crosses 60%
// of the age-up cost the latch still holds military and research, but the Town
// Center keeps training villagers: DE's AI trains to 25 villagers in the Dark
// Age whatever its food, and in the Feudal Age until it can pay for the Castle
// Age (Promisory units.per 328-386 and 409-415), banking the age's cost once it
// stops at its villager count. This file used to assert that the latch held
// ALL production, villagers included.
//
// `ai-villager-reserve-fixture`: owner 2 sits in the Dark Age with barracks +
// mill (the two Feudal prerequisites, so it qualifies to age up) and 320 food —
// 64% of the 500-food Feudal cost, i.e. above the 60% latch. There is NO food
// resource on the map (zero gather income), so any food change is purely
// production spend, and the Barracks is idle, so a Militia would be bought if
// the latch did not hold military.

describe('AI age-up banking — the savingForAgeUp latch holds soldiers, not villagers (work 141)', () => {
  it('keeps the Town Center training villagers past the 60% latch and trains no soldier', () => {
    const bridge = createSimulationBridge('ai-villager-reserve-fixture');
    const startFood = bridge.getEconomyState().playerResources[2]?.food ?? 0;
    // Sanity: the fixture seeds food ABOVE the 60% savingForAgeUp latch
    // (320 = 64% of the 500-food Feudal cost).
    expect(startFood).toBe(320);

    for (let i = 0; i < 700; i += 1) {
      bridge.step(100);
    }

    const eco = bridge.getEconomyState();
    const endFood = eco.playerResources[2]?.food ?? 0;
    const villagers = eco.units.filter((u) => u.owner === 2 && u.unitType === 'villager').length;
    const soldiers = eco.units.filter((u) => u.owner === 2 && u.unitType === 'militia').length;
    // A queued unit is paid for when it is queued, so count the queues too.
    const queued = (unitType: string) => eco.buildings
      .filter((b) => b.owner === 2)
      .reduce((sum, b) => sum + b.queue.filter((entry) => entry.unitType === unitType).length, 0);
    const diagnostic = `startFood=${startFood} endFood=${endFood} villagers=${villagers}+${queued('villager')} queued `
      + `militia=${soldiers}+${queued('militia')} queued`;

    // The Town Center kept working: 700 ticks is room for two villagers at
    // DE's 25 s each.
    expect(villagers, diagnostic).toBeGreaterThanOrEqual(5);
    // Every unit of food spent went to a villager, and none to a soldier. The
    // no-soldier half is a FLOOR, not the latch's detection: this fixture
    // qualifies for Feudal, so the 500-food age-up reserve also keeps a Militia
    // out of 320 food (work 141 review round 0, F4). The latch's detection is the
    // villager count above, red with the latch put back on villagers.
    expect(soldiers + queued('militia'), diagnostic).toBe(0);
    expect(startFood - endFood, diagnostic)
      .toBe((villagers - 3 + queued('villager')) * (trainingCost('villager').food ?? 0));
  }, 90_000);
});
