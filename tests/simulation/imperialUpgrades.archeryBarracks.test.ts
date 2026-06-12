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

describe('Imperial-Age Archery Range upgrades', () => {
  it('exposes Arbalest and Heavy Cavalry Archer research options at the Archery Range in Imperial Age', () => {
    const bridge = createSimulationBridge('imperial-arbalest-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    const options = bridge.getSelectionState().researchOptions;
    expect(options).toContain('arbalest-upgrade');
    expect(options).toContain('heavy-cavalry-archer-upgrade');
  });

  it('researches Arbalest at the Archery Range and swaps existing Crossbowmen to Arbalest', () => {
    const bridge = createSimulationBridge('imperial-arbalest-fixture');

    const startingCrossbowman = findFirstOwnedUnit(bridge, 1, 'crossbowman');
    expect(startingCrossbowman).toBeDefined();
    const crossbowmanId = startingCrossbowman!.id;

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.queueResearch('arbalest-upgrade')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'arbalest') === 1
          && countOwnedUnits(bridge, 1, 'crossbowman') === 0,
        { maxSteps: 600 },
      ),
    ).toBe(true);

    const upgraded = bridge.getEconomyState().units.find((unit) => unit.id === crossbowmanId);
    expect(upgraded?.unitType).toBe('arbalest');
  }, 60_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)

  it('trains Arbalest after the Arbalest upgrade (train menu exposes Arbalest, drops archer-line predecessors)', () => {
    const bridge = createSimulationBridge('imperial-arbalest-fixture');

    // Starting fixture has the human in Imperial Age but with neither
    // crossbowman-upgrade nor arbalest-upgrade researched, so the archer
    // slot in the Archery Range train menu defaults to 'archer'.
    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('archer');
    expect(bridge.getSelectionState().trainOptions).not.toContain('arbalest');
    expect(bridge.getSelectionState().trainOptions).not.toContain('crossbowman');

    expect(bridge.queueResearch('arbalest-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'arbalest') >= 1,
        { maxSteps: 600 },
      ),
    ).toBe(true);

    // After research, arbalest replaces the archer slot entirely (neither
    // archer nor crossbowman remain in the menu).
    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('arbalest');
    expect(bridge.getSelectionState().trainOptions).not.toContain('crossbowman');
    expect(bridge.getSelectionState().trainOptions).not.toContain('archer');

    expect(bridge.queueTrainUnit('arbalest')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'arbalest') >= 2,
        { maxSteps: 600 },
      ),
    ).toBe(true);
  }, 60_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)

  it('researches Heavy Cavalry Archer and swaps existing Cavalry Archers', () => {
    const bridge = createSimulationBridge('imperial-arbalest-fixture');

    const startingCa = findFirstOwnedUnit(bridge, 1, 'cavalry-archer');
    expect(startingCa).toBeDefined();
    const caId = startingCa!.id;

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.queueResearch('heavy-cavalry-archer-upgrade')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'heavy-cavalry-archer') === 1
          && countOwnedUnits(bridge, 1, 'cavalry-archer') === 0,
        { maxSteps: 800 },
      ),
    ).toBe(true);

    const upgraded = bridge.getEconomyState().units.find((unit) => unit.id === caId);
    expect(upgraded?.unitType).toBe('heavy-cavalry-archer');
  }, 60_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)

  it('swaps the Cavalry Archer train option for Heavy Cavalry Archer after research', () => {
    const bridge = createSimulationBridge('imperial-arbalest-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('cavalry-archer');
    expect(bridge.getSelectionState().trainOptions).not.toContain('heavy-cavalry-archer');

    expect(bridge.queueResearch('heavy-cavalry-archer-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'heavy-cavalry-archer') >= 1,
        { maxSteps: 800 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('heavy-cavalry-archer');
    expect(bridge.getSelectionState().trainOptions).not.toContain('cavalry-archer');
  }, 60_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)

  it('applies Fletching +1 attack / +1 range to Arbalest after the upgrade', () => {
    const bridge = createSimulationBridge('imperial-arbalest-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('fletching')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const xbow = findFirstOwnedUnit(bridge, 1, 'crossbowman');
          return !!xbow && xbow.attackDamage === 6 && xbow.attackRange === 6;
        },
        { maxSteps: 500 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.queueResearch('arbalest-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'arbalest') === 1,
        { maxSteps: 600 },
      ),
    ).toBe(true);

    // Arbalest base attack is 6 and base range is 5 (per Slice 7A stats).
    // With Fletching: +1 atk / +1 range => atk 7 / range 6.
    const upgraded = findFirstOwnedUnit(bridge, 1, 'arbalest');
    expect(upgraded?.attackDamage).toBe(7);
    expect(upgraded?.attackRange).toBe(6);
  }, 60_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)
});

describe('Imperial-Age Barracks upgrades', () => {
  it('exposes Halberdier and Champion research options at the Barracks in Imperial Age', () => {
    const bridge = createSimulationBridge('imperial-halberdier-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    const options = bridge.getSelectionState().researchOptions;
    expect(options).toContain('halberdier-upgrade');
    expect(options).toContain('champion-upgrade');
  });

  it('researches Halberdier at the Barracks and swaps existing Pikemen to Halberdier', () => {
    const bridge = createSimulationBridge('imperial-halberdier-fixture');

    const startingPikeman = findFirstOwnedUnit(bridge, 1, 'pikeman');
    expect(startingPikeman).toBeDefined();
    const pikemanId = startingPikeman!.id;

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.queueResearch('halberdier-upgrade')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'halberdier') === 1
          && countOwnedUnits(bridge, 1, 'pikeman') === 0,
        { maxSteps: 800 },
      ),
    ).toBe(true);

    const upgraded = bridge.getEconomyState().units.find((unit) => unit.id === pikemanId);
    expect(upgraded?.unitType).toBe('halberdier');
  }, 60_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)

  it('exposes Halberdier in the Barracks train menu after the Halberdier upgrade (drops spearman-line predecessors)', () => {
    const bridge = createSimulationBridge('imperial-halberdier-fixture');

    // Starting fixture has the human in Imperial Age but with neither
    // pikeman-upgrade nor halberdier-upgrade researched, so the spearman
    // slot defaults to 'spearman'.
    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('spearman');
    expect(bridge.getSelectionState().trainOptions).not.toContain('halberdier');
    expect(bridge.getSelectionState().trainOptions).not.toContain('pikeman');

    expect(bridge.queueResearch('halberdier-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'halberdier') >= 1,
        { maxSteps: 800 },
      ),
    ).toBe(true);

    // After research, Halberdier replaces the spearman slot entirely (no
    // spearman / pikeman in the menu).
    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('halberdier');
    expect(bridge.getSelectionState().trainOptions).not.toContain('pikeman');
    expect(bridge.getSelectionState().trainOptions).not.toContain('spearman');
  }, 60_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)

  it('researches Champion and swaps existing Militia to Champion', () => {
    const bridge = createSimulationBridge('imperial-halberdier-fixture');

    const startingMilitia = findFirstOwnedUnit(bridge, 1, 'militia');
    expect(startingMilitia).toBeDefined();
    const militiaId = startingMilitia!.id;

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.queueResearch('champion-upgrade')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'champion') === 1
          && countOwnedUnits(bridge, 1, 'militia') === 0,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    const upgraded = bridge.getEconomyState().units.find((unit) => unit.id === militiaId);
    expect(upgraded?.unitType).toBe('champion');
  }, 60_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)

  it('swaps the Militia train option for Champion after research', () => {
    const bridge = createSimulationBridge('imperial-halberdier-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('militia');
    expect(bridge.getSelectionState().trainOptions).not.toContain('champion');

    expect(bridge.queueResearch('champion-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'champion') >= 1,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('champion');
    expect(bridge.getSelectionState().trainOptions).not.toContain('militia');
  }, 60_000); // x2 2026-06-12: engine-1.0.x sim-throughput regression (+50-75% observed; see docs/engine-feedback/current.md)
});

