// M6 control: `unit.stance`. Validates the player's stance order and writes it
// onto the addressed units.
//
// The stance rides the recorded command channel because it changes what a unit
// does on later ticks — a replay that skipped it would diverge the moment an
// auto-aggression scan ran with the wrong radius.

import type { UnitComponent } from '../../types';
import type { CommandValidationResult } from 'civ-engine';
import type { GameWorld } from '../../bridge/pureHelpers';
import { UNIT_STANCES, type UnitStance } from '../../unitStance';

export interface UnitStanceDeps {
  setUnitStance: (unitId: number, stance: UnitStance) => void;
}

interface UnitStanceCommand {
  unitIds: number[];
  stance: UnitStance;
}

export function makeUnitStanceValidator(deps: { humanPlayerId: number }) {
  return function unitStanceValidator(
    data: UnitStanceCommand,
    world: GameWorld,
  ): CommandValidationResult {
    if (!UNIT_STANCES.includes(data.stance)) {
      return {
        code: 'unknown_stance',
        message: `Unknown stance '${String(data.stance)}'. Expected one of: ${UNIT_STANCES.join(', ')}.`,
      };
    }
    if (!Array.isArray(data.unitIds) || data.unitIds.length === 0) {
      return {
        code: 'no_units',
        message: 'A stance order needs at least one unit; none were addressed.',
      };
    }
    // Every addressed unit must exist and belong to the commanding player — a
    // stance order is a real order, so a partially-valid batch is a rejected
    // batch rather than a silently narrowed one.
    for (const unitId of data.unitIds) {
      if (!world.isAlive(unitId)) {
        return {
          code: 'unit_not_found',
          message: `Cannot set a stance on unit ${String(unitId)}: it no longer exists.`,
        };
      }
      const unit = world.getComponent<UnitComponent>(unitId, 'unit');
      if (!unit) {
        return {
          code: 'not_a_unit',
          message: `Cannot set a stance on entity ${String(unitId)}: it is not a unit.`,
        };
      }
      if (unit.owner !== deps.humanPlayerId) {
        return {
          code: 'not_owned',
          message: `Cannot set a stance on unit ${String(unitId)}: it belongs to player ${String(unit.owner)}.`,
        };
      }
    }
    return true;
  };
}

export function makeUnitStanceHandler(deps: UnitStanceDeps) {
  return function unitStanceHandler(data: UnitStanceCommand, world: GameWorld): void {
    for (const unitId of data.unitIds) {
      if (!world.getComponent<UnitComponent>(unitId, 'unit')) continue;
      deps.setUnitStance(unitId, data.stance);
    }
  };
}
