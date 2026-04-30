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
import type { SaveBlob } from '../saveSchema';
import type { GameWorld } from './pureHelpers';

export interface CreateWorldResult {
  world: GameWorld;
  saveGame: () => SaveBlob;
  getEconomyState: () => EconomyState;
  getPopulationState: (playerId: number) => PopulationState;
  getPlayerAge: (playerId: number) => AgeType;
  getPlayerResources: (playerId: number) => PlayerResources;
  getMatchState: () => MatchState;
  getSelectionState: () => SelectionState;
  getPlacementPreview: (x: number, y: number) => PlacementPreviewState | null;
  getEntityHealth: (id: number) => { currentHp: number; maxHp: number } | null;
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
