import { describe, expect, it } from 'vitest';

import { detonatesOnAttack } from '../../src/game/simulation/prototypeUnitRules';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

// units.csv, Demolition Ship: "Filled with explosives. SELF-DESTRUCTS WHEN
// USED. Pilot near enemy ships and detonate to wrest control of the sea from an
// entrenched opponent." A demolition ship that survives its own blast is a
// different unit from the one the data describes — it is a repeating area
// weapon with the widest radius in the game (2.5 and 3.5 cells) and no cost for
// using it.

describe('which units detonate', () => {
  it('is the demolition line and nothing else', () => {
    expect(detonatesOnAttack('demolition-ship')).toBe(true);
    expect(detonatesOnAttack('heavy-demolition-ship')).toBe(true);
    for (const unitType of ['galley', 'fire-ship', 'mangonel', 'militia', 'villager'] as const) {
      expect(detonatesOnAttack(unitType)).toBe(false);
    }
  });
});

describe('a demolition ship dies when it detonates', () => {
  it('takes its target with it and does not survive to fire again', () => {
    const bridge = createSimulationBridge('demolition-ship-fixture');
    const own = () => bridge.getEconomyState().units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'demolition-ship',
    );
    const enemyShips = () => bridge.getEconomyState().units.filter(
      (unit) => unit.owner === 2 && unit.unitType !== 'villager',
    );

    const enemyBefore = enemyShips().length;
    expect(enemyBefore).toBeGreaterThan(0);

    const ships = own();
    expect(ships.length).toBeGreaterThan(0);
    const detonatorId = ships[0]!.id;
    const target = enemyShips()[0]!;
    expect(bridge.selectEntityAtCell(ships[0]!.x, ships[0]!.y)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(target.id)).toBe(true);

    for (let step = 0; step < 900; step += 1) bridge.step(100);

    // The blast landed: BOTH galleys are hurt, which is what a 2.5-cell radius
    // buys. It does not necessarily kill them — 110 damage against 120 hit
    // points leaves one standing, and asserting a kill would be asserting the
    // stat table rather than the mechanic.
    // Read the hit points out of world state rather than the selection panel:
    // once the bomb is gone its owner has no vision there, so the panel cannot
    // show an enemy ship at all — which is correct, and makes it the wrong
    // instrument for this question.
    const combat = new Map(
      (bridge.world.getState('aoe2.combatStates') ?? []) as Array<
        [number, { currentHp: number; maxHp: number }]
      >,
    );
    const hurt = enemyShips().filter((ship) => {
      const state = combat.get(ship.id);
      return state !== undefined && state.currentHp < state.maxHp;
    });
    expect(hurt.length).toBe(enemyBefore);
    // And the bomb is spent.
    const survivors = bridge.getEconomyState().units.filter((unit) => unit.id === detonatorId);
    expect(survivors).toEqual([]);
  }, 60_000);
});

describe('a demolition ship is spent against a building too', () => {
  it('dies attacking a dock, which is half of what it is for', () => {
    const bridge = createSimulationBridge('demolition-ship-fixture');
    const ship = bridge.getEconomyState().units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'demolition-ship',
    )!;
    const enemyDock = bridge.getEconomyState().buildings.find(
      (building) => building.owner === 2 && building.buildingType === 'dock',
    )!;
    expect(enemyDock).toBeDefined();
    expect(bridge.selectEntityAtCell(ship.x, ship.y)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(enemyDock.id)).toBe(true);

    // Long enough for it to cross the bay and reach the shore beside the base.
    for (let step = 0; step < 2_000; step += 1) bridge.step(100);

    const survivors = bridge.getEconomyState().units.filter((unit) => unit.id === ship.id);
    expect(survivors).toEqual([]);
  }, 60_000);
});
