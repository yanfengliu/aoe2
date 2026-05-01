// Command handler + validator registration site (DESIGN v17 §6.2 / §6.4).
//
// Phase 1A scaffolding: function exists and is called from `wireBridgeOps`,
// but no handlers are registered yet. Each Phase 1B commit adds one validator
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

import type { GameWorld } from './pureHelpers';

// Phase 1A: deps placeholder. Phase 1B handlers will receive bridge ops
// (BridgeStateAccessor in Phase 2; raw bridge state Maps/Sets transitionally).
// For now this is a marker type so the registration site type-checks.
export type CommandHandlerDeps = Record<string, never>;

/** Register all 15 command type validators + handlers on the given world.
 *  Currently called only by `wireBridgeOps` (live). Phase 3A will add a
 *  `wireReplaySystems` helper that also calls this — replay needs the
 *  same handlers because `SessionReplayer.openAt` re-submits recorded
 *  commands and would throw `ReplayHandlerMissingError` otherwise. */
export function registerCommandHandlers(
  _world: GameWorld,
  _deps: CommandHandlerDeps,
): void {
  // Phase 1A: empty body. Each Phase 1B commit adds one pair:
  //   _world.registerValidator('unit.move', unitMoveValidator);
  //   _world.registerHandler('unit.move', (data, world) => unitMoveHandler(data, world, _deps));
  //   ... 14 more ...
  // Underscore prefix on params silences the unused-vars lint until Phase 1B
  // wires the first handler.
  void _world;
  void _deps;
}
