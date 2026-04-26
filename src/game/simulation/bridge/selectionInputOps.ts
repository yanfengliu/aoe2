// Selection input operations + spatial-context helpers used by command
// resolution. The selection-state mutators close over a small refs holder
// that the bridge owns (selectedEntityRefs / selectionFocusCell), so the
// bridge keeps the single source of truth for selection state. The
// spatial-context helpers (find*AtCell, distanceToBuilding) are pure
// reads over the world + side maps.

import { VisibilityMap, type EntityRef, type Position } from 'civ-engine';
import type {
  BuildingComponent,
  RenderableComponent,
  ResourceComponent,
  UnitComponent,
  UnitType,
} from '../types';
import { clamp, type GameWorld } from './pureHelpers';
import { createSelectionFinders } from './selectionFinders';

export interface SelectableEntityCandidate {
  id: number;
  kind: 'unit' | 'building' | 'resource';
  owner: number | null;
}

export interface SelectionRefsHolder {
  refs: EntityRef[];
  focusCell: Position | null;
}

export interface SelectionInputOpsDeps {
  world: GameWorld;
  humanPlayerId: number;
  mapWidth: number;
  mapHeight: number;
  visibility: VisibilityMap;
  state: import('./bridgeState').BridgeState;
  selection: SelectionRefsHolder;
  placementMode: { current: import('../types').BuildableBuildingType | null };
  isMatchRunning: () => boolean;
  isVisibleToHuman: (position: Position, owner: number | null) => boolean;
  isEntityFootprintVisibleToHuman: (
    position: Position,
    owner: number | null,
    footprintWidth: number,
    footprintHeight: number,
  ) => boolean;
  buildingOccupiesCell: (entityId: number, x: number, y: number) => boolean;
  getEntityRef: (id: number) => EntityRef | null;
  getCurrentEntityId: (ref: EntityRef) => number | null;
}

