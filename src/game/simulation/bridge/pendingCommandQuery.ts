// Pending-command predicate helpers extracted from `wireBridgeOps` so they
// can be unit-tested without standing up a full bridge. The closure binding
// in `wireBridgeOps` is `(unitId) => hasPendingUnitCommand(state.pendingCommands, unitId)`.
//
// Why this lives in its own module: the predicate decides whether
// autoAggression should skip a unit because aiSystem already pushed a
// command-stream intention that will overwrite that unit's
// `unitCommand[id]` at the next handler tick. Getting the case set wrong
// produces the `building.placeConfirm` / `unit.attack` race documented in
// `docs/threads/current/full/2026-05-01/1/REVIEW.md` R2-M1.

import type { PendingCommand } from '../dispatcher';

function assertNever(cmd: never): never {
  throw new Error(
    `hasPendingUnitCommand: unhandled GameCommands variant — add a case for it. Got: ${JSON.stringify(cmd)}`,
  );
}

export function hasPendingUnitCommand(
  pendingCommands: ReadonlyArray<PendingCommand>,
  unitId: number,
): boolean {
  for (const cmd of pendingCommands) {
    // Exhaustive switch (no `default`) — adding a new GameCommands variant
    // without a case here is a TypeScript compile error at `assertNever`.
    // R2-M1's original 2-case predicate failed silently for 5 missed
    // variants; this guard prevents a repeat.
    switch (cmd.type) {
      case 'unit.move':
      case 'unit.attack':
      case 'unit.gather':
      case 'unit.context':
      case 'unit.contextAtEntity':
      case 'monk.contextAtEntity':
      case 'trebuchet.pack':
      case 'trebuchet.unpack':
        if (cmd.data.unitId === unitId) return true;
        break;
      case 'sheep.move':
        if (cmd.data.sheepId === unitId) return true;
        break;
      case 'building.placeConfirm':
        if (cmd.data.builderId === unitId) return true;
        if (cmd.data.additionalBuilderIds?.includes(unitId)) return true;
        break;
      // The following commands don't take a unit-id field that overwrites
      // unitCommand[id], so they don't conflict — but they're enumerated
      // explicitly so the exhaustiveness guard fires on a new variant.
      case 'queue.train':
      case 'queue.research':
      case 'market.action':
      case 'building.action':
      case 'building.setRallyPoint':
        break;
      default:
        return assertNever(cmd);
    }
  }
  return false;
}
