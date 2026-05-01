// Command handler + validator registration site (DESIGN v17 §6.2 / §6.4).
//
// Phase 1A scaffolding: function exists and is called from `wireBridgeOps`,
// but no handlers were registered. Each Phase 1B commit adds one validator
// + handler pair (15 commands total per §6.1). Phase 3A will add a parallel
// call site in `wireReplaySystems` so the replay world re-registers the
// same handlers.
//
// Handlers run during `processCommands` at the START of the next step
// (`world.ts:1671` — NOT same-tick). Validators run synchronously inside
// `submitWithResult` BEFORE the queue accepts the command.
//
// Per civ-engine `CommandValidationResult`:
//  - `true`: accept.
//  - `false`: reject generically.
//  - `{ code, message, ... }` (CommandValidationRejection): reject with details.
//  - `null`: INVALID — civ-engine's normalizer throws.
//
// Per civ-engine `CommandSubmissionResult`:
//  - `{ accepted: true, code, message, details?, tick, sequence }`: accepted into queue.
//  - `{ accepted: false, code, message, details? }`: rejected by validator.
//
// Per civ-engine `CommandExecutionResult`:
//  - `{ executed: true, code: 'executed', ... }`: handler ran without throwing.
//  - `{ executed: false, code: 'missing_handler' | ... }`: handler failed.

import type { Position } from 'civ-engine';

import type { GameWorld } from './pureHelpers';
import { unitMoveValidator } from '../handlers/unit/unitMoveValidator';
import { makeUnitMoveHandler } from '../handlers/unit/unitMoveHandler';

export interface CommandHandlerDeps {
  // Phase 1B (unit.move): direct-mutation helper used by the unit.move
  // handler so live + replay + deterministic-system paths all execute
  // identical code (per DESIGN v17 §6.4 B1 fix).
  setUnitMoveCommandDirect: (unitId: number, target: Position) => boolean;
}

/** Register all 15 command type validators + handlers on the given world.
 *  Currently called only by `wireBridgeOps` (live). Phase 3A will add a
 *  `wireReplaySystems` helper that also calls this — replay needs the
 *  same handlers because `SessionReplayer.openAt` re-submits recorded
 *  commands and would throw `ReplayHandlerMissingError` otherwise. */
export function registerCommandHandlers(
  world: GameWorld,
  deps: CommandHandlerDeps,
): void {
  // Phase 1B — unit.move
  world.registerValidator('unit.move', unitMoveValidator);
  world.registerHandler('unit.move', makeUnitMoveHandler({
    setUnitMoveCommandDirect: deps.setUnitMoveCommandDirect,
  }));
  // Each subsequent Phase 1B commit adds one validator + handler pair here.
}
