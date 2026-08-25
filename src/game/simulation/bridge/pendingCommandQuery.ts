// Pending-command predicate helpers extracted from `wireBridgeOps` so they
// can be unit-tested without standing up a full bridge. The closure binding
// in `wireBridgeOps` is `(unitId) => hasPendingUnitCommand(state.pendingCommands, unitId)`.
//
// Why this lives in its own module: the predicate decides whether
// autoAggression should skip a unit because aiSystem already pushed a
// command-stream intention that will overwrite that unit's
// `unitCommand[id]` at the next handler tick. Getting the case set wrong
// produces the `building.placeConfirm` / `unit.attack` race documented in
// `docs/threads/done/full/2026-05-01/1/REVIEW.md` R2-M1.

import type { PendingCommand } from '../dispatcher';

function assertNever(cmd: never): never {
  throw new Error(
    `hasPendingUnitCommand: unhandled GameCommands variant — add a case for it. Got: ${JSON.stringify(cmd)}`,
  );
}

// Does this pending command carry `unitId` in the field that overwrites
// `unitCommand[unitId]` at the next handler tick? Exhaustive switch (no
// `default`) — adding a new GameCommands variant without a case here is a
// TypeScript compile error at `assertNever`. R2-M1's original 2-case predicate
// failed silently for 5 missed variants; this guard prevents a repeat.
function commandTargetsUnit(cmd: PendingCommand, unitId: number): boolean {
  switch (cmd.type) {
    case 'unit.move':
    case 'unit.attackMove':
    case 'unit.patrol':
    case 'unit.attack':
    case 'unit.gather':
    case 'unit.autoGather':
    case 'unit.context':
    case 'unit.contextAtEntity':
    case 'monk.contextAtEntity':
    case 'trebuchet.pack':
    case 'trebuchet.unpack':
      return cmd.data.unitId === unitId;
    case 'sheep.move':
      return cmd.data.sheepId === unitId;
    case 'building.placeConfirm':
      return cmd.data.builderId === unitId
        || (cmd.data.additionalBuilderIds?.includes(unitId) ?? false);
    // The following commands don't take a unit-id field that overwrites
    // unitCommand[id], so they don't conflict — but they're enumerated
    // explicitly so the exhaustiveness guard fires on a new variant.
    // A stance order changes a unit's standing behaviour rather than its
    // current order, so it never conflicts with a pending unitCommand.
    case 'unit.stance':
    case 'unit.formation':
    case 'queue.train':
    case 'queue.research':
    case 'market.action':
    case 'tribute.send':
    case 'building.action':
    case 'building.setRallyPoint':
      return false;
    default:
      return assertNever(cmd);
  }
}

export function hasPendingUnitCommand(
  pendingCommands: ReadonlyArray<PendingCommand>,
  unitId: number,
): boolean {
  return pendingCommands.some((cmd) => commandTargetsUnit(cmd, unitId));
}

// Evict (in place) every pending intention targeting `unitId`. Full-review M3:
// an explicit HUMAN command for a unit supersedes any stale system intention
// already queued for it — without eviction the FIFO drain runs the human
// command, then the stale handler clobbers it (a one-tick loss of control;
// "unit won't retreat near enemies"). A human-owned unit can have exactly two
// classes of system intention pending — an auto-aggression `unit.attack` and,
// since spec §6.2 auto-mine, a post-construction `unit.autoGather` (aiSystem
// strategic intentions still target AI-owned units only) — and BOTH are
// design-intended evictees: an explicit order always supersedes them. Callers:
// humanInputOps (move/context) and placementOps (accepted chain-build).
export function removePendingUnitCommands(
  pendingCommands: PendingCommand[],
  unitId: number,
): void {
  for (let i = pendingCommands.length - 1; i >= 0; i -= 1) {
    if (commandTargetsUnit(pendingCommands[i]!, unitId)) {
      pendingCommands.splice(i, 1);
    }
  }
}
