// Handler for `unit.attack` command (DESIGN v17 §6.2 / §6.4).
//
// Delegates to the shared `setUnitAttackCommandDirect` helper so live,
// replay, and deterministic-system call sites all execute identical code.
// The helper does its own ownership + kind re-check, so a target that
// died/changed-owner between submit and execute is handled as a silent
// no-op (helper returns false, recorder still captures `executed: true`).

import type { World } from 'civ-engine';

import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface UnitAttackHandlerDeps {
  setUnitAttackCommandDirect: (
    unitId: number,
    targetEntityId: number,
    targetEntityKind: 'unit' | 'building' | 'resource',
  ) => boolean;
  // v0.3.141: a PLAYER attack replaces the unit's shift-queued chain; an
  // auto-aggression engagement (`data.auto`) leaves it standing.
  wipeQueuedEntityOrders: (unitId: number) => void;
}

export type UnitAttackHandler = (
  data: GameCommands['unit.attack'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeUnitAttackHandler(deps: UnitAttackHandlerDeps): UnitAttackHandler {
  return (data) => {
    if (!data.auto) {
      deps.wipeQueuedEntityOrders(data.unitId);
    }
    deps.setUnitAttackCommandDirect(data.unitId, data.targetEntityId, data.targetEntityKind);
  };
}
