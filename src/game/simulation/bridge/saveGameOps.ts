// Phase 3 save-game serializer. Schema 2 makes the engine-owned
// `world.serialize()` snapshot the single source of truth for persisted
// simulation state. Before serializing, this factory flushes the bridge's
// accessor-backed Tier-1 slots, Tier-3 visibility/match state, and the
// save-critical pending command queue into `world.state.aoe2.*`.

import type { SaveBlob } from '../saveSchema';
import { SAVE_SCHEMA_VERSION } from '../saveSchema';
import type { GameWorld } from './pureHelpers';
import type { BridgeState } from './bridgeState';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { VisibilityCell } from './visibilityCell';
import { flushPendingCommandsState, flushTier3State } from './tier3SyncSystem';
import { TIER_3_SLOTS } from './bridgeStateSerialize';

interface MatchStateLike {
  outcome: 'running' | 'victory' | 'defeat' | 'draw';
  summary: string;
  winCondition: 'conquest' | 'wonder' | 'relic' | 'score' | null;
  scores: Record<number, number> | null;
  wonderCountdownTicks: number | null;
  relicCountdownTicks: number | null;
}

export interface SaveGameDeps {
  world: GameWorld;
  getSeed: () => string;
  matchState: MatchStateLike;
  state: BridgeState;
  accessor: BridgeStateAccessor;
  visibilityCell: VisibilityCell;
}

export interface SaveGameOps {
  saveGame(): SaveBlob;
}

export function createSaveGameOps(deps: SaveGameDeps): SaveGameOps {
  const { world, getSeed, matchState, state, accessor, visibilityCell } = deps;
  const { pendingCommands } = state;

  function flushBeforeSerialize(): void {
    // civ-engine 1.0 absorb: strict mode is the default and saveGame runs
    // between ticks, so the pre-serialize state writes must go through
    // the engine's sanctioned maintenance window. Same flush semantics
    // as before; the wrapper only marks the phase as writable.
    world.runMaintenance(() => {
      accessor.flush();
      flushTier3State(world, visibilityCell, matchState);
      flushPendingCommandsState(world, pendingCommands);
    });
  }

  function saveGame(): SaveBlob {
    flushBeforeSerialize();
    const worldSnapshot = world.serialize();
    // Attack cues are checkpoint evidence for deterministic replay scrubbing,
    // not user-save state. `serialize()` returns a detached snapshot, so strip
    // only the returned copy and leave the live recorder slot intact.
    const snapshotState = (worldSnapshot as {
      state?: Record<string, unknown>;
    }).state;
    if (snapshotState) delete snapshotState[TIER_3_SLOTS.replayUnitAttacks];
    return {
      schema: SAVE_SCHEMA_VERSION,
      seed: getSeed(),
      worldSnapshot,
    };
  }

  return {
    saveGame,
  };
}
