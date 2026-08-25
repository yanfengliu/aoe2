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

import type { Position } from 'civ-engine';
import type { World } from 'civ-engine';

import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface UnitMoveHandlerDeps {
  setUnitMoveCommandDirect: (unitId: number, target: Position) => boolean;
  appendMoveWaypointDirect: (unitId: number, target: Position) => boolean;
}

export type UnitMoveHandler = (
  data: GameCommands['unit.move'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeUnitMoveHandler(deps: UnitMoveHandlerDeps): UnitMoveHandler {
  return (data) => {
    // Shift-queue (v0.3.125): a queued move APPENDS a waypoint when a move is
    // already standing (commands process in order, so the first click's move
    // has landed by the time its shift-click follows); anyone without a
    // standing move starts fresh. Replays reproduce chains for free.
    if (data.queue && deps.appendMoveWaypointDirect(data.unitId, data.target)) {
      return;
    }
    deps.setUnitMoveCommandDirect(data.unitId, data.target);
  };
}
