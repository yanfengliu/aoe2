// Post-seed factory wireup. Runs after the scenario has been seeded /
// hydrated; creates the input/output ops (visibility queries, selection
// input, entity destroy, training/market, selection state, target finding,
// technology, AI decision, monk task, unit command). Keeps wireBridgeOps
// thin by isolating the second-half wiring.

import type { EntityRef, Position, VisibilityMap } from 'civ-engine';

import type { GameWorld } from './pureHelpers';
import { currentEntityId } from './pureHelpers';
import type { BridgeState } from './bridgeState';
import type {
  BuildableBuildingType,
  BuildingType,
  ResourceComponent,
  UnitType,
} from '../types';
import { unitTint } from '../prototypeUnitRules';
import {
  AI_MONK_HEAL_HP_FRACTION,
  AI_WATCH_TOWER_FORWARD_STEP,
} from '../ai';
import { createMonkTaskOps } from './monkTaskOps';
import { createTechnologyOps } from './technologyOps';
import { createAiDecisionOps } from './aiDecisionOps';
import { createEntityDestroyOps } from './entityDestroyOps';
import { createVisibilityQueries } from './visibilityQueries';
import { createSelectionInputOps } from './selectionInputOps';
import { createTrainingMarketOps } from './trainingMarketOps';
import { createUnitCommandOps } from './unitCommandOps';
import { createTargetFindingOps } from './targetFindingOps';
import { createSelectionStateOps } from './selectionStateOps';
import { HUMAN_PLAYER_ID, MAP_HEIGHT, MAP_WIDTH } from '../prototypeScenario';
import {
  MARKET_FEE_RATE,
  MARKET_MIN_RATE,
  MARKET_RATE_STEP,
  MARKET_TRANSACTION_AMOUNT,
  MONK_CONVERT_FLIP_THRESHOLD,
  MONK_CONVERT_PROGRESS_PER_TICK,
  MONK_HEAL_HP_PER_INTERVAL,
  MONK_HEAL_TICK_INTERVAL,
} from './bridgeConstants';

type CombatStateLike = ReturnType<
  Parameters<typeof createTechnologyOps>[0]['createCombatState']
>;
type CreateCombatState = (owner: number, unitType: UnitType) => CombatStateLike;

export interface WirePostSeedDeps {
  world: GameWorld;
  state: BridgeState;
  visibility: VisibilityMap;
  selection: { refs: EntityRef[]; focusCell: Position | null };
  placementMode: { current: BuildableBuildingType | null };
  // Helpers from bridgeHelpers
  inFlightTechSetFor: Parameters<typeof createTrainingMarketOps>[0]['inFlightTechSetFor'];
  clearUnitCommand: (id: number) => void;
  setUnitCommand: (id: number, command: import('./sharedTypes').UnitCommand) => void;
  getEntityRef: (id: number) => EntityRef | null;
  getCurrentEntityId: (ref: EntityRef | null) => number | null;
  markOutOfBandRenderChange: () => void;
  isMatchRunning: () => boolean;
  // Pre-seed factory outputs
  createCombatState: CreateCombatState;
  buildingOccupiesCell: (id: number, x: number, y: number) => boolean;
  isTerrainPassableForUnit: (x: number, y: number) => boolean;
  isCellBlockedByBuilding: (x: number, y: number) => boolean;
  isCellBlockedByResource: (x: number, y: number) => boolean;
  isPlacementBlocked: (x: number, y: number, w: number, h: number) => boolean;
  isGarrisonedUnit: (id: number) => boolean;
  isHarvestableResource: (id: number, resource: ResourceComponent) => boolean;
  getActionOptions: Parameters<typeof createSelectionStateOps>[0]['getActionOptions'];
  getApproachCellsForFootprint: Parameters<typeof createEntityDestroyOps>[0]['getApproachCellsForFootprint'];
  setPositionAndSyncOccupancy: Parameters<typeof createTrainingMarketOps>[0]['setPositionAndSyncOccupancy'];
  clearPositionAndSyncOccupancy: Parameters<typeof createTrainingMarketOps>[0]['clearPositionAndSyncOccupancy'];
  syncUnitTransformToPosition: Parameters<typeof createTrainingMarketOps>[0]['syncUnitTransformToPosition'];
  addBuildingEntity: Parameters<typeof createTrainingMarketOps>[0]['addBuildingEntity'];
  addResourceEntity: Parameters<typeof createEntityDestroyOps>[0]['addResourceEntity'];
  findBuildingSpawnPosition: (
    anchor: Position,
    buildingType: BuildingType,
  ) => Position | null;
  clearGathererOrder: (id: number) => void;
  getTrainOptions: Parameters<typeof createSelectionStateOps>[0]['getTrainOptions'];
  getResearchOptions: Parameters<typeof createSelectionStateOps>[0]['getResearchOptions'];
  getMarketOptions: Parameters<typeof createSelectionStateOps>[0]['getMarketOptions'];
  getBuildOptions: Parameters<typeof createSelectionStateOps>[0]['getBuildOptions'];
  getVisibleResearchOptions: Parameters<typeof createSelectionStateOps>[0]['getVisibleResearchOptions'];
}

