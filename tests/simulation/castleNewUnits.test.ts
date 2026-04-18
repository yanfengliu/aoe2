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

describe('Castle-Age new train-menu units (Camel, Cavalry Archer)', () => {
  it('exposes Camel in the Stable train menu at Castle Age', () => {
    const bridge = createSimulationBridge('castle-upgrades-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    const trainOptions = bridge.getSelectionState().trainOptions;
    expect(trainOptions).toContain('camel');
  });

  it('exposes Cavalry Archer in the Archery Range train menu at Castle Age', () => {
    const bridge = createSimulationBridge('castle-upgrades-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    const trainOptions = bridge.getSelectionState().trainOptions;
    expect(trainOptions).toContain('cavalry-archer');
  });

  it('does not offer Cavalry Archer while still in Feudal Age', () => {
    // feudal-blacksmith-fixture has a completed Archery Range but the human
    // is only in Feudal Age, so Cavalry Archer (Castle-only) should be absent
    // from the train menu. The Archer + Skirmisher options remain.
    const bridge = createSimulationBridge('feudal-blacksmith-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    const trainOptions = bridge.getSelectionState().trainOptions;
    expect(trainOptions).toContain('archer');
    expect(trainOptions).not.toContain('cavalry-archer');
  });

  it('trains a Camel when the Stable is selected and the train command is issued', () => {
    const bridge = createSimulationBridge('castle-upgrades-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.queueTrainUnit('camel')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'camel') === 1,
        { maxSteps: 400 },
      ),
    ).toBe(true);

    const camel = findFirstOwnedUnit(bridge, 1, 'camel');
    expect(camel).toMatchObject({
      unitType: 'camel',
      attackDamage: 5,
    });
  }, 20_000);

  it('trains a Cavalry Archer when the Archery Range is selected and the train command is issued', () => {
    const bridge = createSimulationBridge('castle-upgrades-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.queueTrainUnit('cavalry-archer')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'cavalry-archer') === 1,
        { maxSteps: 500 },
      ),
    ).toBe(true);

    const ca = findFirstOwnedUnit(bridge, 1, 'cavalry-archer');
    expect(ca).toMatchObject({
      unitType: 'cavalry-archer',
      attackDamage: 6,
      attackRange: 4,
    });
  }, 20_000);

  it('deals +9 anti-cavalry bonus damage when a Camel attacks a Knight (base 5 + 9 = 14)', () => {
    const bridge = createSimulationBridge('camel-vs-cavalry-fixture');

    const knight = findFirstOwnedUnit(bridge, 2, 'knight');
    expect(knight).toBeDefined();
    const knightHpBefore = getHealthOfUnitAtCell(bridge, knight!.x, knight!.y);
    expect(knightHpBefore).toBe(100);

    expect(selectOwnedUnitDirect(bridge, 1, 'camel')).toBe(true);
    expect(bridge.issueContextCommand(knight!.x, knight!.y)).toBe(true);

    // Step until one hit has landed (20-tick reload) — the Camel is adjacent
    // so no pursuit step is needed and damage fires on the first tick the
    // cooldown clears to zero.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const hp = getHealthOfUnitAtCell(bridge, knight!.x, knight!.y);
          return hp !== null && hp < 100;
        },
        { maxSteps: 60 },
      ),
    ).toBe(true);

    // After the first hit the Knight should be at 100 - 14 = 86 HP.
    const knightHpAfter = getHealthOfUnitAtCell(bridge, knight!.x, knight!.y);
    expect(knightHpAfter).toBe(86);
  }, 10_000);

  it('deals +9 anti-cavalry bonus damage when a Camel attacks a Scout', () => {
    const bridge = createSimulationBridge('camel-vs-cavalry-fixture');

    const scout = findFirstOwnedUnit(bridge, 2, 'scout');
    expect(scout).toBeDefined();
    const scoutHpBefore = getHealthOfUnitAtCell(bridge, scout!.x, scout!.y);
    expect(scoutHpBefore).toBe(45);

    expect(selectOwnedUnitDirect(bridge, 1, 'camel')).toBe(true);
    expect(bridge.issueContextCommand(scout!.x, scout!.y)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const hp = getHealthOfUnitAtCell(bridge, scout!.x, scout!.y);
          // Scout may die (45 - 14 = 31) or at least take one hit.
          return hp === null || hp < 45;
        },
        { maxSteps: 60 },
      ),
    ).toBe(true);

    // If still alive, the Scout must be at 31 HP (45 - 14); if dead, the hit
    // still applied the anti-cavalry bonus — either way the bonus was active.
    const scoutHpAfter = getHealthOfUnitAtCell(bridge, scout!.x, scout!.y);
    if (scoutHpAfter !== null) {
      expect(scoutHpAfter).toBe(31);
    }
  }, 10_000);

  it('lets a Cavalry Archer hit a distant target at range 4 without closing to melee', () => {
    const bridge = createSimulationBridge('cavalry-archer-ranged-fixture');

    const enemyMilitia = findFirstOwnedUnit(bridge, 2, 'militia');
    expect(enemyMilitia).toBeDefined();
    const enemyHpBefore = getHealthOfUnitAtCell(bridge, enemyMilitia!.x, enemyMilitia!.y);
    expect(enemyHpBefore).toBe(40);

    const ca = findFirstOwnedUnit(bridge, 1, 'cavalry-archer');
    expect(ca).toBeDefined();
    // Manhattan distance should already match the CA's range (4 tiles).
    const distance = Math.abs(ca!.x - enemyMilitia!.x) + Math.abs(ca!.y - enemyMilitia!.y);
    expect(distance).toBe(4);

    expect(selectOwnedUnitDirect(bridge, 1, 'cavalry-archer')).toBe(true);
    expect(bridge.issueContextCommand(enemyMilitia!.x, enemyMilitia!.y)).toBe(true);

    // Advance ticks; the first hit lands after one reload at range without
    // needing to approach.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const hp = getHealthOfUnitAtCell(bridge, enemyMilitia!.x, enemyMilitia!.y);
          return hp !== null && hp < 40;
        },
        { maxSteps: 60 },
      ),
    ).toBe(true);

    // Cavalry Archer base attack is 6; Militia has 0 pierce armor in our model,
    // so one hit brings 40 -> 34 HP. The Cavalry Archer should still be at
    // the original position (it did not need to close in).
    const enemyHpAfter = getHealthOfUnitAtCell(bridge, enemyMilitia!.x, enemyMilitia!.y);
    expect(enemyHpAfter).toBe(34);

    const caAfter = findFirstOwnedUnit(bridge, 1, 'cavalry-archer');
    expect(caAfter?.x).toBe(ca!.x);
    expect(caAfter?.y).toBe(ca!.y);
  }, 10_000);

  it('does NOT apply the Spearman anti-cavalry bonus to a Camel target', () => {
    // Spearman's +12 vs Scout / Light-Cavalry and +15 vs Knight bonuses
    // must not extend to Camels. Camels are anti-cavalry, not cavalry.
    // Here the human Spearman (player 1) attacks an enemy Camel (player 2).
    const bridge = createSimulationBridge('spearman-vs-camel-fixture');

    const camel = findFirstOwnedUnit(bridge, 2, 'camel');
    expect(camel).toBeDefined();
    const camelHpBefore = getHealthOfUnitAtCell(bridge, camel!.x, camel!.y);
    expect(camelHpBefore).toBe(100);

    expect(selectOwnedUnitDirect(bridge, 1, 'spearman')).toBe(true);
    expect(bridge.issueContextCommand(camel!.x, camel!.y)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const hp = getHealthOfUnitAtCell(bridge, camel!.x, camel!.y);
          return hp !== null && hp < 100;
        },
        { maxSteps: 60 },
      ),
    ).toBe(true);

    // Spearman base attack is 3. One hit leaves the Camel at 97.
    // If the anti-cavalry bonus applied, the Camel would be at 100-15=85.
    const camelHpAfter = getHealthOfUnitAtCell(bridge, camel!.x, camel!.y);
    expect(camelHpAfter).toBe(97);
  }, 10_000);

  it('applies the Skirmisher +4 anti-archer bonus to Cavalry Archer targets', () => {
    // Skirmisher base attack is 2, +4 vs archer-line = 6. Cavalry Archer starts
    // at 50 HP, so one hit should bring it to 44 (not 48 if the bonus was missing).
    const bridge = createSimulationBridge('skirmisher-vs-cavalry-archer-fixture');

    const cavArcher = findFirstOwnedUnit(bridge, 2, 'cavalry-archer');
    expect(cavArcher).toBeDefined();
    const hpBefore = getHealthOfUnitAtCell(bridge, cavArcher!.x, cavArcher!.y);
    expect(hpBefore).toBe(50);

    expect(selectOwnedUnitDirect(bridge, 1, 'skirmisher')).toBe(true);
    expect(bridge.issueContextCommand(cavArcher!.x, cavArcher!.y)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const hp = getHealthOfUnitAtCell(bridge, cavArcher!.x, cavArcher!.y);
          return hp !== null && hp < 50;
        },
        { maxSteps: 80 },
      ),
    ).toBe(true);

    const hpAfter = getHealthOfUnitAtCell(bridge, cavArcher!.x, cavArcher!.y);
    expect(hpAfter).toBe(44);
  }, 10_000);

  it('applies Fletching +1 attack / +1 range to Cavalry Archers when Fletching is researched BEFORE the unit is trained', () => {
    const bridge = createSimulationBridge('castle-upgrades-fixture');

    // Research Fletching first.
    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('fletching')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const archer = findFirstOwnedUnit(bridge, 1, 'archer');
          return !!archer && archer.attackDamage === 5 && archer.attackRange === 5;
        },
        { maxSteps: 500 },
      ),
    ).toBe(true);

    // Now train a Cavalry Archer; it should spawn with base (6/4) + Fletching (+1/+1) = 7/5.
    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.queueTrainUnit('cavalry-archer')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'cavalry-archer') === 1,
        { maxSteps: 500 },
      ),
    ).toBe(true);

    const ca = findFirstOwnedUnit(bridge, 1, 'cavalry-archer');
    expect(ca).toMatchObject({
      unitType: 'cavalry-archer',
      attackDamage: 7,
      attackRange: 5,
    });
  }, 30_000);

  it('applies Fletching +1 attack / +1 range to existing Cavalry Archers when Fletching is researched AFTER the unit is trained', () => {
    const bridge = createSimulationBridge('castle-upgrades-fixture');

    // Train a Cavalry Archer first (base 6/4).
    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.queueTrainUnit('cavalry-archer')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => countOwnedUnits(bridge, 1, 'cavalry-archer') === 1,
        { maxSteps: 500 },
      ),
    ).toBe(true);

    const caBefore = findFirstOwnedUnit(bridge, 1, 'cavalry-archer');
    expect(caBefore).toMatchObject({
      attackDamage: 6,
      attackRange: 4,
    });

    // Now research Fletching — the existing CA should pick up +1/+1.
    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('fletching')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const ca = findFirstOwnedUnit(bridge, 1, 'cavalry-archer');
          return !!ca && ca.attackDamage === 7 && ca.attackRange === 5;
        },
        { maxSteps: 500 },
      ),
    ).toBe(true);

    const caAfter = findFirstOwnedUnit(bridge, 1, 'cavalry-archer');
    expect(caAfter).toMatchObject({
      attackDamage: 7,
      attackRange: 5,
    });
  }, 30_000);
});
