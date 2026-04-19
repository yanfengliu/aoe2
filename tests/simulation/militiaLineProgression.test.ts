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

describe('Militia-line intermediate tiers at Barracks', () => {
  // The militia-line-fixture seeds two Imperial-Age players with one
  // Barracks and one Militia each, so every Barracks upgrade in the
  // chain (man-at-arms → long-swordsman → two-handed-swordsman →
  // champion) can be researched in sequence on the same bridge.

  it('Man-at-Arms upgrade mutates Militia in place and swaps the Barracks train option', () => {
    const bridge = createSimulationBridge('militia-line-fixture');

    const baseMilitia = findFirstOwnedUnit(bridge, 1, 'militia');
    expect(baseMilitia).toBeDefined();
    expect(baseMilitia?.attackDamage).toBe(4);
    const militiaId = baseMilitia!.id;

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('militia');
    expect(bridge.getSelectionState().researchOptions).toContain('man-at-arms-upgrade');

    expect(bridge.queueResearch('man-at-arms-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'man-at-arms') === 1
          && countOwnedUnits(bridge, 1, 'militia') === 0,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    // Same entity id; just mutated in place.
    const upgraded = bridge.getEconomyState().units.find((unit) => unit.id === militiaId);
    expect(upgraded?.unitType).toBe('man-at-arms');
    expect(upgraded?.attackDamage).toBe(6);

    // Barracks train menu now shows Man-at-Arms instead of Militia.
    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('man-at-arms');
    expect(bridge.getSelectionState().trainOptions).not.toContain('militia');
  }, 30_000);

  it('Long Swordsman upgrade mutates Man-at-Arms in place after Man-at-Arms is researched', () => {
    const bridge = createSimulationBridge('militia-line-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.queueResearch('man-at-arms-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'man-at-arms') === 1,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('long-swordsman-upgrade');
    expect(bridge.queueResearch('long-swordsman-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'long-swordsman') === 1
          && countOwnedUnits(bridge, 1, 'man-at-arms') === 0,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    const longSwordsman = findFirstOwnedUnit(bridge, 1, 'long-swordsman');
    expect(longSwordsman?.attackDamage).toBe(9);

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('long-swordsman');
    expect(bridge.getSelectionState().trainOptions).not.toContain('man-at-arms');
    expect(bridge.getSelectionState().trainOptions).not.toContain('militia');
  }, 45_000);

  it('Two-Handed Swordsman upgrade mutates Long Swordsman in place after Long Swordsman is researched', () => {
    const bridge = createSimulationBridge('militia-line-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.queueResearch('man-at-arms-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'man-at-arms') === 1,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.queueResearch('long-swordsman-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'long-swordsman') === 1,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('two-handed-swordsman-upgrade');
    expect(bridge.queueResearch('two-handed-swordsman-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'two-handed-swordsman') === 1
          && countOwnedUnits(bridge, 1, 'long-swordsman') === 0,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    const twoHanded = findFirstOwnedUnit(bridge, 1, 'two-handed-swordsman');
    expect(twoHanded?.attackDamage).toBe(11);

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('two-handed-swordsman');
    expect(bridge.getSelectionState().trainOptions).not.toContain('long-swordsman');
  }, 60_000);

  it('Champion upgrade mutates a Two-Handed Swordsman to Champion after the full chain', () => {
    const bridge = createSimulationBridge('militia-line-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.queueResearch('man-at-arms-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'man-at-arms') === 1,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.queueResearch('long-swordsman-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'long-swordsman') === 1,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.queueResearch('two-handed-swordsman-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'two-handed-swordsman') === 1,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('champion-upgrade');
    expect(bridge.queueResearch('champion-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'champion') === 1
          && countOwnedUnits(bridge, 1, 'two-handed-swordsman') === 0,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    const champ = findFirstOwnedUnit(bridge, 1, 'champion');
    expect(champ?.attackDamage).toBe(13);
  }, 120_000);

  it('Champion upgrade also mutates a Militia that never passed through the intermediate tiers', () => {
    // Backward-compat behavior documented in FU2: the champion-upgrade
    // keeps working on any militia-line predecessor the owner currently
    // holds (Militia, Man-at-Arms, Long Swordsman, or Two-Handed
    // Swordsman). This keeps existing Slice 7 / imperial-halberdier
    // test coverage intact while the new intermediate tiers are
    // optional.
    const bridge = createSimulationBridge('militia-line-fixture');

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

    const champ = findFirstOwnedUnit(bridge, 1, 'champion');
    expect(champ?.attackDamage).toBe(13);
  }, 30_000);
});

describe('Paladin upgrade at Stable', () => {
  // paladin-fixture seeds two Imperial-Age players with one Stable and
  // one Knight each. Cavalier must be researched first; then Paladin
  // becomes the head of the Knight chain.

  it('exposes Paladin research at the Stable after Cavalier is researched', () => {
    const bridge = createSimulationBridge('paladin-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('cavalier-upgrade');
    expect(bridge.queueResearch('cavalier-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'cavalier') === 1,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('paladin-upgrade');

    expect(bridge.queueResearch('paladin-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'paladin') === 1
          && countOwnedUnits(bridge, 1, 'cavalier') === 0,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    const paladin = findFirstOwnedUnit(bridge, 1, 'paladin');
    expect(paladin?.attackDamage).toBe(14);
  }, 60_000);

  it('swaps the Knight / Cavalier train option for Paladin after Paladin research', () => {
    const bridge = createSimulationBridge('paladin-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('knight');
    expect(bridge.getSelectionState().trainOptions).not.toContain('paladin');

    expect(bridge.queueResearch('cavalier-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'cavalier') >= 1,
        { maxSteps: 1200 },
      ),
    ).toBe(true);
    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.queueResearch('paladin-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'paladin') >= 1,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('paladin');
    expect(bridge.getSelectionState().trainOptions).not.toContain('cavalier');
    expect(bridge.getSelectionState().trainOptions).not.toContain('knight');
  }, 60_000);
});

describe('Heavy Camel upgrade at Stable', () => {
  // The paladin-fixture seeds a Camel for the human owner so the Heavy
  // Camel research option appears. Combat with an enemy Knight runs in
  // the separate heavy-camel-vs-knight-fixture below so the upgrade
  // mutation and the anti-cavalry bonus can be verified in isolation.

  it('mutates a Camel to Heavy Camel with +2 attack / +20 HP', () => {
    const bridge = createSimulationBridge('paladin-fixture');

    const baseCamel = findFirstOwnedUnit(bridge, 1, 'camel');
    expect(baseCamel).toBeDefined();
    expect(baseCamel?.attackDamage).toBe(5);

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('heavy-camel-upgrade');
    expect(bridge.queueResearch('heavy-camel-upgrade')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () =>
          countOwnedUnits(bridge, 1, 'heavy-camel') === 1
          && countOwnedUnits(bridge, 1, 'camel') === 0,
        { maxSteps: 1200 },
      ),
    ).toBe(true);

    const heavyCamel = findFirstOwnedUnit(bridge, 1, 'heavy-camel');
    expect(heavyCamel?.attackDamage).toBe(7);
    expect(heavyCamel?.attackRange).toBe(1);
  }, 45_000);

  it('preserves the +9 anti-cavalry bonus when attacking a Knight', () => {
    // Heavy Camel (base atk 7 + 9 vs cavalry = 16) should deal more
    // damage to a Knight than its own unbuffed damage. The fixture
    // spawns a pre-upgraded Heavy Camel adjacent to the enemy Knight so
    // the first melee hit lands within a handful of ticks.
    const bridge = createSimulationBridge('heavy-camel-vs-knight-fixture');

    const heavyCamel = findFirstOwnedUnit(bridge, 1, 'heavy-camel');
    expect(heavyCamel).toBeDefined();
    expect(heavyCamel?.attackDamage).toBe(7);

    const enemyKnight = findFirstOwnedUnit(bridge, 2, 'knight');
    expect(enemyKnight).toBeDefined();
    const knightId = enemyKnight!.id;

    // Resolve the Knight's HP by fresh position lookup + cell-cycle so
    // a stacked attacker doesn't mask the Knight's selection.
    const readKnightHp = (): number | null => {
      const knight = bridge
        .getEconomyState()
        .units.find((unit) => unit.id === knightId);
      if (!knight) {
        return 0;
      }
      for (let attempt = 0; attempt < 6; attempt += 1) {
        if (!bridge.selectEntityAtCell(knight.x, knight.y)) {
          return null;
        }
        const selection = bridge.getSelectionState();
        if (selection.selectedEntityId === knightId) {
          return selection.health?.current ?? null;
        }
      }
      return null;
    };

    expect(selectOwnedUnitDirect(bridge, 1, 'heavy-camel')).toBe(true);
    expect(bridge.issueContextCommand(enemyKnight!.x, enemyKnight!.y)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const hp = readKnightHp();
          return hp !== null && hp < 100;
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);
    // Heavy Camel first-hit damage = 7 + 9 = 16; Knight HP = 100 - 16 = 84.
    expect(readKnightHp()).toBe(84);
  }, 30_000);
});
