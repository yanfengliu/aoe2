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
  state: BridgeState;
  visibility: VisibilityMap;
  matchState: MatchState;
  savedGame: SaveBlob | undefined;
  scenario: PrototypeScenario;
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
  markOutOfBandRenderChange: () => void;
  getSeed: () => string;
}

export type WireBridgeOpsResult = Omit<
  CreateWorldResult,
  | 'world'
  | 'getPopulationState'
  | 'getPlayerResources'
  | 'getMatchState'
  | 'isSelected'
  | 'consumeOutOfBandRenderChange'
  | 'consumeCommandRejection'
> & {
  getHumanWonderCountdownTicks: () => number | null;
  getHumanRelicCountdownTicks: () => number | null;
  getSelectedEntityIds: () => number[];
};
