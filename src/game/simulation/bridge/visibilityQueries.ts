// Visibility queries against the bridge's `VisibilityMap`. Wraps the four
// "is visible to the human player?" predicates so callers (selection,
// command resolution, projection) share the same definition of partial
// footprint visibility for multi-tile buildings — and of the human's SIGHT,
// which is its own vision plus its allies' (humanSight.ts).

import { VisibilityMap, type Position } from 'civ-engine';
import type {
  BuildingComponent,
  ResourceComponent,
  UnitComponent,
} from '../types';
import { buildingFootprint, type GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { isCellSeen, isFootprintSeen, readSightOwners } from './humanSight';

export interface VisibilityQueriesDeps {
  world: GameWorld;
  humanPlayerId: number;
  visibility: VisibilityMap;
  accessor: BridgeStateAccessor;
}

export interface VisibilityQueries {
  isVisibleToHuman(position: Position, owner: number | null): boolean;
  isEntityFootprintVisibleToHuman(
    position: Position,
    owner: number | null,
    footprintWidth: number,
    footprintHeight: number,
  ): boolean;
  getEntityVisibilityProbe(entityId: number): {
    position: Position;
    owner: number | null;
    footprintWidth: number;
    footprintHeight: number;
  } | null;
  isEntityVisibleToHuman(entityId: number): boolean;
}

export function createVisibilityQueries(deps: VisibilityQueriesDeps): VisibilityQueries {
  const { world, humanPlayerId, visibility, accessor } = deps;

  function isVisibleToHuman(position: Position, owner: number | null): boolean {
    return owner === humanPlayerId
      || isCellSeen(visibility, readSightOwners(accessor, humanPlayerId), position.x, position.y);
  }

  function isEntityFootprintVisibleToHuman(
    position: Position,
    owner: number | null,
    footprintWidth: number,
    footprintHeight: number,
  ): boolean {
    if (owner === humanPlayerId) return true;
    return isFootprintSeen(
      visibility,
      readSightOwners(accessor, humanPlayerId),
      position.x,
      position.y,
      footprintWidth,
      footprintHeight,
    );
  }

  function getEntityVisibilityProbe(entityId: number): {
    position: Position;
    owner: number | null;
    footprintWidth: number;
    footprintHeight: number;
  } | null {
    const position = world.getComponent<Position>(entityId, 'position');
    if (!position) return null;

    const unit = world.getComponent<UnitComponent>(entityId, 'unit');
    const building = world.getComponent<BuildingComponent>(entityId, 'building');
    const resource = world.getComponent<ResourceComponent>(entityId, 'resource');
    const owner = unit?.owner ?? building?.owner ?? resource?.owner ?? null;
    let footprintWidth = 1;
    let footprintHeight = 1;
    if (building) {
      const footprint = buildingFootprint(building.buildingType);
      footprintWidth = footprint.width;
      footprintHeight = footprint.height;
    }
    return { position, owner, footprintWidth, footprintHeight };
  }

  function isEntityVisibleToHuman(entityId: number): boolean {
    const probe = getEntityVisibilityProbe(entityId);
    if (!probe) return false;
    return isEntityFootprintVisibleToHuman(
      probe.position,
      probe.owner,
      probe.footprintWidth,
      probe.footprintHeight,
    );
  }

  return {
    isVisibleToHuman,
    isEntityFootprintVisibleToHuman,
    getEntityVisibilityProbe,
    isEntityVisibleToHuman,
  };
}
