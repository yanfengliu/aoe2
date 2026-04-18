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

function findOwnedBuilding(bridge: Bridge, owner: number, buildingType: string) {
  return bridge
    .getEconomyState()
    .buildings.find((b) => b.owner === owner && b.buildingType === buildingType);
}

describe('Slice 6 Castle + Longbowman', () => {
  it('exposes Castle in a villager placement menu at Castle Age', () => {
    const bridge = createSimulationBridge('castle-unique-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    const buildOptions = bridge.getSelectionState().buildOptions;
    expect(buildOptions).toContain('castle');
  });

  it('does not offer Castle while still in Feudal Age', () => {
    // feudal-blacksmith-fixture keeps the human player in Feudal Age with a
    // completed Barracks, so Castle (Castle-age-or-later) must stay hidden.
    const bridge = createSimulationBridge('feudal-blacksmith-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    const buildOptions = bridge.getSelectionState().buildOptions;
    expect(buildOptions).not.toContain('castle');
  });

  it('Castle under a Britons owner exposes Longbowman in its train menu', () => {
    const bridge = createSimulationBridge('castle-unique-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    const trainOptions = bridge.getSelectionState().trainOptions;
    expect(trainOptions).toEqual(['longbowman']);
  });

  it('Castle under a non-Britons owner exposes no trainable units', () => {
    // castle-non-britons-fixture sets the HUMAN player's civilization
    // to Franks with a completed Castle, so the human-owned Castle
    // offers no trainable units in v1 (only Britons ship a unique unit
    // yet). This is the flip of the prior Britons test.
    const bridge = createSimulationBridge('castle-non-britons-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    const trainOptions = bridge.getSelectionState().trainOptions;
    expect(trainOptions).toEqual([]);
  });

  it('Castle auto-fires on a visible enemy unit within range 8 over a few ticks', () => {
    // castle-defensive-fire-fixture plants a completed player-1 Castle at
    // (14, 6) with an enemy Spearman at (21, 8) — within the Castle's
    // attack range of 8 (south-east footprint corner at (17, 9) is 5 away
    // from (21, 8)). Castle vision radius 11 keeps the target visible.
    // Castle attack 11 pierce > Spearman 45 HP / reload 20 ticks means
    // ~4 shots kill it inside ~80 ticks. We step enough to observe at
    // least one hit.
    const bridge = createSimulationBridge('castle-defensive-fire-fixture');

    const spearmanBefore = findFirstOwnedUnit(bridge, 2, 'spearman');
    expect(spearmanBefore).toBeDefined();

    // Step until either the Spearman is dead OR at least one hit has
    // landed (HP below max). Bail at a generous step budget.
    const spearmanHpDecreased = stepBridgeUntil(
      bridge,
      () => {
        const current = findFirstOwnedUnit(bridge, 2, 'spearman');
        if (!current) {
          return true; // Spearman killed
        }
        const hp = getHealthOfUnitAtCell(bridge, current.x, current.y);
        return hp !== null && hp < 45;
      },
      { maxSteps: 200 },
    );
    expect(spearmanHpDecreased).toBe(true);
  }, 20_000);
});

function getHealthOfUnitAtCell(bridge: Bridge, x: number, y: number): number | null {
  if (!bridge.selectEntityAtCell(x, y)) {
    return null;
  }
  return bridge.getSelectionState().health?.current ?? null;
}