export interface SelectionInputOps {
  compareSelectableEntities(
    left: SelectableEntityCandidate,
    right: SelectableEntityCandidate,
  ): number;
  getSelectableEntitiesAtCell(x: number, y: number): SelectableEntityCandidate[];
  entityOccupiesCell(entityId: number, x: number, y: number): boolean;
  getHumanUnitIdsInRect(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    unitType?: UnitType,
  ): number[];
  selectUnitIds(ids: number[]): boolean;
  filterSelectableUnitIds(ids: number[]): number[];
  selectUnitsByIds(ids: number[]): boolean;
  getHumanOwnedSheepIdsInRect(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): number[];
  selectUnitsInBox(minX: number, minY: number, maxX: number, maxY: number): boolean;
  selectOwnedUnitsByTypeInRect(
    unitType: UnitType | 'sheep',
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): boolean;
  getSelectedEntityIds(): number[];
  getSelectedEntityId(): number | null;
  removeSelectedEntity(id: number): void;
  findResourceAtCell(x: number, y: number): number | null;
  resolveSelectionTile(selectedEntityId: number, position: Position): Position;
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

export function createSelectionInputOps(deps: SelectionInputOpsDeps): SelectionInputOps {
  const {
    world,
    humanPlayerId,
    mapWidth,
    mapHeight,
    visibility,
    state,
    selection,
    placementMode,
    isMatchRunning,
    isVisibleToHuman,
    isEntityFootprintVisibleToHuman,
    buildingOccupiesCell,
    getEntityRef,
    getCurrentEntityId,
  } = deps;

  function compareSelectableEntities(
    left: SelectableEntityCandidate,
    right: SelectableEntityCandidate,
  ): number {
    const kindPriority: Record<SelectableEntityCandidate['kind'], number> = {
      unit: 0,
      building: 1,
      resource: 2,
    };
    const ownerPriority = (owner: number | null): number => {
      if (owner === humanPlayerId) return 0;
      if (owner === null) return 2;
      return 1;
    };

    const kindDelta = kindPriority[left.kind] - kindPriority[right.kind];
    if (kindDelta !== 0) return kindDelta;

    const ownerDelta = ownerPriority(left.owner) - ownerPriority(right.owner);
    if (ownerDelta !== 0) return ownerDelta;

    return left.id - right.id;
  }

  function getSelectableEntitiesAtCell(x: number, y: number): SelectableEntityCandidate[] {
    const candidates: SelectableEntityCandidate[] = [];

    for (const id of world.query('position', 'unit')) {
      const position = world.getComponent<Position>(id, 'position');
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (position?.x === x && position.y === y && isVisibleToHuman(position, unit?.owner ?? null)) {
        candidates.push({ id, kind: 'unit', owner: unit?.owner ?? null });
      }
    }

    for (const id of world.query('position', 'building')) {
      const position = world.getComponent<Position>(id, 'position');
      const building = world.getComponent<BuildingComponent>(id, 'building');
      const renderable = world.getComponent<RenderableComponent>(id, 'renderable');
      if (
        position
        && building
        && renderable
        && buildingOccupiesCell(id, x, y)
        && isEntityFootprintVisibleToHuman(
          position,
          building.owner,
          renderable.footprintWidth,
          renderable.footprintHeight,
        )
      ) {
        candidates.push({ id, kind: 'building', owner: building.owner });
      }
    }

    for (const id of world.query('position', 'resource')) {
      const position = world.getComponent<Position>(id, 'position');
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      if (
        position?.x === x
        && position.y === y
        && resource
        && isVisibleToHuman(position, resource.owner)
      ) {
        candidates.push({ id, kind: 'resource', owner: resource.owner });
      }
    }

    return candidates.sort(compareSelectableEntities);
  }

  function entityOccupiesCell(entityId: number, x: number, y: number): boolean {
    const position = world.getComponent<Position>(entityId, 'position');
    if (!position) return false;

    if (world.getComponent<BuildingComponent>(entityId, 'building')) {
      return buildingOccupiesCell(entityId, x, y);
    }

    return position.x === x && position.y === y;
  }

  function getHumanUnitIdsInRect(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    unitType?: UnitType,
  ): number[] {
    const clampedMinX = clamp(Math.min(minX, maxX), 0, mapWidth - 1);
    const clampedMaxX = clamp(Math.max(minX, maxX), 0, mapWidth - 1);
    const clampedMinY = clamp(Math.min(minY, maxY), 0, mapHeight - 1);
    const clampedMaxY = clamp(Math.max(minY, maxY), 0, mapHeight - 1);

    return [...world.query('position', 'unit')]
      .map((id) => ({
        id,
        position: world.getComponent<Position>(id, 'position'),
        unit: world.getComponent<UnitComponent>(id, 'unit'),
      }))
      .filter(
        (entry): entry is { id: number; position: Position; unit: UnitComponent } =>
          entry.position !== undefined
          && entry.unit !== undefined
          && entry.unit.owner === humanPlayerId
          && (unitType === undefined || entry.unit.unitType === unitType)
          && entry.position.x >= clampedMinX
          && entry.position.x <= clampedMaxX
          && entry.position.y >= clampedMinY
          && entry.position.y <= clampedMaxY,
      )
      .sort((left, right) => {
        const yDelta = left.position.y - right.position.y;
        if (yDelta !== 0) return yDelta;
        return left.position.x - right.position.x;
      })
      .map((entry) => entry.id);
  }

  function selectUnitIds(ids: number[]): boolean {
    selection.refs = ids
      .map((id) => getEntityRef(id))
      .filter((ref): ref is EntityRef => ref !== null);
    selection.focusCell = null;

    if (selection.refs.length === 0) {
      placementMode.current = null;
      return false;
    }

    placementMode.current = null;
    return true;
  }

  function filterSelectableUnitIds(ids: number[]): number[] {
    if (!isMatchRunning()) return [];

    const dedupedIds: number[] = [];
    const seenIds = new Set<number>();
    for (const id of ids) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (unit) {
        const position = world.getComponent<Position>(id, 'position');
        if (position && unit.owner === humanPlayerId && isVisibleToHuman(position, unit.owner)) {
          dedupedIds.push(id);
        }
        continue;
      }

      const position = world.getComponent<Position>(id, 'position');
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      if (
        position
        && resource
        && resource.resourceType === 'sheep'
        && resource.owner === humanPlayerId
        && resource.amount > 0
        && isVisibleToHuman(position, resource.owner)
      ) {
        dedupedIds.push(id);
      }
    }

    return dedupedIds;
  }

  function selectUnitsByIds(ids: number[]): boolean {
    return selectUnitIds(filterSelectableUnitIds(ids));
  }

