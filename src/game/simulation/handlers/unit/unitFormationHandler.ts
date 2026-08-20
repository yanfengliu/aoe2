// M6 control: `unit.formation`. Validates the player's formation order and
// writes it onto the addressed units.
//
// Like a stance, this rides the recorded command channel: it changes where the
// unit stands on later move orders, so a replay that skipped it would put the
// group in the wrong shape and diverge from there.

import type { UnitComponent } from '../../types';
import type { CommandValidationResult } from 'civ-engine';
import type { GameWorld } from '../../bridge/pureHelpers';
import { UNIT_FORMATIONS, type UnitFormation } from '../../unitFormation';

export interface UnitFormationDeps {
  setUnitFormation: (unitId: number, formation: UnitFormation) => void;
}

interface UnitFormationCommand {
  unitIds: number[];
  formation: UnitFormation;
}

export function makeUnitFormationValidator(deps: { humanPlayerId: number }) {
  return function unitFormationValidator(
    data: UnitFormationCommand,
    world: GameWorld,
  ): CommandValidationResult {
    if (!UNIT_FORMATIONS.includes(data.formation)) {
      return {
        code: 'unknown_formation',
        message: `Unknown formation '${String(data.formation)}'. Expected one of: ${UNIT_FORMATIONS.join(', ')}.`,
      };
    }
    if (!Array.isArray(data.unitIds) || data.unitIds.length === 0) {
      return {
        code: 'no_units',
        message: 'A formation order needs at least one unit; none were addressed.',
      };
    }
    // Every addressed unit must exist and belong to the commanding player — a
    // formation order is a real order, so a partially-valid batch is a rejected
    // batch rather than a silently narrowed one.
    for (const unitId of data.unitIds) {
      if (!world.isAlive(unitId)) {
        return {
          code: 'unit_not_found',
          message: `Cannot set a formation on unit ${String(unitId)}: it no longer exists.`,
        };
      }
      const unit = world.getComponent<UnitComponent>(unitId, 'unit');
      if (!unit) {
        return {
          code: 'not_a_unit',
          message: `Cannot set a formation on entity ${String(unitId)}: it is not a unit.`,
        };
      }
      if (unit.owner !== deps.humanPlayerId) {
        return {
          code: 'not_owned',
          message: `Cannot set a formation on unit ${String(unitId)}: it belongs to player ${String(unit.owner)}.`,
        };
      }
    }
    return true;
  };
}

export function makeUnitFormationHandler(deps: UnitFormationDeps) {
  return function unitFormationHandler(data: UnitFormationCommand, world: GameWorld): void {
    for (const unitId of data.unitIds) {
      if (!world.getComponent<UnitComponent>(unitId, 'unit')) continue;
      deps.setUnitFormation(unitId, data.formation);
    }
  };
}
