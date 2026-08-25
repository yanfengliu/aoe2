// Validator for `unit.context` command (DESIGN v17 §6.2 / §6.4).
//
// Structural validation. Monks are rejected here because the bridge facade
// dispatches monk routing BEFORE submission (HUD-side fast path), so a
// monk should never reach this command. The handler routes non-monk
// units via the routeUnitContextCommandDirect helper.

import { isMonasticUnit } from '../../monasticUnits';
import type { World } from 'civ-engine';

import type { UnitComponent } from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export type UnitContextValidator = (
  data: GameCommands['unit.context'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => true | false | { code: string; message: string };

export const unitContextValidator: UnitContextValidator = (data, world) => {
  if (!Number.isInteger(data.unitId)) {
    return { code: 'invalid_unit_id', message: 'Unit id must be an integer.' };
  }
  if (!Number.isInteger(data.target?.x) || !Number.isInteger(data.target?.y)) {
    return { code: 'invalid_target', message: 'Target coordinates must be integers.' };
  }
  if (!world.isAlive(data.unitId)) {
    return { code: 'unit_not_found', message: 'Unit no longer exists.' };
  }
  const unit = world.getComponent<UnitComponent>(data.unitId, 'unit');
  if (!unit) {
    return { code: 'not_a_unit', message: 'Entity is not a unit.' };
  }
  if (isMonasticUnit(unit.unitType)) {
    return { code: 'monk_should_route_via_facade', message: 'Monk routing must go through the HUD-side fast path.' };
  }
  return true;
};
