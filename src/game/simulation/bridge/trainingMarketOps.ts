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
  ResearchableTechnologyType,
  TrainableUnitType,
  UnitComponent,
  UnitType,
  VisionSourceComponent,
} from '../types';
import { createGarrisonOps } from './garrisonOps';
import { buildingFootprint, clamp, type GameWorld } from './pureHelpers';
import { findPlacementAnchorNear } from './placementSearch';
import {
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
  trainingTimeTicks,
} from '../prototypeEconomyRules';

import type { BridgeState } from './bridgeState';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  constructionStatesCodec,
  marketExchangeRatesCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  playerResourcesCodec,
  productionQueuesCodec,
  researchedTechnologiesCodec,
} from './bridgeStateSerialize';
import { civTrainTimeMultiplier, effectiveTrainingCost } from '../civBonusEffects';
import {
  conscriptionTrainTimeMultiplier,
  uniqueTechTrainTimeMultiplier,
} from '../productionTechEffects';
import { EMPTY_TECH_SET } from '../economyTechEffects';

export interface TrainingMarketOpsDeps {
  world: GameWorld;
  humanPlayerId: number;
  mapWidth: number;
  mapHeight: number;
  marketFeeRate: number;
  marketTransactionAmount: number;
  marketRateStep: number;
  marketMinRate: number;
  state: BridgeState;
  // Phase 2D — `marketExchangeRates` migrated to
  // `world.state.aoe2.marketExchangeRates` via accessor + codec.
  accessor: BridgeStateAccessor;
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
  isPlacementBlocked: (
    x: number,
    y: number,
    width: number,
    height: number,
    buildingType?: BuildingType,
  ) => boolean;
  // The three together answer "could a land unit stand here", which is what the
  // AI's placement connectivity guard needs — it asks about ground rather than
  // about a particular unit.
  isTerrainPassableForUnit: (x: number, y: number) => boolean;
  isCellBlockedByBuilding: (x: number, y: number) => boolean;
  isCellBlockedByResource: (x: number, y: number) => boolean;
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
  // Where a disembarking unit can stand: the nearest legal LAND cell to the
  // shore the transport was ordered to. Same helper the scenario loader uses
  // for a unit spawned onto a blocked cell.
  findScenarioSpawnPosition: (origin: Position) => Position | null;
  findBuildingSpawnPosition: (
    anchor: Position,
    buildingType: BuildingType,
    preferForeground?: boolean,
  ) => Position | null;
  placeFreshSpawnUnit: (entity: number, position: Position) => Position | null;
  clearPositionAndSyncOccupancy: (entity: number) => void;
  getEntityRef: (id: number) => EntityRef | null;
  markOutOfBandRenderChange: () => void;
}

export interface TrainingMarketOps {
  enqueueTraining(buildingId: number, unitType: TrainableUnitType): boolean;
  enqueueResearch(buildingId: number, technologyType: ResearchableTechnologyType): boolean;
  // Phase 1B (market.action): direct helper used by the handler. Pre-1B
  // `executeMarketAction` body modulo selection lookup.
  executeMarketActionDirect(playerId: number, actionType: MarketActionType): boolean;
  // Validator helper — re-checked at handler time too (B2 fix).
  playerOwnsCompletedMarket(playerId: number): boolean;
  garrisonUnit(unitId: number, buildingId: number): boolean;
  /** Load a land unit onto a Transport Ship. */
  boardTransport(unitId: number, transportId: number): boolean;
  /** Put a Transport Ship's cargo ashore near `target`. */
  unloadTransport(transportId: number, target: Position): boolean;
  ungarrisonBuilding(buildingId: number): boolean;
  // Multi-villager construction: spend resources once, create the building
  // once, then set a `build` command on each id in the list. Stale or
  // out-of-faction helper ids are silently skipped (AI tolerance pattern).
  // The list MUST be non-empty; the first id is treated as the primary
  // builder for affordability + build-options checks.
  startConstructionWithBuildersDirect(
    builderIds: readonly number[],
    buildingType: BuildableBuildingType,
    anchor: Position,
  ): boolean;
  findBuildPlacementNear(origin: Position, buildingType: BuildableBuildingType): Position | null;
}

