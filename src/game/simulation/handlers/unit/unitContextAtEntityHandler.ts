// Handler for `unit.contextAtEntity` command (DESIGN v17 §6.2 / §6.4).

import type { World } from 'civ-engine';

import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface UnitContextAtEntityHandlerDeps {
  routeUnitContextAtEntityCommandDirect: (
    unitId: number,
    targetEntityId: number,
    allowGarrison: boolean,
    forceAttack?: boolean,
  ) => boolean;
  // Shift-queued entity orders (v0.3.141). Absent deps = a test harness that
  // predates the chain; the handler then routes every click directly.
  queuedOrders?: {
    unitHasActiveOrder(unitId: number): boolean;
    appendQueuedEntityOrder(unitId: number, targetEntityId: number, garrison: boolean, forceAttack: boolean): void;
    wipeQueuedEntityOrders(unitId: number): void;
  };
}

export type UnitContextAtEntityHandler = (
  data: GameCommands['unit.contextAtEntity'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeUnitContextAtEntityHandler(deps: UnitContextAtEntityHandlerDeps): UnitContextAtEntityHandler {
  return (data) => {
    // Absent `garrison` = a recording made before right-click stopped
    // garrisoning (spec §9.3); replay it as the player saw it.
    const garrison = data.garrison ?? true;
    // Absent = every older recording: no forced friendly fire.
    const forceAttack = data.forceAttack ?? false;

    if (data.queue && deps.queuedOrders?.unitHasActiveOrder(data.unitId)) {
      // Shift on a BUSY unit appends to its chain; the completion watchers
      // fire it later through this same router.
      deps.queuedOrders.appendQueuedEntityOrder(data.unitId, data.targetEntityId, garrison, forceAttack);
      return;
    }
    if (!data.queue) {
      // A plain order replaces the whole chain, as in AoE2.
      deps.queuedOrders?.wipeQueuedEntityOrders(data.unitId);
    }
    deps.routeUnitContextAtEntityCommandDirect(data.unitId, data.targetEntityId, garrison, forceAttack);
  };
}
