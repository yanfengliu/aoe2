// Validator for `trebuchet.pack` command (DESIGN v17 §6.2 / §6.4 / §6.6).
//
// Phase 1B note: trebuchet pack/unpack are unique among the 15 commands
// because no live submitter exists today — `playerCommandsSystem` (a
// deterministic-resolution system) auto-triggers `beginTrebuchetPack` /
// `beginTrebuchetUnpack` based on a trebuchet's current state +
// move/attack command. The validator + handler are registered for replay
// observability and to allow Phase 1C+ AI-decision systems (or a future
// HUD button) to submit these directly. The existing in-system call-site
// stays untouched (deterministic-resolution can mutate state directly per
// §6.4 B1; no replay drift since the system is deterministic).

import type { World } from 'civ-engine';

import type { UnitComponent } from '../../types';
import type { TrebuchetPackState } from '../../bridge/sharedTypes';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface TrebuchetPackValidatorDeps {
  trebuchetPackStates: Map<number, TrebuchetPackState>;
}

export type TrebuchetPackValidator = (
  data: GameCommands['trebuchet.pack'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => true | { code: string; message: string };

export function makeTrebuchetPackValidator(
  deps: TrebuchetPackValidatorDeps,
): TrebuchetPackValidator {
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
      return { code: 'not_a_trebuchet', message: 'Only trebuchets can pack.' };
    }
    const packState = deps.trebuchetPackStates.get(data.unitId);
    if (!packState) {
      return { code: 'no_pack_state', message: 'Trebuchet has no pack state.' };
    }
    // impl-15 review F1 / MEDIUM: check `transitionTicksRemaining` BEFORE the
    // packed flag. During an UNPACK transition the state is
    // `{ packed: true, ticks: > 0 }` (advanceTrebuchetTransition flips
    // `packed` only when ticks reach 0); reporting `already_packed` would
    // mislead a recorded-rejection observer about whether the unit is
    // stably packed or about to flip. `in_transition` is the correct
    // diagnostic for any non-zero transition tick count.
    if (packState.transitionTicksRemaining > 0) {
      return { code: 'in_transition', message: 'Trebuchet is mid-transition.' };
    }
    if (packState.packed) {
      return { code: 'already_packed', message: 'Trebuchet is already packed.' };
    }
    return true;
  };
}
