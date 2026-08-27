// v0.3.138 tech-tree denials: this suite's default owners were Britons/
// Franks, whose REAL AoE2 holes deny the content under test — it now boots
// Persians, whose tree carries it.
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

describe('Halberdier anti-cavalry bonus', () => {
  it('deals more damage to a Knight than a Pikeman does', () => {
    // Pikeman: base 4 atk + 22 vs knight = 26; Knight (100 HP) -> 74.
    // Halberdier: base 6 atk + 28 vs knight = 34; Knight (100 HP) -> 66.
    // The Halberdier must leave the Knight with strictly less HP after the
    // first hit than the Pikeman does.

    const pikemanBridge = createSimulationBridge('pikeman-vs-knight-fixture', { civilizationsByOwner: new Map([[1, 'Persians'], [2, 'Persians']]) });
    const pikemanKnight = findFirstOwnedUnit(pikemanBridge, 2, 'knight');
    expect(pikemanKnight).toBeDefined();

    expect(selectOwnedUnitDirect(pikemanBridge, 1, 'pikeman')).toBe(true);
    expect(pikemanBridge.issueContextCommand(pikemanKnight!.x, pikemanKnight!.y)).toBe(true);
    expect(
      stepBridgeUntil(
        pikemanBridge,
        () => {
          const hp = getHealthOfUnitAtCell(pikemanBridge, pikemanKnight!.x, pikemanKnight!.y);
          return hp !== null && hp < 100;
        },
        { maxSteps: 60 },
      ),
    ).toBe(true);
    const pikemanKnightHp = getHealthOfUnitAtCell(
      pikemanBridge,
      pikemanKnight!.x,
      pikemanKnight!.y,
    );

    const halbBridge = createSimulationBridge('halberdier-vs-knight-fixture', { civilizationsByOwner: new Map([[1, 'Persians'], [2, 'Persians']]) });
    const halbKnight = findFirstOwnedUnit(halbBridge, 2, 'knight');
    expect(halbKnight).toBeDefined();

    expect(selectOwnedUnitDirect(halbBridge, 1, 'halberdier')).toBe(true);
    expect(halbBridge.issueContextCommand(halbKnight!.x, halbKnight!.y)).toBe(true);
    expect(
      stepBridgeUntil(
        halbBridge,
        () => {
          const hp = getHealthOfUnitAtCell(halbBridge, halbKnight!.x, halbKnight!.y);
          return hp !== null && hp < 100;
        },
        { maxSteps: 60 },
      ),
    ).toBe(true);
    const halbKnightHp = getHealthOfUnitAtCell(halbBridge, halbKnight!.x, halbKnight!.y);

    expect(pikemanKnightHp).not.toBeNull();
    expect(halbKnightHp).not.toBeNull();
    expect(halbKnightHp!).toBeLessThan(pikemanKnightHp!);

    // Exact values: the Knight's 2 base melee armor (units.csv 2/2) reduces
    // each hit by 2. Pikeman 26 raw (4 + 22 cavalry) - 2 = 24 -> 76 HP;
    // Halberdier 38 raw (6 + 32 cavalry) - 2 = 36 -> 64 HP. The Halberdier
    // still hits harder, so halb < pikeman holds.
    expect(pikemanKnightHp).toBe(76);
    expect(halbKnightHp).toBe(64);
  }, 30_000);
});

