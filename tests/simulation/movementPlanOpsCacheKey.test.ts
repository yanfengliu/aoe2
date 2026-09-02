// The approach-plan cache's KEY — built in movementPlanOps, not in the cache
// container — must pin every input the search reads, and the answer it replays
// must be the answer a fresh search would give under the real passability
// predicate.
//
// Review C5: the shipping tests pinned the container and left the key
// construction untested. Dropping `:${range}` from the building key survived
// every cache, villager and movement test in the repo — two ranges for one
// (unit, building) shared one entry, and monk action range, drop-off range and
// attack range are live collision sources. This is the test that kills it.
//
// Review C1: the search also reads the ASKING UNIT'S OWNER (a gate admits its
// owner's units and nobody else's) and the key does not carry it. Monk
// conversion flips the owner in place, so the bridge bumps the structural
// revision at the flip; the last case pins that the bump is what stops the
// replay. The bridge-level half — a converted villager beside its old side's
// gate — is `convertedUnitGateReplan.test.ts`.

import { World, type Position } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { createMovementPlanOps } from '../../src/game/simulation/bridge/movementPlanOps';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
  GameWorld,
} from '../../src/game/simulation/bridge/pureHelpers';
import type { UnitComponent } from '../../src/game/simulation/types';

// 6x3 map with one open row, y=1. Cell (2,1) is a gate owned by player 1.
//   x: 0 1 2 3 4 5     y=1:  . U G . R .     (house at (4,0)-(5,1))
const WIDTH = 6;
const HEIGHT = 3;
const GATE: Position = { x: 2, y: 1 };
const UNIT_CELL: Position = { x: 1, y: 1 };

function makeWorld(): GameWorld {
  const world = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: WIDTH, gridHeight: HEIGHT, seed: 'movement-plan-ops-cache-key', tps: 10,
  });
  world.registerComponent('position');
  world.registerComponent('unit');
  world.registerComponent('resource');
  world.registerComponent('building');
  return world;
}

function opsFor(
  world: GameWorld,
  revision: () => number,
  blocked: ReadonlySet<string> = new Set(),
): ReturnType<typeof createMovementPlanOps> {
  // Mirrors isCellPassableForUnit: the open row is passable except where a
  // test blocks a cell, and the gate admits only the ASKING unit's owner.
  const isCellPassableForUnit = (unitId: number, x: number, y: number, w: GameWorld): boolean => {
    if (y !== 1 || x < 0 || x >= WIDTH) return false;
    if (blocked.has(`${String(x)},${String(y)}`)) return false;
    if (x === GATE.x && y === GATE.y) {
      return w.getComponent<UnitComponent>(unitId, 'unit')?.owner === 1;
    }
    return true;
  };
  return createMovementPlanOps({
    world,
    mapWidth: WIDTH,
    mapHeight: HEIGHT,
    movePathCache: new Map(),
    isCellPassableForUnit,
    isCellPassableForWildlife: () => true,
    structuralRevision: revision,
  });
}

function seed(world: GameWorld): { unit: number; resource: number; house: number } {
  const unit = world.createEntity();
  world.setPosition(unit, UNIT_CELL);
  world.addComponent(unit, 'unit', { owner: 1, unitType: 'villager' });
  const resource = world.createEntity();
  world.setPosition(resource, { x: 4, y: 1 });
  world.addComponent(resource, 'resource', { resourceType: 'wood', amount: 100 });
  const house = world.createEntity();
  world.setPosition(house, { x: 4, y: 0 });
  world.addComponent(house, 'building', { buildingType: 'house', owner: 2 });
  return { unit, resource, house };
}

describe('the approach-plan cache key', () => {
  it('replays exactly what a fresh search returns for the same state', () => {
    const world = makeWorld();
    const { unit, resource, house } = seed(world);
    const ops = opsFor(world, () => 7);
    const fresh = opsFor(world, () => 7);
    // Warm the cache, then compare its replay with a cold instance.
    ops.findResourceApproachPlan(unit, resource, world);
    ops.findBuildingApproachPlan(unit, house, 1, world);
    expect(ops.findResourceApproachPlan(unit, resource, world))
      .toEqual(fresh.findResourceApproachPlan(unit, resource, world));
    expect(ops.findBuildingApproachPlan(unit, house, 1, world))
      .toEqual(fresh.findBuildingApproachPlan(unit, house, 1, world));
  });

  it('follows a topology change once the revision moves', () => {
    const world = makeWorld();
    const { unit, resource } = seed(world);
    const blocked = new Set<string>();
    let revision = 7;
    const ops = opsFor(world, () => revision, blocked);
    expect(ops.findResourceApproachPlan(unit, resource, world)?.nextStep).toEqual(GATE);
    // A building lands on (3,1): the only route to the wood is closed.
    blocked.add('3,1');
    revision += 1;
    expect(ops.findResourceApproachPlan(unit, resource, world)).toBeNull();
  });

  it('keeps one (unit, building) entry per approach range', () => {
    // At range 1 the nearest approach cell to the house is (3,1); at range 2
    // the gate cell (2,1) qualifies and is found first. Same unit, same cell,
    // same revision — only the range differs, and the answers must too.
    const world = makeWorld();
    const { unit, house } = seed(world);
    const ops = opsFor(world, () => 7);
    const fresh = opsFor(world, () => 7);
    const atRangeOne = ops.findBuildingApproachPlan(unit, house, 1, world);
    const atRangeTwo = ops.findBuildingApproachPlan(unit, house, 2, world);
    expect(atRangeOne?.destination).toEqual({ x: 3, y: 1 });
    expect(atRangeTwo, 'the range-2 call replayed the range-1 entry')
      .toEqual(fresh.findBuildingApproachPlan(unit, house, 2, world));
    expect(atRangeTwo?.destination).toEqual(GATE);
  });

  it('stops replaying a route through a gate once the owner flip has bumped the revision', () => {
    // The key does not carry the owner, so the flip itself is invisible to
    // it; what the bridge does at the flip (`flipConvertedUnit`) is bump the
    // structural revision, and that is what must make the replay stop.
    const world = makeWorld();
    const { unit, resource } = seed(world);
    let revision = 7;
    const ops = opsFor(world, () => revision);
    expect(ops.findResourceApproachPlan(unit, resource, world)?.nextStep).toEqual(GATE);
    world.runMaintenance(() => {
      world.setComponent(unit, 'unit', { owner: 2, unitType: 'villager' });
    });
    revision += 1;
    expect(ops.findResourceApproachPlan(unit, resource, world), 'an enemy of the gate walked through it')
      .toBeNull();
  });
});
