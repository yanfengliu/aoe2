// Phase 2C bootstrap flush — runs ONCE at bridge construction (after
// scenario seed / save-load hydrate) to populate the world.state.aoe2.*
// slots before the first tick. Without this, the recorder's first
// `world.serialize()` snapshot (taken at the bootstrap mark per
// `civ-engine/world.ts:1746`) would observe missing `aoe2.bridgeMeta` /
// `aoe2.matchState` / `aoe2.visibility` slots and the replay path would
// have no anchor to rebuild the bridge from.
//
// Per-tick syncing is handled by `tier3SyncSystem` + `bridgeSnapshotSystem`
// (registered via `registerOutputTail`); those systems run during the
// output phase of every step, but the bootstrap snapshot needs the
// initial values too.

import type { GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { VisibilityCell } from './visibilityCell';
import type { MatchState, ProjectedUnitAttackView } from '../types';
import type { PersistedMatchState } from '../saveSchema';
import type { PendingCommandsQueue } from '../dispatcher';
import { TIER_3_SLOTS } from './bridgeStateSerialize';
import {
  flushPendingCommandsState,
  flushReplayUnitAttacksState,
} from './tier3SyncSystem';

interface BridgeMeta {
  mapWidth: number;
  mapHeight: number;
}

export function bootstrapFlush(deps: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  visibilityCell: VisibilityCell;
  matchState: MatchState;
  pendingCommands: PendingCommandsQueue;
  recentUnitAttacks: ProjectedUnitAttackView[];
  syncReplayUnitAttacks?: boolean;
  mapWidth: number;
  mapHeight: number;
}): void {
  const {
    world,
    accessor,
    visibilityCell,
    matchState,
    pendingCommands,
    recentUnitAttacks,
    syncReplayUnitAttacks = true,
    mapWidth,
    mapHeight,
  } = deps;

  // 1. aoe2.bridgeMeta — written once and never re-written. Holds the map
  // dimensions so loaders can recover map size for any snapshot regardless
  // of visibility-migration state.
  const meta: BridgeMeta = { mapWidth, mapHeight };
  world.setState(
    TIER_3_SLOTS.bridgeMeta,
    meta as unknown as Parameters<typeof world.setState>[1],
  );

  // 2. aoe2.visibility — initial visibility state. UNCONDITIONAL write
  // (no `consumeIfDirty()` gate) per the bootstrap contract: this slot
  // must always be populated before tick 1 regardless of the cell's
  // initial dirty state. Symmetric with the matchState/bridgeMeta writes
  // above. After this write the cell stays clean until Phase 2E's
  // fingerprint-cache mutators start calling `cell.markDirty()`.
  visibilityCell.markClean();
  world.setState(
    TIER_3_SLOTS.visibility,
    visibilityCell.map.getState() as unknown as Parameters<
      typeof world.setState
    >[1],
  );

  // 3. aoe2.matchState — initial persisted shape (derived per-tick fields
  // stripped — they're recomputed by the live API). Shallow-clone `scores`
  // so a future caller that mutates `matchState.scores[ownerId] = N`
  // doesn't retroactively rewrite the persisted snapshot — that would
  // break snapshot/replay determinism. Currently safe because all writers
  // assign `matchState.scores` wholesale, but the boundary copy makes
  // the contract explicit.
  const persisted: PersistedMatchState = {
    outcome: matchState.outcome,
    summary: matchState.summary,
    winCondition: matchState.winCondition,
    scores: matchState.scores ? { ...matchState.scores } : null,
  };
  world.setState(
    TIER_3_SLOTS.matchState,
    persisted as unknown as Parameters<typeof world.setState>[1],
  );

  flushPendingCommandsState(world, pendingCommands);
  if (syncReplayUnitAttacks) {
    flushReplayUnitAttacksState(world, recentUnitAttacks, world.tick);
  }

  // 5. Initial Tier-1 flush. Phase 2D migrations populate the dirty set
  // during seed / hydrate (e.g., `villagerOrdinals` is set per-player by
  // `seedPlayerStarts` and per-villager-spawn by `addUnitEntity`); the
  // flush writes those mutations to `world.state.aoe2.*` so the
  // bootstrap snapshot is complete.
  accessor.flush();
}
