// Validator for `monk.contextAtEntity` command (DESIGN v17 §6.2 / §6.4).

import type { World } from 'civ-engine';

import type { UnitComponent } from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

const MONK_CONTEXT_TASK_KINDS = new Set(['heal', 'convert', 'pickup', 'deposit']);

export type MonkContextAtEntityValidator = (
  data: GameCommands['monk.contextAtEntity'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => true | false | { code: string; message: string };

export const monkContextAtEntityValidator: MonkContextAtEntityValidator = (data, world) => {
  if (!Number.isInteger(data.unitId) || !Number.isInteger(data.targetEntityId)) {
    return { code: 'invalid_id', message: 'IDs must be integers.' };
  }
  if (data.expectedOwner !== undefined && !Number.isInteger(data.expectedOwner)) {
    return { code: 'invalid_owner', message: 'Expected owner must be an integer.' };
  }
  if (
    data.intendedTaskKind !== undefined
    && !MONK_CONTEXT_TASK_KINDS.has(data.intendedTaskKind)
  ) {
    return { code: 'invalid_task_kind', message: 'Intended task kind is invalid.' };
  }
  if (!world.isAlive(data.unitId)) {
    return { code: 'unit_not_found', message: 'Unit no longer exists.' };
  }
  const unit = world.getComponent<UnitComponent>(data.unitId, 'unit');
  if (!unit) {
    return { code: 'not_a_unit', message: 'Entity is not a unit.' };
  }
  if (unit.unitType !== 'monk') {
    return { code: 'not_a_monk', message: 'Only monks can issue monk context commands.' };
  }
  if (data.expectedOwner !== undefined && unit.owner !== data.expectedOwner) {
    return { code: 'owner_changed', message: 'Monk owner changed before command submission.' };
  }
  if (!world.isAlive(data.targetEntityId)) {
    return { code: 'target_not_found', message: 'Target no longer exists.' };
  }
  return true;
};
