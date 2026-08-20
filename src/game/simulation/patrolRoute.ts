// M6 control: the standing patrol route.
//
// A patrol is deliberately NOT a UnitCommand. Auto-aggression takes a unit off
// its walk to fight whatever it meets, which clears the command — so an
// attack-move is over the first time it works, and a patrol issued the same way
// would be too. Modelling the route as its own per-unit state means the walk is
// re-issued whenever the unit falls idle, so a patrolling unit fights, wins, and
// goes back to pacing its line. That is what an AoE2 patrol does.
//
// Only patrolling units are stored, so an ordinary match serializes nothing.

import type { Position } from 'civ-engine';

export interface PatrolRoute {
  /** Where the patrol was ordered from. */
  readonly a: Position;
  /** Where it was ordered to. */
  readonly b: Position;
  /** Which end the unit is currently walking toward. */
  readonly heading: 'a' | 'b';
}

/** The endpoint this route is currently walking toward. */
export function patrolDestination(route: PatrolRoute): Position {
  return route.heading === 'b' ? route.b : route.a;
}

/** The same route, turned around at the end it just reached. */
export function reversePatrol(route: PatrolRoute): PatrolRoute {
  return { a: route.a, b: route.b, heading: route.heading === 'b' ? 'a' : 'b' };
}

/**
 * Whether a unit standing at `position` has arrived at the end it was walking
 * toward. Patrol endpoints are cells, and a unit's own cell is the whole
 * tolerance — a unit crowded off the exact cell by another body would otherwise
 * pace the last step forever.
 */
export function hasReachedPatrolEnd(route: PatrolRoute, position: Position): boolean {
  const target = patrolDestination(route);
  return Math.abs(position.x - target.x) <= 1 && Math.abs(position.y - target.y) <= 1;
}
