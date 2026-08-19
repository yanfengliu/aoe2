// Readers for the parts of a save blob the bridge needs before it can build a
// world. Split out of `createSimulationBridge` to keep that file under the
// 500-LOC budget; the error messages name the schema version so a blob written
// by an older build reports which schema failed rather than a bare undefined.

import type { VisibilityMapState } from 'civ-engine';

import { isSaveBlobV1, type SaveBlob } from './saveSchema';
import { TIER_3_SLOTS } from './bridge/bridgeStateSerialize';

export function worldSnapshotState(savedGame: SaveBlob): Record<string, unknown> {
  const snapshot = savedGame.worldSnapshot as { state?: Record<string, unknown> };
  if (!snapshot.state) {
    throw new Error(`Save schema ${savedGame.schema} is missing worldSnapshot.state.`);
  }
  return snapshot.state;
}

export function visibilityStateFromSave(savedGame: SaveBlob): VisibilityMapState {
  if (isSaveBlobV1(savedGame)) {
    return savedGame.visibility;
  }
  const visibility = worldSnapshotState(savedGame)[TIER_3_SLOTS.visibility];
  if (!visibility) {
    throw new Error(`Save schema ${savedGame.schema} is missing ${TIER_3_SLOTS.visibility}.`);
  }
  return visibility as VisibilityMapState;
}
