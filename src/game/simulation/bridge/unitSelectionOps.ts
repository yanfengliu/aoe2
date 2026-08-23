import type { EntityRef, Position } from 'civ-engine';
import type {
  BuildableBuildingType,
  ResourceComponent,
  UnitComponent,
  UnitType,
} from '../types';
import type { GameWorld } from './pureHelpers';

export interface UnitSelectionOpsDeps {
  world: GameWorld;
  humanPlayerId: number;
  selection: { refs: EntityRef[]; focusCell: Position | null };
  placementMode: { current: BuildableBuildingType | null };
  isMatchRunning: () => boolean;
  isEntityVisibleToHuman: (id: number) => boolean;
  getSelectedEntityIds: () => number[];
  getSelectableEntitiesAtCell: (x: number, y: number) => Array<{ id: number }>;
  getEntityRef: (id: number) => EntityRef | null;
  getBuildOptions: (owner: number, unitType: UnitType) => readonly BuildableBuildingType[];
}

export interface UnitSelectionOps {
  getSelectedOwnedSheepIds(): number[];
  getSelectedHumanUnitIds(): number[];
  getSelectedHumanBuilderIds(): number[];
  selectEntityAtCell(x: number, y: number): boolean;
  selectEntityById(id: number): boolean;
  clearSelection(): void;
}

export function createUnitSelectionOps(deps: UnitSelectionOpsDeps): UnitSelectionOps {
  const {
    world,
    humanPlayerId,
    selection,
    placementMode,
    isMatchRunning,
    isEntityVisibleToHuman,
    getSelectedEntityIds,
    getSelectableEntitiesAtCell,
    getEntityRef,
    getBuildOptions,
  } = deps;

  function getSelectedOwnedSheepIds(): number[] {
    return getSelectedEntityIds().filter((id) => {
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      return (
        resource !== undefined
        && resource.resourceType === 'sheep'
        && resource.owner === humanPlayerId
        && resource.amount > 0
      );
    });
  }

  function getSelectedHumanUnitIds(): number[] {
    return getSelectedEntityIds().filter((id) => {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      return unit?.owner === humanPlayerId;
    });
  }

  // Every selected human unit that can put a building up. Derived from the
  // build MENU rather than from a unit-type test, because a Fishing Ship builds
  // Fish Traps out on the water where no villager can stand — and because a
  // second builder type must not mean a second copy of this rule.
  function getSelectedHumanBuilderIds(): number[] {
    return getSelectedHumanUnitIds().filter((id) => {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      return unit !== undefined && getBuildOptions(unit.owner, unit.unitType).length > 0;
    });
  }

  function selectEntityAtCell(x: number, y: number): boolean {
    if (!isMatchRunning()) return false;

    const selectableEntities = getSelectableEntitiesAtCell(x, y);
    const currentSelectionIds = getSelectedEntityIds();
    const currentSelectionId = currentSelectionIds.length === 1 ? currentSelectionIds[0] : null;
    const lastClickedSameCell =
      selection.focusCell !== null
      && selection.focusCell.x === x
      && selection.focusCell.y === y;
    let nextSelection = selectableEntities[0]?.id ?? null;

    if (lastClickedSameCell && currentSelectionId !== null && selectableEntities.length > 1) {
      const currentIndex = selectableEntities.findIndex(
        (candidate) => candidate.id === currentSelectionId,
      );
      if (currentIndex >= 0) {
        nextSelection = selectableEntities[(currentIndex + 1) % selectableEntities.length]?.id ?? null;
      }
    }

    selection.refs =
      nextSelection === null
        ? []
        : [getEntityRef(nextSelection)].filter((ref): ref is EntityRef => ref !== null);
    if (nextSelection === null) {
      selection.focusCell = null;
      placementMode.current = null;
      return false;
    }

    selection.focusCell = { x, y };
    placementMode.current = null;
    return selection.refs.length > 0;
  }

  function selectEntityById(id: number): boolean {
    if (!isMatchRunning() || !isEntityVisibleToHuman(id)) return false;

    const entityRef = getEntityRef(id);
    if (!entityRef) return false;

    selection.refs = [entityRef];
    selection.focusCell = null;
    placementMode.current = null;
    return true;
  }

  function clearSelection(): void {
    selection.refs = [];
    selection.focusCell = null;
    placementMode.current = null;
  }

  return {
    getSelectedOwnedSheepIds,
    getSelectedHumanUnitIds,
    getSelectedHumanBuilderIds,
    selectEntityAtCell,
    selectEntityById,
    clearSelection,
  };
}
