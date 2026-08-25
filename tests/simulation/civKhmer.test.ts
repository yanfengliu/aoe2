// Khmer (civilizations.csv): "Prereq buildings aren't required to advance to
// further ages or unlock other buildings" and "Villagers can garrison in
// Houses". The first bypasses the two-buildings age gate AND the
// barracks-unlocks-the-military-row build rule (age gates still apply); the
// second gives houses a Khmer-only garrison of five villagers — never
// soldiers.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';
import { canGarrisonAt } from '../../src/game/simulation/prototypeBuildingRules';

type Bridge = ReturnType<typeof createSimulationBridge>;

function boot(scenario: string, civ?: string): Bridge {
  return createSimulationBridge(scenario, {
    ...(civ ? { civilizationsByOwner: new Map([[1, civ]]) } : {}),
  });
}

describe('Khmer house garrison rules (pure)', () => {
  it('admits villagers to Khmer houses, and nobody else anywhere', () => {
    expect(canGarrisonAt('house', 'villager', 'Khmer')).toBe(true);
    expect(canGarrisonAt('house', 'militia', 'Khmer')).toBe(false);
    expect(canGarrisonAt('house', 'villager', 'Britons')).toBe(false);
    expect(canGarrisonAt('house', 'villager')).toBe(false);
    // The civ argument changes nothing anywhere else.
    expect(canGarrisonAt('town-center', 'villager', 'Khmer')).toBe(true);
    expect(canGarrisonAt('watch-tower', 'militia', 'Khmer')).toBe(true);
  });
});

describe('Khmer age advance without prerequisites', () => {
  it('advances to Feudal with one prereq building where a generic civ needs two', () => {
    const generic = boot('feudal-missing-prereq-fixture');
    expect(selectOwnedBuildingDirect(generic, 1, 'town-center')).toBe(true);
    expect(generic.queueResearch('feudal-age')).toBe(false);

    const khmer = boot('feudal-missing-prereq-fixture', 'Khmer');
    expect(selectOwnedBuildingDirect(khmer, 1, 'town-center')).toBe(true);
    expect(khmer.queueResearch('feudal-age')).toBe(true);
    expect(
      stepBridgeUntil(khmer, () => khmer.getEconomyState().ages[1] === 'feudal-age', {
        maxSteps: 2600,
      }),
    ).toBe(true);

    // "...or unlock other buildings": no Barracks stands, yet the Feudal
    // Khmer villager may place the whole military row. Age still gates —
    // no Castle-Age buildings appear.
    expect(selectOwnedUnitDirect(khmer, 1, 'villager')).toBe(true);
    const options = khmer.getSelectionState().buildOptions;
    expect(options).toContain('stable');
    expect(options).toContain('archery-range');
    expect(options).not.toContain('monastery');

    // The generic villager in the same position stays locked.
    expect(selectOwnedUnitDirect(generic, 1, 'villager')).toBe(true);
    expect(generic.getSelectionState().buildOptions).not.toContain('stable');
  });
});

describe('Khmer villagers shelter in houses (in the world)', () => {
  it('a Khmer villager enters the house; the militia and the generic villager stay out', () => {
    const khmer = boot('civ-khmer-house-fixture', 'Khmer');
    const house = khmer
      .getEconomyState()
      .buildings.find((b) => b.owner === 1 && b.buildingType === 'house')!;
    expect(selectOwnedUnitDirect(khmer, 1, 'villager')).toBe(true);
    expect(khmer.issueContextCommand(house.x, house.y, true)).toBe(true);
    expect(
      stepBridgeUntil(
        khmer,
        () => {
          if (!khmer.selectEntityAtCell(house.x, house.y)) return false;
          return khmer.getSelectionState().inventory === '1 / 5 garrisoned';
        },
        { maxSteps: 600 },
      ),
    ).toBe(true);
    // The militia walks if ordered, but never enters.
    expect(selectOwnedUnitDirect(khmer, 1, 'militia')).toBe(true);
    expect(khmer.issueContextCommand(house.x, house.y, true)).toBe(true);
    for (let index = 0; index < 300; index += 1) khmer.step(100);
    expect(khmer.selectEntityAtCell(house.x, house.y)).toBe(true);
    expect(khmer.getSelectionState().inventory).toBe('1 / 5 garrisoned');

    // A generic civ's house garrisons nothing and shows no garrison line.
    const generic = boot('civ-khmer-house-fixture');
    const genericHouse = generic
      .getEconomyState()
      .buildings.find((b) => b.owner === 1 && b.buildingType === 'house')!;
    expect(selectOwnedUnitDirect(generic, 1, 'villager')).toBe(true);
    generic.issueContextCommand(genericHouse.x, genericHouse.y, true);
    for (let index = 0; index < 300; index += 1) generic.step(100);
    expect(generic.selectEntityAtCell(genericHouse.x, genericHouse.y)).toBe(true);
    expect(generic.getSelectionState().inventory).toBeNull();
  });
});
