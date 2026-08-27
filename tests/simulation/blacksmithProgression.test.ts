import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

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

describe('Blacksmith melee attack progression (Forging / Iron Casting / Blast Furnace)', () => {
  it('Forging grants +1 attack to a Militia and stacks independently with Iron Casting (+1) and Blast Furnace (+2)', () => {
    // Base Militia attack is 4. After Forging it is 5, after Iron Casting 6,
    // after Blast Furnace 8 (+2 on top). The three techs are independent:
    // canonical AoE2 does not require the predecessor to research the
    // successor. Each buff re-walks the player's units so existing
    // Militia reflect the new total immediately.

    const bridge = createSimulationBridge('blacksmith-progression-fixture');

    const baseMilitia = findFirstOwnedUnit(bridge, 1, 'militia');
    expect(baseMilitia).toBeDefined();
    expect(baseMilitia?.attackDamage).toBe(4);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('forging')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const militia = findFirstOwnedUnit(bridge, 1, 'militia');
          return !!militia && militia.attackDamage === 5;
        },
        { maxSteps: 600 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('iron-casting')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const militia = findFirstOwnedUnit(bridge, 1, 'militia');
          return !!militia && militia.attackDamage === 6;
        },
        { maxSteps: 600 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('blast-furnace')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const militia = findFirstOwnedUnit(bridge, 1, 'militia');
          return !!militia && militia.attackDamage === 8;
        },
        { maxSteps: 700 },
      ),
    ).toBe(true);
  }, 90_000); // contention headroom (full-suite thread pool; NOT an engine regression — see docs/debugging/2026-06-30-engine-throughput-regression.md)
});

describe('Blacksmith infantry armor progression (Scale Mail / Chain Mail / Plate Mail)', () => {
  it('stacks +1 armor per tier on a Spearman for +3 total', () => {
    const bridge = createSimulationBridge('blacksmith-progression-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'spearman')).toBe(true);
    expect(bridge.getSelectionState().armor).toBe(0);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('scale-mail-armor')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const spearman = findFirstOwnedUnit(bridge, 1, 'spearman');
          return !!spearman && spearman.armor === 1;
        },
        { maxSteps: 600 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('chain-mail-armor')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const spearman = findFirstOwnedUnit(bridge, 1, 'spearman');
          return !!spearman && spearman.armor === 2;
        },
        { maxSteps: 700 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('plate-mail-armor')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const spearman = findFirstOwnedUnit(bridge, 1, 'spearman');
          return !!spearman && spearman.armor === 3;
        },
        { maxSteps: 800 },
      ),
    ).toBe(true);
  }, 90_000); // contention headroom (full-suite thread pool; NOT an engine regression — see docs/debugging/2026-06-30-engine-throughput-regression.md)
});

describe('Blacksmith cavalry armor progression (Scale / Chain / Plate Barding)', () => {
  it('stacks +1 armor per tier on a Knight for +3 total', () => {
    const bridge = createSimulationBridge('blacksmith-progression-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'knight')).toBe(true);
    expect(bridge.getSelectionState().armor).toBe(0);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('scale-barding-armor')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const knight = findFirstOwnedUnit(bridge, 1, 'knight');
          return !!knight && knight.armor === 1;
        },
        { maxSteps: 600 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('chain-barding-armor')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const knight = findFirstOwnedUnit(bridge, 1, 'knight');
          return !!knight && knight.armor === 2;
        },
        { maxSteps: 700 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('plate-barding')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const knight = findFirstOwnedUnit(bridge, 1, 'knight');
          return !!knight && knight.armor === 3;
        },
        { maxSteps: 800 },
      ),
    ).toBe(true);
  }, 90_000); // contention headroom (full-suite thread pool; NOT an engine regression — see docs/debugging/2026-06-30-engine-throughput-regression.md)
});

describe('Blacksmith archer armor progression (Padded / Leather / Ring Archer Armor)', () => {
  it('stacks +1 armor per tier on an Archer for +3 total', () => {
    const bridge = createSimulationBridge('blacksmith-progression-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'archer')).toBe(true);
    expect(bridge.getSelectionState().armor).toBe(0);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('padded-archer-armor')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const archer = findFirstOwnedUnit(bridge, 1, 'archer');
          return !!archer && archer.armor === 1;
        },
        { maxSteps: 600 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('leather-archer-armor')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const archer = findFirstOwnedUnit(bridge, 1, 'archer');
          return !!archer && archer.armor === 2;
        },
        { maxSteps: 700 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('ring-archer-armor')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const archer = findFirstOwnedUnit(bridge, 1, 'archer');
          return !!archer && archer.armor === 3;
        },
        { maxSteps: 800 },
      ),
    ).toBe(true);
  }, 90_000); // contention headroom (full-suite thread pool; NOT an engine regression — see docs/debugging/2026-06-30-engine-throughput-regression.md)
});

describe('Blacksmith archer attack/range progression (Fletching / Bodkin / Bracer)', () => {
  it('stacks +1 attack and +1 range per tier on an Archer for +3/+3 total', () => {
    const bridge = createSimulationBridge('blacksmith-progression-fixture');

    const baseArcher = findFirstOwnedUnit(bridge, 1, 'archer');
    expect(baseArcher).toBeDefined();
    // Archer base atk 4 / range 4.
    expect(baseArcher?.attackDamage).toBe(4);
    expect(baseArcher?.attackRange).toBe(4);

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

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('bodkin-arrow')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const archer = findFirstOwnedUnit(bridge, 1, 'archer');
          return !!archer && archer.attackDamage === 6 && archer.attackRange === 6;
        },
        { maxSteps: 700 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.queueResearch('bracer')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const archer = findFirstOwnedUnit(bridge, 1, 'archer');
          return !!archer && archer.attackDamage === 7 && archer.attackRange === 7;
        },
        { maxSteps: 800 },
      ),
    ).toBe(true);
  }, 90_000); // contention headroom (full-suite thread pool; NOT an engine regression — see docs/debugging/2026-06-30-engine-throughput-regression.md)
});

