// Per-unit command issuance + entity-selection ops. The wrappers translate
// player intent into a `unitCommands` entry: move, sheep-move, attack,
// context (which dispatches into garrison / attack / gather / move based on
// what's at the target cell), gather, and a shared selectEntity{AtCell,
// ById}/clearSelection trio. Each closes over the bridge state holder so
// reads/writes go through the same shared selection refs.

import type { EntityRef, Position } from 'civ-engine';
import type {
  BuildingComponent,
  GathererComponent,
  ResourceComponent,
  UnitComponent,
  UnitType,
} from '../types';
import { clamp, type GameWorld } from './pureHelpers';
import { canGarrisonAt } from '../prototypeBuildingRules';
import { resourceKindToEconomyResource } from '../prototypeEconomyRules';
import type { UnitCommand } from './sharedTypes';
import type { BridgeState } from './bridgeState';

export interface UnitCommandOpsDeps {
  world: GameWorld;
  humanPlayerId: number;
  mapWidth: number;
  mapHeight: number;
  state: BridgeState;
  selection: { refs: EntityRef[]; focusCell: Position | null };
  placementMode: { current: import('../types').BuildableBuildingType | null };
  isMatchRunning: () => boolean;
  isEntityVisibleToHuman: (id: number) => boolean;
  getSelectedEntityIds: () => number[];
  getSelectableEntitiesAtCell: (x: number, y: number) => Array<{ id: number }>;
  findResourceAtCell: (x: number, y: number) => number | null;
  findOwnedGarrisonBuildingAtCell: (
    x: number,
    y: number,
    owner: number,
    unitType: UnitType,
  ) => number | null;
  findHostileUnitAtCell: (x: number, y: number, attackerOwner: number) => number | null;
  findHostileBuildingAtCell: (x: number, y: number, attackerOwner: number) => number | null;
  findHostileWildlifeAtCell: (x: number, y: number) => number | null;
  findMonkContextTargetAtCell: (x: number, y: number, owner: number) => number | null;
  issueMonkContextCommandAtEntity: (
    monkId: number,
    targetEntityId: number,
    monkUnit: UnitComponent,
    targetPosition: Position,
  ) => boolean;
  clearMonkTask: (monkId: number) => void;
  garrisonUnit: (unitId: number, buildingId: number) => boolean;
  isHarvestableResource: (id: number, resource: ResourceComponent) => boolean;
  findNearestDropOffBuilding: (
    activeWorld: GameWorld,
    owner: number,
    resource: 'food' | 'wood' | 'gold' | 'stone',
    position: Position,
  ) => number | null;
  clearGathererOrder: (id: number) => void;
  clearUnitCommand: (id: number) => void;
  setUnitCommand: (unitId: number, command: UnitCommand) => void;
  getEntityRef: (id: number) => EntityRef | null;
}

