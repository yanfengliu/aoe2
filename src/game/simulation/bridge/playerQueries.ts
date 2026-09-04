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
  /** The first unit of this type this owner has ON THE MAP — a garrisoned
   *  one has no position and cannot be engaged, so it is never returned. */
  findOwnedUnitOnMap(owner: number, unitType: UnitType): number | null;
  /** Whether this owner has any unit at all standing on the map. */
  ownerHasUnitOnMap(owner: number): boolean;
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

  // ON THE MAP is part of the question, not a detail. A GARRISONED unit keeps
  // its `unit` component and stays alive, but `garrisonUnit` strips its
  // position — so it cannot be walked to, attacked, or engaged in any way.
  // Handing one back as "a unit of this type" pinned the AI's whole army:
  // `runAttackPhase` prefers the target enemy's villager, and
  // `setUnitAttackCommandDirect` returns false without a target position, so
  // the order was silently dropped and re-issued on every decision tick.
  // Measured on `gold-rush` at 60,000 ticks: owner 2 held 14 buildings and two
  // garrisoned villagers, owner 1 held 151 units, and every one of them was
  // idle from tick 30,000 to the horizon while the match could not resolve.
  /** Whether this owner has ANY unit standing on the map — the question the
   *  conquest rule leaves over once its buildings are all that keep it alive. */
  function ownerHasUnitOnMap(owner: number): boolean {
    for (const id of world.query('unit', 'position')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (unit?.owner === owner) return true;
    }
    return false;
  }

  function findOwnedUnitOnMap(owner: number, unitType: UnitType): number | null {
    for (const id of world.query('unit', 'position')) {
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
    // Khmer: "Prereq buildings aren't required to advance to further ages" —
    // the age sequence still holds, the building count does not.
    if (getPlayerCivilization(owner) === 'Khmer') {
      return true;
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
    // Khmer: "Prereq buildings aren't required to advance to further ages" —
    // the age sequence still holds, the building count does not.
    if (getPlayerCivilization(owner) === 'Khmer') {
      return true;
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
    // Khmer: "Prereq buildings aren't required to advance to further ages" —
    // the age sequence still holds, the building count does not.
    if (getPlayerCivilization(owner) === 'Khmer') {
      return true;
    }
    // Spec §7.2: "2 qualifying Castle Age buildings OR 1 Castle". The
    // alternative is the point — a Castle costs more than two of anything else
    // in its tier, so AoE2 lets one stand alone — and only the count was
    // implemented, with a Castle merely counting as one of the two. A player
    // who had built a Castle and nothing else was blocked out of Imperial.
    if (hasCompletedBuilding(owner, 'castle')) {
      return true;
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
    findOwnedUnitOnMap,
    ownerHasUnitOnMap,
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