describe('Armor reduces damage per hit', () => {
  it('a Plate Mail Halberdier takes 1 less damage per Champion hit than an unarmored Halberdier', () => {
    // Champion base atk 13; Halberdier base HP 60. No anti-cavalry bonus
    // fires here (Champion is infantry). First hit on an unarmored
    // Halberdier leaves 47 HP; with Plate Mail armor (+1), 48 HP — one
    // point of reduction per hit. Player 1 Champion is the attacker in
    // both fixtures so the test can issue the attack via the human's
    // context command pathway.

    const unarmoredBridge = createSimulationBridge('champion-vs-halberdier-fixture');
    const unarmoredHalb = findFirstOwnedUnit(unarmoredBridge, 2, 'halberdier');
    expect(unarmoredHalb).toBeDefined();

    expect(selectOwnedUnitDirect(unarmoredBridge, 1, 'champion')).toBe(true);
    expect(unarmoredBridge.issueContextCommand(unarmoredHalb!.x, unarmoredHalb!.y)).toBe(true);
    expect(
      stepBridgeUntil(
        unarmoredBridge,
        () => {
          const halb = findFirstOwnedUnit(unarmoredBridge, 2, 'halberdier');
          const hp = halb ? getHealthOfUnitAtCell(unarmoredBridge, halb.x, halb.y) : null;
          return hp !== null && hp < 60;
        },
        { maxSteps: 200 },
      ),
    ).toBe(true);
    const postHitHalb = findFirstOwnedUnit(unarmoredBridge, 2, 'halberdier');
    const unarmoredHp = postHitHalb
      ? getHealthOfUnitAtCell(unarmoredBridge, postHitHalb.x, postHitHalb.y)
      : null;
    expect(unarmoredHp).toBe(47);

    // Same layout, but player 2's Halberdier has Plate Mail armor +1.
    const armoredBridge = createSimulationBridge('champion-vs-armored-halberdier-fixture');
    const armoredHalb = findFirstOwnedUnit(armoredBridge, 2, 'halberdier');
    expect(armoredHalb).toBeDefined();
    expect(armoredHalb?.armor).toBe(1);

    expect(selectOwnedUnitDirect(armoredBridge, 1, 'champion')).toBe(true);
    expect(armoredBridge.issueContextCommand(armoredHalb!.x, armoredHalb!.y)).toBe(true);
    expect(
      stepBridgeUntil(
        armoredBridge,
        () => {
          const halb = findFirstOwnedUnit(armoredBridge, 2, 'halberdier');
          const hp = halb ? getHealthOfUnitAtCell(armoredBridge, halb.x, halb.y) : null;
          return hp !== null && hp < 60;
        },
        { maxSteps: 200 },
      ),
    ).toBe(true);
    const postHitArmored = findFirstOwnedUnit(armoredBridge, 2, 'halberdier');
    const armoredHp = postHitArmored
      ? getHealthOfUnitAtCell(armoredBridge, postHitArmored.x, postHitArmored.y)
      : null;
    expect(armoredHp).toBe(48);
  }, 90_000); // contention headroom (full-suite thread pool; NOT an engine regression — see docs/debugging/2026-06-30-engine-throughput-regression.md)
});

describe('Chemistry gates Bombard Cannon training', () => {
  it('does not expose Bombard Cannon at the Siege Workshop until Chemistry is researched', () => {
    const bridge = createSimulationBridge('blacksmith-progression-fixture');

    // The progression fixture starts in Imperial Age with a Siege Workshop
    // but no Chemistry — Bombard Cannon should NOT be trainable yet.
    expect(selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).not.toContain('bombard-cannon');

    // Research Chemistry at the University (v0.3.133, per technologies.csv).
    expect(selectOwnedBuildingDirect(bridge, 1, 'university')).toBe(true);
    expect(bridge.queueResearch('chemistry')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          // After Chemistry the Siege Workshop should expose Bombard Cannon.
          if (!selectOwnedBuildingDirect(bridge, 1, 'siege-workshop')) {
            return false;
          }
          return bridge.getSelectionState().trainOptions.includes('bombard-cannon');
        },
        { maxSteps: 700 },
      ),
    ).toBe(true);
  }, 90_000); // contention headroom (full-suite thread pool; NOT an engine regression — see docs/debugging/2026-06-30-engine-throughput-regression.md)
});

describe('Chemistry grants +1 attack to archer-line units', () => {
  it('bumps Archer attack from 4 to 5 after Chemistry completes', () => {
    const bridge = createSimulationBridge('blacksmith-progression-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'university')).toBe(true);
    expect(bridge.queueResearch('chemistry')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const archer = findFirstOwnedUnit(bridge, 1, 'archer');
          return !!archer && archer.attackDamage === 5;
        },
        { maxSteps: 700 },
      ),
    ).toBe(true);
  }, 90_000); // contention headroom (full-suite thread pool; NOT an engine regression — see docs/debugging/2026-06-30-engine-throughput-regression.md)
});
