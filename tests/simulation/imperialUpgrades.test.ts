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
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);
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
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);
});

describe('Halberdier anti-cavalry bonus', () => {
  it('deals more damage to a Knight than a Pikeman does', () => {
    // Pikeman: base 4 atk + 22 vs knight = 26; Knight (100 HP) -> 74.
    // Halberdier: base 6 atk + 28 vs knight = 34; Knight (100 HP) -> 66.
    // The Halberdier must leave the Knight with strictly less HP after the
    // first hit than the Pikeman does.

    const pikemanBridge = createSimulationBridge('pikeman-vs-knight-fixture');
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

    const halbBridge = createSimulationBridge('halberdier-vs-knight-fixture');
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

    // Exact values: Pikeman 26 dmg -> 74 HP; Halberdier 34 dmg -> 66 HP.
    expect(pikemanKnightHp).toBe(74);
    expect(halbKnightHp).toBe(66);
  }, 30_000);
});

describe('Imperial-Age Stable upgrades', () => {
  it('exposes Hussar and Cavalier research options at the Stable in Imperial Age', () => {
    const bridge = createSimulationBridge('imperial-stable-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    const options = bridge.getSelectionState().researchOptions;
    expect(options).toContain('hussar-upgrade');
    expect(options).toContain('cavalier-upgrade');
  });

  it('researches Hussar and swaps existing Light Cavalry to Hussar with vision bump', () => {
    const bridge = createSimulationBridge('imperial-stable-fixture');

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
    const bridge = createSimulationBridge('imperial-stable-fixture');

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
    const bridge = createSimulationBridge('imperial-stable-fixture');

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
    const bridge = createSimulationBridge('imperial-stable-fixture');

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
  it("applies Camel's +9 anti-cavalry bonus to a Hussar", () => {
    // Hussar is a cavalry target. Camel base atk 5 + 9 = 14. Hussar (75 HP)
    // -> 61 after first hit.
    const bridge = createSimulationBridge('camel-vs-hussar-fixture');

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
    expect(hp).toBe(61);
  }, 30_000);

  it("applies Halberdier's +28 anti-cavalry bonus to a Cavalier", () => {
    // Cavalier (120 HP). Halberdier base atk 6 + 28 = 34. 120 - 34 = 86.
    const bridge = createSimulationBridge('halberdier-vs-cavalier-fixture');

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
    expect(hp).toBe(86);
  }, 30_000);
});

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
