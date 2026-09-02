import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function findFirstOwnedUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

function findOwnedBuilding(bridge: Bridge, owner: number, buildingType: string) {
  return bridge
    .getEconomyState()
    .buildings.find((b) => b.owner === owner && b.buildingType === buildingType);
}

function getUnitHp(bridge: Bridge, unitId: number): number | null {
  const unit = bridge.getEconomyState().units.find((u) => u.id === unitId);
  if (!unit) {
    return null;
  }
  if (!bridge.selectEntityAtCell(unit.x, unit.y)) {
    return null;
  }
  return bridge.getSelectionState().health?.current ?? null;
}

/**
 * Garrisons every archer, then reports the damage the Castle's FIRST volley
 * deals to `enemyId`. Both arrow-count cases used to garrison and then step a
 * fixed 15 ticks, which silently encoded how long the archers took to walk in:
 * when nearest-first approaches changed that walk (2026-09-02) the fifth
 * archer arrived at tick 12 and the volley landed after the window, so a test
 * about the ARROW CAP failed on a movement change. Waiting on the two events
 * it actually depends on — everyone inside, then the volley — says what the
 * test means. It refuses to measure at all if the Castle fires before the
 * crew is in, which would make the count wrong rather than late.
 */
function damageOfFirstVolleyAfterGarrison(
  bridge: ReturnType<typeof createSimulationBridge>,
  castleId: number,
  enemyId: number,
): number {
  const archers = bridge.getEconomyState().units
    .filter((u) => u.owner === 1 && u.unitType === 'archer');
  const beforeHp = getUnitHp(bridge, enemyId);
  for (const archer of archers) {
    expect(bridge.selectEntityAtCell(archer.x, archer.y)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(castleId, { garrison: true })).toBe(true);
  }

  let inside = false;
  for (let tick = 0; tick < 120 && !inside; tick += 1) {
    bridge.step(100);
    inside = bridge.getEconomyState().units.filter((u) => u.unitType === 'archer').length === 0;
    expect(
      getUnitHp(bridge, enemyId),
      'the Castle fired before the crew was in — this measures the wrong arrow count',
    ).toBe(beforeHp);
  }
  expect(inside, 'archers never garrisoned').toBe(true);

  for (let tick = 0; tick < 40; tick += 1) {
    bridge.step(100);
    const now = getUnitHp(bridge, enemyId);
    if (now !== beforeHp) return beforeHp! - now!;
  }
  throw new Error('the Castle never fired within two reload cycles');
}

