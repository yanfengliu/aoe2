import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

// v0.1.96: villager training is no longer coupled to the age-up reserve. v0.1.90
// had made the villager gate respect the full next-age reserve (symmetric with
// military), but replaying the default-seed corpus showed that DEADLOCKED the
// economy: once the AI qualified for the next age while still villager-poor, the
// reserve (e.g. {food:800} for Castle) blocked EVERY villager train, so the
// gathering engine could never grow to gather the food it was reserving — the AI
// froze at 7 Feudal villagers with food pinned at 339. Villagers are the engine
// that gathers the reserved resource, so gating them on it is self-defeating.
//
// The banking that v0.1.90 was reaching for is already provided by the
// `savingForAgeUp` latch: once the stockpile crosses 60% of the age-up cost, the
// AI suppresses ALL production (military AND villagers) and banks the last
// stretch. This fixture isolates that latch — the mechanism that now holds the
// age-up food — with the villager gate deliberately un-gated.
//
// `ai-villager-reserve-fixture`: owner 2 sits in the Dark Age with barracks +
// mill (the two Feudal prerequisites, so it qualifies to age up) and 320 food —
// 64% of the 500-food Feudal cost, i.e. above the 60% latch. There is NO food
// resource on the map (zero gather income), so any food change is purely
// production spend. With the latch engaged, nothing is trained and the 320 food
// is HELD toward the age-up. (After the v0.1.96 change, removing the latch — i.e.
// seeding below 60% — would instead let the AI train villagers, which is correct:
// below 60% the AI should still be growing its economy.)

describe('AI age-up banking — the savingForAgeUp latch holds food near the age-up (v0.1.96)', () => {
  it('holds the food intact once past the 60% latch instead of spending it on production', () => {
    const bridge = createSimulationBridge('ai-villager-reserve-fixture');
    const startFood = bridge.getEconomyState().playerResources[2]?.food ?? 0;
    // Sanity: the fixture seeds food ABOVE the 60% savingForAgeUp latch
    // (320 = 64% of the 500-food Feudal cost) so the latch — not any reserve
    // gate — is what holds it.
    expect(startFood).toBe(320);

    for (let i = 0; i < 700; i += 1) {
      bridge.step(100);
    }

    const eco = bridge.getEconomyState();
    const endFood = eco.playerResources[2]?.food ?? 0;
    const villagers = eco.units.filter(
      (u) => u.owner === 2 && u.unitType === 'villager',
    ).length;
    const diagnostic = `startFood=${startFood} endFood=${endFood} villagers=${villagers}`;

    // The latch suppresses ALL production above 60%, and there is no income, so
    // the 320 food is HELD intact — the AI banks toward the age-up.
    expect(endFood, diagnostic).toBe(startFood);
    // And no villagers were trained (production is latched off).
    expect(villagers, diagnostic).toBe(3);
  }, 90_000);
});
