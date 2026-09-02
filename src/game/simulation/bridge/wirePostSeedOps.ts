// Post-seed factory wireup. Runs after the scenario has been seeded /
// hydrated; creates the input/output ops (visibility queries, selection
// input, entity destroy, training/market, selection state, target finding,
// technology, AI decision, monk task, unit command). Keeps wireBridgeOps
// thin by isolating the second-half wiring.

import type { EntityRef, Position, VisibilityMap } from 'civ-engine';

import type { GameWorld } from './pureHelpers';
import { currentEntityId } from './pureHelpers';
import { effectiveResearchCost } from '../civBonusEffects';
import type { BridgeState } from './bridgeState';
import type {
  BuildableBuildingType,
  BuildingType,
  ResearchableTechnologyType,
  ResourceComponent,
  TerrainComponent,
  UnitType,
} from '../types';
import { playerAgesCodec, playerCivilizationsCodec, inFlightTechByOwnerCodec } from './bridgeStateSerialize';
import { unitTint } from '../prototypeUnitRules';
import {
  AI_MONK_HEAL_HP_FRACTION,
  AI_WATCH_TOWER_FORWARD_STEP,
} from '../ai';
import { defaultCivilizationName } from './pureHelpers';
import { createBuildingOptionsOps } from './buildingOptionsOps';
import type { CellPassability } from './cellPassability';
import { createMonkTaskOps } from './monkTaskOps';
import { createTechnologyOps } from './technologyOps';
import { createAiDecisionOps } from './aiDecisionOps';
import { createEntityDestroyOps } from './entityDestroyOps';
import { createVisibilityQueries } from './visibilityQueries';
import { applyVietnameseReveal } from './vietnameseReveal';
import { createSelectionInputOps } from './selectionInputOps';
import { createTrainingMarketOps } from './trainingMarketOps';
import { createUnitCommandOps } from './unitCommandOps';
import { createTargetFindingOps } from './targetFindingOps';
import { createSelectionStateOps } from './selectionStateOps';
import { HUMAN_PLAYER_ID } from '../prototypeScenario';
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
  // Phase 2D — accessor for migrated slots (currently `villagerOrdinals`,
  // `gathererDropOffStuckSinceTick`).
  accessor: import('./bridgeStateAccessor').BridgeStateAccessor;
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
  // Tile-entity lookup grid, so felling a tree can open its forest tile.
  tiles: number[][];
  worldOccupancy: import('../worldOccupancy').WorldOccupancy;
  isCellBlockedByBuilding: (x: number, y: number) => boolean;
  isCellBlockedByResource: (x: number, y: number) => boolean;
  isPlacementBlocked: (x: number, y: number, w: number, h: number) => boolean;
  isGarrisonedUnit: (id: number) => boolean;
  isHarvestableResource: (id: number, resource: ResourceComponent) => boolean;
  getActionOptions: Parameters<typeof createSelectionStateOps>[0]['getActionOptions'];
  getApproachCellsForFootprint: Parameters<typeof createEntityDestroyOps>[0]['getApproachCellsForFootprint'];
  placeFreshSpawnUnit: Parameters<typeof createTrainingMarketOps>[0]['placeFreshSpawnUnit'];
  clearPositionAndSyncOccupancy: Parameters<typeof createTrainingMarketOps>[0]['clearPositionAndSyncOccupancy'];
  addBuildingEntity: Parameters<typeof createTrainingMarketOps>[0]['addBuildingEntity'];
  addResourceEntity: Parameters<typeof createEntityDestroyOps>[0]['addResourceEntity'];
  findScenarioSpawnPosition: (origin: Position) => Position | null;
  findBuildingSpawnPosition: (
    anchor: Position,
    buildingType: BuildingType,
    preferForeground?: boolean,
  ) => Position | null;
  clearGathererOrder: (id: number) => void;
  getTrainOptions: Parameters<typeof createSelectionStateOps>[0]['getTrainOptions'];
  getResearchOptions: Parameters<typeof createSelectionStateOps>[0]['getResearchOptions'];
  getMarketOptions: Parameters<typeof createSelectionStateOps>[0]['getMarketOptions'];
  getBuildOptions: Parameters<typeof createSelectionStateOps>[0]['getBuildOptions'];
  getVisibleResearchOptions: Parameters<typeof createSelectionStateOps>[0]['getVisibleResearchOptions'];
  // agent-affordances B/C (campaign-1 backlog #2/#3)
  researchUnavailableReason: Parameters<
    typeof createBuildingOptionsOps
  >[0]['researchUnavailableReason'];
  findOpenPlacementAnchors: CellPassability['findOpenPlacementAnchors'];
}