describe('FU3 Castle garrisoned-archer extra arrows', () => {
  it('Castle with no garrisoned archers fires a single arrow per reload', () => {
    // fu3-castle-no-archers-fixture plants a Castle with the target at
    // closest-edge distance ≤ 8. Over 15 ticks (< 1 reload of 20), the
    // Castle fires exactly one arrow. Castle attack 11 is PIERCE; the Champion
    // target carries 1 pierce armor (units.csv 1/1) → 10 HP of damage.
    const bridge = createSimulationBridge('fu3-castle-no-archers-fixture');
    const before = findFirstOwnedUnit(bridge, 2, 'champion');
    expect(before).toBeDefined();
    const beforeHp = getUnitHp(bridge, before!.id);
    expect(beforeHp).toBe(70);

    // 15 ticks < one reload (20 ticks), so exactly 1 shot lands.
    for (let i = 0; i < 15; i += 1) {
      bridge.step(100);
    }

    const afterHp = getUnitHp(bridge, before!.id);
    expect(afterHp).toBe(beforeHp! - 10);
  });

  it('Castle with 3 archers garrisoned fires 4 arrows per reload cycle', () => {
    // fu3-castle-three-archers-fixture: same Castle + target layout as above,
    // but with 3 archers pre-garrisoned. Expected damage per reload is
    // 4 * 11 = 44 (arrow count = 1 base + 3 archers). Since a single
    // Spearman has 45 HP, 4 arrows will bring it to 1 HP — but we measure
    // via a tough target (garrison unit) so we can see the full damage.
    const bridge = createSimulationBridge('fu3-castle-three-archers-fixture');

    const castle = findOwnedBuilding(bridge, 1, 'castle');
    expect(castle).toBeDefined();
    const archers = bridge
      .getEconomyState()
      .units.filter((u) => u.owner === 1 && u.unitType === 'archer');
    expect(archers.length).toBe(3);

    // Capture pre-garrison enemy HP — Phase 1B unit.contextAtEntity changed
    // garrison from synchronous to "handler runs at start of next step".
    // The first step that drains the garrison commands ALSO runs combat
    // resolution; if the Castle had its reload ready it would fire arrows
    // BEFORE we could capture a clean beforeHp. So capture HP first, then
    // garrison + step the full 15-tick window.
    const enemy = findFirstOwnedUnit(bridge, 2, 'champion');
    expect(enemy).toBeDefined();
    const beforeHp = getUnitHp(bridge, enemy!.id);
    expect(beforeHp).toBe(70);

    // Castle fires 4 arrows (1 base + 3 archers). The Champion has 1 pierce
    // armor, so each pierce arrow deals 10 — 4 arrows = 40 damage.
    const damage = damageOfFirstVolleyAfterGarrison(bridge, castle!.id, enemy!.id);

    expect(
      bridge.getEconomyState().units.filter((u) => u.unitType === 'archer').length,
    ).toBe(0);
    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.getSelectionState().inventory ?? '').toContain('3 / 20 garrisoned');
    expect(damage).toBe(40)
  });

  it('Castle with 5 archers garrisoned caps at 5 arrows per reload cycle', () => {
    // fu3-castle-five-archers-fixture: 5 archers pre-garrisoned. Canonical
    // AoE2 DE caps Castle arrow count at 5 (1 base + 4 archer bonus),
    // not 1 + 5. Verifying the cap.
    const bridge = createSimulationBridge('fu3-castle-five-archers-fixture');

    const castle = findOwnedBuilding(bridge, 1, 'castle');
    expect(castle).toBeDefined();
    const archers = bridge
      .getEconomyState()
      .units.filter((u) => u.owner === 1 && u.unitType === 'archer');
    expect(archers.length).toBe(5);

    // Capture pre-garrison enemy HP (see 3-archer test above for rationale).
    const enemy = findFirstOwnedUnit(bridge, 2, 'champion');
    expect(enemy).toBeDefined();
    const beforeHp = getUnitHp(bridge, enemy!.id);
    expect(beforeHp).toBe(70);

    // 5 arrows (capped at 1 base + 4) x 10 pierce damage = 50. At 1 + 5 = 6
    // arrows it would be 60, which is what the cap exists to prevent.
    const damage = damageOfFirstVolleyAfterGarrison(bridge, castle!.id, enemy!.id);

    expect(
      bridge.getEconomyState().units.filter((u) => u.unitType === 'archer').length,
    ).toBe(0);

    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.getSelectionState().inventory ?? '').toContain('5 / 20 garrisoned');

    expect(damage).toBe(50)
  });
});

describe('FU3 Closest-edge range for large buildings', () => {
  it('Castle fires on a target whose nearest-footprint-cell distance is within range but anchor distance is not', () => {
    // fu3-castle-edge-range-fixture: Castle (4x4) anchored at (6, 6).
    // Target at (14, 8). Anchor distance = |14-6| + |8-6| = 8 + 2 = 10,
    // which is OUT of the Castle's attack range of 8. But the closest
    // footprint cell is (9, 8) (bottom-right column, row 8) at distance
    // |14-9| + |8-8| = 5, which IS within range. Pre-fix the Castle would
    // ignore this target; post-fix it fires.
    const bridge = createSimulationBridge('fu3-castle-edge-range-fixture');
    const enemy = findFirstOwnedUnit(bridge, 2, 'spearman');
    expect(enemy).toBeDefined();
    const beforeHp = getUnitHp(bridge, enemy!.id);
    expect(beforeHp).toBe(45);

    // Sanity check distance: footprint edge is at (9, 8) → distance 5.
    // Anchor is (6, 6) → distance 10. So range 8 from edge YES, range 8
    // from anchor NO.
    expect(Math.abs(enemy!.x - 6) + Math.abs(enemy!.y - 6)).toBe(10);

    // Step long enough for at least one shot (reload is 20 ticks).
    const hit = stepBridgeUntil(
      bridge,
      () => {
        const hp = getUnitHp(bridge, enemy!.id);
        return hp !== null && hp < 45;
      },
      { maxSteps: 80 },
    );
    expect(hit).toBe(true);
  }, 20_000);
});

