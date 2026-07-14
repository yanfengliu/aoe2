// Validator for `unit.attack` command (DESIGN v17 §6.2 / §6.4).
//
// Semantic attacker capability plus structural entity existence / component
// shape validation. The handler re-checks the same conditions (since the
// target may have died between submit and execute) and silently no-ops on
// a stale-state miss; recorder still captures `executed: true` because the
// handler ran without throwing.

import type { World } from 'civ-engine';

import type { BuildingComponent, ResourceComponent, UnitComponent } from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export type UnitAttackValidator = (
  data: GameCommands['unit.attack'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => true | false | { code: string; message: string };

export const unitAttackValidator: UnitAttackValidator = (data, world) => {
  if (!Number.isInteger(data.unitId) || !Number.isInteger(data.targetEntityId)) {
    return { code: 'invalid_id', message: 'Attack ids must be integers.' };
  }
  if (data.targetEntityKind !== 'unit'
      && data.targetEntityKind !== 'building'
      && data.targetEntityKind !== 'resource') {
    return { code: 'invalid_target_kind', message: 'Unknown attack target kind.' };
  }
  if (!world.isAlive(data.unitId)) {
    return { code: 'unit_not_found', message: 'Attacker no longer exists.' };
  }
  const unit = world.getComponent<UnitComponent>(data.unitId, 'unit');
  if (!unit) {
    return { code: 'not_a_unit', message: 'Attacker is not a unit.' };
  }
  if (unit.unitType === 'monk') {
    return { code: 'unit_cannot_attack', message: 'Monks cannot attack.' };
  }
  if (!world.isAlive(data.targetEntityId)) {
    return { code: 'target_not_found', message: 'Target no longer exists.' };
  }
  // Ownership / kind alignment is re-checked in the handler because the
  // target's owner could change between submit and execute (monk conversion).
  // Validator confirms the kind tag matches the entity's component shape.
  if (data.targetEntityKind === 'unit'
      && !world.getComponent<UnitComponent>(data.targetEntityId, 'unit')) {
    return { code: 'target_kind_mismatch', message: 'Target is not a unit.' };
  }
  if (data.targetEntityKind === 'building'
      && !world.getComponent<BuildingComponent>(data.targetEntityId, 'building')) {
    return { code: 'target_kind_mismatch', message: 'Target is not a building.' };
  }
  if (data.targetEntityKind === 'resource'
      && !world.getComponent<ResourceComponent>(data.targetEntityId, 'resource')) {
    return { code: 'target_kind_mismatch', message: 'Target is not a resource.' };
  }
  return true;
};
