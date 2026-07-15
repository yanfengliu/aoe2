// Handler for `unit.contextAtEntity` command (DESIGN v17 §6.2 / §6.4).

import type { World } from 'civ-engine';

import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface UnitContextAtEntityHandlerDeps {
  routeUnitContextAtEntityCommandDirect: (
    unitId: number,
    targetEntityId: number,
    allowGarrison: boolean,
  ) => boolean;
}

export type UnitContextAtEntityHandler = (
  data: GameCommands['unit.contextAtEntity'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeUnitContextAtEntityHandler(deps: UnitContextAtEntityHandlerDeps): UnitContextAtEntityHandler {
  return (data) => {
    // Absent `garrison` = a recording made before right-click stopped
    // garrisoning (spec §9.3); replay it as the player saw it.
    deps.routeUnitContextAtEntityCommandDirect(
      data.unitId,
      data.targetEntityId,
      data.garrison ?? true,
    );
  };
}
