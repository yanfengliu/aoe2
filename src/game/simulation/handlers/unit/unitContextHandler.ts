// Handler for `unit.context` command (DESIGN v17 §6.2 / §6.4).
// Delegates to routeUnitContextCommandDirect helper which captures all
// the routing dependencies via closure.

import type { Position, World } from 'civ-engine';

import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface UnitContextHandlerDeps {
  routeUnitContextCommandDirect: (unitId: number, target: Position) => boolean;
}

export type UnitContextHandler = (
  data: GameCommands['unit.context'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeUnitContextHandler(deps: UnitContextHandlerDeps): UnitContextHandler {
  return (data) => {
    deps.routeUnitContextCommandDirect(data.unitId, data.target);
  };
}
