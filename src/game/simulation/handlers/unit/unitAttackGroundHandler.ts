// Attack-ground (spec §10.7, v0.3.117): `unit.attackGround` orders a
// blast-capable unit to bombard a CELL. The validator gates on the unit's
// own blast radius — the whole attack IS the area effect, so a unit without
// one has nothing to fire at the ground.

import type { World } from 'civ-engine';

import type { UnitComponent } from '../../types';
import { unitBlastRadius } from '../../prototypeUnitRules';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

type GameWorldT = World<GameEvents, GameCommands, GameComponents>;

export const unitAttackGroundValidator = (
  data: GameCommands['unit.attackGround'],
  world: GameWorldT,
): true | { code: string; message: string } => {
  if (!Number.isInteger(data.unitId)) {
    return { code: 'invalid_unit_id', message: 'Unit id must be an integer.' };
  }
  if (!Number.isInteger(data.target?.x) || !Number.isInteger(data.target?.y)) {
    return { code: 'invalid_target', message: 'Attack-ground target coordinates are invalid.' };
  }
  if (!world.isAlive(data.unitId)) {
    return { code: 'unit_not_found', message: 'Unit no longer exists.' };
  }
  const unit = world.getComponent<UnitComponent>(data.unitId, 'unit');
  if (!unit) {
    return { code: 'not_a_unit', message: 'Entity is not a unit.' };
  }
  if (unitBlastRadius(unit.unitType) <= 0) {
    return {
      code: 'no_blast',
      message: 'Only siege with an area attack (the mangonel line) can attack the ground.',
    };
  }
  return true;
};

export function makeUnitAttackGroundHandler(deps: {
  setUnitAttackGroundCommandDirect: (unitId: number, target: { x: number; y: number }) => boolean;
}) {
  return (data: GameCommands['unit.attackGround']): void => {
    deps.setUnitAttackGroundCommandDirect(data.unitId, data.target);
  };
}
