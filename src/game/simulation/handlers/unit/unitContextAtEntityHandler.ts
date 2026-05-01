// Handler for `unit.contextAtEntity` command (DESIGN v17 §6.2 / §6.4).

import type { World } from 'civ-engine';

import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface UnitContextAtEntityHandlerDeps {
  routeUnitContextAtEntityCommandDirect: (unitId: number, targetEntityId: number) => boolean;
}

export type UnitContextAtEntityHandler = (
  data: GameCommands['unit.contextAtEntity'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeUnitContextAtEntityHandler(deps: UnitContextAtEntityHandlerDeps): UnitContextAtEntityHandler {
  return (data) => {
    deps.routeUnitContextAtEntityCommandDirect(data.unitId, data.targetEntityId);
  };
}
