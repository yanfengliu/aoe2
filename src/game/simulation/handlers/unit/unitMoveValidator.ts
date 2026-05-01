// Validator for `unit.move` command (DESIGN v17 §6.2 / §6.4).
//
// Validators run synchronously inside `submitWithResult` BEFORE the queue
// accepts the command. Per civ-engine's `CommandValidationResult`:
//  - `true`        → accept.
//  - `false`       → reject generically.
//  - `{ code, message, ... }` → reject with details (recorder captures as
//                                RejectionResult).
//
// Validators do **structural** validation here: entity existence + correct
// component shape. State-dependent re-checks (resource affordability, etc.)
// happen in the handler at execution time per §6.2 B2 fix — but `unit.move`
// has no state-dependent guards beyond unit existence, so the validator is
// the only check.
//
// Coordinate clamping is HANDLER responsibility (§6.2 B2 prose); validator
// rejects only structurally-invalid coordinates (NaN, non-integer).

import type { World } from 'civ-engine';

import type { UnitComponent } from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export type UnitMoveValidator = (
  data: GameCommands['unit.move'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => true | false | { code: string; message: string };

export const unitMoveValidator: UnitMoveValidator = (data, world) => {
  if (!Number.isInteger(data.unitId)) {
    return { code: 'invalid_unit_id', message: 'Unit id must be an integer.' };
  }
  if (
    !Number.isInteger(data.target?.x)
    || !Number.isInteger(data.target?.y)
  ) {
    return { code: 'invalid_target', message: 'Move target coordinates are invalid.' };
  }
  if (!world.isAlive(data.unitId)) {
    return { code: 'unit_not_found', message: 'Unit no longer exists.' };
  }
  const unit = world.getComponent<UnitComponent>(data.unitId, 'unit');
  if (!unit) {
    return { code: 'not_a_unit', message: 'Entity is not a unit.' };
  }
  return true;
};
