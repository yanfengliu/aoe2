// A shot hits only the entity it was aimed at (spec §10.4; defect register,
// "A stone aimed at a deleted House hit the foundation that took its id",
// 2026-10-11).
//
// THE DEFECT: a shot in flight named its target by bare entity id, and
// civ-engine hands a freed id to the next entity it creates (its entity
// manager pops the most recently freed id first). So a shot whose target died
// while it was in the air landed on whatever had taken the id by then. Here a
// Mangonel's stone is in the air at a House when the House's owner deletes it
// and puts a new House foundation down: the foundation takes the dead House's
// id, and the stone that was aimed at the House took 75 of its 90 hit points.
//
// This file holds the engine's id reuse, which the defect rests on, and that
// player-visible case, played through real commands. The whole class (every
// entity a shot names: a building, a unit or an animal as its target, and its
// shooter) is in `projectileNamedEntities.test.ts`; the same scene across a
// save is in `projectileGenerationSave.test.ts` and in a replay in
// `tests/replay/projectileGenerationReplay.test.ts`.
//
// BOUND: one shot, one fixture, the building case. A unit or an animal that
// takes a dead target's id is hit only if it also stands where the shot lands,
// which no real command arranges inside one flight, so those cases are driven
// directly in the class test.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  buildingAtHouseSpot,
  buildingHp,
  landShot,
  replaceHouse,
  STONE_SEED,
  stoneAtHouse,
} from './stoneAtDeletedHouse.helpers';

describe('civ-engine reuses a destroyed entity\'s id', () => {
  it('gives the next entity it creates the id of the one destroyed last, under the next generation', () => {
    const bridge = createSimulationBridge(STONE_SEED);
    const house = buildingAtHouseSpot(bridge.world)!;
    const houseRef = bridge.world.getEntityRef(house)!;
    expect(bridge.world.submitWithResult('entity.delete', { entityId: house, requestedBy: 2 }).accepted).toBe(true);
    bridge.step(100);
    expect(bridge.world.getEntityRef(house), 'the House was not deleted').toBeNull();

    const next = bridge.world.runMaintenance(() => bridge.world.createEntity());
    expect(next, 'the next entity did not take the deleted House\'s id').toBe(house);
    expect(bridge.world.getEntityRef(next)!.generation).toBe(houseRef.generation + 1);
    expect(bridge.world.isCurrent(houseRef), 'the House\'s own reference still reads as current').toBe(false);
  });
});

describe('a shot hits only the entity it was aimed at', () => {
  it('a stone aimed at a House deleted in its flight leaves the foundation that took the House\'s id unharmed', () => {
    const bridge = createSimulationBridge(STONE_SEED);
    const step = () => bridge.step(100);
    const { house, shot } = stoneAtHouse(bridge);
    const foundation = replaceHouse(bridge.world, step, house, shot);
    const foundationRef = bridge.world.getEntityRef(foundation)!;
    const hpBefore = buildingHp(bridge.world, foundation)!;

    landShot(bridge.world, step, shot);

    expect(bridge.world.isCurrent(foundationRef), 'the stone aimed at the deleted House razed the foundation that took its id').toBe(true);
    const hpAfter = buildingHp(bridge.world, foundation)!;
    expect(hpAfter, `the stone aimed at the deleted House hit the foundation that took its id: ${hpBefore} -> ${hpAfter} hit points`)
      .toBeGreaterThanOrEqual(hpBefore);
    expect(bridge.getRecentPlayerHits().filter((blow) => blow.targetId === foundation), 'a blow was recorded on the foundation').toEqual([]);
  }, 30_000);
});
