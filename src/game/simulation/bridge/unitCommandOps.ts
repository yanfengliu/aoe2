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
import type { MonkTask } from './sharedTypes';
import { clamp, type GameWorld } from './pureHelpers';
import { canGarrisonAt } from '../prototypeBuildingRules';
import { resourceKindToEconomyResource } from '../prototypeEconomyRules';
import type { UnitCommand } from './sharedTypes';
import type { BridgeState } from './bridgeState';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  constructionStatesCodec,
  monkTasksCodec,
  wildlifeStatesCodec,
} from './bridgeStateSerialize';
import { createSheepCommandOps, type SheepCommandOps } from './sheepCommandOps';
import { createUnitSelectionOps, type UnitSelectionOps } from './unitSelectionOps';
import {
  createMonkContextOps,
  type MonkContextRouteOptions,
} from './monkContextOps';

export interface UnitCommandOpsDeps {
  world: GameWorld;
  humanPlayerId: number;
  mapWidth: number;
  mapHeight: number;
  state: BridgeState;
  // Phase 2D: sheepMoveOrders migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
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
  issueMonkContextCommandAtEntity: (monkId: number, targetEntityId: number) => boolean;
  clearMonkTask: (monkId: number) => void;
  // Phase 1B (DESIGN v17 §6.4): used by routeMonkContextAtEntityCommandDirect
  // (the direct-mutation routing helper backing the `monk.contextAtEntity`
  // handler).
  setMonkTask: (monkId: number, kind: MonkTask['kind'], targetEntityRef: EntityRef) => boolean;
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

export interface UnitCommandOps extends SheepCommandOps, UnitSelectionOps {
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
  // (unit guard, clearGathererOrder, guarded monkTasksCodec clear, target clamp,
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
  // Multi-villager construction (0.1.17): direct-mutation helper that
  // queues a `build` command at an existing in-progress own-team
  // building. Used by the in-progress branch of
  // routeUnitContextAtEntityCommandDirect so additional villagers can
  // join a half-built site via right-click.
  setUnitBuildCommandDirect(unitId: number, buildingId: number): boolean;
  // Phase 1B unit.context: routing helper. Reads world state to dispatch
  // to garrison/attack/gather/move via the direct helpers. Used by the
  // unit.context handler so live + replay execute identical routing.
  // Bridge facade dispatches monk routing BEFORE submission; this helper
  // is non-monk only.
  routeUnitContextCommandDirect(unitId: number, target: Position): boolean;
  // Phase 1B unit.contextAtEntity: routing helper by entity id.
  routeUnitContextAtEntityCommandDirect(unitId: number, targetEntityId: number): boolean;
  // Phase 1B monk.contextAtEntity: reads monk + target afresh, then routes to
  // setMonkTask or move-fallback. Kept here to avoid a monkTaskOps wiring cycle.
  routeMonkContextAtEntityCommandDirect(
    monkId: number,
    targetEntityId: number,
    options?: MonkContextRouteOptions,
  ): boolean;
  issueUnitAttackCommand(
    unitId: number,
    targetEntityId: number,
    targetEntityKind: 'unit' | 'building' | 'resource',
  ): boolean;
  issueUnitContextCommand(unitId: number, target: Position): boolean;
  issueUnitGatherCommand(unitId: number, resourceId: number): boolean;
  issueUnitContextCommandAtEntity(unitId: number, targetEntityId: number): boolean;
}

export function createUnitCommandOps(deps: UnitCommandOpsDeps): UnitCommandOps {
  const {
    world,
    humanPlayerId,
    mapWidth,
    mapHeight,
    accessor,
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
    setMonkTask,
    garrisonUnit,
    isHarvestableResource,
    findNearestDropOffBuilding,
    clearGathererOrder,
    clearUnitCommand,
    setUnitCommand,
    getEntityRef,
  } = deps;
  const selectionOps = createUnitSelectionOps({
    world,
    humanPlayerId,
    selection,
    placementMode,
    isMatchRunning,
    isEntityVisibleToHuman,
    getSelectedEntityIds,
    getSelectableEntitiesAtCell,
    getEntityRef,
  });
  const sheepOps = createSheepCommandOps({
    world,
    humanPlayerId,
    mapWidth,
    mapHeight,
    accessor,
  });

  // Direct-mutation helper. Same body as the pre-Phase-1B `issueUnitMoveCommand`.
  // Used by deterministic-resolution systems and by the `unit.move` handler.
  function setUnitMoveCommandDirect(unitId: number, target: Position): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit) return false;

    clearGathererOrder(unitId);
    const monkTasks = accessor.get(monkTasksCodec);
    if (monkTasks.delete(unitId)) {
      accessor.markDirty(monkTasksCodec);
    }
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
      const wildlife = accessor.get(wildlifeStatesCodec).get(targetEntityId);
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

