// Validator for `unit.contextAtEntity` command (DESIGN v17 §6.2 / §6.4).

import { isMonasticUnit } from '../../monasticUnits';
import type { World } from 'civ-engine';

import type { UnitComponent } from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export type UnitContextAtEntityValidator = (
  data: GameCommands['unit.contextAtEntity'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => true | false | { code: string; message: string };

export const unitContextAtEntityValidator: UnitContextAtEntityValidator = (data, world) => {
  if (!Number.isInteger(data.unitId) || !Number.isInteger(data.targetEntityId)) {
    return { code: 'invalid_id', message: 'IDs must be integers.' };
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
  if (!world.isAlive(data.targetEntityId)) {
    return { code: 'target_not_found', message: 'Target no longer exists.' };
  }
  return true;
};
