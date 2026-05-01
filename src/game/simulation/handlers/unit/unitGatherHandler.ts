// Handler for `unit.gather` command (DESIGN v17 §6.2 / §6.4).
// Delegates to the shared `setUnitGatherCommandDirect` helper.

import type { World } from 'civ-engine';

import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface UnitGatherHandlerDeps {
  setUnitGatherCommandDirect: (unitId: number, resourceId: number) => boolean;
}

export type UnitGatherHandler = (
  data: GameCommands['unit.gather'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeUnitGatherHandler(deps: UnitGatherHandlerDeps): UnitGatherHandler {
  return (data) => {
    deps.setUnitGatherCommandDirect(data.unitId, data.resourceId);
  };
}
