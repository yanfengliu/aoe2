// Phase 2B helper: registers `tier3SyncSystem` and `bridgeSnapshotSystem`
// at the TAIL of the output phase. Called as the last action of
// `wireBridgeOps` (after `registerBridgeSystems`) and of `wireReplaySystems`
// (Phase 3A) so live and replay paths share the same flush ordering.
//
// **Ordering invariant**: `aoe2Tier3Sync` is the SECOND-TO-LAST output-phase
// system; `aoe2BridgeSnapshot` is LAST. civ-engine's topological scheduler
// uses registration order as the tiebreaker when `before`/`after` are empty
// (per `world.ts:2089-2134, 2415-2480`), so calling this helper last in
// the bridge wiring guarantees the order. Future output-phase systems must
// be registered BEFORE this helper. The Phase 2B test fixture exercises
// the order via instrumented `execute` hooks that record system names per
// tick and assert the last two output entries are
// `['aoe2Tier3Sync', 'aoe2BridgeSnapshot']`.

import type { GameWorld } from './pureHelpers';
import type { MatchState } from '../types';
import type { PendingCommandsQueue } from '../dispatcher';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { VisibilityCell } from './visibilityCell';
import type { ProjectedUnitAttackView } from '../types';
import { registerTier3SyncSystem } from './tier3SyncSystem';
import { registerBridgeSnapshotSystem } from './bridgeSnapshotSystem';

export function registerOutputTail(deps: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  visibilityCell: VisibilityCell;
  matchState: MatchState;
  pendingCommands: PendingCommandsQueue;
  recentUnitAttacks: ProjectedUnitAttackView[];
  syncReplayUnitAttacks?: boolean;
}): void {
  const {
    world,
    accessor,
    visibilityCell,
    matchState,
    pendingCommands,
    recentUnitAttacks,
    syncReplayUnitAttacks = true,
  } = deps;
  registerTier3SyncSystem({
    world,
    visibilityCell,
    matchState,
    pendingCommands,
    recentUnitAttacks,
    syncReplayUnitAttacks,
  });
  registerBridgeSnapshotSystem({ world, accessor });
}
