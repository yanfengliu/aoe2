// Garrison-scaled watch-tower arrows (structures.csv "Max 5 arrows"): archers
// and villagers each add an arrow to the base one; infantry add none; the
// Bombard Tower keeps its single cannon whatever shelters inside.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';
import { buildingArrowCount } from '../../src/game/simulation/prototypeBuildingRules';

describe('buildingArrowCount (pure)', () => {
  it('adds an arrow per archer or villager in a watch tower, capped at 5', () => {
    expect(buildingArrowCount('watch-tower', 0, 0, 0)).toBe(1);
    expect(buildingArrowCount('watch-tower', 3, 2, 1)).toBe(4); // 1 + 2 + 1
    expect(buildingArrowCount('watch-tower', 3, 3, 0)).toBe(4);
    expect(buildingArrowCount('watch-tower', 5, 5, 0)).toBe(5); // the cap
    expect(buildingArrowCount('watch-tower', 8, 4, 4)).toBe(5);
    // Infantry contribute nothing.
    expect(buildingArrowCount('watch-tower', 4, 0, 0)).toBe(1);
    // The Bombard Tower's cannon never multiplies.
    expect(buildingArrowCount('bombard-tower', 5, 5, 0)).toBe(1);
  });
});

describe('tower volleys in the world', () => {
  it('a tower with 2 archers + 1 villager (and an inert militia) aboard volleys 4 arrows', () => {
    const bridge = createSimulationBridge('tower-arrows-fixture');
    const tower = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 1 && b.buildingType === 'watch-tower')!;
    const enemy = bridge
      .getEconomyState()
      .units.find((u) => u.owner === 2 && u.unitType === 'knight')!;
    // Garrison all four (archers, villager, militia) into the tower.
    for (const mine of bridge
      .getEconomyState()
      .units.filter((u) => u.owner === 1 && ['archer', 'villager', 'militia'].includes(u.unitType))) {
      expect(bridge.selectEntityAtCell(mine.x, mine.y)).toBe(true);
      expect(bridge.issueContextCommand(tower.x, tower.y, true)).toBe(true);
    }
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          if (!bridge.selectEntityAtCell(tower.x, tower.y)) return false;
          return bridge.getSelectionState().inventory === '4 / 5 garrisoned';
        },
        { maxSteps: 900 },
      ),
    ).toBe(true);
    // The tower snipes throughout the crew's §12.4.2-slow walk-in, so by full
    // garrison the knight has ~45 ticks of life left (measured: 100 HP at
    // spawn, dead ~125 ticks after the first partial-garrison volley). The
    // window therefore opens IMMEDIATELY on full garrison and stays short:
    // 36 ticks = 3 four-arrow volleys x (5 - 2 pierce) = 36 max; require 30.
    // An empty tower's single arrow lands at most ~9 in the same window.
    const baseline = bridge.getEntityHealth(enemy.id)!.currentHp;
    for (let index = 0; index < 36; index += 1) bridge.step(100);
    const dealt = baseline - bridge.getEntityHealth(enemy.id)!.currentHp;
    expect(dealt).toBeGreaterThanOrEqual(30);
  });

  it('an empty tower still fires exactly its one base arrow', () => {
    const bridge = createSimulationBridge('tower-arrows-fixture');
    const enemy = bridge
      .getEconomyState()
      .units.find((u) => u.owner === 2 && u.unitType === 'knight')!;
    // March the field crew far away first — otherwise the archers fight the
    // knight themselves and the "empty tower" window measures a brawl.
    for (const mine of bridge
      .getEconomyState()
      .units.filter((u) => u.owner === 1 && ['archer', 'villager', 'militia'].includes(u.unitType))) {
      expect(bridge.selectEntityAtCell(mine.x, mine.y)).toBe(true);
      expect(bridge.issueMoveCommand(6, 28)).toBe(true);
    }
    // §12.4.2 clock: long enough for the crew to clear the field, short
    // enough that the base arrow (3 damage per ~12 ticks) leaves the 100 HP
    // knight alive for the measuring window.
    for (let index = 0; index < 150; index += 1) bridge.step(100);
    // Same 36-tick window as the garrisoned run: a single base arrow lands
    // ~3 volleys x 3 = 9 damage — far under the 4-arrow floor of 30.
    const baseline = bridge.getEntityHealth(enemy.id)!.currentHp;
    for (let index = 0; index < 36; index += 1) bridge.step(100);
    const dealt = baseline - bridge.getEntityHealth(enemy.id)!.currentHp;
    expect(dealt).toBeGreaterThan(0);
    expect(dealt).toBeLessThanOrEqual(18);
  });
});