  function getHumanOwnedSheepIdsInRect(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): number[] {
    const clampedMinX = clamp(Math.min(minX, maxX), 0, mapWidth - 1);
    const clampedMaxX = clamp(Math.max(minX, maxX), 0, mapWidth - 1);
    const clampedMinY = clamp(Math.min(minY, maxY), 0, mapHeight - 1);
    const clampedMaxY = clamp(Math.max(minY, maxY), 0, mapHeight - 1);

    return [...world.query('position', 'resource')]
      .map((id) => ({
        id,
        position: world.getComponent<Position>(id, 'position'),
        resource: world.getComponent<ResourceComponent>(id, 'resource'),
      }))
      .filter(
        (entry): entry is { id: number; position: Position; resource: ResourceComponent } =>
          entry.position !== undefined
          && entry.resource !== undefined
          && entry.resource.resourceType === 'sheep'
          && entry.resource.owner === humanPlayerId
          && entry.resource.amount > 0
          && entry.position.x >= clampedMinX
          && entry.position.x <= clampedMaxX
          && entry.position.y >= clampedMinY
          && entry.position.y <= clampedMaxY,
      )
      .sort((left, right) => {
        const yDelta = left.position.y - right.position.y;
        if (yDelta !== 0) return yDelta;
        return left.position.x - right.position.x;
      })
      .map((entry) => entry.id);
  }

  function selectUnitsInBox(minX: number, minY: number, maxX: number, maxY: number): boolean {
    if (!isMatchRunning()) return false;

    const unitIds = getHumanUnitIdsInRect(minX, minY, maxX, maxY);
    const sheepIds = getHumanOwnedSheepIdsInRect(minX, minY, maxX, maxY);
    return selectUnitIds([...unitIds, ...sheepIds]);
  }

  function selectOwnedUnitsByTypeInRect(
    unitType: UnitType | 'sheep',
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): boolean {
    if (!isMatchRunning()) return false;

    const ids = unitType === 'sheep'
      ? getHumanOwnedSheepIdsInRect(minX, minY, maxX, maxY)
      : getHumanUnitIdsInRect(minX, minY, maxX, maxY, unitType);
    return selectUnitIds(ids);
  }

  function getSelectedEntityIds(): number[] {
    const ids: number[] = [];
    const nextRefs: EntityRef[] = [];

    for (const ref of selection.refs) {
      const id = getCurrentEntityId(ref);
      if (id === null || ids.includes(id)) continue;
      ids.push(id);
      nextRefs.push(ref);
    }

    if (nextRefs.length !== selection.refs.length) {
      selection.refs = nextRefs;
      if (selection.refs.length === 0) {
        selection.focusCell = null;
        placementMode.current = null;
      }
    }

    return ids;
  }

  function getSelectedEntityId(): number | null {
    const ids = getSelectedEntityIds();
    if (ids.length > 0) return ids[0];

    if (selection.refs.length > 0) {
      selection.refs = [];
      selection.focusCell = null;
      placementMode.current = null;
    }
    return null;
  }

  function removeSelectedEntity(id: number): void {
    const nextRefs = selection.refs.filter((ref) => getCurrentEntityId(ref) !== id);
    if (nextRefs.length === selection.refs.length) return;

    selection.refs = nextRefs;
    if (selection.refs.length === 0) {
      selection.focusCell = null;
      placementMode.current = null;
    }
  }

  function resolveSelectionTile(selectedEntityId: number, position: Position): Position {
    if (
      selection.focusCell
      && entityOccupiesCell(selectedEntityId, selection.focusCell.x, selection.focusCell.y)
    ) {
      return selection.focusCell;
    }
    return position;
  }

  const finders = createSelectionFinders({
    world,
    humanPlayerId,
    visibility,
    state,
    buildingOccupiesCell,
  });

  return {
    compareSelectableEntities,
    getSelectableEntitiesAtCell,
    entityOccupiesCell,
    getHumanUnitIdsInRect,
    selectUnitIds,
    filterSelectableUnitIds,
    selectUnitsByIds,
    getHumanOwnedSheepIdsInRect,
    selectUnitsInBox,
    selectOwnedUnitsByTypeInRect,
    getSelectedEntityIds,
    getSelectedEntityId,
    removeSelectedEntity,
    resolveSelectionTile,
    ...finders,
  };
}
