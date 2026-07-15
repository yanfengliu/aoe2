// Validator for `unit.autoGather` (spec §6.2 automatic post-construction
// mining). Baseline rules are identical to an explicit `unit.gather`; on top,
// the auto-order must never preempt anything. PRECISION (review iter-1): the
// engine validates at SUBMIT time and executes handlers later without
// re-validation, so this validator alone cannot see explicit commands already
// sitting in the engine queue — same-window protection is layered: the human
// move/context/placement paths EVICT pending intentions for their units
// (removePendingUnitCommands), agent/AI pushes land after the auto-order in
// FIFO so their handlers write last, and this validator is the state-based
// backstop that refuses any unit no longer "idle from the completed build"
// at its own submit time. Only two states count as idle-from-build: no unit
// command at all, or the stale build command still referencing the SAME camp
// (loop order can leave it uncleared for one tick after completion).

import type { World } from 'civ-engine';

import type { GathererComponent, ResourceComponent } from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';
import type { BridgeStateAccessor } from '../../bridge/bridgeStateAccessor';
import { unitCommandsCodec } from '../../bridge/bridgeStateSerialize';
import { unitGatherValidator } from './unitGatherValidator';

export interface UnitAutoGatherValidatorDeps {
  accessor: BridgeStateAccessor;
}

export type UnitAutoGatherValidator = (
  data: GameCommands['unit.autoGather'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => true | false | { code: string; message: string };

export function makeUnitAutoGatherValidator(
  deps: UnitAutoGatherValidatorDeps,
): UnitAutoGatherValidator {
  return (data, world) => {
    const base = unitGatherValidator(data, world);
    if (base !== true) return base;
    const resource = world.getComponent<ResourceComponent>(data.resourceId, 'resource');
    if (!resource || resource.amount <= 0) {
      return { code: 'auto_gather_depleted', message: 'Auto-gather target is depleted.' };
    }
    const gatherer = world.getComponent<GathererComponent>(data.unitId, 'gatherer');
    if (!gatherer || gatherer.task !== 'idle') {
      return { code: 'auto_gather_busy', message: 'Auto-gather never preempts an active task.' };
    }
    const command = deps.accessor.get(unitCommandsCodec).get(data.unitId);
    if (
      command
      && !(command.type === 'build' && command.buildingRef?.id === data.campBuildingId)
    ) {
      return { code: 'auto_gather_busy', message: 'Auto-gather never preempts an explicit order.' };
    }
    return true;
  };
}
