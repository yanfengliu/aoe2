// FU4 AI search helpers for the Monk task pipeline. Each finder walks the
// world once and picks the closest viable target by Manhattan distance.
// Extracted from monkTaskOps so the Monk module's apply / context layers
// stay focused on their own concerns.
//
// What the computer knows about relics (work 128; spec §13.3). Its Monks go
// for a relic lying on ground its seat has EXPLORED: its own exploration, or
// that of any player whose vision it shares, which is the ground a person in
// that seat sees as explored rather than black. Until work 128 they went only
// for a relic in sight at that moment, so a relic the seat had found and then
// lost sight of was never sought. No Definitive Edition source states what
// DE's computer knows about relics; its AI was previewed as one that does not
// see through the fog and must scout (E3 2019), so it may not use ground its
// seat has never seen. BOUND: the search reads where a relic lies NOW, not
// where the seat last saw it, so a relic moved on explored ground out of sight
// (dropped by a dying carrier, or taken away) is known at its new place.

import type { Position } from 'civ-engine';

import type {
  BuildingComponent,
  ResourceComponent,
  UnitComponent,
  UnitType,
} from '../types';
import { manhattanDistance, type GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { readSightOwners } from './humanSight';
import {
  combatStatesCodec,
  constructionStatesCodec,
  monkCarriedRelicCodec,
} from './bridgeStateSerialize';

export interface MonkAiSearchDeps {
  world: GameWorld;
  // Phase 2D: all slots this helper needs (combatStates, constructionStates,
  // monkCarriedRelic) live on the accessor now; the BridgeState dep was
  // removed when the last raw-map read was migrated.
  accessor: BridgeStateAccessor;
  isAiMilitaryUnit: (unitType: UnitType) => boolean;
  /** Whether `owner` has ever explored the cell (the VisibilityMap's own record). */
  isExploredByOwner: (owner: number, x: number, y: number) => boolean;
  aiMonkHealHpFraction: number;
}

export interface MonkAiSearchHelpers {
  findNearestOwnedMonasteryToDeposit(owner: number, origin: Position): number | null;
  findNearestKnownNeutralRelic(owner: number, origin: Position): number | null;
  findNearestWoundedFriendlyMilitary(owner: number, origin: Position): number | null;
}

export function createMonkAiSearchHelpers(deps: MonkAiSearchDeps): MonkAiSearchHelpers {
  const { world, accessor, isAiMilitaryUnit, isExploredByOwner, aiMonkHealHpFraction } = deps;

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

  // Returns the nearest neutral relic on ground the owner's sight has
  // explored (the header says why); carried relics are excluded because their
  // position tracks the carrying Monk.
  function findNearestKnownNeutralRelic(owner: number, origin: Position): number | null {
    const carriedRelicIds = new Set<number>(accessor.get(monkCarriedRelicCodec).values());
    const sight = readSightOwners(accessor, owner);
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
      if (!sight.some((viewer) => isExploredByOwner(viewer, position.x, position.y))) {
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
      const combat = accessor.get(combatStatesCodec).get(id);
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
    findNearestKnownNeutralRelic,
    findNearestWoundedFriendlyMilitary,
  };
}