export interface WirePostSeedResult {
  // agent-affordances B/C: agent-snapshot read surfaces. Spread into the
  // bridge result by wireBridgeOps.
  agentOptionsOps: {
    getAgentBuildingOptions: ReturnType<
      typeof createBuildingOptionsOps
    >['getAgentBuildingOptions'];
    findOpenPlacementAnchorsNear: (
      ownerId: number,
      centerX: number,
      centerY: number,
      width: number,
      height: number,
      max: number,
    ) => Position[];
  };
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
    accessor,
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
    placeFreshSpawnUnit,
    clearPositionAndSyncOccupancy,
    addBuildingEntity,
    addResourceEntity,
    tiles,
    worldOccupancy,
    findScenarioSpawnPosition,
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
    mapWidth: world.grid.width,
    mapHeight: world.grid.height,
    visibility,
    state,
    accessor,
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
    findOwnedTransportAtCell,
  } = selectionInputOps;

  // AoE2's forest IS its trees: an exhausted tree leaves open ground, so a
  // woodline is cut from its rim inward until it is gone. `buildable` follows
  // the same rule the terrain factory uses, so the cleared tile can be built on.
  const clearForestTerrainAt = (position: Position): void => {
    const tile = tiles[position.y]?.[position.x];
    if (tile === undefined) return;
    const terrain = world.getComponent<TerrainComponent>(tile, 'terrain');
    if (!terrain || terrain.kind !== 'forest') return;
    world.setComponent(tile, 'terrain', { ...terrain, kind: 'grass', buildable: true });
    // The occupancy grid holds a static terrain blocker per forest cell, and it
    // is not entity-keyed, so changing the component alone leaves the cell
    // impassable — the felled tree's ground stayed a wall.
    worldOccupancy.unblockTerrain([position]);
  };

  const entityDestroyOps = createEntityDestroyOps({
    world,
    mapWidth: world.grid.width,
    mapHeight: world.grid.height,
    state,
    accessor,
    visibility,
    removeSelectedEntity,
    clearUnitCommand,
    getApproachCellsForFootprint,
    isTerrainPassableForUnit,
    isCellBlockedByBuilding,
    isCellBlockedByResource,
    addResourceEntity,
    clearForestTerrainAt,
    markOutOfBandRenderChange,
  });

  const trainingMarketOps = createTrainingMarketOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: world.grid.width,
    mapHeight: world.grid.height,
    marketFeeRate: MARKET_FEE_RATE,
    marketTransactionAmount: MARKET_TRANSACTION_AMOUNT,
    marketRateStep: MARKET_RATE_STEP,
    marketMinRate: MARKET_MIN_RATE,
    state,
    accessor,
    placementMode,
    inFlightTechSetFor,
    getSelectedEntityId,
    getTrainOptions,
    getResearchOptions,
    getMarketOptions,
    getBuildOptions,
    isPlacementBlocked,
    isTerrainPassableForUnit,
    isCellBlockedByBuilding,
    isCellBlockedByResource,
    isGarrisonedUnit,
    clearGathererOrder,
    clearUnitCommand,
    removeSelectedEntity,
    setUnitCommand,
    addBuildingEntity,
    findScenarioSpawnPosition,
    findBuildingSpawnPosition,
    placeFreshSpawnUnit,
    clearPositionAndSyncOccupancy,
    getEntityRef,
    markOutOfBandRenderChange,
  });
  const { findBuildPlacementNear, garrisonUnit } = trainingMarketOps;

  const selectionStateOps = createSelectionStateOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    accessor,
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

  const targetFindingOps = createTargetFindingOps({ world, visibility, accessor });
  const { findNearestDropOffBuilding } = targetFindingOps;

  const technologyOps = createTechnologyOps({
    world,
    state,
    accessor,
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
    accessor,
    clearUnitCommand,
    clearGathererOrder,
    markOutOfBandRenderChange,
    getEntityRef,
    destroyResourceEntity: (id) => entityDestroyOps.destroyResourceEntity(id),
    destroyUnitEntity: (id) => entityDestroyOps.destroyUnitEntity(id),
    buildingOccupiesCell,
    isAiMilitaryUnit,
    isVisibleToOwner: (owner, x, y) => visibility.isVisible(owner, x, y),
    currentEntityId,
    unitTint,
    notePassabilityChange: () => { worldOccupancy.notePassabilityChange(); },
    aiMonkHealHpFraction: AI_MONK_HEAL_HP_FRACTION,
    monkHealTickInterval: MONK_HEAL_TICK_INTERVAL,
    monkHealHpPerInterval: MONK_HEAL_HP_PER_INTERVAL,
    monkConvertProgressPerTick: MONK_CONVERT_PROGRESS_PER_TICK,
    monkConvertFlipThreshold: MONK_CONVERT_FLIP_THRESHOLD,
  });
  const {
    clearMonkTask,
    setMonkTask,
    findMonkContextTargetAtCell,
    issueMonkContextCommandAtEntity,
  } = monkOps;

  const unitCommandOps = createUnitCommandOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: world.grid.width,
    mapHeight: world.grid.height,
    state,
    accessor,
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
    setMonkTask,
    findOwnedTransportAtCell,
    boardTransport: trainingMarketOps.boardTransport,
    unloadTransport: trainingMarketOps.unloadTransport,
    isLandCell: (x: number, y: number) => isTerrainPassableForUnit(x, y),
    garrisonUnit,
    isHarvestableResource,
    findNearestDropOffBuilding,
    clearGathererOrder,
    clearUnitCommand,
    setUnitCommand,
    getEntityRef,
    getBuildOptions,
  });

  // agent-affordances B/C: agent-snapshot read surfaces. Pure read-side;
  // the anchor search fog-gates through the owner's visibility so a
  // suggestion never reveals unscouted terrain. The in-flight probe is
  // deliberately NON-creating (iter-1 Claude L2) — the helpers'
  // inFlightTechSetFor get-or-create would insert an empty set into the
  // Tier-2 cache on every snapshot of an owner with no research.
  const NO_IN_FLIGHT: ReadonlySet<ResearchableTechnologyType> = new Set();
  const { getAgentBuildingOptions } = createBuildingOptionsOps({
    world,
    accessor,
    getResearchOptions,
    getVisibleResearchOptions,
    getTrainOptions,
    getBuildOptions,
    getPlayerCivilization: (owner) =>
      accessor.get(playerCivilizationsCodec).get(owner) ?? defaultCivilizationName(owner),
    inFlightTechsFor: (owner) =>
      accessor.get(inFlightTechByOwnerCodec).get(owner) ?? NO_IN_FLIGHT,
    effectiveResearchCostFor: (owner, tech) => effectiveResearchCost(
      accessor.get(playerCivilizationsCodec).get(owner),
      accessor.get(playerAgesCodec).get(owner) ?? 'dark-age',
      tech,
    ),
    researchUnavailableReason: deps.researchUnavailableReason,
  });
  const agentOptionsOps = {
    getAgentBuildingOptions,
    findOpenPlacementAnchorsNear: (
      ownerId: number,
      centerX: number,
      centerY: number,
      width: number,
      height: number,
      max: number,
    ): Position[] => deps.findOpenPlacementAnchors(centerX, centerY, width, height, {
      max,
      isCellVisible: (x, y) => visibility.isVisible(ownerId, x, y),
    }),
  };

  // Vietnamese "Reveals enemy positions at game start": stamped once, here,
  // where the seeded world and the visibility map are both in hand.
  applyVietnameseReveal(world, accessor, visibility);

  return {
    agentOptionsOps,
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
