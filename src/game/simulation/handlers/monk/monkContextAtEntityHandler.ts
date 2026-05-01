// Handler for `monk.contextAtEntity` command (DESIGN v17 §6.2 / §6.4).

import type { World } from 'civ-engine';

import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface MonkContextAtEntityHandlerDeps {
  routeMonkContextAtEntityCommandDirect: (monkId: number, targetEntityId: number) => boolean;
}

export type MonkContextAtEntityHandler = (
  data: GameCommands['monk.contextAtEntity'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeMonkContextAtEntityHandler(
  deps: MonkContextAtEntityHandlerDeps,
): MonkContextAtEntityHandler {
  return (data) => {
    deps.routeMonkContextAtEntityCommandDirect(data.unitId, data.targetEntityId);
  };
}