  // Direct-mutation routing helper. Reads world state to dispatch to
  // garrison / attack / gather / move via the corresponding direct
  // helpers. Used by the `unit.context` handler so live + replay paths
  // execute identical routing logic against identical world state.
  function routeUnitContextCommandDirect(unitId: number, target: Position): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit) return false;
    // Monk routing is handled by the bridge facade BEFORE submission
    // (HUD-side fast path). The validator rejects monk units so this
    // branch only runs for non-monks.

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
      return setUnitAttackCommandDirect(unitId, hostileUnitId, 'unit');
    }
    if (hostileBuildingId !== null) {
      return setUnitAttackCommandDirect(unitId, hostileBuildingId, 'building');
    }
    if (hostileWildlifeId !== null) {
      return setUnitAttackCommandDirect(unitId, hostileWildlifeId, 'resource');
    }
    if (resourceId === null) {
      return setUnitMoveCommandDirect(unitId, target);
    }
    if (!setUnitGatherCommandDirect(unitId, resourceId)) {
      return setUnitMoveCommandDirect(unitId, target);
    }
    return true;
  }

  // Bridge facade. HUD context-click. Monk path delegates to
  // `issueMonkContextCommandAtEntity` which submits `monk.contextAtEntity`;
  // the move-fallback (no monk-context target at the cell) clears any
  // existing task and submits `unit.move` via the commandified facade.
  // Non-monk path submits `unit.context` for handler-side routing.
  function issueUnitContextCommand(unitId: number, target: Position): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit || unit.owner !== humanPlayerId) return false;

    if (unit.unitType === 'monk') {
      const monkTargetEntityId = findMonkContextTargetAtCell(target.x, target.y, unit.owner);
      if (monkTargetEntityId !== null) {
        return issueMonkContextCommandAtEntity(unitId, monkTargetEntityId);
      }
      clearMonkTask(unitId);
      return issueUnitMoveCommand(unitId, target);
    }

    const result = world.submitWithResult('unit.context', { unitId, target });
    return result.accepted;
  }

  // Multi-villager construction (0.1.17). Queues a `build` command for
  // a villager onto an existing in-progress own-team building. Returns
  // false on any precondition miss (non-villager, foreign owner, building
  // missing or already complete) so the caller can fall through.
  function setUnitBuildCommandDirect(unitId: number, buildingId: number): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit || unit.unitType !== 'villager') return false;
    const buildingPosition = world.getComponent<Position>(buildingId, 'position');
    const targetBuilding = world.getComponent<BuildingComponent>(buildingId, 'building');
    if (!buildingPosition || !targetBuilding || targetBuilding.owner !== unit.owner) return false;
    const construction = accessor.get(constructionStatesCodec).get(buildingId);
    if (!construction || construction.isComplete) return false;
    const buildingRef = getEntityRef(buildingId);
    if (!buildingRef) return false;
    clearGathererOrder(unitId);
    setUnitCommand(unitId, {
      type: 'build',
      target: { x: buildingPosition.x, y: buildingPosition.y },
      buildingRef,
    });
    return true;
  }

  // Direct-mutation routing helper. Used by the unit.contextAtEntity
  // handler. Monk routing is hoisted to the bridge facade.
  function routeUnitContextAtEntityCommandDirect(unitId: number, targetEntityId: number): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    const targetPosition = world.getComponent<Position>(targetEntityId, 'position');
    if (!unit || !targetPosition) return false;

    const targetUnit = world.getComponent<UnitComponent>(targetEntityId, 'unit');
    if (targetUnit && targetUnit.owner !== unit.owner) {
      return setUnitAttackCommandDirect(unitId, targetEntityId, 'unit');
    }

    const targetBuilding = world.getComponent<BuildingComponent>(targetEntityId, 'building');
    if (targetBuilding) {
      if (targetBuilding.owner !== unit.owner) {
        return setUnitAttackCommandDirect(unitId, targetEntityId, 'building');
      }

      const construction = accessor.get(constructionStatesCodec).get(targetEntityId);
      if (
        construction
        && !construction.isComplete
        && unit.unitType === 'villager'
        && setUnitBuildCommandDirect(unitId, targetEntityId)
      ) {
        return true;
      }

      if (
        canGarrisonAt(targetBuilding.buildingType, unit.unitType)
        && (!construction || construction.isComplete)
      ) {
        return garrisonUnit(unitId, targetEntityId);
      }
    }

    const targetResource = world.getComponent<ResourceComponent>(targetEntityId, 'resource');
    const wildlife = accessor.get(wildlifeStatesCodec).get(targetEntityId);
    if (targetResource && wildlife?.isAlive) {
      return setUnitAttackCommandDirect(unitId, targetEntityId, 'resource');
    }

    if (unit.unitType === 'villager' && setUnitGatherCommandDirect(unitId, targetEntityId)) {
      return true;
    }

    return setUnitMoveCommandDirect(unitId, targetPosition);
  }

  const monkContextOps = createMonkContextOps({
    world,
    accessor,
    setMonkTask,
    getEntityRef,
    setUnitMoveCommandDirect,
  });
  const { routeMonkContextAtEntityCommandDirect } = monkContextOps;

  // Bridge facade. Monk path submits `monk.contextAtEntity` (handler
  // re-routes via `routeMonkContextAtEntityCommandDirect`). Non-monk path
  // submits `unit.contextAtEntity`.
  function issueUnitContextCommandAtEntity(unitId: number, targetEntityId: number): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    const targetPosition = world.getComponent<Position>(targetEntityId, 'position');
    if (!unit || unit.owner !== humanPlayerId || !targetPosition) return false;

    if (unit.unitType === 'monk') {
      return issueMonkContextCommandAtEntity(unitId, targetEntityId);
    }

    const result = world.submitWithResult('unit.contextAtEntity', { unitId, targetEntityId });
    return result.accepted;
  }

  return {
    ...selectionOps,
    ...sheepOps,
    issueUnitMoveCommand,
    setUnitMoveCommandDirect,
    setUnitAttackCommandDirect,
    setUnitGatherCommandDirect,
    setUnitBuildCommandDirect,
    routeUnitContextCommandDirect,
    routeUnitContextAtEntityCommandDirect,
    routeMonkContextAtEntityCommandDirect,
    issueUnitAttackCommand,
    issueUnitContextCommand,
    issueUnitGatherCommand,
    issueUnitContextCommandAtEntity,
  };
}
