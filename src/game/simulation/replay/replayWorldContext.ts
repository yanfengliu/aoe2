import type { VisibilityMap } from 'civ-engine';

import type { PendingCommandsQueue } from '../dispatcher';
import type { BridgeStateAccessor } from '../bridge/bridgeStateAccessor';
import type { CreateWorldResult } from '../bridge/createWorldResult';
import type { GameWorld } from '../bridge/pureHelpers';
import type { VisibilityCell } from '../bridge/visibilityCell';
import type { MatchState } from '../types';

export interface ReplayWorldContext {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  visibility: VisibilityMap;
  visibilityCell: VisibilityCell;
  matchState: MatchState;
  pendingCommands: PendingCommandsQueue;
  seed: string;
  api?: CreateWorldResult;
}

const replayWorldContexts = new WeakMap<GameWorld, ReplayWorldContext>();

export function setReplayWorldContext(
  world: GameWorld,
  context: Omit<ReplayWorldContext, 'world'>,
): void {
  replayWorldContexts.set(world, { world, ...context });
}

export function getReplayWorldContext(world: GameWorld): ReplayWorldContext | null {
  return replayWorldContexts.get(world) ?? null;
}

export function attachReplayWorldApi(world: GameWorld, api: CreateWorldResult): void {
  const context = getReplayWorldContext(world);
  if (!context) {
    throw new Error('Cannot attach replay bridge API before replay world context exists.');
  }
  replayWorldContexts.set(world, { ...context, api });
}
