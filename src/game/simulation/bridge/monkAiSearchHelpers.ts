// FU4 AI search helpers for the Monk task pipeline. Each finder walks the
// world once and picks the closest viable target by Manhattan distance.
// Extracted from monkTaskOps so the Monk module's apply / context layers
// stay focused on their own concerns.

import type { Position } from 'civ-engine';

import type {
  BuildingComponent,
  ResourceComponent,
  UnitComponent,
  UnitType,
} from '../types';
import { manhattanDistance, type GameWorld } from './pureHelpers';
import type { BridgeState } from './bridgeState';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  constructionStatesCodec,
  monkCarriedRelicCodec,
} from './bridgeStateSerialize';

export interface MonkAiSearchDeps {
  world: GameWorld;
  state: BridgeState;
  // Phase 2D: monkCarriedRelic migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  isAiMilitaryUnit: (unitType: UnitType) => boolean;
  isVisibleToOwner: (owner: number, x: number, y: number) => boolean;
  aiMonkHealHpFraction: number;
}

export interface MonkAiSearchHelpers {
  findNearestOwnedMonasteryToDeposit(owner: number, origin: Position): number | null;
  findNearestVisibleNeutralRelic(owner: number, origin: Position): number | null;
  findNearestWoundedFriendlyMilitary(owner: number, origin: Position): number | null;
}

export function createMonkAiSearchHelpers(deps: MonkAiSearchDeps): MonkAiSearchHelpers {
  const { world, state, accessor, isAiMilitaryUnit, isVisibleToOwner, aiMonkHealHpFraction } = deps;
  const { combatStates } = state;

  function findNearestOwnedMonasteryToDeposit(owner: number, origin: Position): number | null {
    let bestId: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const id of world.query('building', 'position')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      const position = world.getComponent<Position>(id, 'position');
      if (
        !building
        || !position
        || building.owner !== owner
        || building.buildingType !== 'monastery'
      ) {
        continue;
      }
      const construction = accessor.get(constructionStatesCodec).get(id);
      if (construction && !construction.isComplete) {
        continue;
      }
      const distance = manhattanDistance(origin, position);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
      }
    }
    return bestId;
  }

  // Returns the nearest neutral relic visible to the Monk's owner; carried
  // relics are excluded because their position tracks the carrying Monk.
  function findNearestVisibleNeutralRelic(owner: number, origin: Position): number | null {
    const carriedRelicIds = new Set<number>(accessor.get(monkCarriedRelicCodec).values());
    let bestId: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const id of world.query('resource', 'position')) {
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      const position = world.getComponent<Position>(id, 'position');
      if (
        !resource
        || !position
        || resource.resourceType !== 'relic'
        || resource.owner !== null
      ) {
        continue;
      }
      if (carriedRelicIds.has(id)) {
        continue;
      }
      if (!isVisibleToOwner(owner, position.x, position.y)) {
        continue;
      }
      const distance = manhattanDistance(origin, position);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
      }
    }
    return bestId;
  }

  // Returns the nearest owned military unit below aiMonkHealHpFraction of
  // max HP. Villagers / Scouts / Monks are excluded so heal allocation
  // tracks the military line.
  function findNearestWoundedFriendlyMilitary(owner: number, origin: Position): number | null {
    let bestId: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const id of world.query('unit', 'position')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      const position = world.getComponent<Position>(id, 'position');
      if (
        !unit
        || !position
        || unit.owner !== owner
        || !isAiMilitaryUnit(unit.unitType)
      ) {
        continue;
      }
      const combat = combatStates.get(id);
      if (!combat || combat.maxHp <= 0 || combat.currentHp <= 0) {
        continue;
      }
      if (combat.currentHp >= combat.maxHp * aiMonkHealHpFraction) {
        continue;
      }
      const distance = manhattanDistance(origin, position);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
      }
    }
    return bestId;
  }

  return {
    findNearestOwnedMonasteryToDeposit,
    findNearestVisibleNeutralRelic,
    findNearestWoundedFriendlyMilitary,
  };
}
