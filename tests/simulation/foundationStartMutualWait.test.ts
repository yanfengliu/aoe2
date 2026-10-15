// Two seats' builders standing on each other's unstarted sites do not wait on
// each other forever (work 126, review round 0; spec §8.1).
//
// An enemy's unit on a footprint holds the start (foundationStart.ts). Units
// walk over a foundation nobody has started, so a builder can stand on another
// seat's site while it works on its own beside it, and the other seat's
// builder can stand on its site the same way. Each start then saw an enemy's
// unit and waited, and neither ever began: the review found it with an overlap
// (owner 2's Barracks at (26,16) and the human's House at (25,15), orders 0 to
// 6 ticks apart with the human's first, 0 to 21 with owner 2's first) and with
// adjacency only (the House at (24,16), 3 to 51 ticks apart), and an AI's build
// order would stall for good. The rule since (the coordinator, review round
// 0): a unit whose order is building a site of its own seat's does not hold
// another seat's start; it is moved off like the owner's own units. Since round
// 1 only while it stands beside that site, where it builds from: one passing
// through holds the start (foundationStartTransit.test.ts). The approach
// planner does not avoid other seats' unstarted foundations, which would tell
// the human's builder where a hidden enemy foundation lies.
//
// BOUND — what a green run here does NOT prove: one Barracks and one House on
// flat grass, the two builders of the review's sweep, three of the orders and
// delays it found locked; the AI's own builders run the same start check.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  ENEMY_SITE,
  HOUSE_OVER_ENEMY_SITE,
  HUMAN_BUILDER,
  UNBUILT_FOUNDATIONS_SEED,
} from '../../src/game/simulation/fixtures/unbuiltFoundations';

type Cell = { readonly x: number; readonly y: number };

/** Next to the Barracks site, touching it on the west: no overlap. */
const HOUSE_BESIDE_ENEMY_SITE: Cell = { x: 24, y: 16 };

function race(house: Cell, first: 'human' | 'enemy', delay: number) {
  const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
  const enemy = bridge.getEconomyState().units.find((unit) => unit.owner === 2 && unit.unitType === 'villager')!.id;
  const human = bridge.getEconomyState().units
    .find((unit) => unit.owner === 1 && unit.x === HUMAN_BUILDER.x && unit.y === HUMAN_BUILDER.y)!.id;
  const submit = (type: 'building.placeConfirm' | 'unit.move' | 'unit.contextAtEntity', data: object): void => {
    const result = bridge.world.submitWithResult(type as never, data as never);
    expect(result.accepted, `${type} ${JSON.stringify(result)}`).toBe(true);
  };
  submit('building.placeConfirm', { builderId: enemy, buildingType: 'barracks', position: { ...ENEMY_SITE } });
  submit('unit.move', { unitId: enemy, target: house === HOUSE_OVER_ENEMY_SITE ? { x: 21, y: 11 } : { x: 19, y: 17 } });
  bridge.step(100);
  const barracks = bridge.getEconomyState().buildings.find((building) => building.owner === 2 && building.buildingType === 'barracks')!.id;
  expect(bridge.selectUnitsByIds([human])).toBe(true);
  expect(bridge.beginBuildingPlacement('house')).toBe(true);
  expect(bridge.confirmBuildingPlacement(house.x, house.y), 'the House was refused').toBe(true);
  bridge.step(100);
  submit('unit.move', { unitId: human, target: { x: 31, y: 21 } });
  for (let tick = 0; tick < 400; tick += 1) bridge.step(100);
  const houseId = bridge.getEconomyState().buildings.find((building) => building.owner === 1 && building.buildingType === 'house')!.id;
  const humanBuilds = () => submit('unit.contextAtEntity', { unitId: human, targetEntityId: houseId });
  const enemyBuilds = () => submit('unit.contextAtEntity', { unitId: enemy, targetEntityId: barracks });
  (first === 'human' ? humanBuilds : enemyBuilds)();
  for (let tick = 0; tick < delay; tick += 1) bridge.step(100);
  (first === 'human' ? enemyBuilds : humanBuilds)();
  const site = (id: number) => bridge.getEconomyState().buildings.find((building) => building.id === id);
  const settled = (): boolean => {
    const h = site(houseId);
    const b = site(barracks);
    // Each has started, or gone.
    return (h === undefined || h.buildProgressTicks > 0) && (b === undefined || b.buildProgressTicks > 0);
  };
  for (let tick = 0; tick < 600 && !settled(); tick += 1) bridge.step(100);
  return { house: site(houseId), barracks: site(barracks), settled: settled() };
}

describe('two seats\' builders on each other\'s unstarted sites (work 126, review round 0)', () => {
  for (const [first, delay] of [['human', 0], ['enemy', 12]] as const) {
    it(`overlapping sites, ${first}'s order first by ${delay} ticks: the first to start wins, the other is cancelled`, () => {
      const result = race(HOUSE_OVER_ENEMY_SITE, first, delay);
      expect(result.settled, 'the two builders waited on each other').toBe(true);
      const started = [result.house, result.barracks].filter((building) => building !== undefined);
      expect(started.length, 'both overlapping sites went up, or neither did').toBe(1);
      expect(started[0]!.buildProgressTicks).toBeGreaterThan(0);
    });
  }

  it('sites side by side, the human\'s order first by 24 ticks: both start', () => {
    const result = race(HOUSE_BESIDE_ENEMY_SITE, 'human', 24);
    expect(result.settled, 'the two builders waited on each other').toBe(true);
    expect(result.house?.buildProgressTicks ?? 0, 'the House never started').toBeGreaterThan(0);
    expect(result.barracks?.buildProgressTicks ?? 0, 'the Barracks never started').toBeGreaterThan(0);
  });
});
