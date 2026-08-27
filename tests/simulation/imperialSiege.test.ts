// v0.3.138 tech-tree denials: the default Britons/Franks lack Bombard Cannon
// (a real AoE2 hole), so this file pins Saracens, whose gunpowder is complete.
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
    const bridge = createSimulationBridge('imperial-siege-fixture', { civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]) });

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    const options = bridge.getSelectionState().researchOptions;
    expect(options).toContain('onager-upgrade');
    expect(options).toContain('heavy-scorpion-upgrade');
    // The ram line is three tiers (v0.3.45), so the Siege upgrade only appears
    // once the Capped one is in — offering an upgrade whose input unit the
    // player cannot have would be a menu that lies.
    expect(options).toContain('capped-ram-upgrade');
    expect(options).not.toContain('siege-ram-upgrade');
  });

  it('researches Onager at the Siege Workshop and swaps existing Mangonels to Onager', () => {
    const bridge = createSimulationBridge('imperial-siege-fixture', { civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]) });

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
    const bridge = createSimulationBridge('imperial-siege-fixture', { civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]) });

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
    const bridge = createSimulationBridge('onager-min-range-blocked-fixture', { civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]) });

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
    const bridge = createSimulationBridge('imperial-siege-fixture', { civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]) });

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
    const bridge = createSimulationBridge('imperial-siege-fixture', { civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]) });

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

  it('walks a Battering Ram up the whole line, one tier at a time', () => {
    const bridge = createSimulationBridge('imperial-siege-fixture', { civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]) });

    const startingRam = findFirstOwnedUnit(bridge, 1, 'battering-ram');
    expect(startingRam).toBeDefined();
    const ramId = startingRam!.id;

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.queueResearch('capped-ram-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'capped-ram') === 1
          && countOwnedUnits(bridge, 1, 'battering-ram') === 0,
        { maxSteps: 1500 },
      ),
    ).toBe(true);
    // Same entity throughout: an upgrade swaps the unit's type, it does not
    // replace the unit.
    expect(bridge.getEconomyState().units.find((u) => u.id === ramId)?.unitType).toBe('capped-ram');

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.queueResearch('siege-ram-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'siege-ram') === 1
          && countOwnedUnits(bridge, 1, 'capped-ram') === 0,
        { maxSteps: 1500 },
      ),
    ).toBe(true);
    expect(bridge.getEconomyState().units.find((u) => u.id === ramId)?.unitType).toBe('siege-ram');
  }, 60_000);

  it('swaps the Battering Ram train option for Siege Ram after research', () => {
    const bridge = createSimulationBridge('imperial-siege-fixture', { civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]) });

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('battering-ram');
    expect(bridge.getSelectionState().trainOptions).not.toContain('capped-ram');

    expect(bridge.queueResearch('capped-ram-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'capped-ram') >= 1,
        { maxSteps: 1500 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('capped-ram');
    expect(bridge.getSelectionState().trainOptions).not.toContain('battering-ram');
  }, 30_000);

  it('deals +200 bonus damage when a Siege Ram attacks a building (upgraded from Battering Ram +125)', () => {
    // Siege Ram base attack 3 + 200 anti-building bonus = 203 per hit.
    // A Town Center with 200 HP (below its default 2400 max) should drop to
    // 0 after a single hit — confirming the Siege Ram's huge anti-building
    // bonus scaled up from the Ram's +125.
    const bridge = createSimulationBridge('siege-ram-vs-building-fixture', { civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]) });

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

describe('Bombard Cannon', () => {
  it('appears in the Siege Workshop train menu at Imperial Age', () => {
    const bridge = createSimulationBridge('imperial-siege-fixture', { civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]) });

    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('bombard-cannon');
  });

  it('deals +200 bonus damage against buildings at long range', () => {
    // Bombard Cannon base attack 40 + 200 anti-building bonus = 240 per hit.
    // A Town Center with 200 HP drops in a single hit.
    const bridge = createSimulationBridge('bombard-cannon-vs-building-fixture', { civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]) });

    const tc = bridge.getEconomyState().buildings.find(
      (b) => b.owner === 2 && b.buildingType === 'town-center',
    );
    expect(tc).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, 1, 'bombard-cannon')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(tc!.id)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          bridge
            .getEconomyState()
            .buildings.find((b) => b.owner === 2 && b.buildingType === 'town-center') === undefined,
        { maxSteps: 400 },
      ),
    ).toBe(true);
  }, 30_000);

  it('holds fire when the target is inside its minimum range of 5', () => {
    const bridge = createSimulationBridge('bombard-cannon-min-range-blocked-fixture', { civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]) });

    const targetSpearman = findFirstOwnedUnit(bridge, 2, 'spearman');
    expect(targetSpearman).toBeDefined();
    const targetHpBefore = targetSpearman ? getHealthOfUnitAtCell(bridge, targetSpearman.x, targetSpearman.y) : null;
    expect(targetHpBefore).not.toBeNull();

    expect(selectOwnedUnitDirect(bridge, 1, 'bombard-cannon')).toBe(true);
    const spearmanEntityId = targetSpearman!.id;
    bridge.issueContextCommandAtEntity(spearmanEntityId);

    for (let i = 0; i < 30; i += 1) {
      bridge.step(100);
    }

    const spearmanAfter = bridge
      .getEconomyState()
      .units.find((unit) => unit.id === spearmanEntityId);
    expect(spearmanAfter).toBeDefined();
    const targetHpAfter = getHealthOfUnitAtCell(bridge, spearmanAfter!.x, spearmanAfter!.y);
    expect(targetHpAfter).toBe(targetHpBefore);
  }, 15_000);
});

describe('Trebuchet', () => {
  it('appears in the Castle train menu at Imperial Age regardless of civilization', () => {
    // Default civs on purpose: the assertion below is about the BRITON
    // unique unit sharing the card with the Trebuchet.
    const bridge = createSimulationBridge('imperial-castle-fixture');

    // Britons player-1 Castle: Longbowman (or Elite Longbowman if researched) + Trebuchet.
    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    const britonsOptions = bridge.getSelectionState().trainOptions;
    expect(britonsOptions).toContain('trebuchet');
    expect(britonsOptions.some((unit) => unit === 'longbowman' || unit === 'elite-longbowman')).toBe(true);
  });

});
