// Deer flee (spec §5.6).
//
// This is the behaviour that makes a deer a different thing from a sheep and a
// boar rather than a third food pile. A sheep is walked home, a boar is lured
// and fights back, and a deer runs — which is why hunting one is a decision
// about where your villagers will be for the next half minute, and why a
// player lures deer with a scout instead of walking villagers at them.
//
// The flight is REACTIVE, not planned: a deer does not path anywhere, it steps
// directly away from whatever came too close. That is both what the animal
// does and what keeps this cheap — a fleeing herd re-deciding every tick
// through the pathfinder would be a per-tick cost for no gain, and the
// pathfinder is already the simulation's most expensive system.

import type { Position } from 'civ-engine';

import type { GathererComponent, ResourceComponent } from '../../types';
import { manhattanDistance, type GameWorld } from '../pureHelpers';
import { DEER_STEP_TICK_INTERVAL } from '../wildlifeCadence';

type CivWorld = GameWorld;

/** How close a unit must come before a deer bolts. Roughly a villager's own
 *  sight, so a deer reacts about when a player would expect to have been
 *  noticed. */
export const DEER_FLEE_TRIGGER_RADIUS = 5;

/** A deer this close has been caught and stops running.
 *
 *  Without it the hunt cannot finish. Gathering happens at adjacency 1, which
 *  is permanently inside the trigger radius, so a hunted deer flees forever:
 *  review measured a villager driving one 40 tiles to the map border and
 *  delivering 10 food in five minutes — about 0.04 food/sec against the 0.41
 *  the rate table promises — and gathering at all only once the world edge
 *  stopped the deer. A deer with a hunter at its shoulder is caught, and a
 *  caught deer stands. */
export const DEER_CAUGHT_RADIUS = 1;

// There is deliberately NO "keep running a moment longer" tail. It read better
// — a herd that stops dead the instant a villager steps back looks mechanical —
// but it needs per-deer state, and per-entity system state in this bridge is
// persisted through a codec (see `sheepMoveOrders`) precisely so save/load and
// replay reproduce it. A plain Map in the closure would have been dropped by
// both, so a reloaded match would diverge from the one that was saved. The
// flight is therefore a pure function of who is standing near the deer right
// now, which needs no state at all. A tail can come back with a codec behind
// it if it is ever worth the persistence.

// The hop clock (one whole cell every 14 ticks, units.csv 0.737 tiles/s) lives
// in `wildlifeCadence.ts`, where the renderer's display delay reads it too.

export interface DeerFleeSystemDeps {
  world: GameWorld;
  findNearestHostileWildlifeTarget: (
    position: Position,
    aggroRange: number,
    activeWorld: CivWorld,
  ) => number | null;
  isCellPassableForWildlife: (
    entityId: number,
    x: number,
    y: number,
    activeWorld: CivWorld,
  ) => boolean;
  setPositionAndSyncOccupancy: (
    entityId: number,
    position: Position,
    activeWorld?: CivWorld,
  ) => void;
  markOutOfBandRenderChange: () => void;
}

/**
 * Candidate steps away from `threat`, best first.
 *
 * DIAGONALLY away first, and this is the important part rather than a detail.
 * The first version fled straight back along the dominant axis, which keeps
 * the deer on the pursuer's line of travel — so a scout walking east pushed a
 * deer east ahead of it indefinitely, and a herd fled into the same cells and
 * corked them. Measured: four deer shepherded into a scout's wander-box
 * entrance and held it shut for 900 ticks. Breaking off the axis is both what
 * an animal does and what stops the deer becoming a moving wall.
 *
 * The straight steps stay as fallbacks so a deer boxed against terrain still
 * has somewhere to go rather than standing to be shot.
 */
function retreatSteps(from: Position, threat: Position, deerId: number): Position[] {
  // A deer standing exactly on the threat's cell has no "away", so the tie is
  // broken deterministically rather than by picking its own cell and freezing.
  const awayX = Math.sign(from.x - threat.x) || 1;
  const awayY = Math.sign(from.y - threat.y) || 1;
  // When the threat is squarely on one axis the other has no "away" either,
  // and every deer would break the same way and re-form the wall one row over.
  // The id decides which shoulder, so a herd fans out.
  const lateral = deerId % 2 === 0 ? 1 : -1;
  const sideY = from.y - threat.y === 0 ? lateral : awayY;
  const sideX = from.x - threat.x === 0 ? lateral : awayX;
  return [
    { x: from.x + sideX, y: from.y + sideY },
    { x: from.x + awayX, y: from.y },
    { x: from.x, y: from.y + awayY },
    { x: from.x + sideX, y: from.y - sideY },
  ];
}

export function registerDeerFleeSystem(deps: DeerFleeSystemDeps): void {
  const {
    world,
    findNearestHostileWildlifeTarget,
    isCellPassableForWildlife,
    setPositionAndSyncOccupancy,
    markOutOfBandRenderChange,
  } = deps;

  world.registerSystem({
    name: 'prototypeDeerFlee',
    phase: 'update',
    after: ['prototypeVillagerEconomy'],
    execute(activeWorld) {
      if (activeWorld.tick % DEER_STEP_TICK_INTERVAL !== 0) return;

      for (const id of activeWorld.query('position', 'resource')) {
        const resource = activeWorld.getComponent<ResourceComponent>(id, 'resource');
        if (!resource || resource.resourceType !== 'deer' || resource.amount <= 0) continue;
        const position = activeWorld.getComponent<Position>(id, 'position');
        if (!position) continue;

        const threatId = findNearestHostileWildlifeTarget(
          position,
          DEER_FLEE_TRIGGER_RADIUS,
          activeWorld,
        );
        // No threat in range means no movement. A deer at rest standing still
        // is what makes "it moved away" evidence of the approach rather than
        // of ambient wandering — the undisturbed control test pins it.
        if (threatId === null) continue;
        const threat = activeWorld.getComponent<Position>(threatId, 'position');
        if (!threat) continue;

        // Caught: a hunter at its shoulder ends the chase, so the hunt can
        // actually finish. Checked against the CLOSEST unit rather than the
        // one that startled it, because a herd being worked by several
        // villagers must not keep bolting from a second hunter one tile
        // further out than the first.
        if (manhattanDistance(position, threat) <= DEER_CAUGHT_RADIUS) continue;

        // A deer already being gathered stays put for that villager. The
        // adjacency check above covers the moment of contact; this covers the
        // approach, so a villager explicitly sent to hunt closes the distance
        // instead of herding its target across the map.
        if (isBeingGatheredBy(activeWorld, threatId, id)) continue;

        for (const step of retreatSteps(position, threat, id)) {
          if (!isCellPassableForWildlife(id, step.x, step.y, activeWorld)) continue;
          setPositionAndSyncOccupancy(id, step, activeWorld);
          markOutOfBandRenderChange();
          break;
        }
      }
    },
  });
}

/** Whether `unitId` is a gatherer working this exact deer. */
function isBeingGatheredBy(activeWorld: CivWorld, unitId: number, deerId: number): boolean {
  const gatherer = activeWorld.getComponent<GathererComponent>(unitId, 'gatherer');
  return gatherer?.targetResourceId === deerId;
}
