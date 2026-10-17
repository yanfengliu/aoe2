// Can this unit walk to within a range of that cell? Asked often, searched
// once per state (work 128, review round 0, SF2).
//
// The computer's Monks ask it of every relic their seat knows of, nearest
// first, at each decision a Monk is idle for, so a relic it cannot reach is
// passed over rather than chosen and dropped. The answer is the planner's own,
// `findUnitRangePlan`, the call `monkBehaviorSystem` walks a Monk to a relic
// with, so the AI never sends a Monk on a walk the mover would refuse. A
// failing search explores everything the unit can reach, so an idle Monk whose
// only known relic lies in a lake would re-run a whole-map search at every
// decision; each answer is kept instead, for the unit's cell and the
// structural revision. `approachPlanCache.ts` gives the argument that this
// cannot change an answer: the search reads the unit's start cell, the target
// cells, durable topology and, through gates, the unit's owner, and topology
// changes and conversions bump the revision. A unit that leaves its cell asks
// afresh.

import type { Position } from 'civ-engine';

import { createApproachPlanCache } from './approachPlanCache';
import type { UnitMovementPlan } from './movementTypes';
import type { GameWorld } from './pureHelpers';

export type UnitRangeReach = (
  unitId: number,
  target: Position,
  range: number,
  activeWorld: GameWorld,
) => boolean;

export function createUnitRangeReach(
  findUnitRangePlan: (
    unitId: number,
    target: Position,
    range: number,
    activeWorld?: GameWorld,
  ) => UnitMovementPlan | null,
  structuralRevision: () => number,
): UnitRangeReach {
  const answers = createApproachPlanCache<boolean>();
  return (unitId, target, range, activeWorld) => {
    const start = activeWorld.getComponent<Position>(unitId, 'position');
    if (!start) return false;
    const key = `${String(unitId)}>${String(target.x)},${String(target.y)}:${String(range)}`;
    const revision = structuralRevision();
    const known = answers.get(key, revision, start);
    if (known) return known.plan === true;
    const reachable = findUnitRangePlan(unitId, target, range, activeWorld) !== null;
    answers.set(key, revision, start, reachable);
    return reachable;
  };
}
