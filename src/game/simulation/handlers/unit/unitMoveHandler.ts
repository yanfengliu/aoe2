// Handler for `unit.move` command (DESIGN v17 §6.2 / §6.4).
//
// Handlers run during `processCommands` at the START of the next step
// (NOT same-tick — see DESIGN §6.5). Pure mutation; rejection already
// happened in the validator at submit time.
//
// Per the v15 facade-vs-helper split, this handler delegates to the
// shared `setUnitMoveCommandDirect` helper so live (facade → submit →
// handler) and replay (recorded submit → handler) AND deterministic-
// system (helper directly) all execute identical code.

import type { World } from 'civ-engine';

import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface UnitMoveHandlerDeps {
  setUnitMoveCommandDirect: (unitId: number, target: { x: number; y: number }) => boolean;
}

export type UnitMoveHandler = (
  data: GameCommands['unit.move'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeUnitMoveHandler(deps: UnitMoveHandlerDeps): UnitMoveHandler {
  return (data) => {
    deps.setUnitMoveCommandDirect(data.unitId, data.target);
  };
}
