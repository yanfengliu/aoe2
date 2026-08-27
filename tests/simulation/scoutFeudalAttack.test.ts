// The Scout Cavalry's hidden Feudal buff (units.csv rows 65/66, v0.3.136):
// the same scout attacks for 3 in the Dark Age and 5 from Feudal on. Both
// halves of the age-scaled pattern: creation reads the owner's age, and the
// age-up sweep bumps STANDING scouts by the difference — replace, never
// compound, and independent of civilization.

import { describe, expect, it } from 'vitest';

import { ageScaledUnitAttack } from '../../src/game/simulation/ageScaledHp';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

describe('the scout Feudal attack', () => {
  it('is 3 in the Dark Age and 5 from Feudal, scout only', () => {
    expect(ageScaledUnitAttack('scout', 'dark-age')).toBe(3);
    expect(ageScaledUnitAttack('scout', 'feudal-age')).toBe(5);
    expect(ageScaledUnitAttack('scout', 'imperial-age')).toBe(5);
    expect(ageScaledUnitAttack('light-cavalry', 'feudal-age')).toBeNull();
    expect(ageScaledUnitAttack('militia', 'dark-age')).toBeNull();
  });

  it('a standing scout gains +2 the moment its owner reaches Feudal', () => {
    // The outpost-vision fixture can genuinely afford and prerequisite the
    // Feudal research (the ageScaledHp suite ages up on it); no soft-skips.
    const bridge = createSimulationBridge('outpost-vision-fixture');
    const scout = bridge.getEconomyState().units.find(
      (u) => u.owner === 1 && u.unitType === 'scout',
    );
    if (!scout) throw new Error('the outpost fixture has no scout');
    const attackOf = () => {
      const rows = (bridge.world.getState('aoe2.combatStates') ?? []) as ReadonlyArray<
        [number, { attackDamage: number }]
      >;
      return new Map(rows).get(scout.id)?.attackDamage;
    };
    expect(attackOf()).toBe(3);

    expect(bridge.selectEntityById(bridge.getEconomyState().buildings.find(
      (b) => b.owner === 1 && b.buildingType === 'town-center',
    )!.id)).toBe(true);
    expect(bridge.queueResearch('feudal-age')).toBe(true);
    const buffed = stepBridgeUntil(
      bridge,
      () => attackOf() === 5,
      { maxSteps: 2600 },
    );
    expect(buffed, 'the standing scout never gained its Feudal +2').toBe(true);
  });
});
