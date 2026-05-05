// Phase 2B output-phase system: writes the three Tier-3 slots
// (`aoe2.visibility`, `aoe2.matchState`, `aoe2.bridgeMeta`) back to
// `world.state` so the recorder's diff-listener snapshot (fired AFTER
// the output phase per `civ-engine/world.ts:1746`) sees current values.
//
// Visibility writes are gated by `VisibilityCell.consumeIfDirty()` so the
// per-tick cost is paid only when a source actually moved. matchState writes
// are unconditional (the object is small and flat). `aoe2.bridgeMeta` is
// written once at game start by `bootstrapFlush` (Phase 2C); this system
// does not re-write it because the dimensions never change after seed.
//
// This system is registered as the SECOND-TO-LAST output-phase system in
// `wireBridgeOps` via `registerOutputTail`; `bridgeSnapshotSystem` runs
// immediately after.
//
// **Closure contract** (Phase 2B → 2C): the system closes over the
// `visibilityCell` and `matchState` instances passed at registration time.
// Both are mutated in place by the rest of the bridge:
// - `matchState` is mutated by `matchEndOps`, `hydrateFromSavedGame` (in-place
//   `Object.assign`), and the live tick loop. Stable identity guaranteed.
// - `visibilityCell._map` is `readonly`, so the cell instance is the
//   source-of-truth for the `VisibilityMap`. Phase 2C/3A constructions that
//   swap the underlying map MUST go through `cell.replace(newMap)` (or
//   reconstruct the entire bridge so this system is re-registered against
//   the fresh cell). Holding the cell ref vs. fetching via `world` is an
//   intentional asymmetry: the cell is bridge-side, world.state is engine-side.

import type { GameWorld } from './pureHelpers';
import type { VisibilityCell } from './visibilityCell';
import type { MatchState } from '../types';
import type { PersistedMatchState } from '../saveSchema';
import { clonePendingCommand, type PendingCommandsQueue } from '../dispatcher';
import { TIER_3_SLOTS } from './bridgeStateSerialize';

// Pure Tier-3 flush body extracted so saveGameOps can call it at save
// time WITHOUT relying on the next output phase. Without this, full-review
// iter-1 R2-C2 (Codex MAJOR) would bite Phase 2F's schema-2 saves where
// `world.serialize()` is the source of truth: a save mid-tick would lose
// up to one tick of visibility/matchState updates because the per-tick
// `tier3SyncSystem` hadn't run yet.
//
// Visibility flush is unconditional in the save-time path: even if the
// cell is "clean", that just means tier3SyncSystem's last execute ran
// AND no source moved since — but a cold load (restart from blob) won't
// have run tier3SyncSystem at all, so we must publish at least once
// before serialize. Cell is then marked clean so the next per-tick run
// stays optimized.
export function flushTier3State(
  world: GameWorld,
  visibilityCell: VisibilityCell,
  matchState: MatchState,
): void {
  world.setState(
    TIER_3_SLOTS.visibility,
    visibilityCell.map.getState() as unknown as Parameters<
      typeof world.setState
    >[1],
  );
  visibilityCell.markClean();

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
}

export function flushPendingCommandsState(
  world: GameWorld,
  pendingCommands: PendingCommandsQueue,
): void {
  world.setState(
    TIER_3_SLOTS.pendingCommands,
    pendingCommands.map(clonePendingCommand) as unknown as Parameters<
      typeof world.setState
    >[1],
  );
}

export function registerTier3SyncSystem(deps: {
  world: GameWorld;
  visibilityCell: VisibilityCell;
  matchState: MatchState;
  pendingCommands: PendingCommandsQueue;
}): void {
  const { world, visibilityCell, matchState, pendingCommands } = deps;
  world.registerSystem({
    name: 'aoe2Tier3Sync',
    phase: 'output',
    execute: (activeWorld) => {
      if (visibilityCell.consumeIfDirty()) {
        // VisibilityMap.getState() returns the JsonValue-compatible
        // {width, height, players: Array<[id, {sources, explored}]>}
        // shape used by SaveBlob; safe to write directly.
        activeWorld.setState(
          TIER_3_SLOTS.visibility,
          visibilityCell.map.getState() as unknown as Parameters<
            typeof activeWorld.setState
          >[1],
        );
      }

      // matchState is small and flat; unconditional rewrite. Build the
      // persisted shape inline (rather than constructing an intermediate
      // SerializedMatchState + stripping it) — `wonderCountdownTicks` /
      // `relicCountdownTicks` are recomputed per-tick by the live API,
      // so we omit them from the persisted shape. Shallow-clone `scores`
      // so a future in-place mutation on `matchState.scores` doesn't
      // retroactively rewrite the persisted snapshot.
      const persisted: PersistedMatchState = {
        outcome: matchState.outcome,
        summary: matchState.summary,
        winCondition: matchState.winCondition,
        scores: matchState.scores ? { ...matchState.scores } : null,
      };
      activeWorld.setState(
        TIER_3_SLOTS.matchState,
        persisted as unknown as Parameters<typeof activeWorld.setState>[1],
      );
      flushPendingCommandsState(activeWorld, pendingCommands);
    },
  });
}