export interface UnitCommandOps {
  // Phase 1B (DESIGN v17 §6.3): public commandified facade — used by
  // HUD-time entry points (humanInputOps.issueMoveCommand, internal
  // fallthrough from issueUnitContextCommand/AtEntity, and the
  // monkTaskOps human-context fallback). Calls
  // `world.submitWithResult('unit.move', ...)`. Validator runs
  // synchronously; handler runs at start of NEXT step.
  // Returns the validator's accept/reject decision (NOT whether the move
  // happened — that's deferred to next step's processCommands).
  issueUnitMoveCommand(unitId: number, target: Position): boolean;
  // Phase 1B (DESIGN v17 §6.4): private direct-mutation helper — used by
  // deterministic-resolution systems (productionQueueSystem rally,
  // monkTaskOps appliers). Mirrors the full facade body's invariants
  // (unit guard, clearGathererOrder, monkTasks.delete, target clamp,
  // movePathCache.delete via setUnitCommand). Safe to call from ANY
  // context. NOT for AI-decision systems (those use pendingCommands
  // intentions per §6.5).
  setUnitMoveCommandDirect(unitId: number, target: Position): boolean;
  // Phase 1B (DESIGN v17 §6.4): direct-mutation helper for unit.attack —
  // same role as setUnitMoveCommandDirect but for attack commands.
  setUnitAttackCommandDirect(
    unitId: number,
    targetEntityId: number,
    targetEntityKind: 'unit' | 'building' | 'resource',
  ): boolean;
  // Phase 1B unit.gather: same direct-mutation helper pattern.
  setUnitGatherCommandDirect(unitId: number, resourceId: number): boolean;
  issueSheepMoveCommand(sheepId: number, target: Position): boolean;
  getSelectedOwnedSheepIds(): number[];
  issueUnitAttackCommand(
    unitId: number,
    targetEntityId: number,
    targetEntityKind: 'unit' | 'building' | 'resource',
  ): boolean;
  getSelectedHumanUnitIds(): number[];
  getSelectedHumanVillagerIds(): number[];
  issueUnitContextCommand(unitId: number, target: Position): boolean;
  issueUnitGatherCommand(unitId: number, resourceId: number): boolean;
  issueUnitContextCommandAtEntity(unitId: number, targetEntityId: number): boolean;
  selectEntityAtCell(x: number, y: number): boolean;
  selectEntityById(id: number): boolean;
  clearSelection(): void;
}

