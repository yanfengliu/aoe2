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
import type { TrainableUnitType } from '../types';
import { unitMoveValidator } from '../handlers/unit/unitMoveValidator';
import { makeUnitMoveHandler } from '../handlers/unit/unitMoveHandler';
import { unitAttackValidator } from '../handlers/unit/unitAttackValidator';
import { makeUnitAttackHandler } from '../handlers/unit/unitAttackHandler';
import { unitGatherValidator } from '../handlers/unit/unitGatherValidator';
import { makeUnitGatherHandler } from '../handlers/unit/unitGatherHandler';
import { unitContextValidator } from '../handlers/unit/unitContextValidator';
import { makeUnitContextHandler } from '../handlers/unit/unitContextHandler';
import { unitContextAtEntityValidator } from '../handlers/unit/unitContextAtEntityValidator';
import { makeUnitContextAtEntityHandler } from '../handlers/unit/unitContextAtEntityHandler';
import { sheepMoveValidator } from '../handlers/sheep/sheepMoveValidator';
import { makeSheepMoveHandler } from '../handlers/sheep/sheepMoveHandler';
import { monkContextAtEntityValidator } from '../handlers/monk/monkContextAtEntityValidator';
import { makeMonkContextAtEntityHandler } from '../handlers/monk/monkContextAtEntityHandler';
import { makeQueueTrainValidator, type QueueTrainValidatorDeps } from '../handlers/queue/queueTrainValidator';
import { makeQueueTrainHandler } from '../handlers/queue/queueTrainHandler';

export interface CommandHandlerDeps {
  // Phase 1B (unit.move): direct-mutation helper used by the unit.move
  // handler so live + replay + deterministic-system paths all execute
  // identical code (per DESIGN v17 §6.4 B1 fix).
  setUnitMoveCommandDirect: (unitId: number, target: Position) => boolean;
  // Phase 1B (unit.attack): same pattern.
  setUnitAttackCommandDirect: (
    unitId: number,
    targetEntityId: number,
    targetEntityKind: 'unit' | 'building' | 'resource',
  ) => boolean;
  // Phase 1B (unit.gather): same pattern.
  setUnitGatherCommandDirect: (unitId: number, resourceId: number) => boolean;
  // Phase 1B (unit.context): routing helper. Reads world state and
  // dispatches to garrison/attack/gather/move via the corresponding
  // direct helpers. Non-monk only — monk path is handled by the bridge
  // facade BEFORE submission.
  routeUnitContextCommandDirect: (unitId: number, target: Position) => boolean;
  // Phase 1B (unit.contextAtEntity): same shape as unit.context but
  // keyed on entity id.
  routeUnitContextAtEntityCommandDirect: (unitId: number, targetEntityId: number) => boolean;
  // Phase 1B (sheep.move).
  setSheepMoveCommandDirect: (sheepId: number, target: Position) => boolean;
  // Phase 1B (monk.contextAtEntity): routing helper. Reads the monk + target
  // afresh, dispatches to setMonkTask (heal/convert/pickup/deposit) or
  // setUnitMoveCommandDirect (move-fallback). Lives in unitCommandOps.
  routeMonkContextAtEntityCommandDirect: (monkId: number, targetEntityId: number) => boolean;
  // Phase 1B (queue.train): authoritative-resolution helper. Pre-1B
  // `enqueueTraining` body — does structural + affordability re-checks +
  // spendResources + queue mutation atomically. Returns false on stale-
  // state miss (e.g., two queue.train commands in same frame whose total
  // cost exceeds the stockpile — second handler silently no-ops).
  enqueueTrainingDirect: (buildingId: number, unitType: TrainableUnitType) => boolean;
  // Validator deps for `queue.train` (validators read mutable state — must
  // be threaded so they see the same constructionStates / playerResources
  // / getTrainOptions the bridge uses).
  queueTrainValidatorDeps: QueueTrainValidatorDeps;
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
  // Phase 1B — unit.attack
  world.registerValidator('unit.attack', unitAttackValidator);
  world.registerHandler('unit.attack', makeUnitAttackHandler({
    setUnitAttackCommandDirect: deps.setUnitAttackCommandDirect,
  }));
  // Phase 1B — unit.gather
  world.registerValidator('unit.gather', unitGatherValidator);
  world.registerHandler('unit.gather', makeUnitGatherHandler({
    setUnitGatherCommandDirect: deps.setUnitGatherCommandDirect,
  }));
  // Phase 1B — unit.context
  world.registerValidator('unit.context', unitContextValidator);
  world.registerHandler('unit.context', makeUnitContextHandler({
    routeUnitContextCommandDirect: deps.routeUnitContextCommandDirect,
  }));
  // Phase 1B — unit.contextAtEntity
  world.registerValidator('unit.contextAtEntity', unitContextAtEntityValidator);
  world.registerHandler('unit.contextAtEntity', makeUnitContextAtEntityHandler({
    routeUnitContextAtEntityCommandDirect: deps.routeUnitContextAtEntityCommandDirect,
  }));
  // Phase 1B — sheep.move
  world.registerValidator('sheep.move', sheepMoveValidator);
  world.registerHandler('sheep.move', makeSheepMoveHandler({
    setSheepMoveCommandDirect: deps.setSheepMoveCommandDirect,
  }));
  // Phase 1B — monk.contextAtEntity
  world.registerValidator('monk.contextAtEntity', monkContextAtEntityValidator);
  world.registerHandler('monk.contextAtEntity', makeMonkContextAtEntityHandler({
    routeMonkContextAtEntityCommandDirect: deps.routeMonkContextAtEntityCommandDirect,
  }));
  // Phase 1B — queue.train
  world.registerValidator('queue.train', makeQueueTrainValidator(deps.queueTrainValidatorDeps));
  world.registerHandler('queue.train', makeQueueTrainHandler({
    enqueueTrainingDirect: deps.enqueueTrainingDirect,
  }));
  // Each subsequent Phase 1B commit adds one validator + handler pair here.
}