describe('Imperial-Age Stable upgrades', () => {
  it('exposes Hussar and Cavalier research options at the Stable in Imperial Age', () => {
    const bridge = createSimulationBridge('imperial-stable-fixture', { civilizationsByOwner: new Map([[1, 'Persians'], [2, 'Persians']]) });

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    const options = bridge.getSelectionState().researchOptions;
    expect(options).toContain('hussar-upgrade');
    expect(options).toContain('cavalier-upgrade');
  });

  it('researches Hussar and swaps existing Light Cavalry to Hussar with vision bump', () => {
    const bridge = createSimulationBridge('imperial-stable-fixture', { civilizationsByOwner: new Map([[1, 'Persians'], [2, 'Persians']]) });

    const startingLightCav = findFirstOwnedUnit(bridge, 1, 'light-cavalry');
    expect(startingLightCav).toBeDefined();
    const lightCavId = startingLightCav!.id;

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.queueResearch('hussar-upgrade')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'hussar') === 1
          && countOwnedUnits(bridge, 1, 'light-cavalry') === 0,
        { maxSteps: 800 },
      ),
    ).toBe(true);

    const upgraded = bridge.getEconomyState().units.find((unit) => unit.id === lightCavId);
    expect(upgraded?.unitType).toBe('hussar');
    // Hussar stats per Slice 7A: HP 75, attack 7, vision 11.
    expect(upgraded?.attackDamage).toBe(7);
  }, 30_000);

  it('researches Cavalier and swaps existing Knights to Cavalier', () => {
    const bridge = createSimulationBridge('imperial-stable-fixture', { civilizationsByOwner: new Map([[1, 'Persians'], [2, 'Persians']]) });

    const startingKnight = findFirstOwnedUnit(bridge, 1, 'knight');
    expect(startingKnight).toBeDefined();
    const knightId = startingKnight!.id;

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.queueResearch('cavalier-upgrade')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'cavalier') === 1
          && countOwnedUnits(bridge, 1, 'knight') === 0,
        { maxSteps: 800 },
      ),
    ).toBe(true);

    const upgraded = bridge.getEconomyState().units.find((unit) => unit.id === knightId);
    expect(upgraded?.unitType).toBe('cavalier');
    // Cavalier stats per Slice 7A: HP 120, attack 12.
    expect(upgraded?.attackDamage).toBe(12);
  }, 30_000);

  it('swaps the Scout slot for Hussar after Hussar research (drops Light Cavalry + Scout from menu)', () => {
    const bridge = createSimulationBridge('imperial-stable-fixture', { civilizationsByOwner: new Map([[1, 'Persians'], [2, 'Persians']]) });

    // Starting fixture: Imperial with neither light-cavalry-upgrade nor
    // hussar-upgrade researched; menu shows the scout-line predecessor
    // (`scout`) plus `knight` and `camel`.
    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('scout');
    expect(bridge.getSelectionState().trainOptions).not.toContain('hussar');
    expect(bridge.getSelectionState().trainOptions).not.toContain('light-cavalry');

    expect(bridge.queueResearch('hussar-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'hussar') >= 1,
        { maxSteps: 800 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('hussar');
    expect(bridge.getSelectionState().trainOptions).not.toContain('scout');
    expect(bridge.getSelectionState().trainOptions).not.toContain('light-cavalry');
    // Knight slot stays put until the Cavalier upgrade is researched.
    expect(bridge.getSelectionState().trainOptions).toContain('knight');
    expect(bridge.getSelectionState().trainOptions).toContain('camel');
  }, 30_000);

  it('swaps the Knight slot for Cavalier after Cavalier research', () => {
    const bridge = createSimulationBridge('imperial-stable-fixture', { civilizationsByOwner: new Map([[1, 'Persians'], [2, 'Persians']]) });

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('knight');
    expect(bridge.getSelectionState().trainOptions).not.toContain('cavalier');

    expect(bridge.queueResearch('cavalier-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'cavalier') >= 1,
        { maxSteps: 800 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('cavalier');
    expect(bridge.getSelectionState().trainOptions).not.toContain('knight');
    // Camel remains standalone.
    expect(bridge.getSelectionState().trainOptions).toContain('camel');
  }, 30_000);
});

describe('Anti-cavalry bonuses vs Hussar and Cavalier', () => {
  it("applies Camel's +10 anti-cavalry bonus to a Hussar", () => {
    // Hussar is a cavalry target. Camel base atk 5 + 10 = 15. Hussar (75 HP,
    // 0 melee armor) -> 60 after first hit.
    const bridge = createSimulationBridge('camel-vs-hussar-fixture', { civilizationsByOwner: new Map([[1, 'Persians'], [2, 'Persians']]) });

    const hussar = findFirstOwnedUnit(bridge, 2, 'hussar');
    expect(hussar).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, 1, 'camel')).toBe(true);
    expect(bridge.issueContextCommand(hussar!.x, hussar!.y)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const hp = getHealthOfUnitAtCell(bridge, hussar!.x, hussar!.y);
          return hp !== null && hp < 75;
        },
        { maxSteps: 60 },
      ),
    ).toBe(true);

    const hp = getHealthOfUnitAtCell(bridge, hussar!.x, hussar!.y);
    expect(hp).toBe(60);
  }, 30_000);

  it("applies Halberdier's +32 anti-cavalry bonus to a Cavalier", () => {
    // Cavalier (120 HP). Halberdier base atk 6 + 32 = 38 raw; the Cavalier's
    // 2 base melee armor reduces it to 36, so 120 - 36 = 84.
    const bridge = createSimulationBridge('halberdier-vs-cavalier-fixture', { civilizationsByOwner: new Map([[1, 'Persians'], [2, 'Persians']]) });

    const cavalier = findFirstOwnedUnit(bridge, 2, 'cavalier');
    expect(cavalier).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, 1, 'halberdier')).toBe(true);
    expect(bridge.issueContextCommand(cavalier!.x, cavalier!.y)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const hp = getHealthOfUnitAtCell(bridge, cavalier!.x, cavalier!.y);
          return hp !== null && hp < 120;
        },
        { maxSteps: 60 },
      ),
    ).toBe(true);

    const hp = getHealthOfUnitAtCell(bridge, cavalier!.x, cavalier!.y);
    expect(hp).toBe(84);
  }, 30_000);
});

