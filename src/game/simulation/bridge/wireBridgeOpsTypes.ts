import type { EntityRef, Position, VisibilityMap } from 'civ-engine';

import type { BridgeState } from './bridgeState';
import type { CreateWorldResult } from './createWorldResult';
import type { GameWorld } from './pureHelpers';
import type { SaveBlob } from '../saveSchema';
import type { PrototypeScenario } from '../prototypeScenario';
import type {
  BuildableBuildingType,
  MatchState,
  ResearchableTechnologyType,
  UnitTaskState,
} from '../types';
import type { AiState, DifficultyLevel } from '../ai';
import type { UnitCommand } from './sharedTypes';
import type { WorldOccupancy } from '../worldOccupancy';

export interface PlayerScoreCounters {
  unitsProduced: number;
  buildingsProduced: number;
  resourcesGathered: number;
  unitsKilled: number;
  wonderCompleted: boolean;
}

export interface WireBridgeOpsDeps {
  world: GameWorld;
  systemMode?: 'live' | 'replay';
  state: BridgeState;
  // Phase 2D — accessor constructed in createWorld so bridgeHelpers
  // (also constructed in createWorld) can consume it for migrated slots.
  accessor: import('./bridgeStateAccessor').BridgeStateAccessor;
  visibility: VisibilityMap;
  matchState: MatchState;
  savedGame: SaveBlob | undefined;
  // V4-8: scenario is nullable on the saved-game branch since the
  // hydration path never consults it. Skipping createPrototypeScenario
  // saves several ms (more on Black Forest seeds) per save load.
  scenario: PrototypeScenario | null;
  worldOccupancy: WorldOccupancy;
  tiles: number[][];
  selection: { refs: EntityRef[]; focusCell: Position | null };
  placementMode: { current: BuildableBuildingType | null };
  isBootstrappingScenarioRef: { current: boolean };
  ensurePlayerScoreCounters: (owner: number) => PlayerScoreCounters;
  ensureAiState: (owner: number, difficulty?: DifficultyLevel) => AiState;
  inFlightTechSetFor: (owner: number) => Set<ResearchableTechnologyType>;
  clearUnitCommand: (id: number) => void;
  setUnitCommand: (id: number, command: UnitCommand) => void;
  getCurrentEntityId: (ref: EntityRef | null) => number | null;
  getEntityRef: (id: number) => EntityRef | null;
  getUnitTaskStateInternal: (id: number, isGarrisonedUnit: (id: number) => boolean) => UnitTaskState;
  enqueueRejection: (reason: string) => void;
  /** §4.6 AI difficulty for every seat the scenario does not pin. */
  difficulty?: import('../ai').DifficultyLevel;
  markOutOfBandRenderChange: () => void;
  getSeed: () => string;
}

export type WireBridgeOpsResult = Omit<
  CreateWorldResult,
  | 'world'
  | 'pendingCommands'
  | 'getPopulationState'
  | 'getPlayerResources'
  | 'getSharedVisionOwners'
  | 'getMatchState'
  | 'isSelected'
  | 'consumeOutOfBandRenderChange'
  | 'consumeCommandRejection'
  // v0.1.129: implemented by assembleBridgeApi directly off BridgeState.
  | 'getRecentUnitDeaths'
  | 'getRecentUnitAttacks'
  | 'getInFlightProjectiles'
> & {
  getHumanWonderCountdownTicks: () => number | null;
  getHumanRelicCountdownTicks: () => number | null;
  getSelectedEntityIds: () => number[];
};
