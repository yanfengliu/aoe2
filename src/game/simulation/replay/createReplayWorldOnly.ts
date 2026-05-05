import {
  VisibilityMap,
  type VisibilityMapState,
  type WorldSnapshot,
} from 'civ-engine';

import { createWorld } from '../bridge/createWorld';
import type { GameWorld } from '../bridge/pureHelpers';
import { TIER_3_SLOTS } from '../bridge/bridgeStateSerialize';
import { SAVE_SCHEMA_VERSION, type SaveBlobV2 } from '../saveSchema';

export interface CreateReplayWorldOnlyOptions {
  seed?: string;
}

export function createReplayWorldOnly(
  snapshot: WorldSnapshot,
  options: CreateReplayWorldOnlyOptions = {},
): GameWorld {
  const seed = options.seed ?? 'aoe2-replay';
  const savedGame: SaveBlobV2 = {
    schema: SAVE_SCHEMA_VERSION,
    seed,
    worldSnapshot: snapshot,
  };
  const visibility = VisibilityMap.fromState(readVisibilityState(snapshot));
  return createWorld(seed, visibility, savedGame, 'replay').world;
}

function readVisibilityState(snapshot: WorldSnapshot): VisibilityMapState {
  const state = (snapshot as { state?: Record<string, unknown> }).state;
  const visibility = state?.[TIER_3_SLOTS.visibility];
  if (!visibility) {
    throw new Error(`Replay snapshot is missing ${TIER_3_SLOTS.visibility}.`);
  }
  return visibility as VisibilityMapState;
}
