import { VisibilityMap, type Position } from 'civ-engine';

import type {
  BuildingComponent,
  ResourceComponent,
  UnitComponent,
  UnitType,
} from '../types';
import { buildingFootprint, type GameWorld } from './pureHelpers';
import { canGarrisonAt } from '../prototypeBuildingRules';
import type { BridgeState } from './bridgeState';

export interface SelectionFindersDeps {
  world: GameWorld;
  humanPlayerId: number;
  visibility: VisibilityMap;
  state: BridgeState;
  buildingOccupiesCell: (entityId: number, x: number, y: number) => boolean;
}

export interface SelectionFinders {
  findResourceAtCell(x: number, y: number): number | null;
  findHostileUnitAtCell(x: number, y: number, attackerOwner: number): number | null;
  findHostileBuildingAtCell(x: number, y: number, attackerOwner: number): number | null;
  findHostileWildlifeAtCell(x: number, y: number): number | null;
  findOwnedGarrisonBuildingAtCell(
    x: number,
    y: number,
    owner: number,
    unitType: UnitType,
  ): number | null;
  distanceToBuilding(id: number, position: Position): number;
}

export function createSelectionFinders(deps: SelectionFindersDeps): SelectionFinders {
  const { world, humanPlayerId, visibility, state, buildingOccupiesCell } = deps;
  const { wildlifeStates, constructionStates } = state;

  function findResourceAtCell(x: number, y: number): number | null {
    for (const id of world.query('position', 'resource')) {
      const position = world.getComponent<Position>(id, 'position');
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      if (
        position?.x === x
        && position.y === y
        && resource
        && resource.amount > 0
        && visibility.isVisible(humanPlayerId, x, y)
      ) {
        return id;
      }
    }
    return null;
  }

  function findHostileUnitAtCell(x: number, y: number, attackerOwner: number): number | null {
    for (const id of world.query('position', 'unit')) {
      const position = world.getComponent<Position>(id, 'position');
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (
        position?.x === x
        && position.y === y
        && unit
        && unit.owner !== attackerOwner
        && visibility.isVisible(humanPlayerId, x, y)
      ) {
        return id;
      }
    }
    return null;
  }

  function findHostileBuildingAtCell(
    x: number,
    y: number,
    attackerOwner: number,
  ): number | null {
    for (const id of world.query('position', 'building')) {
      const position = world.getComponent<Position>(id, 'position');
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (
        position
        && building
        && building.owner !== attackerOwner
        && buildingOccupiesCell(id, x, y)
        && visibility.isVisible(humanPlayerId, x, y)
      ) {
        return id;
      }
    }
    return null;
  }

  function findHostileWildlifeAtCell(x: number, y: number): number | null {
    for (const id of world.query('position', 'resource')) {
      const position = world.getComponent<Position>(id, 'position');
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      const wildlife = wildlifeStates.get(id);
      if (
        position?.x === x
        && position.y === y
        && resource
        && wildlife?.isAlive
        && visibility.isVisible(humanPlayerId, x, y)
      ) {
        return id;
      }
    }
    return null;
  }

  function findOwnedGarrisonBuildingAtCell(
    x: number,
    y: number,
    owner: number,
    unitType: UnitType,
  ): number | null {
    for (const id of world.query('position', 'building')) {
      const position = world.getComponent<Position>(id, 'position');
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (
        position
        && building
        && building.owner === owner
        && canGarrisonAt(building.buildingType, unitType)
        && buildingOccupiesCell(id, x, y)
      ) {
        const construction = constructionStates.get(id);
        if (construction && !construction.isComplete) continue;
        return id;
      }
    }
    return null;
  }

  function distanceToBuilding(id: number, position: Position): number {
    const buildingPosition = world.getComponent<Position>(id, 'position');
    const building = world.getComponent<BuildingComponent>(id, 'building');
    if (!buildingPosition || !building) return Number.POSITIVE_INFINITY;

    const footprint = buildingFootprint(building.buildingType);
    const minX = buildingPosition.x;
    const maxX = buildingPosition.x + footprint.width - 1;
    const minY = buildingPosition.y;
    const maxY = buildingPosition.y + footprint.height - 1;

    const dx =
      position.x < minX ? minX - position.x
      : position.x > maxX ? position.x - maxX
      : 0;
    const dy =
      position.y < minY ? minY - position.y
      : position.y > maxY ? position.y - maxY
      : 0;

    return dx + dy;
  }

  return {
    findResourceAtCell,
    findHostileUnitAtCell,
    findHostileBuildingAtCell,
    findHostileWildlifeAtCell,
    findOwnedGarrisonBuildingAtCell,
    distanceToBuilding,
  };
}
