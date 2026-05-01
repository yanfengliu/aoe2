// Handler for `trebuchet.pack` command (DESIGN v17 §6.2 / §6.4 / §6.6).
// Delegates to beginTrebuchetPackDirect (= existing beginTrebuchetPack
// body, which itself re-checks pack-state invariants and silently no-ops
// on stale state).

import type { World } from 'civ-engine';

import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface TrebuchetPackHandlerDeps {
  beginTrebuchetPackDirect: (unitId: number) => void;
}

export type TrebuchetPackHandler = (
  data: GameCommands['trebuchet.pack'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeTrebuchetPackHandler(
  deps: TrebuchetPackHandlerDeps,
): TrebuchetPackHandler {
  return (data) => {
    deps.beginTrebuchetPackDirect(data.unitId);
  };
}
