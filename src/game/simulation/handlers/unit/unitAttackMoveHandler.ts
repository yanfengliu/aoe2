// M6 control: `unit.attackMove`. Same shape and validation as `unit.move` —
// the difference is entirely in what auto-aggression does while the order is
// active (it engages regardless of the unit's stance).

import type { Position } from 'civ-engine';

import type { UnitComponent } from '../../types';
import type { GameWorld } from '../../bridge/pureHelpers';

interface AttackMoveCommand {
  unitId: number;
  target: Position;
}

export function makeUnitAttackMoveValidator(deps: { humanPlayerId: number }) {
  return function unitAttackMoveValidator(
    data: AttackMoveCommand,
    world: GameWorld,
  ): true | { code: string; message: string } {
    if (!world.isAlive(data.unitId)) {
      return {
        code: 'unit_not_found',
        message: `Cannot attack-move unit ${String(data.unitId)}: it no longer exists.`,
      };
    }
    const unit = world.getComponent<UnitComponent>(data.unitId, 'unit');
    if (!unit) {
      return {
        code: 'not_a_unit',
        message: `Cannot attack-move entity ${String(data.unitId)}: it is not a unit.`,
      };
    }
    if (unit.owner !== deps.humanPlayerId) {
      return {
        code: 'not_owned',
        message: `Cannot attack-move unit ${String(data.unitId)}: it belongs to player ${String(unit.owner)}.`,
      };
    }
    return true;
  };
}

export function makeUnitAttackMoveHandler(deps: {
  setUnitAttackMoveCommandDirect: (unitId: number, target: Position) => boolean;
}) {
  return function unitAttackMoveHandler(data: AttackMoveCommand): void {
    deps.setUnitAttackMoveCommandDirect(data.unitId, data.target);
  };
}
