// Training / research / market / construction / garrison ops. Each path
// validates its preconditions, charges the cost, mutates the relevant side
// map, and triggers any follow-up bookkeeping (production-queue insert,
// inFlightTechByOwner update, occupancy sync). Mirrors the pre-extraction
// inline implementation byte-for-byte; the deps bag is the only structural
// change.

import type { EntityRef, Position } from 'civ-engine';
import type {
  BuildableBuildingType,
  BuildingComponent,
  BuildingType,
  MarketActionType,
  PlayerResources,
  ProductionQueueEntry,
  ResearchableTechnologyType,
  TrainableUnitType,
  UnitComponent,
  UnitType,
  VisionSourceComponent,
} from '../types';
import { buildingFootprint, clamp, type GameWorld } from './pureHelpers';
import {
  buildingGarrisonCapacity,
  canGarrisonAt,
  canResearchAt,
  canTrainAt,
} from '../prototypeBuildingRules';
import {
  canAfford,
  constructionCost,
  isBuyMarketAction,
  marketCommodityForAction,
  researchCost,
  researchTimeTicks,
  spendResources,
  trainingCost,
  trainingTimeTicks,
} from '../prototypeEconomyRules';

interface ConstructionStateLike {
  isComplete: boolean;
}

export interface TrainingMarketOpsDeps {
  world: GameWorld;
  humanPlayerId: number;
  mapWidth: number;
  mapHeight: number;
  marketFeeRate: number;
  marketTransactionAmount: number;
  marketRateStep: number;
  marketMinRate: number;
  playerResources: Map<number, PlayerResources>;
  productionQueues: Map<number, ProductionQueueEntry[]>;
  constructionStates: Map<number, ConstructionStateLike>;
  garrisonedByBuilding: Map<number, number[]>;
  garrisonedUnitToBuilding: Map<number, number>;
  garrisonedUnitVisionSources: Map<number, VisionSourceComponent>;
  marketExchangeRates: { food: number; wood: number; stone: number };
  placementMode: { current: BuildableBuildingType | null };
  inFlightTechSetFor: (owner: number) => Set<ResearchableTechnologyType>;
  getSelectedEntityId: () => number | null;
  getTrainOptions: (owner: number, buildingType: BuildingType) => TrainableUnitType[];
  getResearchOptions: (
    owner: number,
    buildingType: BuildingType,
  ) => ResearchableTechnologyType[];
  getMarketOptions: (owner: number, buildingType: BuildingType) => MarketActionType[];
  getBuildOptions: (owner: number, unitType: UnitType) => BuildableBuildingType[];
  isPlacementBlocked: (x: number, y: number, width: number, height: number) => boolean;
  isGarrisonedUnit: (id: number) => boolean;
  clearGathererOrder: (id: number) => void;
  clearUnitCommand: (id: number) => void;
  clearSelection: () => void;
  setUnitCommand: (
    unitId: number,
    command: {
      type: 'build';
      target: Position;
      buildingRef: EntityRef;
    },
  ) => void;
  addBuildingEntity: (
    owner: number,
    buildingType: BuildingType,
    position: Position,
    isComplete: boolean,
    vision?: VisionSourceComponent,
  ) => number;
  findBuildingSpawnPosition: (anchor: Position, buildingType: BuildingType) => Position | null;
  setPositionAndSyncOccupancy: (entity: number, position: Position) => void;
  clearPositionAndSyncOccupancy: (entity: number) => void;
  syncUnitTransformToPosition: (entity: number, position: Position) => void;
  getEntityRef: (id: number) => EntityRef | null;
  markOutOfBandRenderChange: () => void;
}

export interface TrainingMarketOps {
  enqueueTraining(buildingId: number, unitType: TrainableUnitType): boolean;
  enqueueResearch(buildingId: number, technologyType: ResearchableTechnologyType): boolean;
  executeMarketAction(actionType: MarketActionType): boolean;
  garrisonUnit(unitId: number, buildingId: number): boolean;
  ungarrisonBuilding(buildingId: number): boolean;
  startConstruction(
    builderId: number,
    buildingType: BuildableBuildingType,
    anchor: Position,
  ): boolean;
  findBuildPlacementNear(origin: Position, buildingType: BuildableBuildingType): Position | null;
}

