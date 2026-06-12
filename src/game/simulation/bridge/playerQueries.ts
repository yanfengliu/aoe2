// Player-state queries. Pure read accessors over the bridge's per-player
// side maps (age / civ / researched techs) and over the world's owned
// buildings + units. Used by the AI planner, the option lookups, and the
// HUD's selection panel — anywhere a "what does this player have?" answer
// is needed without mutating state.

import type {
  AgeType,
  BuildingComponent,
  BuildingType,
  ResearchableTechnologyType,
  TrainableUnitType,
  UnitComponent,
  UnitType,
} from '../types';
import { defaultCivilizationName, type GameWorld } from './pureHelpers';
import {
  AGE_ADVANCE_REQUIRED_COUNT,
  isCastleAgePrerequisiteBuilding,
  isDarkAgePrerequisiteBuilding,
  isFeudalAgePrerequisiteBuilding,
} from '../prototypeBuildingRules';
import {
  latestResearchedInChain as latestResearchedInChainExternal,
  type UpgradeChainEntry,
} from '../upgradeChains';
import {
  constructionStatesCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  productionQueuesCodec,
  researchedTechnologiesCodec,
} from './bridgeStateSerialize';

export interface PlayerQueriesDeps {
  world: GameWorld;
  state: import('./bridgeState').BridgeState;
  // Phase 2D — accessor for migrated slots (playerAges, playerCivilizations).
  accessor: import('./bridgeStateAccessor').BridgeStateAccessor;
}

export interface PlayerQueries {
  hasTechnology(owner: number, technologyType: ResearchableTechnologyType): boolean;
  findOwnedBuilding(owner: number, buildingType: BuildingType): number | null;
  findOwnedUnit(owner: number, unitType: UnitType): number | null;
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
  countCompletedAgePrerequisites(
    owner: number,
    forTech: 'feudal-age' | 'castle-age' | 'imperial-age',
  ): number;
  canAdvanceToFeudalAge(owner: number): boolean;
  canAdvanceToCastleAge(owner: number): boolean;
  canAdvanceToImperialAge(owner: number): boolean;
  latestResearchedInChain(owner: number, chain: UpgradeChainEntry): TrainableUnitType;
}

export function createPlayerQueries(deps: PlayerQueriesDeps): PlayerQueries {
  const { world, accessor } = deps;

  function hasTechnology(owner: number, technologyType: ResearchableTechnologyType): boolean {
    return accessor.get(researchedTechnologiesCodec).get(owner)?.has(technologyType) ?? false;
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

  function countQueuedUnits(buildingId: number, unitType: TrainableUnitType): number {
    const queue = accessor.get(productionQueuesCodec).get(buildingId) ?? [];
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
      const construction = accessor.get(constructionStatesCodec).get(id);
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
      const construction = accessor.get(constructionStatesCodec).get(id);
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
    return accessor.get(playerAgesCodec).get(owner) ?? 'dark-age';
  }

  function getPlayerCivilization(owner: number): string {
    return accessor.get(playerCivilizationsCodec).get(owner) ?? defaultCivilizationName(owner);
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

  // agent-affordances A1: the raw prerequisite count behind the
  // canAdvanceTo* booleans, so rejection messages can say "you have 1"
  // instead of hiding the rule.
  function countCompletedAgePrerequisites(
    owner: number,
    forTech: 'feudal-age' | 'castle-age' | 'imperial-age',
  ): number {
    switch (forTech) {
      case 'feudal-age':
        return countCompletedOwnedBuildings(owner, isDarkAgePrerequisiteBuilding);
      case 'castle-age':
        return countCompletedOwnedBuildings(owner, isFeudalAgePrerequisiteBuilding);
      case 'imperial-age':
        return countCompletedOwnedBuildings(owner, isCastleAgePrerequisiteBuilding);
    }
  }

  // iter-1 Claude L1: the gates consume AGE_ADVANCE_REQUIRED_COUNT so the
  // rejection messages (which render the same constant) can never drift
  // from the actual rule.
  function canAdvanceToFeudalAge(owner: number): boolean {
    if (getPlayerAge(owner) !== 'dark-age') {
      return false;
    }
    return (
      countCompletedOwnedBuildings(owner, isDarkAgePrerequisiteBuilding)
      >= AGE_ADVANCE_REQUIRED_COUNT
    );
  }

  function canAdvanceToCastleAge(owner: number): boolean {
    if (getPlayerAge(owner) !== 'feudal-age') {
      return false;
    }
    return (
      countCompletedOwnedBuildings(owner, isFeudalAgePrerequisiteBuilding)
      >= AGE_ADVANCE_REQUIRED_COUNT
    );
  }

  function canAdvanceToImperialAge(owner: number): boolean {
    if (getPlayerAge(owner) !== 'castle-age') {
      return false;
    }
    return (
      countCompletedOwnedBuildings(owner, isCastleAgePrerequisiteBuilding)
      >= AGE_ADVANCE_REQUIRED_COUNT
    );
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
    countQueuedUnits,
    countOwnedUnits,
    countCompletedOwnedBuildings,
    hasCompletedBuilding,
    isConstructingBuilding,
    hasOwnedWonder,
    getPlayerAge,
    getPlayerCivilization,
    isAtLeastAge,
    countCompletedAgePrerequisites,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    latestResearchedInChain,
  };
}