export interface WirePostSeedResult {
  visibilityQueries: ReturnType<typeof createVisibilityQueries>;
  selectionInputOps: ReturnType<typeof createSelectionInputOps>;
  entityDestroyOps: ReturnType<typeof createEntityDestroyOps>;
  trainingMarketOps: ReturnType<typeof createTrainingMarketOps>;
  selectionStateOps: ReturnType<typeof createSelectionStateOps>;
  targetFindingOps: ReturnType<typeof createTargetFindingOps>;
  technologyOps: ReturnType<typeof createTechnologyOps>;
  aiDecisionOps: ReturnType<typeof createAiDecisionOps>;
  monkOps: ReturnType<typeof createMonkTaskOps>;
  unitCommandOps: ReturnType<typeof createUnitCommandOps>;
}

export function wirePostSeedOps(deps: WirePostSeedDeps): WirePostSeedResult {
  const {
    world,
    state,
    visibility,
    selection,
    placementMode,
    inFlightTechSetFor,
    clearUnitCommand,
    setUnitCommand,
    getEntityRef,
    getCurrentEntityId,
    markOutOfBandRenderChange,
    isMatchRunning,
    createCombatState,
    buildingOccupiesCell,
    isTerrainPassableForUnit,
    isCellBlockedByBuilding,
    isCellBlockedByResource,
    isPlacementBlocked,
    isGarrisonedUnit,
    isHarvestableResource,
    getActionOptions,
    getApproachCellsForFootprint,
    setPositionAndSyncOccupancy,
    clearPositionAndSyncOccupancy,
    syncUnitTransformToPosition,
    addBuildingEntity,
    addResourceEntity,
    findBuildingSpawnPosition,
    clearGathererOrder,
    getTrainOptions,
    getResearchOptions,
    getMarketOptions,
    getBuildOptions,
    getVisibleResearchOptions,
  } = deps;

  const visibilityQueries = createVisibilityQueries({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    visibility,
  });
  const { isVisibleToHuman, isEntityFootprintVisibleToHuman, isEntityVisibleToHuman } =
    visibilityQueries;

  const selectionInputOps = createSelectionInputOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    visibility,
    state,
    selection,
    placementMode,
    isMatchRunning,
    isVisibleToHuman,
    isEntityFootprintVisibleToHuman,
    buildingOccupiesCell,
    getEntityRef,
    getCurrentEntityId,
  });
  const {
    getSelectableEntitiesAtCell,
    getSelectedEntityId,
    getSelectedEntityIds,
    removeSelectedEntity,
    findResourceAtCell,
    resolveSelectionTile,
    findHostileUnitAtCell,
    findHostileBuildingAtCell,
    findHostileWildlifeAtCell,
    findOwnedGarrisonBuildingAtCell,
  } = selectionInputOps;

  const entityDestroyOps = createEntityDestroyOps({
    world,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    state,
    removeSelectedEntity,
    clearUnitCommand,
    getApproachCellsForFootprint,
    isTerrainPassableForUnit,
    isCellBlockedByBuilding,
    isCellBlockedByResource,
    addResourceEntity,
    markOutOfBandRenderChange,
  });

  const trainingMarketOps = createTrainingMarketOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    marketFeeRate: MARKET_FEE_RATE,
    marketTransactionAmount: MARKET_TRANSACTION_AMOUNT,
    marketRateStep: MARKET_RATE_STEP,
    marketMinRate: MARKET_MIN_RATE,
    state,
    placementMode,
    inFlightTechSetFor,
    getSelectedEntityId,
    getTrainOptions,
    getResearchOptions,
    getMarketOptions,
    getBuildOptions,
    isPlacementBlocked,
    isGarrisonedUnit,
    clearGathererOrder,
    clearUnitCommand,
    clearSelection: () => {
      selection.refs = [];
      selection.focusCell = null;
    },
    setUnitCommand,
    addBuildingEntity,
    findBuildingSpawnPosition,
    setPositionAndSyncOccupancy,
    clearPositionAndSyncOccupancy,
    syncUnitTransformToPosition,
    getEntityRef,
    markOutOfBandRenderChange,
  });
  const { findBuildPlacementNear, garrisonUnit } = trainingMarketOps;

  const selectionStateOps = createSelectionStateOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    state,
    placementMode,
    getSelectedEntityIds,
    resolveSelectionTile,
    getSelectableEntitiesAtCell,
    getCurrentEntityId,
    clearSelection: () => {
      selection.refs = [];
      selection.focusCell = null;
    },
    getActionOptions,
    getTrainOptions,
    getMarketOptions,
    getBuildOptions,
    getResearchOptions,
    getVisibleResearchOptions,
  });

  const targetFindingOps = createTargetFindingOps({ world, visibility, state });
  const { findNearestDropOffBuilding } = targetFindingOps;

  const technologyOps = createTechnologyOps({
    world,
    state,
    createCombatState,
    markOutOfBandRenderChange,
  });

  const aiDecisionOps = createAiDecisionOps({
    world,
    findBuildPlacementNear,
    aiWatchTowerForwardStep: AI_WATCH_TOWER_FORWARD_STEP,
  });
  const { isAiMilitaryUnit } = aiDecisionOps;

  const monkOps = createMonkTaskOps({
    world,
    state,
    clearUnitCommand,
    clearGathererOrder,
    markOutOfBandRenderChange,
    getEntityRef,
    destroyResourceEntity: (id) => entityDestroyOps.destroyResourceEntity(id),
    buildingOccupiesCell,
    issueUnitMoveCommand: (unitId, target) => unitCommandOps.issueUnitMoveCommand(unitId, target),
    isAiMilitaryUnit,
    isVisibleToOwner: (owner, x, y) => visibility.isVisible(owner, x, y),
    currentEntityId,
    unitTint,
    aiMonkHealHpFraction: AI_MONK_HEAL_HP_FRACTION,
    monkHealTickInterval: MONK_HEAL_TICK_INTERVAL,
    monkHealHpPerInterval: MONK_HEAL_HP_PER_INTERVAL,
    monkConvertProgressPerTick: MONK_CONVERT_PROGRESS_PER_TICK,
    monkConvertFlipThreshold: MONK_CONVERT_FLIP_THRESHOLD,
  });
  const {
    clearMonkTask,
    findMonkContextTargetAtCell,
    issueMonkContextCommandAtEntity,
  } = monkOps;

  const unitCommandOps = createUnitCommandOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    state,
    selection,
    placementMode,
    isMatchRunning,
    isEntityVisibleToHuman,
    getSelectedEntityIds,
    getSelectableEntitiesAtCell,
    findResourceAtCell,
    findOwnedGarrisonBuildingAtCell,
    findHostileUnitAtCell,
    findHostileBuildingAtCell,
    findHostileWildlifeAtCell,
    findMonkContextTargetAtCell,
    issueMonkContextCommandAtEntity,
    clearMonkTask,
    garrisonUnit,
    isHarvestableResource,
    findNearestDropOffBuilding,
    clearGathererOrder,
    clearUnitCommand,
    setUnitCommand,
    getEntityRef,
  });

  return {
    visibilityQueries,
    selectionInputOps,
    entityDestroyOps,
    trainingMarketOps,
    selectionStateOps,
    targetFindingOps,
    technologyOps,
    aiDecisionOps,
    monkOps,
    unitCommandOps,
  };
}