export function createTrainingMarketOps(deps: TrainingMarketOpsDeps): TrainingMarketOps {
  const {
    world,
    mapWidth,
    mapHeight,
    marketFeeRate,
    marketTransactionAmount,
    marketRateStep,
    marketMinRate,
    accessor,
    placementMode,
    inFlightTechSetFor,
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
    clearSelection,
    setUnitCommand,
    addBuildingEntity,
    findScenarioSpawnPosition,
    findBuildingSpawnPosition,
    placeFreshSpawnUnit,
    clearPositionAndSyncOccupancy,
    getEntityRef,
    markOutOfBandRenderChange,
  } = deps;

  // Transport loading/unloading lives in its own module; it shares this file's
  // garrison side maps and spawn helpers but nothing else.
  const garrisonOps = createGarrisonOps({
    world,
    accessor,
    isGarrisonedUnit,
    clearGathererOrder,
    clearUnitCommand,
    clearPositionAndSyncOccupancy,
    placeFreshSpawnUnit,
    findScenarioSpawnPosition,
    findBuildingSpawnPosition,
    clearSelection,
    placementMode,
    markOutOfBandRenderChange,
  });

  function enqueueTraining(buildingId: number, unitType: TrainableUnitType): boolean {
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    if (!building) return false;

    const construction = accessor.get(constructionStatesCodec).get(buildingId);
    if (construction && !construction.isComplete) return false;

    if (
      !canTrainAt(building.buildingType, unitType)
      || !getTrainOptions(building.owner, building.buildingType).includes(unitType)
    ) {
      return false;
    }

    const stockpile = accessor.get(playerResourcesCodec).get(building.owner);
    if (!stockpile) return false;

    // Cost + train time both read the owner's persisted civ (+ age/tech) state.
    // Goths infantry cost 35% less from Feudal (effectiveTrainingCost); Aztecs
    // ×0.85 train + Conscription ×0.75 at military buildings. The SAME effective
    // cost gates and charges here — the affordability checks elsewhere (AI /
    // human / validator) use effectiveTrainingCost too, so they agree.
    const ownerCiv = accessor.get(playerCivilizationsCodec).get(building.owner);
    const ownerAge = accessor.get(playerAgesCodec).get(building.owner) ?? 'dark-age';
    const cost = effectiveTrainingCost(ownerCiv, ownerAge, unitType);
    if (!canAfford(stockpile, cost)) return false;

    spendResources(stockpile, cost);
    accessor.markDirty(playerResourcesCodec);
    const ownerTechs = accessor.get(researchedTechnologiesCodec).get(building.owner) ?? EMPTY_TECH_SET;
    const totalTicks = Math.max(
      1,
      Math.round(
        trainingTimeTicks(unitType)
          * civTrainTimeMultiplier(ownerCiv, unitType)
          * conscriptionTrainTimeMultiplier(ownerTechs, building.buildingType)
          * uniqueTechTrainTimeMultiplier(ownerTechs, building.buildingType),
      ),
    );
    accessor.mutate(productionQueuesCodec, (m) => {
      const queue = m.get(buildingId) ?? [];
      queue.push({
        kind: 'unit',
        label: unitType,
        unitType,
        remainingTicks: totalTicks,
        totalTicks,
        isBlocked: false,
      });
      m.set(buildingId, queue);
    });
    return true;
  }

  function enqueueResearch(
    buildingId: number,
    technologyType: ResearchableTechnologyType,
  ): boolean {
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    if (!building) return false;

    const construction = accessor.get(constructionStatesCodec).get(buildingId);
    if (construction && !construction.isComplete) return false;

    if (!canResearchAt(building.buildingType, technologyType)) return false;
    if (!getResearchOptions(building.owner, building.buildingType).includes(technologyType)) {
      return false;
    }

    if (inFlightTechSetFor(building.owner).has(technologyType)) {
      return false;
    }

    const stockpile = accessor.get(playerResourcesCodec).get(building.owner);
    if (!stockpile) return false;

    const cost = researchCost(technologyType);
    if (!canAfford(stockpile, cost)) return false;

    spendResources(stockpile, cost);
    accessor.markDirty(playerResourcesCodec);
    const totalTicks = researchTimeTicks(technologyType);
    accessor.mutate(productionQueuesCodec, (m) => {
      const queue = m.get(buildingId) ?? [];
      queue.push({
        kind: 'technology',
        label: technologyType,
        technologyType,
        remainingTicks: totalTicks,
        totalTicks,
        isBlocked: false,
      });
      m.set(buildingId, queue);
    });
    inFlightTechSetFor(building.owner).add(technologyType);
    return true;
  }

  // Phase 1B (market.action) authoritative-resolution helper. Body
  // verbatim modulo: `playerId` replaces selection-lookup; checks the
  // player owns at least one COMPLETED market building. Used by the
  // market.action handler at start of next step's processCommands.
  function executeMarketActionDirect(playerId: number, actionType: MarketActionType): boolean {
    if (!playerOwnsCompletedMarket(playerId)) return false;
    if (!getMarketOptions(playerId, 'market').includes(actionType)) return false;

    const stockpile = accessor.get(playerResourcesCodec).get(playerId);
    if (!stockpile) return false;

    const commodity = marketCommodityForAction(actionType);
    const rate = accessor.get(marketExchangeRatesCodec)[commodity];
    if (isBuyMarketAction(actionType)) {
      const goldCost = Math.ceil(rate * (1 + marketFeeRate));
      if (stockpile.gold < goldCost) return false;
      stockpile.gold -= goldCost;
      accessor.markDirty(playerResourcesCodec);
      stockpile[commodity] += marketTransactionAmount;
      accessor.mutate(marketExchangeRatesCodec, (m) => {
        m[commodity] = rate + marketRateStep;
      });
      return true;
    }

    if (stockpile[commodity] < marketTransactionAmount) return false;
    stockpile[commodity] -= marketTransactionAmount;
    stockpile.gold += Math.floor(rate * (1 - marketFeeRate));
    accessor.markDirty(playerResourcesCodec);
    accessor.mutate(marketExchangeRatesCodec, (m) => {
      m[commodity] = Math.max(marketMinRate, rate - marketRateStep);
    });
    return true;
  }

  // Returns true iff the player owns at least one completed market
  // building. The market.action validator and handler both use this to
  // gate the trade — pre-1B `executeMarketAction` enforced this implicitly
  // via the selected-entity lookup.
  function playerOwnsCompletedMarket(playerId: number): boolean {
    for (const id of world.query('building')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (!building || building.owner !== playerId || building.buildingType !== 'market') {
        continue;
      }
      const construction = accessor.get(constructionStatesCodec).get(id);
      if (construction && !construction.isComplete) continue;
      return true;
    }
    return false;
  }


  function startConstructionWithBuildersDirect(
    builderIds: readonly number[],
    buildingType: BuildableBuildingType,
    anchor: Position,
  ): boolean {
    if (builderIds.length === 0) return false;
    const primaryId = builderIds[0];
    const primary = world.getComponent<UnitComponent>(primaryId, 'unit');
    if (!primary || primary.unitType !== 'villager') return false;

    if (!getBuildOptions(primary.owner, primary.unitType).includes(buildingType)) return false;

    const clampedAnchor = {
      x: clamp(anchor.x, 0, mapWidth - 1),
      y: clamp(anchor.y, 0, mapHeight - 1),
    };
    const footprint = buildingFootprint(buildingType);
    if (isPlacementBlocked(
      clampedAnchor.x,
      clampedAnchor.y,
      footprint.width,
      footprint.height,
      buildingType,
    )) {
      return false;
    }

    const stockpile = accessor.get(playerResourcesCodec).get(primary.owner);
    if (!stockpile) return false;

    const cost = constructionCost(buildingType);
    if (!canAfford(stockpile, cost)) return false;

    spendResources(stockpile, cost);
    accessor.markDirty(playerResourcesCodec);
    const buildingId = addBuildingEntity(primary.owner, buildingType, clampedAnchor, false);
    const buildingRef = getEntityRef(buildingId);
    if (!buildingRef) {
      throw new Error(`Expected a current EntityRef for new ${buildingType} construction.`);
    }
    for (const id of builderIds) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (!unit || unit.unitType !== 'villager' || unit.owner !== primary.owner) {
        continue;
      }
      clearGathererOrder(id);
      setUnitCommand(id, {
        type: 'build',
        target: clampedAnchor,
        buildingRef,
      });
    }
    markOutOfBandRenderChange();
    return true;
  }

  function isGroundWalkable(x: number, y: number): boolean {
    return isTerrainPassableForUnit(x, y)
      && !isCellBlockedByBuilding(x, y)
      && !isCellBlockedByResource(x, y);
  }

  function findBuildPlacementNear(
    origin: Position,
    buildingType: BuildableBuildingType,
  ): Position | null {
    // Ring-search out to radius 12 (default) so a 4x4 building (market / castle /
    // wonder) can find a gap past a base's packed inner rings — a radius-6 cap
    // left the AI unable to ever place one (v0.1.93 FIND). See placementSearch.
    //
    // The `isFree` guard is what stops the AI walling ITSELF in: it packed its
    // buildings into a solid mass ten cells wide on the default map and sealed
    // its own sheep, boar and forest into a pocket its villagers could not
    // reach. A gate or wall is excluded from the guard — sealing ground is the
    // whole point of building one.
    const sealsDeliberately = buildingType === 'palisade-wall'
      || buildingType === 'stone-wall'
      || buildingType === 'palisade-gate'
      || buildingType === 'stone-gate';
    return findPlacementAnchorNear(
      origin,
      buildingFootprint(buildingType),
      mapWidth,
      mapHeight,
      isPlacementBlocked,
      undefined,
      sealsDeliberately ? undefined : isGroundWalkable,
    );
  }

  return {
    enqueueTraining,
    enqueueResearch,
    executeMarketActionDirect,
    playerOwnsCompletedMarket,
    ...garrisonOps,
    startConstructionWithBuildersDirect,
    findBuildPlacementNear,
  };
}
