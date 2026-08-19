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

  it('deals +125 bonus damage when a Battering Ram attacks a building', () => {
    // Ram base attack is 2 + 125 anti-building bonus = 127 damage per hit. A
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
    // Pikeman's +22 vs the cavalry class must not extend to siege weapons —
    // a Ram is in the siege/ram classes, not cavalry. armorClassBonus sums no
    // matching class for a ram target, so the fallback 0 is returned.
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
    // Camel's +10 vs the cavalry class must not extend to a Ram (siege/ram).
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

  it('holds Mangonel fire when the target is inside its minimum range of 3', () => {
    // Slice 4 review Fix 3: Mangonel range is 7 with a minimum of 3 —
    // boulders cannot arc in to an adjacent cell. At distance 2 the
    // Mangonel must refuse to attack rather than dealing damage. The
    // fixture places a Spearman at distance 2; after 20 ticks (well past
    // two reload cycles of 6s) the Spearman's HP must still be 45.
    const bridge = createSimulationBridge('mangonel-min-range-blocked-fixture');

    const spearman = findFirstOwnedUnit(bridge, 2, 'spearman');
    expect(spearman).toBeDefined();
    const spearmanIdBefore = spearman!.id;

    expect(selectOwnedUnitDirect(bridge, 1, 'mangonel')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(spearmanIdBefore)).toBe(true);

    // Run for longer than a single reload cycle (60 ticks is full reload);
    // if the min-range check is missing, the Mangonel will fire on tick 1.
    for (let index = 0; index < 20; index += 1) {
      bridge.step(100);
    }

    const spearmanAfter = bridge.getEconomyState().units.find((u) => u.id === spearmanIdBefore);
    expect(spearmanAfter).toBeDefined();
    const spearmanHp = getHealthOfUnitAtCell(bridge, spearmanAfter!.x, spearmanAfter!.y);
    expect(spearmanHp).toBe(45); // untouched — Mangonel held fire
  }, 10_000);

  it('fires normally once the target is outside the Mangonel minimum range', () => {
    // Positive control for the min-range dead zone: with the Spearman at
    // distance 5 (outside the min-range 3), the Mangonel must fire on tick 1.
    // Mangonel base 40 PIERCE vs the Spearman's 0 pierce armor = 40 dmg, so
    // one hit brings the 45-HP Spearman to 5 — it does NOT one-shot (mangonel
    // anti-infantry is blast, deferred to M2). We assert the shot landed.
    const bridge = createSimulationBridge('mangonel-outside-min-range-fixture');

    const spearman = findFirstOwnedUnit(bridge, 2, 'spearman');
    expect(spearman).toBeDefined();
    const spearmanIdBefore = spearman!.id;

    expect(selectOwnedUnitDirect(bridge, 1, 'mangonel')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(spearmanIdBefore)).toBe(true);

    // The stone is loosed on tick 1 and lands after its flight (spec §10.4),
    // so step until it comes down rather than reading HP on the launch tick.
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEntityHealth(spearmanIdBefore)?.currentHp !== 45,
      { maxSteps: 60 },
    )).toBe(true);

    const after = bridge.getEconomyState().units.find((u) => u.id === spearmanIdBefore);
    expect(after).toBeDefined();
    const hpAfter = getHealthOfUnitAtCell(bridge, after!.x, after!.y);
    expect(hpAfter).toBe(5); // 45 - 40, the Mangonel fired outside min range
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

    // The Watch Tower starts with cooldownTicks = 0 and looses its first arrow
    // on tick 1, but the arrow now FLIES (spec §10.4) — step until it lands.
    // Reload is 12 ticks, so this window contains exactly one volley.
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEntityHealth(mangonelIdBefore)?.currentHp !== 50,
      { maxSteps: 10 },
    )).toBe(true);

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
    // Tower arrows are pierce (5) and a Mangonel carries 6 pierce armor, so each
    // shot is floored to 1 dmg: 50 -> 49. Still proves the tower targeted the
    // Mangonel (it took damage) while the closer Militia stayed untouched.
    expect(mangonelHp).toBe(49);
    expect(militiaHp).toBe(40); // 40 - 0, untouched
  }, 10_000);

  it('deals only base damage (no anti-infantry bonus) when a Mangonel attacks a Spearman', () => {
    // Slice 2b-ii: AoE2 mangonel anti-infantry is BLAST/splash (spec §10.7,
    // deferred to M2), NOT an attack bonus. So a Spearman takes only the
    // Mangonel's base 40 PIERCE (0 pierce armor) = 40: the 45-HP Spearman
    // survives at 5 after the first hit — it is NOT one-shot.
    const bridge = createSimulationBridge('mangonel-vs-spearman-fixture');

    const spearman = findFirstOwnedUnit(bridge, 2, 'spearman');
    expect(spearman).toBeDefined();
    const spearmanIdBefore = spearman!.id;

    expect(selectOwnedUnitDirect(bridge, 1, 'mangonel')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(spearmanIdBefore)).toBe(true);

    // The Mangonel fires on tick 1; the stone lands a few ticks later
    // (spec §10.4 travel time) for exactly its base damage.
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEntityHealth(spearmanIdBefore)?.currentHp !== 45,
      { maxSteps: 60 },
    )).toBe(true);

    const after = bridge.getEconomyState().units.find((u) => u.id === spearmanIdBefore);
    expect(after).toBeDefined();
    const hpAfter = getHealthOfUnitAtCell(bridge, after!.x, after!.y);
    expect(hpAfter).toBe(5); // 45 - 40 base, no anti-infantry bonus
  }, 10_000);

  it('deals only base damage when a Mangonel attacks a Knight (no anti-infantry bonus)', () => {
    // Mangonel has NO anti-infantry attack bonus (AoE2 anti-infantry is blast,
    // deferred to M2), so a Knight takes the Mangonel's base 40 PIERCE reduced
    // by its 2 pierce armor = 38; 100 - 38 = 62 HP after one tick.
    const bridge = createSimulationBridge('mangonel-vs-knight-fixture');

    const knight = findFirstOwnedUnit(bridge, 2, 'knight');
    expect(knight).toBeDefined();
    const knightIdBefore = knight!.id;

    expect(selectOwnedUnitDirect(bridge, 1, 'mangonel')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(knightIdBefore)).toBe(true);

    // Fired on tick 1, lands after its flight (spec §10.4).
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEntityHealth(knightIdBefore)?.currentHp !== 100,
      { maxSteps: 60 },
    )).toBe(true);

    const knightAfter = bridge.getEconomyState().units.find((u) => u.id === knightIdBefore);
    expect(knightAfter).toBeDefined();
    const knightHp = getHealthOfUnitAtCell(bridge, knightAfter!.x, knightAfter!.y);
    expect(knightHp).toBe(62); // 100 - (40 pierce - 2 knight pierce armor), no bonus
  }, 10_000);

  it('selects every owned Mangonel in a rect when selectOwnedUnitsByTypeInRect is called with mangonel', () => {
    // Slice 4 review Fix 4 safety net: backs the GameScene same-type
    // double-click flow for siege. The scene's isUnitType allowlist gates
    // which unitTypes can trigger the rect expansion, and siege units
    // (mangonel / scorpion / battering-ram) must be included. The bridge
    // contract — selectOwnedUnitsByTypeInRect — has to return true and
    // actually select the Mangonel in the rect.
    const bridge = createSimulationBridge('mangonel-ranged-fixture');

    expect(bridge.selectOwnedUnitsByTypeInRect('mangonel', 0, 0, 59, 35)).toBe(true);

    const selectionState = bridge.getSelectionState();
    expect(selectionState.selectedCount).toBe(1);
    expect(selectionState.selectedKind).toBe('unit');
    expect(selectionState.selectedEntityType).toBe('mangonel');
    expect(selectionState.owner).toBe(1);
  });

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
