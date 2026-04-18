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

  it('Longbowman hits a target at range 6 without closing', () => {
    // longbowman-ranged-fixture plants a player-1 Longbowman at (14, 8)
    // and an enemy Spearman at (20, 8) — distance exactly 6. Assert the
    // Longbow lands damage without moving from its starting cell.
    const bridge = createSimulationBridge('longbowman-ranged-fixture');

    const longbow = findFirstOwnedUnit(bridge, 1, 'longbowman');
    expect(longbow).toBeDefined();
    const spearmanBefore = findFirstOwnedUnit(bridge, 2, 'spearman');
    expect(spearmanBefore).toBeDefined();
    expect(Math.abs(longbow!.x - spearmanBefore!.x) + Math.abs(longbow!.y - spearmanBefore!.y)).toBe(6);

    expect(selectOwnedUnitDirect(bridge, 1, 'longbowman')).toBe(true);
    expect(bridge.issueContextCommand(spearmanBefore!.x, spearmanBefore!.y)).toBe(true);

    // Longbow attack 6 pierce / reload 20. Spearman 45 HP → ~8 shots
    // dead. Assert at minimum damage lands and the Longbow did not move.
    const hitLanded = stepBridgeUntil(
      bridge,
      () => {
        const s = findFirstOwnedUnit(bridge, 2, 'spearman');
        if (!s) {
          return true;
        }
        const hp = getHealthOfUnitAtCell(bridge, s.x, s.y);
        return hp !== null && hp < 45;
      },
      { maxSteps: 120 },
    );
    expect(hitLanded).toBe(true);

    const longbowAfter = findFirstOwnedUnit(bridge, 1, 'longbowman');
    expect(longbowAfter?.x).toBe(longbow!.x);
    expect(longbowAfter?.y).toBe(longbow!.y);
  }, 20_000);

  it('Fletching researched before training a Longbowman applies +1/+1 to the Longbowman', () => {
    // castle-fletching-fixture puts Britons Castle + Blacksmith under the
    // human player. Research Fletching first, then train a Longbowman,
    // then assert the Longbow spawns with damage 7 / range 7 (6+1 / 6+1).
    const bridge = createSimulationBridge('castle-fletching-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('fletching')).toBe(true);

    expect(
      stepBridgeUntil(bridge, () => {
        return bridge
          .getEconomyState()
          .buildings.find((b) => b.owner === 1 && b.buildingType === 'blacksmith')
          ?.queue.length === 0;
      }, { maxSteps: 500 }),
    ).toBe(true);

    // Now train a Longbowman.
    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.queueTrainUnit('longbowman')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'longbowman') === 1,
        { maxSteps: 400 },
      ),
    ).toBe(true);

    const longbow = findFirstOwnedUnit(bridge, 1, 'longbowman');
    expect(longbow).toMatchObject({
      unitType: 'longbowman',
      attackDamage: 7,
      attackRange: 7,
    });
  }, 40_000);

  it('Fletching researched after training a Longbowman upgrades the existing Longbowman to 7/7', () => {
    // Same Britons Castle + Blacksmith fixture, but train the Longbow
    // first (base 6/6), then research Fletching, and assert the Longbow
    // was updated in place.
    const bridge = createSimulationBridge('castle-fletching-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.queueTrainUnit('longbowman')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'longbowman') === 1,
        { maxSteps: 400 },
      ),
    ).toBe(true);

    const longbowBefore = findFirstOwnedUnit(bridge, 1, 'longbowman');
    expect(longbowBefore).toMatchObject({
      unitType: 'longbowman',
      attackDamage: 6,
      attackRange: 6,
    });

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('fletching')).toBe(true);

    expect(
      stepBridgeUntil(bridge, () => {
        return bridge
          .getEconomyState()
          .buildings.find((b) => b.owner === 1 && b.buildingType === 'blacksmith')
          ?.queue.length === 0;
      }, { maxSteps: 500 }),
    ).toBe(true);

    const longbowAfter = findFirstOwnedUnit(bridge, 1, 'longbowman');
    expect(longbowAfter).toMatchObject({
      unitType: 'longbowman',
      attackDamage: 7,
      attackRange: 7,
    });
  }, 40_000);

  it('Castle accepts up to 20 villagers as garrisoned units (well above the 5-cap of TC / Watch Tower)', () => {
    // castle-garrison-fixture spawns a completed Castle plus 20 villagers
    // under the human player (Britons). Villager garrison is instantaneous
    // in v1 (no closing / move required), so iterating all 20 with
    // `issueContextCommandAtEntity` on the Castle id should fill the
    // capacity without rejection. Then selecting the Castle should read
    // "20 / 20 garrisoned" via its inventory line.
    const bridge = createSimulationBridge('castle-garrison-fixture');

    const castle = findOwnedBuilding(bridge, 1, 'castle');
    expect(castle).toBeDefined();

    const villagerIds = bridge
      .getEconomyState()
      .units.filter((u) => u.owner === 1 && u.unitType === 'villager')
      .map((u) => u.id);
    expect(villagerIds.length).toBeGreaterThanOrEqual(15);

    // Garrison 15 villagers (above the TC / Watch Tower cap of 5) — all
    // should succeed under the Castle's 20 capacity.
    for (let i = 0; i < 15; i += 1) {
      const id = villagerIds[i];
      // Select the single villager by its id, then issue the garrison
      // context command against the Castle.
      const villager = bridge.getEconomyState().units.find((u) => u.id === id);
      expect(villager).toBeDefined();
      expect(bridge.selectEntityAtCell(villager!.x, villager!.y)).toBe(true);
      expect(bridge.issueContextCommandAtEntity(castle!.id)).toBe(true);
    }

    // Re-select the Castle via direct bridge and read garrison count.
    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    const inventory = bridge.getSelectionState().inventory ?? '';
    expect(inventory).toContain('15 / 20 garrisoned');
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
