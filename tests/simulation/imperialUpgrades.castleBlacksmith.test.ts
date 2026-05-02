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


describe('Imperial-Age Castle upgrade (Britons-gated Elite Longbowman)', () => {
  it('exposes elite-longbowman-upgrade at the Castle for a Britons owner in Imperial Age', () => {
    const bridge = createSimulationBridge('imperial-castle-britons-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    const options = bridge.getSelectionState().researchOptions;
    expect(options).toContain('elite-longbowman-upgrade');
  });

  it('does not expose elite-longbowman-upgrade at the Castle for a non-Britons owner', () => {
    const bridge = createSimulationBridge('imperial-castle-franks-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    const options = bridge.getSelectionState().researchOptions;
    expect(options).not.toContain('elite-longbowman-upgrade');
  });

  it('researches Elite Longbowman at the Castle and swaps existing Longbowmen', () => {
    const bridge = createSimulationBridge('imperial-castle-britons-fixture');

    const startingLongbow = findFirstOwnedUnit(bridge, 1, 'longbowman');
    expect(startingLongbow).toBeDefined();
    const longbowId = startingLongbow!.id;

    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.queueResearch('elite-longbowman-upgrade')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'elite-longbowman') === 1
          && countOwnedUnits(bridge, 1, 'longbowman') === 0,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    const upgraded = bridge.getEconomyState().units.find((unit) => unit.id === longbowId);
    expect(upgraded?.unitType).toBe('elite-longbowman');
  }, 30_000);

  it('exposes Elite Longbowman in the Castle train menu after the upgrade (drops Longbowman)', () => {
    const bridge = createSimulationBridge('imperial-castle-britons-fixture');

    // Starting state: Britons owner, no upgrade, Castle trains Longbowman.
    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('longbowman');
    expect(bridge.getSelectionState().trainOptions).not.toContain('elite-longbowman');

    expect(bridge.queueResearch('elite-longbowman-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'elite-longbowman') >= 1,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('elite-longbowman');
    expect(bridge.getSelectionState().trainOptions).not.toContain('longbowman');
  }, 30_000);

  it('applies Fletching +1 attack / +1 range to Elite Longbowman', () => {
    const bridge = createSimulationBridge('imperial-castle-britons-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('fletching')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const lbow = findFirstOwnedUnit(bridge, 1, 'longbowman');
          return !!lbow && lbow.attackDamage === 7 && lbow.attackRange === 7;
        },
        { maxSteps: 500 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.queueResearch('elite-longbowman-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'elite-longbowman') === 1,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    // Elite Longbowman base attack 7 / base range 6. With Fletching
    // stacked via isArcherLineUnit: atk 8 / range 7.
    const upgraded = findFirstOwnedUnit(bridge, 1, 'elite-longbowman');
    expect(upgraded?.attackDamage).toBe(8);
    expect(upgraded?.attackRange).toBe(7);
  }, 30_000);
});

describe('Imperial-Age Blacksmith upgrades', () => {
  it('exposes Bracer / Blast Furnace / Plate Mail Armor / Plate Barding at the Blacksmith in Imperial Age', () => {
    const bridge = createSimulationBridge('imperial-blacksmith-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    const options = bridge.getSelectionState().researchOptions;
    expect(options).toContain('bracer');
    expect(options).toContain('blast-furnace');
    expect(options).toContain('plate-mail-armor');
    expect(options).toContain('plate-barding');
  });

  it('does not expose Imperial Blacksmith techs before Imperial Age', () => {
    const bridge = createSimulationBridge('castle-upgrades-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    const options = bridge.getSelectionState().researchOptions;
    // Castle Age: Fletching is the only Blacksmith option until Imperial
    // Age unlocks the four Imperial techs.
    expect(options).not.toContain('bracer');
    expect(options).not.toContain('blast-furnace');
    expect(options).not.toContain('plate-mail-armor');
    expect(options).not.toContain('plate-barding');
  });

  it('stacks Bracer on top of the base Arbalest stats', () => {
    const bridge = createSimulationBridge('imperial-blacksmith-fixture');

    const baseArbalest = findFirstOwnedUnit(bridge, 1, 'arbalest');
    expect(baseArbalest).toBeDefined();
    // Arbalest base atk 6 / range 5 per Slice 7A stats.
    expect(baseArbalest?.attackDamage).toBe(6);
    expect(baseArbalest?.attackRange).toBe(5);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('bracer')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const arb = findFirstOwnedUnit(bridge, 1, 'arbalest');
          return !!arb && arb.attackDamage === 7 && arb.attackRange === 6;
        },
        { maxSteps: 700 },
      ),
    ).toBe(true);

    // Research the arbalest-upgrade so the Archery Range exposes Arbalest
    // in its train menu, then train one to prove createCombatState carries
    // the Bracer bonus onto newly spawned archer-line units.
    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.queueResearch('arbalest-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getSelectionState().trainOptions.includes('arbalest'),
        { maxSteps: 700 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.queueTrainUnit('arbalest')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () =>
          bridge
            .getEconomyState()
            .units.filter((u) => u.owner === 1 && u.unitType === 'arbalest').length >= 2,
        { maxSteps: 700 },
      ),
    ).toBe(true);

    const allArbs = bridge
      .getEconomyState()
      .units.filter((u) => u.owner === 1 && u.unitType === 'arbalest');
    expect(allArbs.length).toBeGreaterThanOrEqual(2);
    expect(allArbs.every((u) => u.attackDamage === 7 && u.attackRange === 6)).toBe(true);
  }, 30_000);

  it('stacks Bracer on top of Fletching (Arbalest atk = base + 2, range = base + 2)', () => {
    const bridge = createSimulationBridge('imperial-blacksmith-fixture');

    // Research Fletching first.
    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('fletching')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const arb = findFirstOwnedUnit(bridge, 1, 'arbalest');
          return !!arb && arb.attackDamage === 7 && arb.attackRange === 6;
        },
        { maxSteps: 700 },
      ),
    ).toBe(true);

    // Then Bracer — stacks cumulatively for atk + 2 / range + 2 above base.
    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('bracer')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const arb = findFirstOwnedUnit(bridge, 1, 'arbalest');
          return !!arb && arb.attackDamage === 8 && arb.attackRange === 7;
        },
        { maxSteps: 700 },
      ),
    ).toBe(true);
  }, 30_000);

  it('gives Champion +2 attack via Blast Furnace', () => {
    const bridge = createSimulationBridge('imperial-blacksmith-fixture');

    const baseChampion = findFirstOwnedUnit(bridge, 1, 'champion');
    expect(baseChampion).toBeDefined();
    // Champion base atk 13 per Slice 7A.
    expect(baseChampion?.attackDamage).toBe(13);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('blast-furnace')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const champ = findFirstOwnedUnit(bridge, 1, 'champion');
          return !!champ && champ.attackDamage === 15;
        },
        { maxSteps: 800 },
      ),
    ).toBe(true);
  }, 30_000);

  it('gives Halberdier +1 armor via Plate Mail Armor', () => {
    const bridge = createSimulationBridge('imperial-blacksmith-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'halberdier')).toBe(true);
    expect(bridge.getSelectionState().armor).toBe(0);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('plate-mail-armor')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const halb = findFirstOwnedUnit(bridge, 1, 'halberdier');
          return !!halb && halb.armor === 1;
        },
        { maxSteps: 800 },
      ),
    ).toBe(true);

    expect(selectOwnedUnitDirect(bridge, 1, 'halberdier')).toBe(true);
    expect(bridge.getSelectionState().armor).toBe(1);
  }, 30_000);

  it('gives Cavalier +1 armor via Plate Barding', () => {
    const bridge = createSimulationBridge('imperial-blacksmith-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'cavalier')).toBe(true);
    expect(bridge.getSelectionState().armor).toBe(0);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('plate-barding')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const cav = findFirstOwnedUnit(bridge, 1, 'cavalier');
          return !!cav && cav.armor === 1;
        },
        { maxSteps: 800 },
      ),
    ).toBe(true);

    expect(selectOwnedUnitDirect(bridge, 1, 'cavalier')).toBe(true);
    expect(bridge.getSelectionState().armor).toBe(1);
  }, 30_000);
});
