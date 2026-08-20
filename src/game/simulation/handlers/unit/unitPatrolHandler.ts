// M6 control: `unit.patrol`. Same validation as `unit.move` and
// `unit.attackMove`; the difference is that it records a standing ROUTE rather
// than a one-shot order, so the unit keeps pacing it after a fight.

import type { Position } from 'civ-engine';

import type { UnitComponent } from '../../types';
import type { GameWorld } from '../../bridge/pureHelpers';

interface PatrolCommand {
  unitId: number;
  target: Position;
}

export function makeUnitPatrolValidator(deps: { humanPlayerId: number }) {
  return function unitPatrolValidator(
    data: PatrolCommand,
    world: GameWorld,
  ): true | { code: string; message: string } {
    if (!world.isAlive(data.unitId)) {
      return {
        code: 'unit_not_found',
        message: `Cannot patrol unit ${String(data.unitId)}: it no longer exists.`,
      };
    }
    const unit = world.getComponent<UnitComponent>(data.unitId, 'unit');
    if (!unit) {
      return {
        code: 'not_a_unit',
        message: `Cannot patrol entity ${String(data.unitId)}: it is not a unit.`,
      };
    }
    if (unit.owner !== deps.humanPlayerId) {
      return {
        code: 'not_owned',
        message: `Cannot patrol unit ${String(data.unitId)}: it belongs to player ${String(unit.owner)}.`,
      };
    }
    return true;
  };
}

export function makeUnitPatrolHandler(deps: {
  setUnitPatrolCommandDirect: (unitId: number, target: Position) => boolean;
}) {
  return function unitPatrolHandler(data: PatrolCommand): void {
    deps.setUnitPatrolCommandDirect(data.unitId, data.target);
  };
}
