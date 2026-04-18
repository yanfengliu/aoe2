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

  it('lets a Mangonel hit a distant Spearman at range 7 without closing', () => {
    const bridge = createSimulationBridge('mangonel-ranged-fixture');

    const spearman = findFirstOwnedUnit(bridge, 2, 'spearman');
    expect(spearman).toBeDefined();
    const spearmanHpBefore = getHealthOfUnitAtCell(bridge, spearman!.x, spearman!.y);
    expect(spearmanHpBefore).toBe(45);

    const mangonel = findFirstOwnedUnit(bridge, 1, 'mangonel');
    expect(mangonel).toBeDefined();
    const distance = Math.abs(mangonel!.x - spearman!.x) + Math.abs(mangonel!.y - spearman!.y);
    expect(distance).toBe(7);

    expect(selectOwnedUnitDirect(bridge, 1, 'mangonel')).toBe(true);
    expect(bridge.issueContextCommand(spearman!.x, spearman!.y)).toBe(true);

    // Mangonel base atk 40; Spearman dies in one hit (45 - 40 = 5 HP, and
    // would drop to 0 if armor is 0). We assert the spearman entity
    // disappears or its HP has decreased, and the Mangonel did not move.
    expect(
      stepBridgeUntil(
        bridge,
        () => findFirstOwnedUnit(bridge, 2, 'spearman') === undefined,
        { maxSteps: 120 },
      ),
    ).toBe(true);

    const mangonelAfter = findFirstOwnedUnit(bridge, 1, 'mangonel');
    expect(mangonelAfter?.x).toBe(mangonel!.x);
    expect(mangonelAfter?.y).toBe(mangonel!.y);
  }, 20_000);

  it('deals +75 bonus damage when a Battering Ram attacks a building', () => {
    // Ram base attack is 2 + 75 anti-building bonus = 77 damage per hit. A
    // House has 75 HP, so a single hit destroys it. The v1 combat model has
    // no building-armor reduction (only unit armor for ranged/melee).
    const bridge = createSimulationBridge('ram-vs-building-fixture');

    const house = bridge.getEconomyState().buildings.find((b) => b.owner === 2 && b.buildingType === 'house');
    expect(house).toBeDefined();

    const ram = findFirstOwnedUnit(bridge, 1, 'battering-ram');
    expect(ram).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, 1, 'battering-ram')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(house!.id)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().buildings.find((b) => b.owner === 2 && b.buildingType === 'house') === undefined,
        { maxSteps: 200 },
      ),
    ).toBe(true);
  }, 20_000);

  it('deals only base damage when a Battering Ram attacks a villager (no +75 bonus vs units)', () => {
    const bridge = createSimulationBridge('ram-vs-villager-fixture');

    const villager = findFirstOwnedUnit(bridge, 2, 'villager');
    expect(villager).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, 1, 'battering-ram')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(villager!.id)).toBe(true);

    // Step exactly one tick so the Ram's first hit lands before the enemy AI
    // can move the villager (player 2 villager starts the house-build loop
    // and walks away otherwise). The Ram's attack-command was set before any
    // step and fires on tick 1 at the pre-AI villager position (15, 8).
    bridge.step(100);

    // Locate the villager by id since it may have moved off its spawn cell.
    const vAfter = bridge.getEconomyState().units.find((u) => u.id === villager!.id);
    expect(vAfter).toBeDefined();
    const villagerHpAfter = getHealthOfUnitAtCell(bridge, vAfter!.x, vAfter!.y);
    // Ram base attack 2, NO +75 vs unit target. Villager: 25 -> 23. If the
    // building bonus bled into the unit path the villager would be at -52
    // (destroyed on tick 1).
    expect(villagerHpAfter).toBe(23);
  }, 10_000);

  it('lets a Scorpion hit a distant Spearman at range 7 without closing', () => {
    const bridge = createSimulationBridge('scorpion-ranged-fixture');

    const spearman = findFirstOwnedUnit(bridge, 2, 'spearman');
    expect(spearman).toBeDefined();
    const spearmanHpBefore = getHealthOfUnitAtCell(bridge, spearman!.x, spearman!.y);
    expect(spearmanHpBefore).toBe(45);

    const scorpion = findFirstOwnedUnit(bridge, 1, 'scorpion');
    expect(scorpion).toBeDefined();
    const distance = Math.abs(scorpion!.x - spearman!.x) + Math.abs(scorpion!.y - spearman!.y);
    expect(distance).toBe(7);

    expect(selectOwnedUnitDirect(bridge, 1, 'scorpion')).toBe(true);
    expect(bridge.issueContextCommand(spearman!.x, spearman!.y)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const hp = getHealthOfUnitAtCell(bridge, spearman!.x, spearman!.y);
          return hp !== null && hp < 45;
        },
        { maxSteps: 80 },
      ),
    ).toBe(true);

    // Scorpion base atk 12. First hit at range: 45 -> 33.
    const spearmanHpAfter = getHealthOfUnitAtCell(bridge, spearman!.x, spearman!.y);
    expect(spearmanHpAfter).toBe(33);

    const scorpionAfter = findFirstOwnedUnit(bridge, 1, 'scorpion');
    expect(scorpionAfter?.x).toBe(scorpion!.x);
    expect(scorpionAfter?.y).toBe(scorpion!.y);
  }, 20_000);
});

function getHealthOfUnitAtCell(bridge: Bridge, x: number, y: number): number | null {
  if (!bridge.selectEntityAtCell(x, y)) {
    return null;
  }
  return bridge.getSelectionState().health?.current ?? null;
}
