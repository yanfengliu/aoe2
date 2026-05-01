// Handler for `sheep.move` command (DESIGN v17 §6.2 / §6.4).

import type { Position, World } from 'civ-engine';

import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface SheepMoveHandlerDeps {
  setSheepMoveCommandDirect: (sheepId: number, target: Position) => boolean;
}

export type SheepMoveHandler = (
  data: GameCommands['sheep.move'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeSheepMoveHandler(deps: SheepMoveHandlerDeps): SheepMoveHandler {
  return (data) => {
    deps.setSheepMoveCommandDirect(data.sheepId, data.target);
  };
}
