import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { pickUnitMix } from '../../src/game/simulation/ai';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

const SIEGE_WORKSHOP_UNITS = new Set([
  'battering-ram', 'siege-ram', 'mangonel', 'onager', 'scorpion', 'heavy-scorpion',
]);

describe('the AI army mix', () => {
  it('includes siege from Castle Age, because a Siege Workshop it never uses is wasted wood', () => {
    // The AI has built a Siege Workshop since FU4 and trained nothing from it,
    // which means it could not break a wall or a Castle at all.
    const castle = pickUnitMix('castle-age');
    expect(castle.some((entry) => entry.producer === 'siege-workshop'),
      'Castle-Age mix has no siege').toBe(true);
    const imperial = pickUnitMix('imperial-age');
    expect(imperial.some((entry) => entry.producer === 'siege-workshop'),
      'Imperial mix has no siege').toBe(true);
  });

  it('keeps the early ages free of siege, which needs a building they do not have', () => {
    for (const age of ['dark-age', 'feudal-age'] as const) {
      expect(pickUnitMix(age).some((entry) => entry.producer === 'siege-workshop'), age)
        .toBe(false);
    }
  });

  it('names units its producer can actually train', () => {
    for (const age of ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'] as const) {
      for (const entry of pickUnitMix(age)) {
        if (entry.producer !== 'siege-workshop') continue;
        expect(SIEGE_WORKSHOP_UNITS.has(entry.unitType), `${age}: ${entry.unitType}`).toBe(true);
      }
    }
  });
});

describe('an AI in Castle Age', () => {
  it('eventually trains something from its Siege Workshop', () => {
    const bridge: Bridge = createSimulationBridge('ai-castle-age-military-fixture');
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().units.some(
        (unit) => unit.owner === 2 && SIEGE_WORKSHOP_UNITS.has(unit.unitType),
      ),
      { maxSteps: 2500 },
    ), 'the AI never built a siege unit').toBe(true);
  }, 120_000);

  it('trains its civilization unique unit from its Castle', () => {
    // The Castle is the most expensive thing the AI builds. Before this it
    // trained nothing from it at all.
    const bridge: Bridge = createSimulationBridge('ai-castle-age-military-fixture');
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'throwing-axeman',
      ),
      { maxSteps: 2500 },
    ), 'the AI never trained its unique unit').toBe(true);
  }, 120_000);
});
