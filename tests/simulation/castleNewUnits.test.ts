import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
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

describe('Castle-Age new train-menu units (Camel, Cavalry Archer)', () => {
  it('exposes Camel in the Stable train menu at Castle Age', () => {
    const bridge = createSimulationBridge('castle-upgrades-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    const trainOptions = bridge.getSelectionState().trainOptions;
    expect(trainOptions).toContain('camel');
  });

  it('exposes Cavalry Archer in the Archery Range train menu at Castle Age', () => {
    const bridge = createSimulationBridge('castle-upgrades-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    const trainOptions = bridge.getSelectionState().trainOptions;
    expect(trainOptions).toContain('cavalry-archer');
  });

  it('does not offer Cavalry Archer while still in Feudal Age', () => {
    // feudal-blacksmith-fixture has a completed Archery Range but the human
    // is only in Feudal Age, so Cavalry Archer (Castle-only) should be absent
    // from the train menu. The Archer + Skirmisher options remain.
    const bridge = createSimulationBridge('feudal-blacksmith-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    const trainOptions = bridge.getSelectionState().trainOptions;
    expect(trainOptions).toContain('archer');
    expect(trainOptions).not.toContain('cavalry-archer');
  });

  it('trains a Camel when the Stable is selected and the train command is issued', () => {
    const bridge = createSimulationBridge('castle-upgrades-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.queueTrainUnit('camel')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'camel') === 1,
        { maxSteps: 400 },
      ),
    ).toBe(true);

    const camel = findFirstOwnedUnit(bridge, 1, 'camel');
    expect(camel).toMatchObject({
      unitType: 'camel',
      attackDamage: 5,
    });
  }, 20_000);

  it('trains a Cavalry Archer when the Archery Range is selected and the train command is issued', () => {
    const bridge = createSimulationBridge('castle-upgrades-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.queueTrainUnit('cavalry-archer')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'cavalry-archer') === 1,
        { maxSteps: 500 },
      ),
    ).toBe(true);

    const ca = findFirstOwnedUnit(bridge, 1, 'cavalry-archer');
    expect(ca).toMatchObject({
      unitType: 'cavalry-archer',
      attackDamage: 6,
      attackRange: 4,
    });
  }, 20_000);
});
