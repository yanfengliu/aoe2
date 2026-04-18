import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function countOwnedUnits(bridge: Bridge, owner: number, unitType: string): number {
  return bridge
    .getEconomyState()
    .units.filter((unit) => unit.owner === owner && unit.unitType === unitType).length;
}

function findFirstOwnedUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

describe('Slice 4 Siege Workshop + siege units', () => {
  it('exposes Siege Workshop in a villager placement menu at Castle Age', () => {
    const bridge = createSimulationBridge('siege-workshop-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    const buildOptions = bridge.getSelectionState().buildOptions;
    expect(buildOptions).toContain('siege-workshop');
  });

  it('does not offer Siege Workshop while still in Feudal Age', () => {
    // feudal-blacksmith-fixture keeps the human player in Feudal Age with a
    // completed Barracks, so Siege Workshop (Castle-only) must stay hidden.
    const bridge = createSimulationBridge('feudal-blacksmith-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    const buildOptions = bridge.getSelectionState().buildOptions;
    expect(buildOptions).not.toContain('siege-workshop');
  });

  it('exposes Mangonel / Scorpion / Battering Ram in the Siege Workshop train menu at Castle Age', () => {
    const bridge = createSimulationBridge('siege-workshop-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    const trainOptions = bridge.getSelectionState().trainOptions;
    expect(trainOptions).toContain('mangonel');
    expect(trainOptions).toContain('scorpion');
    expect(trainOptions).toContain('battering-ram');
  });

  it('trains a Mangonel when the Siege Workshop is selected and the train command is issued', () => {
    const bridge = createSimulationBridge('siege-workshop-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.queueTrainUnit('mangonel')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'mangonel') === 1,
        { maxSteps: 700 },
      ),
    ).toBe(true);

    const mangonel = findFirstOwnedUnit(bridge, 1, 'mangonel');
    expect(mangonel).toMatchObject({
      unitType: 'mangonel',
      attackDamage: 40,
      attackRange: 7,
    });
  }, 40_000);
});
