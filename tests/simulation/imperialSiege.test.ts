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

function getHealthOfUnitAtCell(bridge: Bridge, x: number, y: number): number | null {
  if (!bridge.selectEntityAtCell(x, y)) {
    return null;
  }
  return bridge.getSelectionState().health?.current ?? null;
}

describe('Imperial-Age Siege Workshop upgrades', () => {
  it('exposes Onager, Heavy Scorpion, and Siege Ram research options at the Siege Workshop in Imperial Age', () => {
    const bridge = createSimulationBridge('imperial-siege-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    const options = bridge.getSelectionState().researchOptions;
    expect(options).toContain('onager-upgrade');
    expect(options).toContain('heavy-scorpion-upgrade');
    expect(options).toContain('siege-ram-upgrade');
  });

  it('researches Onager at the Siege Workshop and swaps existing Mangonels to Onager', () => {
    const bridge = createSimulationBridge('imperial-siege-fixture');

    const startingMangonel = findFirstOwnedUnit(bridge, 1, 'mangonel');
    expect(startingMangonel).toBeDefined();
    const mangonelId = startingMangonel!.id;

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.queueResearch('onager-upgrade')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'onager') === 1
          && countOwnedUnits(bridge, 1, 'mangonel') === 0,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    const upgraded = bridge.getEconomyState().units.find((unit) => unit.id === mangonelId);
    expect(upgraded?.unitType).toBe('onager');
  }, 30_000);

  it('exposes Onager in the Siege Workshop train menu after research (drops Mangonel)', () => {
    const bridge = createSimulationBridge('imperial-siege-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('mangonel');
    expect(bridge.getSelectionState().trainOptions).not.toContain('onager');

    expect(bridge.queueResearch('onager-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'onager') >= 1,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('onager');
    expect(bridge.getSelectionState().trainOptions).not.toContain('mangonel');
  }, 30_000);

  it('holds Onager fire when the target is inside its minimum range of 3', () => {
    // Onager inherits the Mangonel's min-range 3 "dead zone". Identical
    // setup to the mangonel-min-range-blocked fixture but an Onager is
    // placed at distance 2 from a Spearman. The Onager must hold fire.
    const bridge = createSimulationBridge('onager-min-range-blocked-fixture');

    const spearman = findFirstOwnedUnit(bridge, 2, 'spearman');
    expect(spearman).toBeDefined();
    const spearmanIdBefore = spearman!.id;

    expect(selectOwnedUnitDirect(bridge, 1, 'onager')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(spearmanIdBefore)).toBe(true);

    // Run past one full reload cycle (60 ticks). A missing min-range check
    // would let the Onager fire and obliterate the Spearman.
    for (let index = 0; index < 20; index += 1) {
      bridge.step(100);
    }

    const spearmanAfter = bridge.getEconomyState().units.find((u) => u.id === spearmanIdBefore);
    expect(spearmanAfter).toBeDefined();
    const spearmanHp = getHealthOfUnitAtCell(bridge, spearmanAfter!.x, spearmanAfter!.y);
    expect(spearmanHp).toBe(45); // untouched
  }, 10_000);

  it('researches Heavy Scorpion at the Siege Workshop and swaps existing Scorpions', () => {
    const bridge = createSimulationBridge('imperial-siege-fixture');

    const startingScorpion = findFirstOwnedUnit(bridge, 1, 'scorpion');
    expect(startingScorpion).toBeDefined();
    const scorpionId = startingScorpion!.id;

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.queueResearch('heavy-scorpion-upgrade')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'heavy-scorpion') === 1
          && countOwnedUnits(bridge, 1, 'scorpion') === 0,
        { maxSteps: 1500 },
      ),
    ).toBe(true);

    const upgraded = bridge.getEconomyState().units.find((unit) => unit.id === scorpionId);
    expect(upgraded?.unitType).toBe('heavy-scorpion');
  }, 30_000);

  it('swaps the Scorpion train option for Heavy Scorpion after research', () => {
    const bridge = createSimulationBridge('imperial-siege-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('scorpion');
    expect(bridge.getSelectionState().trainOptions).not.toContain('heavy-scorpion');

    expect(bridge.queueResearch('heavy-scorpion-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'heavy-scorpion') >= 1,
        { maxSteps: 1500 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('heavy-scorpion');
    expect(bridge.getSelectionState().trainOptions).not.toContain('scorpion');
  }, 30_000);

  it('researches Siege Ram at the Siege Workshop and swaps existing Battering Rams', () => {
    const bridge = createSimulationBridge('imperial-siege-fixture');

    const startingRam = findFirstOwnedUnit(bridge, 1, 'battering-ram');
    expect(startingRam).toBeDefined();
    const ramId = startingRam!.id;

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.queueResearch('siege-ram-upgrade')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'siege-ram') === 1
          && countOwnedUnits(bridge, 1, 'battering-ram') === 0,
        { maxSteps: 1500 },
      ),
    ).toBe(true);

    const upgraded = bridge.getEconomyState().units.find((unit) => unit.id === ramId);
    expect(upgraded?.unitType).toBe('siege-ram');
  }, 30_000);

  it('swaps the Battering Ram train option for Siege Ram after research', () => {
    const bridge = createSimulationBridge('imperial-siege-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('battering-ram');
    expect(bridge.getSelectionState().trainOptions).not.toContain('siege-ram');

    expect(bridge.queueResearch('siege-ram-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'siege-ram') >= 1,
        { maxSteps: 1500 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('siege-ram');
    expect(bridge.getSelectionState().trainOptions).not.toContain('battering-ram');
  }, 30_000);

  it('deals +250 bonus damage when a Siege Ram attacks a building (upgraded from Battering Ram +75)', () => {
    // Siege Ram base attack 3 + 250 anti-building bonus = 253 per hit.
    // A Town Center with 200 HP (below its default 2400 max) should drop to
    // 0 after a single hit — confirming the Siege Ram's huge anti-building
    // bonus scaled up from the Ram's +75.
    const bridge = createSimulationBridge('siege-ram-vs-building-fixture');

    const tc = bridge.getEconomyState().buildings.find(
      (b) => b.owner === 2 && b.buildingType === 'town-center',
    );
    expect(tc).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, 1, 'siege-ram')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(tc!.id)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          bridge
            .getEconomyState()
            .buildings.find((b) => b.owner === 2 && b.buildingType === 'town-center') === undefined,
        { maxSteps: 200 },
      ),
    ).toBe(true);
  }, 20_000);
});
