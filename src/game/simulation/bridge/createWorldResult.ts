import type { EntityRef } from 'civ-engine';

import type {
  ActionType,
  AgeType,
  BuildableBuildingType,
  EconomyState,
  MarketActionType,
  MatchState,
  PlacementPreviewState,
  PlayerResources,
  PopulationState,
  ProjectedEntityView,
  ResearchableTechnologyType,
  SelectionState,
  SimulationDebugSnapshot,
  TrainableUnitType,
  UnitType,
} from '../types';
import type { Position } from 'civ-engine';
import type { SaveBlob } from '../saveSchema';
import type { GameWorld } from './pureHelpers';
import type { PendingCommandsQueue } from '../dispatcher';
import type { AgentBuildingOptions } from './buildingOptionsOps';

export interface CreateWorldResult {
  world: GameWorld;
  // Phase 1A: AI intention queue handle exposed so createSimulationBridge's
  // tick loop can call drainPendingCommands(world, pendingCommands) before
  // each tick. Same reference held internally by AI-decision systems.
  pendingCommands: PendingCommandsQueue;
  saveGame: () => SaveBlob;
  getEconomyState: () => EconomyState;
  getPopulationState: (playerId: number) => PopulationState;
  getPlayerAge: (playerId: number) => AgeType;
  getPlayerResources: (playerId: number) => PlayerResources;
  getMatchState: () => MatchState;
  getSelectionState: () => SelectionState;
  getPlacementPreview: (x: number, y: number) => PlacementPreviewState | null;
  // agent-affordances B/C: agent-snapshot read surfaces (per-building
  // research/train options with locked reasons; fog-gated open-anchor
  // search near a point for the given owner).
  getAgentBuildingOptions: (ownerId: number) => AgentBuildingOptions;
  findOpenPlacementAnchorsNear: (
    ownerId: number,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    max: number,
  ) => Position[];
  getEntityHealth: (id: number) => { currentHp: number; maxHp: number } | null;
  getWildlifeAlive: (id: number) => boolean | undefined;
  getUnitActiveVerb: (id: number) => 'building' | undefined;
  // v0.1.129 death feedback: raw (un-fog-filtered) death feed for the render
  // projector, which applies the per-player fog filter in projectFrame.
  getRecentUnitDeaths: () => readonly import('../types').ProjectedUnitDeathView[];
  getRecentUnitAttacks: () => readonly import('../types').ProjectedUnitAttackView[];
  selectEntityAtCell: (x: number, y: number) => boolean;
  selectEntityById: (id: number) => boolean;
  selectOwnedUnitsByTypeInRect: (
    unitType: UnitType | 'sheep',
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ) => boolean;
  filterSelectableUnitIds: (ids: number[]) => number[];
  selectUnitsByIds: (ids: number[]) => boolean;
  selectUnitsInBox: (minX: number, minY: number, maxX: number, maxY: number) => boolean;
  // Spec 2 (annotation-ui v0.1.5) AO-2: selection refs (with generation)
  // and select-from-refs entry point — exposed so the AnnotationController
  // can resolve the current selection to MarkerRefs.entities preserving
  // generation, and so MarkerListPanel row clicks can pass refs back through.
  getSelectedEntityRefs: () => readonly EntityRef[];
  selectByRefs: (refs: readonly EntityRef[]) => boolean;
  clearSelection: () => void;
  issueContextCommand: (x: number, y: number) => boolean;
  issueContextCommandAtEntity: (entityId: number) => boolean;
  issueMoveCommand: (x: number, y: number) => boolean;
  issueAction: (actionType: ActionType) => boolean;
  queueTrainUnit: (unitType: TrainableUnitType) => boolean;
  queueResearch: (technologyType: ResearchableTechnologyType) => boolean;
  issueMarketAction: (actionType: MarketActionType) => boolean;
  beginBuildingPlacement: (buildingType: BuildableBuildingType) => boolean;
  confirmBuildingPlacement: (x: number, y: number) => boolean;
  isSelected: (id: number) => boolean;
  consumeOutOfBandRenderChange: () => boolean;
  consumeCommandRejection: () => string | null;
  getDebugSnapshot: () => SimulationDebugSnapshot;
  getFogMemoryEntities: (liveEntityIds: Set<number>) => ProjectedEntityView[];
  getHumanFogMemorySize: () => number;
}