describe('FU3 Stone Wall building', () => {
  it('Castle-Age villager sees stone-wall in build options', () => {
    const bridge = createSimulationBridge('fu3-stone-wall-fixture');
    const villager = bridge
      .getEconomyState()
      .units.find((u) => u.owner === 1 && u.unitType === 'villager');
    expect(villager).toBeDefined();
    expect(bridge.selectEntityAtCell(villager!.x, villager!.y)).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('stone-wall');
  });

  it('Feudal-Age villager does NOT see stone-wall in build options', () => {
    const bridge = createSimulationBridge('feudal-blacksmith-fixture');
    const villager = bridge
      .getEconomyState()
      .units.find((u) => u.owner === 1 && u.unitType === 'villager');
    expect(villager).toBeDefined();
    expect(bridge.selectEntityAtCell(villager!.x, villager!.y)).toBe(true);
    expect(bridge.getSelectionState().buildOptions).not.toContain('stone-wall');
  });

  it('placed stone-wall cell is impassable to unit placement and construction', () => {
    // fu3-stone-wall-blocking-fixture has a pre-placed stone-wall at a
    // known cell. The wall cell must behave as an impassable obstacle so
    // that no other building can be placed on it.
    const bridge = createSimulationBridge('fu3-stone-wall-blocking-fixture');

    const wall = bridge
      .getEconomyState()
      .buildings.find((b) => b.buildingType === 'stone-wall');
    expect(wall).toBeDefined();

    // Select the human villager and try to place a House on the wall
    // cell. The placement preview must report invalid.
    const villager = bridge
      .getEconomyState()
      .units.find((u) => u.owner === 1 && u.unitType === 'villager');
    expect(villager).toBeDefined();
    expect(bridge.selectEntityAtCell(villager!.x, villager!.y)).toBe(true);
    expect(bridge.beginBuildingPlacement('house')).toBe(true);

    const preview = bridge.getPlacementPreview(wall!.x, wall!.y);
    expect(preview).toBeDefined();
    expect(preview!.isValid).toBe(false);
  });

  it('stone-wall can be attacked and destroyed', () => {
    const bridge = createSimulationBridge('fu3-stone-wall-combat-fixture');
    const wall = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 1 && b.buildingType === 'stone-wall');
    expect(wall).toBeDefined();
    const wallId = wall!.id;

    // A player-2 Battering Ram nearby (+75 vs buildings, dealing 77 per
    // hit). Stone wall starts at 50 HP (fixture override) so one shot
    // kills it.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          return bridge.getEconomyState().buildings.find((b) => b.id === wallId) === undefined;
        },
        { maxSteps: 200 },
      ),
    ).toBe(true);
  }, 20_000);

  it('Arena map uses real stone-wall buildings around each start', () => {
    // Slice 11's Arena originally used stone-mine nodes as a wall proxy.
    // FU3 replaces that with real stone-wall buildings.
    const bridge = createSimulationBridge('arena');
    const stoneWalls = bridge
      .getEconomyState()
      .buildings.filter((b) => b.buildingType === 'stone-wall');
    expect(stoneWalls.length).toBeGreaterThan(0);
  });
});

describe('FU3 Palisade Wall building', () => {
  it('Feudal-Age villager with a Barracks sees palisade-wall in build options', () => {
    const bridge = createSimulationBridge('fu3-palisade-wall-fixture');
    const villager = bridge
      .getEconomyState()
      .units.find((u) => u.owner === 1 && u.unitType === 'villager');
    expect(villager).toBeDefined();
    expect(bridge.selectEntityAtCell(villager!.x, villager!.y)).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('palisade-wall');
  });
});
