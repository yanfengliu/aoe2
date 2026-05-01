// Validator for `trebuchet.unpack` command (DESIGN v17 §6.2 / §6.4 / §6.6).
// Mirror of trebuchet.pack — same shape, opposite state requirement
// (must be packed + not in transition).

import type { World } from 'civ-engine';

import type { UnitComponent } from '../../types';
import type { TrebuchetPackState } from '../../bridge/sharedTypes';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface TrebuchetUnpackValidatorDeps {
  trebuchetPackStates: Map<number, TrebuchetPackState>;
}

export type TrebuchetUnpackValidator = (
  data: GameCommands['trebuchet.unpack'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => true | { code: string; message: string };

export function makeTrebuchetUnpackValidator(
  deps: TrebuchetUnpackValidatorDeps,
): TrebuchetUnpackValidator {
  return (data, world) => {
    if (!Number.isInteger(data.unitId)) {
      return { code: 'invalid_unit_id', message: 'Unit id must be an integer.' };
    }
    if (!world.isAlive(data.unitId)) {
      return { code: 'unit_not_found', message: 'Unit no longer exists.' };
    }
    const unit = world.getComponent<UnitComponent>(data.unitId, 'unit');
    if (!unit) {
      return { code: 'not_a_unit', message: 'Entity is not a unit.' };
    }
    if (unit.unitType !== 'trebuchet') {
      return { code: 'not_a_trebuchet', message: 'Only trebuchets can unpack.' };
    }
    const packState = deps.trebuchetPackStates.get(data.unitId);
    if (!packState) {
      return { code: 'no_pack_state', message: 'Trebuchet has no pack state.' };
    }
    // impl-15 review F1 / MEDIUM: same precedence rule as the pack
    // validator — check `transitionTicksRemaining` BEFORE the packed flag.
    if (packState.transitionTicksRemaining > 0) {
      return { code: 'in_transition', message: 'Trebuchet is mid-transition.' };
    }
    if (!packState.packed) {
      return { code: 'already_unpacked', message: 'Trebuchet is already unpacked.' };
    }
    return true;
  };
}
