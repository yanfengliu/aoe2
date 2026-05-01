// Handler for `trebuchet.unpack` command (DESIGN v17 §6.2 / §6.4 / §6.6).
// Delegates to beginTrebuchetUnpackDirect (= existing beginTrebuchetUnpack).

import type { World } from 'civ-engine';

import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface TrebuchetUnpackHandlerDeps {
  beginTrebuchetUnpackDirect: (unitId: number) => void;
}

export type TrebuchetUnpackHandler = (
  data: GameCommands['trebuchet.unpack'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeTrebuchetUnpackHandler(
  deps: TrebuchetUnpackHandlerDeps,
): TrebuchetUnpackHandler {
  return (data) => {
    deps.beginTrebuchetUnpackDirect(data.unitId);
  };
}
