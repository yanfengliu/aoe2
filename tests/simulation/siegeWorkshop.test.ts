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

  it('does NOT apply the Pikeman anti-cavalry bonus to a Battering Ram target', () => {
    // Pikeman's +19 vs Scout / Light-Cavalry and +22 vs Knight must not
    // extend to siege weapons — Ram is siege, not cavalry. Exclusion is
    // enforced inside attackBonusAgainstUnit: its conditions never include
    // 'battering-ram' as a target, so the fallback 0 is returned.
    const bridge = createSimulationBridge('pikeman-vs-ram-fixture');

    const ram = findFirstOwnedUnit(bridge, 2, 'battering-ram');
    expect(ram).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, 1, 'pikeman')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(ram!.id)).toBe(true);

    // Tick 1: Pikeman's attack command fires before any enemy AI movement.
    bridge.step(100);

    const rAfter = bridge.getEconomyState().units.find((u) => u.id === ram!.id);
    expect(rAfter).toBeDefined();
    const ramHpAfter = getHealthOfUnitAtCell(bridge, rAfter!.x, rAfter!.y);
    // Pikeman base attack is 4. With the anti-cav bonus wrongly applied the
    // Ram would be at 175 - (4 + 22) = 149; with it correctly excluded: 171.
    expect(ramHpAfter).toBe(171);
  }, 10_000);

  it('does NOT apply the Camel anti-cavalry bonus to a Battering Ram target', () => {
    // Camel's +9 vs Scout / Light-Cavalry / Knight must not extend to Ram.
    const bridge = createSimulationBridge('camel-vs-ram-fixture');

    const ram = findFirstOwnedUnit(bridge, 2, 'battering-ram');
    expect(ram).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, 1, 'camel')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(ram!.id)).toBe(true);

    bridge.step(100);

    const rAfter = bridge.getEconomyState().units.find((u) => u.id === ram!.id);
    expect(rAfter).toBeDefined();
    const ramHpAfter = getHealthOfUnitAtCell(bridge, rAfter!.x, rAfter!.y);
    // Camel base attack is 5. Bonus wrongly applied → 175 - 14 = 161. With
    // exclusion: 170.
    expect(ramHpAfter).toBe(170);
  }, 10_000);

  it('makes a Watch Tower prefer a Mangonel over a closer Militia in range (siege-first priority)', () => {
    // Slice 4 review Fix 1: siege units must be the highest-priority target
    // for defensive buildings so towers do not burn their shots on infantry
    // while a Mangonel shells them from the same radius. The fixture places
    // both enemies inside the tower's range, with the Militia CLOSER (dist 4
    // vs the Mangonel at dist 5) so proximity-based tie-breaking would pick
    // the Militia. Correct behavior: the Mangonel takes damage first.
    const bridge = createSimulationBridge('tower-vs-siege-priority-fixture');

    const mangonel = findFirstOwnedUnit(bridge, 2, 'mangonel');
    const militia = findFirstOwnedUnit(bridge, 2, 'militia');
    expect(mangonel).toBeDefined();
    expect(militia).toBeDefined();

    const mangonelIdBefore = mangonel!.id;
    const militiaIdBefore = militia!.id;

    // Step exactly one tower tick so exactly one arrow has flown. Watch
    // Tower starts with cooldownTicks = 0 and fires on its first tick, so a
    // single 100ms step lands the first shot.
    bridge.step(100);

    const economy = bridge.getEconomyState();
    const mangonelAfter = economy.units.find((u) => u.id === mangonelIdBefore);
    const militiaAfter = economy.units.find((u) => u.id === militiaIdBefore);

    // Tower fires 5 damage; Mangonel has 50 HP so it survives one hit and
    // stays on the map. Its HP must be below the Militia's, proving the
    // arrow landed on the Mangonel rather than the closer Militia.
    expect(mangonelAfter).toBeDefined();
    expect(militiaAfter).toBeDefined();
    const mangonelHp = getHealthOfUnitAtCell(bridge, mangonelAfter!.x, mangonelAfter!.y);
    const militiaHp = getHealthOfUnitAtCell(bridge, militiaAfter!.x, militiaAfter!.y);
    expect(mangonelHp).toBe(45); // 50 - 5
    expect(militiaHp).toBe(40); // 40 - 0, untouched
  }, 10_000);

  it('applies a +10 anti-infantry bonus when a Mangonel attacks a Spearman', () => {
    // Slice 4 review Fix 2: Mangonel is modeled as single-target AoE in v1,
    // so the "splash vs infantry" design is simulated by a flat +10 bonus
    // when the target is militia / spearman / pikeman / villager. Spearman
    // at 45 HP takes 40 base + 10 bonus = 50 damage on the first hit, so
    // one attack tick must be enough to destroy it. Without the bonus the
    // first hit would leave 5 HP behind.
    const bridge = createSimulationBridge('mangonel-vs-spearman-fixture');

    const spearman = findFirstOwnedUnit(bridge, 2, 'spearman');
    expect(spearman).toBeDefined();
    const spearmanIdBefore = spearman!.id;

    expect(selectOwnedUnitDirect(bridge, 1, 'mangonel')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(spearmanIdBefore)).toBe(true);

    // A single 100 ms step covers exactly one attack tick with cooldownTicks
    // starting at 0, so the Mangonel fires its first shot and the Spearman
    // should be destroyed in one hit.
    bridge.step(100);

    expect(
      bridge.getEconomyState().units.find((u) => u.id === spearmanIdBefore),
    ).toBeUndefined();
  }, 10_000);

  it('does NOT apply the anti-infantry bonus when a Mangonel attacks a Knight', () => {
    // Slice 4 review Fix 2: the +10 bonus is narrow — only militia /
    // spearman / pikeman / villager qualify. Knight (cavalry) must take
    // base 40 damage, no more. 100 - 40 = 60 HP after one tick.
    const bridge = createSimulationBridge('mangonel-vs-knight-fixture');

    const knight = findFirstOwnedUnit(bridge, 2, 'knight');
    expect(knight).toBeDefined();
    const knightIdBefore = knight!.id;

    expect(selectOwnedUnitDirect(bridge, 1, 'mangonel')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(knightIdBefore)).toBe(true);

    bridge.step(100);

    const knightAfter = bridge.getEconomyState().units.find((u) => u.id === knightIdBefore);
    expect(knightAfter).toBeDefined();
    const knightHp = getHealthOfUnitAtCell(bridge, knightAfter!.x, knightAfter!.y);
    expect(knightHp).toBe(60); // 100 - 40 base, no bonus
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
