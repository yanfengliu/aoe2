import type { BridgeState } from './bridgeState';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { CreateWorldResult } from './createWorldResult';
import type { GameWorld } from './pureHelpers';
import { sharedVisionOwners } from '../alliances';
import type { ResearchableTechnologyType } from '../types';

const EMPTY_SHARED_VISION_TECHS: ReadonlySet<ResearchableTechnologyType> = new Set();

import { cloneResources } from './pureHelpers';
import type { MatchState } from '../types';
import { STANDARD_STARTING_RESOURCES } from './bridgeConstants';
import {
  playerResourcesCodec,
  playerTeamsCodec,
  researchedTechnologiesCodec,
  populationCodec,
  projectilesCodec,
} from './bridgeStateSerialize';
import {
  getUnitAttackFeedEntries,
  pruneUnitAttackFeed,
} from './unitAttackAnimationFeed';

export interface AssembleBridgeApiDeps
  extends Omit<
    CreateWorldResult,
    | 'world'
    | 'pendingCommands'
    | 'getPopulationState'
    | 'getPlayerResources'
    | 'getSharedVisionOwners'
    | 'getMatchState'
    | 'isSelected'
    | 'consumeOutOfBandRenderChange'
    | 'getSelectedEntityRefs'
    | 'selectByRefs'
    | 'getRecentUnitDeaths'
    | 'getRecentUnitAttacks'
    | 'getInFlightProjectiles'
  > {
  world: GameWorld;
  state: BridgeState;
  // Phase 2D: playerResources migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  matchState: MatchState;
  getHumanWonderCountdownTicks: () => number | null;
  getHumanRelicCountdownTicks: () => number | null;
  getSelectedEntityIds: () => number[];
  getSelectedEntityRefs: () => readonly import('civ-engine').EntityRef[];
  selectByRefs: (refs: readonly import('civ-engine').EntityRef[]) => boolean;
  hasOutOfBandRenderChangeRef: { current: boolean };
}

export function assembleBridgeApi(deps: AssembleBridgeApiDeps): CreateWorldResult {
  const {
    state,
    accessor,
    matchState,
    getHumanWonderCountdownTicks,
    getHumanRelicCountdownTicks,
    getSelectedEntityIds,
    getSelectedEntityRefs,
    selectByRefs,
    hasOutOfBandRenderChangeRef,
    ...rest
  } = deps;

  return {
    ...rest,
    pendingCommands: state.pendingCommands,
    getPopulationState(playerId: number) {
      return { ...(accessor.get(populationCodec).get(playerId) ?? { current: 0, cap: 0, rawSupply: 0 }) };
    },
    getPlayerResources(playerId: number) {
      return cloneResources(
        accessor.get(playerResourcesCodec).get(playerId) ?? STANDARD_STARTING_RESOURCES,
      );
    },
    // Cartography: the owners whose vision this one also sees. Empty without
    // the technology or without allies, which is every match before teams.
    getSharedVisionOwners(playerId: number) {
      const researched = accessor.get(researchedTechnologiesCodec).get(playerId)
        ?? EMPTY_SHARED_VISION_TECHS;
      return sharedVisionOwners(
        accessor.get(playerTeamsCodec),
        playerId,
        researched.has('cartography'),
        accessor.get(playerResourcesCodec).keys(),
        researched.has('spies'),
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
    // Spec 2 (annotation-ui v0.1.5) AO-2: surface refs + select-from-refs
    // through to the public bridge API.
    getSelectedEntityRefs,
    selectByRefs,
    // v0.1.129 death feedback: raw death feed for the projector's fog filter.
    getRecentUnitDeaths() {
      return state.recentUnitDeaths;
    },
    getRecentUnitAttacks() {
      pruneUnitAttackFeed(state.unitAttackFeed, rest.world.tick);
      return getUnitAttackFeedEntries(state.unitAttackFeed);
    },
    // Spec §10.4: shots in the air, straight from the authoritative slot — a
    // caller can never observe a projectile the simulation already resolved.
    getInFlightProjectiles() {
      return accessor.get(projectilesCodec).inFlight;
    },
  };
}