export function createUnitCommandOps(deps: UnitCommandOpsDeps): UnitCommandOps {
  const {
    world,
    humanPlayerId,
    mapWidth,
    mapHeight,
    state,
    selection,
    placementMode,
    isMatchRunning,
    isEntityVisibleToHuman,
    getSelectedEntityIds,
    getSelectableEntitiesAtCell,
    findResourceAtCell,
    findOwnedGarrisonBuildingAtCell,
    findHostileUnitAtCell,
    findHostileBuildingAtCell,
    findHostileWildlifeAtCell,
    findMonkContextTargetAtCell,
    issueMonkContextCommandAtEntity,
    clearMonkTask,
    garrisonUnit,
    isHarvestableResource,
    findNearestDropOffBuilding,
    clearGathererOrder,
    clearUnitCommand,
    setUnitCommand,
    getEntityRef,
  } = deps;
  const { sheepMoveOrders, monkTasks, wildlifeStates, constructionStates } = state;

  // Direct-mutation helper. Same body as the pre-Phase-1B `issueUnitMoveCommand`.
  // Used by deterministic-resolution systems and by the `unit.move` handler.
  function setUnitMoveCommandDirect(unitId: number, target: Position): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit) return false;

    clearGathererOrder(unitId);
    monkTasks.delete(unitId);
    setUnitCommand(unitId, {
      type: 'move',
      target: {
        x: clamp(target.x, 0, mapWidth - 1),
        y: clamp(target.y, 0, mapHeight - 1),
      },
    });
    return true;
  }

  // Bridge facade. HUD / hotkey handlers call this; it routes through
  // civ-engine's command channel so the recorder captures the intent.
  // Handler delegates to setUnitMoveCommandDirect at start of next step.
  function issueUnitMoveCommand(unitId: number, target: Position): boolean {
    const result = world.submitWithResult('unit.move', { unitId, target });
    return result.accepted;
  }

  function issueSheepMoveCommand(sheepId: number, target: Position): boolean {
    const resource = world.getComponent<ResourceComponent>(sheepId, 'resource');
    if (
      !resource
      || resource.resourceType !== 'sheep'
      || resource.owner !== humanPlayerId
      || resource.amount <= 0
    ) {
      return false;
    }

    sheepMoveOrders.set(sheepId, {
      x: clamp(target.x, 0, mapWidth - 1),
      y: clamp(target.y, 0, mapHeight - 1),
    });
    return true;
  }

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

  // Direct-mutation helper. Same body as the pre-Phase-1B
  // `issueUnitAttackCommand`. Used by deterministic-resolution systems
  // and by the `unit.attack` handler.
  function setUnitAttackCommandDirect(
    unitId: number,
    targetEntityId: number,
    targetEntityKind: 'unit' | 'building' | 'resource',
  ): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    const targetPosition = world.getComponent<Position>(targetEntityId, 'position');
    if (!unit || !targetPosition) return false;

    if (targetEntityKind === 'unit') {
      const targetUnit = world.getComponent<UnitComponent>(targetEntityId, 'unit');
      if (!targetUnit || targetUnit.owner === unit.owner) return false;
    } else if (targetEntityKind === 'building') {
      const targetBuilding = world.getComponent<BuildingComponent>(targetEntityId, 'building');
      if (!targetBuilding || targetBuilding.owner === unit.owner) return false;
    } else {
      const targetResource = world.getComponent<ResourceComponent>(targetEntityId, 'resource');
      const wildlife = wildlifeStates.get(targetEntityId);
      if (!targetResource || !wildlife || !wildlife.isAlive) return false;
    }

    const targetEntityRef = getEntityRef(targetEntityId);
    if (!targetEntityRef) return false;

    clearGathererOrder(unitId);
    setUnitCommand(unitId, {
      type: 'attack',
      target: { x: targetPosition.x, y: targetPosition.y },
      targetEntityRef,
      targetEntityKind,
    });
    return true;
  }

  // Bridge facade. HUD / hotkey handlers + internal context-routing call
  // this; it routes through civ-engine's command channel so the recorder
  // captures the intent. Handler delegates to setUnitAttackCommandDirect
  // at start of next step.
  function issueUnitAttackCommand(
    unitId: number,
    targetEntityId: number,
    targetEntityKind: 'unit' | 'building' | 'resource',
  ): boolean {
    const result = world.submitWithResult('unit.attack', { unitId, targetEntityId, targetEntityKind });
    return result.accepted;
  }

  function getSelectedHumanUnitIds(): number[] {
    return getSelectedEntityIds().filter((id) => {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      return unit?.owner === humanPlayerId;
    });
  }

  function getSelectedHumanVillagerIds(): number[] {
    return getSelectedHumanUnitIds().filter((id) => {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      return unit?.unitType === 'villager';
    });
  }

  // Direct-mutation helper. Same body as the pre-Phase-1B
  // `issueUnitGatherCommand`. Used by the `unit.gather` handler (no
  // deterministic-system or AI call sites today — gather goes through
  // the HUD context-command fallthrough only).
  function setUnitGatherCommandDirect(unitId: number, resourceId: number): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    const gatherer = world.getComponent<GathererComponent>(unitId, 'gatherer');
    const resource = world.getComponent<ResourceComponent>(resourceId, 'resource');
    const targetPosition = world.getComponent<Position>(resourceId, 'position');
    if (!unit || !gatherer || !resource || !targetPosition) return false;

    const economyResource = resourceKindToEconomyResource(resource.resourceType);
    if (economyResource === null || !isHarvestableResource(resourceId, resource)) {
      return false;
    }

    clearGathererOrder(unitId);
    gatherer.hasExplicitGatherOrder = true;
    clearUnitCommand(unitId);
    gatherer.desiredResource = economyResource;
    gatherer.task = 'to-resource';
    gatherer.targetResourceId = resourceId;
    gatherer.dropOffBuildingId = findNearestDropOffBuilding(
      world,
      unit.owner,
      economyResource,
      targetPosition,
    );
    gatherer.gatherProgressTicks = 0;
    return true;
  }

  // Bridge facade. HUD-time context-command fallthrough calls this; routes
  // through civ-engine's command channel so the recorder captures gather
  // intent. Handler delegates to setUnitGatherCommandDirect at start of
  // next step.
  function issueUnitGatherCommand(unitId: number, resourceId: number): boolean {
    const result = world.submitWithResult('unit.gather', { unitId, resourceId });
    return result.accepted;
  }

  function issueUnitContextCommand(unitId: number, target: Position): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit || unit.owner !== humanPlayerId) return false;

    if (unit.unitType === 'monk') {
      const monkTargetEntityId = findMonkContextTargetAtCell(target.x, target.y, unit.owner);
      if (monkTargetEntityId !== null) {
        const monkTargetPosition = world.getComponent<Position>(monkTargetEntityId, 'position');
        if (monkTargetPosition) {
          return issueMonkContextCommandAtEntity(unitId, monkTargetEntityId, unit, monkTargetPosition);
        }
      }
      clearMonkTask(unitId);
      return issueUnitMoveCommand(unitId, target);
    }

    const resourceId =
      unit.unitType === 'villager' ? findResourceAtCell(target.x, target.y) : null;
    const ownedGarrisonBuildingId = findOwnedGarrisonBuildingAtCell(
      target.x,
      target.y,
      unit.owner,
      unit.unitType,
    );
    const hostileUnitId = findHostileUnitAtCell(target.x, target.y, unit.owner);
    const hostileBuildingId = findHostileBuildingAtCell(target.x, target.y, unit.owner);
    const hostileWildlifeId = findHostileWildlifeAtCell(target.x, target.y);

    if (ownedGarrisonBuildingId !== null) {
      return garrisonUnit(unitId, ownedGarrisonBuildingId);
    }
    if (hostileUnitId !== null) {
      return issueUnitAttackCommand(unitId, hostileUnitId, 'unit');
    }
    if (hostileBuildingId !== null) {
      return issueUnitAttackCommand(unitId, hostileBuildingId, 'building');
    }
    if (hostileWildlifeId !== null) {
      return issueUnitAttackCommand(unitId, hostileWildlifeId, 'resource');
    }
    if (resourceId === null) {
      return issueUnitMoveCommand(unitId, target);
    }
    if (!issueUnitGatherCommand(unitId, resourceId)) {
      return issueUnitMoveCommand(unitId, target);
    }
    return true;
  }

  function issueUnitContextCommandAtEntity(unitId: number, targetEntityId: number): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    const targetPosition = world.getComponent<Position>(targetEntityId, 'position');
    if (!unit || unit.owner !== humanPlayerId || !targetPosition) return false;

    if (unit.unitType === 'monk') {
      return issueMonkContextCommandAtEntity(unitId, targetEntityId, unit, targetPosition);
    }

    const targetUnit = world.getComponent<UnitComponent>(targetEntityId, 'unit');
    if (targetUnit && targetUnit.owner !== unit.owner) {
      return issueUnitAttackCommand(unitId, targetEntityId, 'unit');
    }

    const targetBuilding = world.getComponent<BuildingComponent>(targetEntityId, 'building');
    if (targetBuilding) {
      if (targetBuilding.owner !== unit.owner) {
        return issueUnitAttackCommand(unitId, targetEntityId, 'building');
      }

      const construction = constructionStates.get(targetEntityId);
      if (
        canGarrisonAt(targetBuilding.buildingType, unit.unitType)
        && (!construction || construction.isComplete)
      ) {
        return garrisonUnit(unitId, targetEntityId);
      }
    }

    const targetResource = world.getComponent<ResourceComponent>(targetEntityId, 'resource');
    const wildlife = wildlifeStates.get(targetEntityId);
    if (targetResource && wildlife?.isAlive) {
      return issueUnitAttackCommand(unitId, targetEntityId, 'resource');
    }

    if (unit.unitType === 'villager' && issueUnitGatherCommand(unitId, targetEntityId)) {
      return true;
    }

    return issueUnitMoveCommand(unitId, targetPosition);
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
    issueUnitMoveCommand,
    setUnitMoveCommandDirect,
    setUnitAttackCommandDirect,
    setUnitGatherCommandDirect,
    issueSheepMoveCommand,
    getSelectedOwnedSheepIds,
    issueUnitAttackCommand,
    getSelectedHumanUnitIds,
    getSelectedHumanVillagerIds,
    issueUnitContextCommand,
    issueUnitGatherCommand,
    issueUnitContextCommandAtEntity,
    selectEntityAtCell,
    selectEntityById,
    clearSelection,
  };
}
