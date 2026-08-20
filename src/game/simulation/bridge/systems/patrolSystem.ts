// M6 control: keeps a patrolling unit pacing its route.
//
// Runs AFTER `prototypePlayerCommands`, which is what clears a finished walk.
// So each tick this sees exactly the patrollers that have nothing to do — the
// ones that arrived at an end, and the ones that just finished a fight
// auto-aggression pulled them into — and sends them on the next leg. That is
// the whole difference between a patrol and an attack-move: an attack-move is
// one order and is over the first time it works.
//
// A dead unit's route is dropped here rather than at the death site, so nothing
// in the combat path has to know patrol exists.

import type { Position } from 'civ-engine';

import type { GameWorld } from '../pureHelpers';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { patrolRoutesCodec, unitCommandsCodec } from '../bridgeStateSerialize';
import { hasReachedPatrolEnd, patrolDestination, reversePatrol } from '../../patrolRoute';

export interface PatrolSystemDeps {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  /** Re-issues a walk WITHOUT ending the route (see unitCommandOps). */
  resumePatrolLeg: (unitId: number, target: Position) => boolean;
}

export function registerPatrolSystem(deps: PatrolSystemDeps): void {
  const { world, accessor, resumePatrolLeg } = deps;

  world.registerSystem({
    name: 'prototypePatrol',
    phase: 'update',
    after: ['prototypePlayerCommands'],
    execute(activeWorld) {
      const routes = accessor.get(patrolRoutesCodec);
      if (routes.size === 0) return;

      const commands = accessor.get(unitCommandsCodec);
      let changed = false;

      for (const [unitId, route] of [...routes]) {
        if (!activeWorld.isAlive(unitId)) {
          routes.delete(unitId);
          changed = true;
          continue;
        }
        // Still walking, fighting, or otherwise busy — leave it alone.
        if (commands.has(unitId)) continue;

        const position = activeWorld.getComponent<Position>(unitId, 'position');
        if (!position) continue;

        // Turn around only when the unit is actually at the end it was headed
        // for. A unit that stopped anywhere else (a fight, a blocked step)
        // resumes toward the SAME end rather than doubling back.
        const next = hasReachedPatrolEnd(route, position) ? reversePatrol(route) : route;
        if (next !== route) {
          routes.set(unitId, next);
          changed = true;
        }
        resumePatrolLeg(unitId, patrolDestination(next));
      }

      if (changed) accessor.markDirty(patrolRoutesCodec);
    },
  });
}
