// M6 control: the patrol ops. Extracted from ./unitCommandOps.ts for the
// 500-LOC budget; they are the natural group because a patrol is the one order
// that keeps state of its own after the walk it issues has finished.

import type { Position } from 'civ-engine';

import type { PatrolRoute } from '../patrolRoute';
import { patrolRoutesCodec } from './bridgeStateSerialize';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { clamp, type GameWorld } from './pureHelpers';

export interface PatrolCommandOpsDeps {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  mapWidth: number;
  mapHeight: number;
  /** The shared walk helper; `keepPatrol` stops it ending the route. */
  setWalkCommandDirect: (
    unitId: number,
    target: Position,
    type: 'move' | 'attack-move',
    options?: { keepPatrol?: boolean },
  ) => boolean;
  submitPatrol: (unitId: number, target: Position) => boolean;
}

export function createPatrolCommandOps(deps: PatrolCommandOpsDeps) {
  const { world, accessor, mapWidth, mapHeight, setWalkCommandDirect, submitPatrol } = deps;

  /** Drop this unit's standing patrol, if it has one. */
  function clearPatrolRoute(unitId: number): void {
    const routes = accessor.get(patrolRoutesCodec);
    if (routes.delete(unitId)) accessor.markDirty(patrolRoutesCodec);
  }

  /**
   * Start a patrol between where the unit stands and `target`, and set it
   * walking toward the far end. The route outlives the walk (see patrolRoute.ts).
   */
  function setUnitPatrolCommandDirect(unitId: number, target: Position): boolean {
    const position = world.getComponent<Position>(unitId, 'position');
    if (!position) return false;
    const b: Position = {
      x: clamp(target.x, 0, mapWidth - 1),
      y: clamp(target.y, 0, mapHeight - 1),
    };
    const route: PatrolRoute = { a: { x: position.x, y: position.y }, b, heading: 'b' };
    if (!setWalkCommandDirect(unitId, b, 'attack-move', { keepPatrol: true })) return false;
    accessor.mutate(patrolRoutesCodec, (map) => map.set(unitId, route));
    return true;
  }

  /** The patrol system's own re-issue: walks a leg without ending the route. */
  function resumePatrolLeg(unitId: number, target: Position): boolean {
    return setWalkCommandDirect(unitId, target, 'attack-move', { keepPatrol: true });
  }

  function issueUnitPatrolCommand(unitId: number, target: Position): boolean {
    return submitPatrol(unitId, target);
  }

  return {
    clearPatrolRoute,
    setUnitPatrolCommandDirect,
    resumePatrolLeg,
    issueUnitPatrolCommand,
  };
}
