import type { BridgeState } from './bridgeState';
import type { CreateWorldResult } from './createWorldResult';
import type { GameWorld } from './pureHelpers';
import { cloneResources } from './pureHelpers';
import type { MatchState } from '../types';
import { STANDARD_STARTING_RESOURCES } from './bridgeConstants';

export interface AssembleBridgeApiDeps
  extends Omit<
    CreateWorldResult,
    | 'world'
    | 'getPopulationState'
    | 'getPlayerResources'
    | 'getMatchState'
    | 'isSelected'
    | 'consumeOutOfBandRenderChange'
  > {
  world: GameWorld;
  state: BridgeState;
  matchState: MatchState;
  getHumanWonderCountdownTicks: () => number | null;
  getHumanRelicCountdownTicks: () => number | null;
  getSelectedEntityIds: () => number[];
  hasOutOfBandRenderChangeRef: { current: boolean };
}

export function assembleBridgeApi(deps: AssembleBridgeApiDeps): CreateWorldResult {
  const {
    state,
    matchState,
    getHumanWonderCountdownTicks,
    getHumanRelicCountdownTicks,
    getSelectedEntityIds,
    hasOutOfBandRenderChangeRef,
    ...rest
  } = deps;
  const { population, playerResources } = state;

  return {
    ...rest,
    getPopulationState(playerId: number) {
      return { ...(population.get(playerId) ?? { current: 0, cap: 0 }) };
    },
    getPlayerResources(playerId: number) {
      return cloneResources(
        playerResources.get(playerId) ?? STANDARD_STARTING_RESOURCES,
      );
    },
    getMatchState() {
      return {
        ...matchState,
        wonderCountdownTicks:
          matchState.outcome === 'running' ? getHumanWonderCountdownTicks() : null,
        relicCountdownTicks:
          matchState.outcome === 'running' ? getHumanRelicCountdownTicks() : null,
      };
    },
    isSelected(id: number) {
      return getSelectedEntityIds().includes(id);
    },
    consumeOutOfBandRenderChange() {
      const didChange = hasOutOfBandRenderChangeRef.current;
      hasOutOfBandRenderChangeRef.current = false;
      return didChange;
    },
  };
}

