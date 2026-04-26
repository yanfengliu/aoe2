// Player-state queries. Pure read accessors over the bridge's per-player
// side maps (age / civ / researched techs) and over the world's owned
// buildings + units. Used by the AI planner, the option lookups, and the
// HUD's selection panel — anywhere a "what does this player have?" answer
// is needed without mutating state.

import type {
  AgeType,
  BuildingComponent,
  BuildingType,
  ProductionQueueEntry,
  ResearchableTechnologyType,
  TrainableUnitType,
  UnitComponent,
  UnitType,
} from '../types';
import { defaultCivilizationName, type GameWorld } from './pureHelpers';
import {
  isCastleAgePrerequisiteBuilding,
  isDarkAgePrerequisiteBuilding,
  isFeudalAgePrerequisiteBuilding,
} from '../prototypeBuildingRules';
import {
  latestResearchedInChain as latestResearchedInChainExternal,
  type UpgradeChainEntry,
} from '../upgradeChains';

interface ConstructionStateLike {
  isComplete: boolean;
}

// Keys-only consumer of unitCommands: `unitCommands.has(id)` gates the
// "available villager" check.
type UnitCommandLike = unknown;

export interface PlayerQueriesDeps {
  world: GameWorld;
  unitCommands: Map<number, UnitCommandLike>;
  productionQueues: Map<number, ProductionQueueEntry[]>;
  constructionStates: Map<number, ConstructionStateLike>;
  playerAges: Map<number, AgeType>;
  playerCivilizations: Map<number, string>;
  researchedTechnologies: Map<number, Set<ResearchableTechnologyType>>;
}

export interface PlayerQueries {
  hasTechnology(owner: number, technologyType: ResearchableTechnologyType): boolean;
  findOwnedBuilding(owner: number, buildingType: BuildingType): number | null;
  findOwnedUnit(owner: number, unitType: UnitType): number | null;
  findAvailableVillager(owner: number): number | null;
  countQueuedUnits(buildingId: number, unitType: TrainableUnitType): number;
  countOwnedUnits(owner: number, unitType: UnitType): number;
  countCompletedOwnedBuildings(
    owner: number,
    filter: (buildingType: BuildingType) => boolean,
  ): number;
  hasCompletedBuilding(owner: number, buildingType: BuildingType): boolean;
  isConstructingBuilding(owner: number, buildingType: BuildingType): boolean;
  hasOwnedWonder(owner: number): boolean;
  getPlayerAge(owner: number): AgeType;
  getPlayerCivilization(owner: number): string;
  isAtLeastAge(owner: number, minAge: AgeType): boolean;
  canAdvanceToFeudalAge(owner: number): boolean;
  canAdvanceToCastleAge(owner: number): boolean;
  canAdvanceToImperialAge(owner: number): boolean;
  latestResearchedInChain(owner: number, chain: UpgradeChainEntry): TrainableUnitType;
}

export function createPlayerQueries(deps: PlayerQueriesDeps): PlayerQueries {
  const {
    world,
    unitCommands,
    productionQueues,
    constructionStates,
    playerAges,
    playerCivilizations,
    researchedTechnologies,
  } = deps;

  function hasTechnology(owner: number, technologyType: ResearchableTechnologyType): boolean {
    return researchedTechnologies.get(owner)?.has(technologyType) ?? false;
  }

  function findOwnedBuilding(owner: number, buildingType: BuildingType): number | null {
    for (const id of world.query('building')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (building?.owner === owner && building.buildingType === buildingType) {
        return id;
      }
    }
    return null;
  }

  function findOwnedUnit(owner: number, unitType: UnitType): number | null {
    for (const id of world.query('unit')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (unit?.owner === owner && unit.unitType === unitType) {
        return id;
      }
    }
    return null;
  }

  function findAvailableVillager(owner: number): number | null {
    for (const id of world.query('unit')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (unit?.owner === owner && unit.unitType === 'villager' && !unitCommands.has(id)) {
        return id;
      }
    }
    return findOwnedUnit(owner, 'villager');
  }

  function countQueuedUnits(buildingId: number, unitType: TrainableUnitType): number {
    const queue = productionQueues.get(buildingId) ?? [];
    return queue.filter((entry) => entry.kind === 'unit' && entry.unitType === unitType).length;
  }

  function countOwnedUnits(owner: number, unitType: UnitType): number {
    let count = 0;
    for (const id of world.query('unit')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (unit?.owner === owner && unit.unitType === unitType) {
        count += 1;
      }
    }
    return count;
  }

  function countCompletedOwnedBuildings(
    owner: number,
    filter: (buildingType: BuildingType) => boolean,
  ): number {
    let count = 0;
    for (const id of world.query('building')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (!building || building.owner !== owner || !filter(building.buildingType)) {
        continue;
      }
      const construction = constructionStates.get(id);
      if (construction && !construction.isComplete) {
        continue;
      }
      count += 1;
    }
    return count;
  }

  function hasCompletedBuilding(owner: number, buildingType: BuildingType): boolean {
    return countCompletedOwnedBuildings(owner, (candidate) => candidate === buildingType) > 0;
  }

  function isConstructingBuilding(owner: number, buildingType: BuildingType): boolean {
    for (const id of world.query('building')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (!building || building.owner !== owner || building.buildingType !== buildingType) {
        continue;
      }
      const construction = constructionStates.get(id);
      if (construction && !construction.isComplete) {
        return true;
      }
    }
    return false;
  }

  function hasOwnedWonder(owner: number): boolean {
    for (const id of world.query('building')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (building?.owner === owner && building.buildingType === 'wonder') {
        return true;
      }
    }
    return false;
  }

  function getPlayerAge(owner: number): AgeType {
    return playerAges.get(owner) ?? 'dark-age';
  }

  function getPlayerCivilization(owner: number): string {
    return playerCivilizations.get(owner) ?? defaultCivilizationName(owner);
  }

  function isAtLeastAge(owner: number, minAge: AgeType): boolean {
    const order: Record<AgeType, number> = {
      'dark-age': 0,
      'feudal-age': 1,
      'castle-age': 2,
      'imperial-age': 3,
    };
    return order[getPlayerAge(owner)] >= order[minAge];
  }

  function canAdvanceToFeudalAge(owner: number): boolean {
    if (getPlayerAge(owner) !== 'dark-age') {
      return false;
    }
    return countCompletedOwnedBuildings(owner, isDarkAgePrerequisiteBuilding) >= 2;
  }

  function canAdvanceToCastleAge(owner: number): boolean {
    if (getPlayerAge(owner) !== 'feudal-age') {
      return false;
    }
    return countCompletedOwnedBuildings(owner, isFeudalAgePrerequisiteBuilding) >= 2;
  }

  function canAdvanceToImperialAge(owner: number): boolean {
    if (getPlayerAge(owner) !== 'castle-age') {
      return false;
    }
    return countCompletedOwnedBuildings(owner, isCastleAgePrerequisiteBuilding) >= 2;
  }

  function latestResearchedInChain(
    owner: number,
    chain: UpgradeChainEntry,
  ): TrainableUnitType {
    return latestResearchedInChainExternal(owner, chain, hasTechnology);
  }

  return {
    hasTechnology,
    findOwnedBuilding,
    findOwnedUnit,
    findAvailableVillager,
    countQueuedUnits,
    countOwnedUnits,
    countCompletedOwnedBuildings,
    hasCompletedBuilding,
    isConstructingBuilding,
    hasOwnedWonder,
    getPlayerAge,
    getPlayerCivilization,
    isAtLeastAge,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    latestResearchedInChain,
  };
}
