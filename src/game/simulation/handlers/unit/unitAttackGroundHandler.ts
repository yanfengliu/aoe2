// Attack-ground (spec §10.7, v0.3.117): `unit.attackGround` orders a unit to
// bombard a CELL. The validator accepts a unit whose shot blasts where it
// lands (`canAttackGround`), since the blast is the whole attack. It used to
// accept any unit with a blast radius, which let a Demolition Ship take an
// order DE does not give it and lob shots that did nothing, and let a Siege
// Onager take one its shot could not carry out (defect register,
// "The Siege Onager fired direct hits with no splash", 2026-09-24).

import type { World } from 'civ-engine';

import type { UnitComponent } from '../../types';
import { canAttackGround } from '../../projectileRules';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

type GameWorldT = World<GameEvents, GameCommands, GameComponents>;

export const unitAttackGroundValidator = (
  data: GameCommands['unit.attackGround'],
  world: GameWorldT,
): true | { code: string; message: string } => {
  if (!Number.isInteger(data.unitId)) {
    return {
      code: 'invalid_unit_id',
      message: `Cannot attack the ground with unit id ${String(data.unitId)}: a unit id is a whole number.`,
    };
  }
  if (!Number.isInteger(data.target?.x) || !Number.isInteger(data.target?.y)) {
    return {
      code: 'invalid_target',
      message: `Cannot attack the ground at (${String(data.target?.x)}, ${String(data.target?.y)}): `
        + 'the target cell needs whole-number coordinates.',
    };
  }
  if (!world.isAlive(data.unitId)) {
    return {
      code: 'unit_not_found',
      message: `Cannot attack the ground with unit ${String(data.unitId)}: it no longer exists.`,
    };
  }
  const unit = world.getComponent<UnitComponent>(data.unitId, 'unit');
  if (!unit) {
    return {
      code: 'not_a_unit',
      message: `Cannot attack the ground with entity ${String(data.unitId)}: it is not a unit.`,
    };
  }
  if (!canAttackGround(unit.unitType)) {
    return {
      code: 'cannot_attack_ground',
      message: `Unit ${String(data.unitId)} (${unit.unitType}) cannot attack the ground: only a unit whose shot blasts where it lands, `
        + 'such as the mangonel line, can be ordered to.',
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