export function createTrainingMarketOps(deps: TrainingMarketOpsDeps): TrainingMarketOps {
  const {
    world,
    humanPlayerId,
    mapWidth,
    mapHeight,
    marketFeeRate,
    marketTransactionAmount,
    marketRateStep,
    marketMinRate,
    playerResources,
    productionQueues,
    constructionStates,
    garrisonedByBuilding,
    garrisonedUnitToBuilding,
    garrisonedUnitVisionSources,
    marketExchangeRates,
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
    clearSelection,
    setUnitCommand,
    addBuildingEntity,
    findBuildingSpawnPosition,
    setPositionAndSyncOccupancy,
    clearPositionAndSyncOccupancy,
    syncUnitTransformToPosition,
    getEntityRef,
    markOutOfBandRenderChange,
  } = deps;

  function enqueueTraining(buildingId: number, unitType: TrainableUnitType): boolean {
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    if (!building) return false;

    const construction = constructionStates.get(buildingId);
    if (construction && !construction.isComplete) return false;

    if (
      !canTrainAt(building.buildingType, unitType)
      || !getTrainOptions(building.owner, building.buildingType).includes(unitType)
    ) {
      return false;
    }

    const stockpile = playerResources.get(building.owner);
    if (!stockpile) return false;

    const cost = trainingCost(unitType);
    if (!canAfford(stockpile, cost)) return false;

    spendResources(stockpile, cost);
    const queue = productionQueues.get(buildingId) ?? [];
    const totalTicks = trainingTimeTicks(unitType);
    queue.push({
      kind: 'unit',
      label: unitType,
      unitType,
      remainingTicks: totalTicks,
      totalTicks,
      isBlocked: false,
    });
    productionQueues.set(buildingId, queue);
    return true;
  }

  function enqueueResearch(
    buildingId: number,
    technologyType: ResearchableTechnologyType,
  ): boolean {
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    if (!building) return false;

    const construction = constructionStates.get(buildingId);
    if (construction && !construction.isComplete) return false;

    if (!canResearchAt(building.buildingType, technologyType)) return false;
    if (!getResearchOptions(building.owner, building.buildingType).includes(technologyType)) {
      return false;
    }

    if (inFlightTechSetFor(building.owner).has(technologyType)) {
      return false;
    }

    const queue = productionQueues.get(buildingId) ?? [];
    const stockpile = playerResources.get(building.owner);
    if (!stockpile) return false;

    const cost = researchCost(technologyType);
    if (!canAfford(stockpile, cost)) return false;

    spendResources(stockpile, cost);
    const totalTicks = researchTimeTicks(technologyType);
    queue.push({
      kind: 'technology',
      label: technologyType,
      technologyType,
      remainingTicks: totalTicks,
      totalTicks,
      isBlocked: false,
    });
    productionQueues.set(buildingId, queue);
    inFlightTechSetFor(building.owner).add(technologyType);
    return true;
  }

  function executeMarketAction(actionType: MarketActionType): boolean {
    const selectedEntityId = getSelectedEntityId();
    if (selectedEntityId === null) return false;

    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    if (!building || building.owner !== humanPlayerId || building.buildingType !== 'market') {
      return false;
    }

    const construction = constructionStates.get(selectedEntityId);
    if (construction && !construction.isComplete) return false;

    if (!getMarketOptions(building.owner, building.buildingType).includes(actionType)) {
      return false;
    }

    const stockpile = playerResources.get(building.owner);
    if (!stockpile) return false;

    const commodity = marketCommodityForAction(actionType);
    const rate = marketExchangeRates[commodity];
    if (isBuyMarketAction(actionType)) {
      const goldCost = Math.ceil(rate * (1 + marketFeeRate));
      if (stockpile.gold < goldCost) return false;
      stockpile.gold -= goldCost;
      stockpile[commodity] += marketTransactionAmount;
      marketExchangeRates[commodity] = rate + marketRateStep;
      return true;
    }

    if (stockpile[commodity] < marketTransactionAmount) return false;
    stockpile[commodity] -= marketTransactionAmount;
    stockpile.gold += Math.floor(rate * (1 - marketFeeRate));
    marketExchangeRates[commodity] = Math.max(marketMinRate, rate - marketRateStep);
    return true;
  }

  function garrisonUnit(unitId: number, buildingId: number): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    const capacity = building ? buildingGarrisonCapacity(building.buildingType) : 0;
    if (
      !unit
      || !building
      || unit.owner !== building.owner
      || !canGarrisonAt(building.buildingType, unit.unitType)
    ) {
      return false;
    }

    const currentUnits = garrisonedByBuilding.get(buildingId) ?? [];
    if (currentUnits.length >= capacity || isGarrisonedUnit(unitId)) {
      return false;
    }

    clearGathererOrder(unitId);
    clearUnitCommand(unitId);

    const visionSource = world.getComponent<VisionSourceComponent>(unitId, 'visionSource');
    if (visionSource) {
      garrisonedUnitVisionSources.set(unitId, { ...visionSource });
      world.removeComponent(unitId, 'visionSource');
    }

    clearPositionAndSyncOccupancy(unitId);
    garrisonedUnitToBuilding.set(unitId, buildingId);
    currentUnits.push(unitId);
    garrisonedByBuilding.set(buildingId, currentUnits);
    clearSelection();
    placementMode.current = null;
    markOutOfBandRenderChange();
    return true;
  }

  function ungarrisonBuilding(buildingId: number): boolean {
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    const buildingPosition = world.getComponent<Position>(buildingId, 'position');
    const garrisonedUnits = garrisonedByBuilding.get(buildingId) ?? [];
    if (!building || !buildingPosition || garrisonedUnits.length === 0) {
      return false;
    }

    const remainingGarrisonedUnits: number[] = [];
    let didUngarrisonUnit = false;

    for (const unitId of garrisonedUnits) {
      const unit = world.getComponent<UnitComponent>(unitId, 'unit');
      if (!unit) continue;

      const spawnPosition = findBuildingSpawnPosition(buildingPosition, building.buildingType);
      if (!spawnPosition) {
        remainingGarrisonedUnits.push(unitId);
        continue;
      }

      setPositionAndSyncOccupancy(unitId, spawnPosition);
      syncUnitTransformToPosition(unitId, spawnPosition);
      const storedVisionSource = garrisonedUnitVisionSources.get(unitId);
      if (storedVisionSource) {
        world.addComponent(unitId, 'visionSource', storedVisionSource);
        garrisonedUnitVisionSources.delete(unitId);
      }
      garrisonedUnitToBuilding.delete(unitId);
      clearGathererOrder(unitId);
      didUngarrisonUnit = true;
    }

    if (remainingGarrisonedUnits.length > 0) {
      garrisonedByBuilding.set(buildingId, remainingGarrisonedUnits);
    } else {
      garrisonedByBuilding.delete(buildingId);
    }

    if (didUngarrisonUnit) {
      markOutOfBandRenderChange();
    }
    return didUngarrisonUnit;
  }

  function startConstruction(
    builderId: number,
    buildingType: BuildableBuildingType,
    anchor: Position,
  ): boolean {
    const unit = world.getComponent<UnitComponent>(builderId, 'unit');
    if (!unit || unit.unitType !== 'villager') return false;

    if (!getBuildOptions(unit.owner, unit.unitType).includes(buildingType)) return false;

    const clampedAnchor = {
      x: clamp(anchor.x, 0, mapWidth - 1),
      y: clamp(anchor.y, 0, mapHeight - 1),
    };
    const footprint = buildingFootprint(buildingType);
    if (isPlacementBlocked(clampedAnchor.x, clampedAnchor.y, footprint.width, footprint.height)) {
      return false;
    }

    const stockpile = playerResources.get(unit.owner);
    if (!stockpile) return false;

    const cost = constructionCost(buildingType);
    if (!canAfford(stockpile, cost)) return false;

    spendResources(stockpile, cost);
    const buildingId = addBuildingEntity(unit.owner, buildingType, clampedAnchor, false);
    const buildingRef = getEntityRef(buildingId);
    if (!buildingRef) {
      throw new Error(`Expected a current EntityRef for new ${buildingType} construction.`);
    }
    clearGathererOrder(builderId);
    setUnitCommand(builderId, {
      type: 'build',
      target: clampedAnchor,
      buildingRef,
    });
    markOutOfBandRenderChange();
    return true;
  }

  function findBuildPlacementNear(
    origin: Position,
    buildingType: BuildableBuildingType,
  ): Position | null {
    const footprint = buildingFootprint(buildingType);

    for (let radius = 2; radius <= 6; radius += 1) {
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          if (Math.abs(offsetX) !== radius && Math.abs(offsetY) !== radius) {
            continue;
          }

          const candidate = {
            x: origin.x + offsetX,
            y: origin.y + offsetY,
          };
          if (
            candidate.x < 0
            || candidate.y < 0
            || candidate.x + footprint.width > mapWidth
            || candidate.y + footprint.height > mapHeight
          ) {
            continue;
          }

          if (!isPlacementBlocked(candidate.x, candidate.y, footprint.width, footprint.height)) {
            return candidate;
          }
        }
      }
    }

    return null;
  }

  return {
    enqueueTraining,
    enqueueResearch,
    executeMarketAction,
    garrisonUnit,
    ungarrisonBuilding,
    startConstruction,
    findBuildPlacementNear,
  };
}
