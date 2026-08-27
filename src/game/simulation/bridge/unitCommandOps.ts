// Per-unit command issuance + entity-selection ops. The wrappers translate
// player intent into a `unitCommands` entry: move, sheep-move, attack,
// context (which dispatches into garrison / attack / gather / move based on
// what's at the target cell), gather, and a shared selectEntity{AtCell,
// ById}/clearSelection trio. Each closes over the bridge state holder so
// reads/writes go through the same shared selection refs.

import { isMonasticUnit } from '../monasticUnits';
import type { EntityRef, Position } from 'civ-engine';
import { createContextRouter } from './contextRouter';
import type {
  BuildingComponent,
  ResourceComponent,
  UnitComponent,
  UnitType, EconomyResourceKind,
} from '../types';
import { clamp, type GameWorld } from './pureHelpers';
import { createBuildRepairCommandOps } from './buildRepairCommandOps';
import { createGarrisonOrderOps } from './garrisonOrderOps';
import { createTradeRouteOrder } from './tradeRouteOrderOps';
import { createContextAtEntityRouter } from './contextAtEntityRouter';
import type { MonkTask, UnitCommand } from './sharedTypes';
import type { BridgeState } from './bridgeState';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  monkTasksCodec,
  wildlifeStatesCodec,
  unitCommandsCodec,
} from './bridgeStateSerialize';
import { createGatherCommandOps } from './gatherCommandOps';
import { createPatrolCommandOps } from './patrolCommandOps';
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
  // Transport Ship loading and unloading, both routed from the ordinary
  // right-click (see contextRouter).
  findOwnedTransportAtCell: (x: number, y: number, owner: number) => number | null;
  boardTransport: (unitId: number, transportId: number) => boolean;
  unloadTransport: (transportId: number, target: Position) => boolean;
  isLandCell: (x: number, y: number) => boolean;
  isHarvestableResource: (id: number, resource: ResourceComponent) => boolean;
  findNearestDropOffBuilding: (
    activeWorld: GameWorld,
    owner: number,
    resource: EconomyResourceKind,
    position: Position,
  ) => number | null;
  clearGathererOrder: (id: number) => void;
  clearUnitCommand: (id: number) => void;
  setUnitCommand: (unitId: number, command: UnitCommand) => void;
  getEntityRef: (id: number) => EntityRef | null;
  getBuildOptions: (
    owner: number,
    unitType: UnitType,
  ) => readonly import('../types').BuildableBuildingType[];
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
  appendMoveWaypointDirect(unitId: number, target: Position): boolean;
  setUnitAttackMoveCommandDirect(unitId: number, target: Position): boolean;
  setUnitAttackGroundCommandDirect(unitId: number, target: Position): boolean;
  issueUnitAttackMoveCommand(unitId: number, target: Position): boolean;
  issueUnitPatrolCommand(unitId: number, target: Position): boolean;
  setUnitPatrolCommandDirect(unitId: number, target: Position): boolean;
  clearPatrolRoute(unitId: number): void;
  resumePatrolLeg(unitId: number, target: Position): boolean;
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
  routeUnitContextCommandDirect(unitId: number, target: Position, allowGarrison: boolean): boolean;
  /** Walk-then-enter garrison order (v0.3.115 town bell reuses it). */
  orderGarrison(unitId: number, buildingId: number): boolean;
  // Phase 1B unit.contextAtEntity: routing helper by entity id.
  routeUnitContextAtEntityCommandDirect(unitId: number, targetEntityId: number, allowGarrison: boolean): boolean;
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
  issueUnitContextCommand(unitId: number, target: Position, garrison?: boolean): boolean;
  issueUnitGatherCommand(unitId: number, resourceId: number): boolean;
  issueUnitContextCommandAtEntity(unitId: number, targetEntityId: number, garrison?: boolean): boolean;
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
    findOwnedTransportAtCell,
    boardTransport,
    unloadTransport,
    isLandCell,
    isHarvestableResource,
    findNearestDropOffBuilding,
    clearGathererOrder,
    clearUnitCommand,
    setUnitCommand,
    getEntityRef,
    getBuildOptions,
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
    getBuildOptions,
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
  function setWalkCommandDirect(
    unitId: number,
    target: Position,
    type: 'move' | 'attack-move' | 'attack-ground',
    { keepPatrol = false }: { keepPatrol?: boolean } = {},
  ): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit) return false;

    // Any order the PLAYER gives ends a patrol. The patrol system re-issues
    // its own walks with keepPatrol, so the route survives its own legs.
    if (!keepPatrol) clearPatrolRoute(unitId);
    clearGathererOrder(unitId);
    const monkTasks = accessor.get(monkTasksCodec);
    if (monkTasks.delete(unitId)) {
      accessor.markDirty(monkTasksCodec);
    }
    setUnitCommand(unitId, {
      type,
      target: {
        x: clamp(target.x, 0, mapWidth - 1),
        y: clamp(target.y, 0, mapHeight - 1),
      },
    });
    return true;
  }

  function setUnitMoveCommandDirect(unitId: number, target: Position): boolean {
    return setWalkCommandDirect(unitId, target, 'move');
  }

  // Shift-queue (v0.3.125): append a waypoint to a STANDING move. Capped so a
  // click storm cannot grow an unbounded save field.
  function appendMoveWaypointDirect(unitId: number, target: Position): boolean {
    const command = accessor.get(unitCommandsCodec).get(unitId);
    if (command?.type !== 'move') return false;
    const queued = command.queuedTargets ?? [];
    if (queued.length < 8) {
      command.queuedTargets = [...queued, { x: target.x, y: target.y }];
      accessor.markDirty(unitCommandsCodec);
    }
    return true;
  }

  // M6 control: identical walk, different order type — auto-aggression reads
  // the type and engages regardless of stance while it is active.
  function setUnitAttackMoveCommandDirect(unitId: number, target: Position): boolean {
    return setWalkCommandDirect(unitId, target, 'attack-move');
  }

  // Attack-ground (v0.3.117): same walk toward the cell; the executor stops
  // at firing range and bombards instead of arriving.
  function setUnitAttackGroundCommandDirect(unitId: number, target: Position): boolean {
    return setWalkCommandDirect(unitId, target, 'attack-ground');
  }

  const {
    clearPatrolRoute,
    setUnitPatrolCommandDirect,
    resumePatrolLeg,
    issueUnitPatrolCommand,
  } = createPatrolCommandOps({
    world,
    accessor,
    mapWidth,
    mapHeight,
    setWalkCommandDirect,
    submitPatrol: (unitId, target) => (
      world.submitWithResult('unit.patrol', { unitId, target }).accepted
    ),
  });

  function issueUnitAttackMoveCommand(unitId: number, target: Position): boolean {
    return world.submitWithResult('unit.attackMove', { unitId, target }).accepted;
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
    if (!unit || isMonasticUnit(unit.unitType) || !targetPosition) return false;

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
  const { setUnitGatherCommandDirect, issueUnitGatherCommand } = createGatherCommandOps({
    world,
    isHarvestableResource,
    clearGathererOrder,
    clearUnitCommand,
    findNearestDropOffBuilding,
  });

  const { orderGarrison } = createGarrisonOrderOps({
    world,
    garrisonUnit,
    getEntityRef,
    clearGathererOrder,
    setUnitCommand,
  });

  // Right-click routing lives in contextRouter.ts (extracted for the LOC budget).
  const routeUnitContextCommandDirect = createContextRouter({
    world,
    findResourceAtCell,
    findOwnedGarrisonBuildingAtCell,
    findHostileUnitAtCell,
    findHostileBuildingAtCell,
    findHostileWildlifeAtCell,
    orderGarrison,
    findOwnedTransportAtCell,
    boardTransport,
    unloadTransport,
    isLandCell,
    setUnitAttackCommandDirect,
    setUnitGatherCommandDirect,
    setUnitMoveCommandDirect,
  });

  // Bridge facade. HUD context-click. Monk path delegates to
  // `issueMonkContextCommandAtEntity` which submits `monk.contextAtEntity`;
  // the move-fallback (no monk-context target at the cell) clears any
  // existing task and submits `unit.move` via the commandified facade.
  // Non-monk path submits `unit.context` for handler-side routing.
  function issueUnitContextCommand(unitId: number, target: Position, garrison = false): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit || unit.owner !== humanPlayerId) return false;

    if (isMonasticUnit(unit.unitType)) {
      const monkTargetEntityId = findMonkContextTargetAtCell(target.x, target.y, unit.owner);
      if (monkTargetEntityId !== null) {
        return issueMonkContextCommandAtEntity(unitId, monkTargetEntityId);
      }
      clearMonkTask(unitId);
      return issueUnitMoveCommand(unitId, target);
    }

    const result = world.submitWithResult('unit.context', { unitId, target, garrison });
    return result.accepted;
  }

  // Multi-villager construction (0.1.17). Queues a `build` command for
  // a villager onto an existing in-progress own-team building. Returns
  // false on any precondition miss (non-villager, foreign owner, building
  // missing or already complete) so the caller can fall through.
  const buildRepairOps = createBuildRepairCommandOps({
    world,
    accessor,
    getEntityRef,
    clearGathererOrder,
    setUnitCommand,
  });

  // Direct-mutation routing helper. Used by the unit.contextAtEntity
  // handler. Monk routing is hoisted to the bridge facade.
  // A trade route is an order on the CART, stored as its unit command; the
  // far Market must be another player's, standing, and complete.
  const orderTradeRoute = createTradeRouteOrder({ world, accessor, clearGathererOrder, setUnitCommand, getEntityRef });

  const routeUnitContextAtEntityCommandDirect = createContextAtEntityRouter({
    world,
    accessor,
    setUnitAttackCommandDirect,
    setUnitBuildCommandDirect: buildRepairOps.setUnitBuildCommandDirect,
    tryRepairCharge: buildRepairOps.tryRepairCharge,
    tryRepairUnitCharge: buildRepairOps.tryRepairUnitCharge,
    orderGarrison,
    setUnitGatherCommandDirect,
    setUnitMoveCommandDirect,
    orderTradeRoute,
  });

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
  function issueUnitContextCommandAtEntity(unitId: number, targetEntityId: number, garrison = false, forceAttack = false, queue = false): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    const targetPosition = world.getComponent<Position>(targetEntityId, 'position');
    if (!unit || unit.owner !== humanPlayerId || !targetPosition) return false;

    if (isMonasticUnit(unit.unitType)) {
      return issueMonkContextCommandAtEntity(unitId, targetEntityId);
    }

    // Always explicit on the live path (§9.3); only a pre-rule RECORDING omits
    // `garrison`, which the handler reads as legacy.
    const result = world.submitWithResult('unit.contextAtEntity', { unitId, targetEntityId, garrison, forceAttack, queue });
    return result.accepted;
  }

  return {
    ...selectionOps,
    ...sheepOps,
    orderGarrison,
    appendMoveWaypointDirect,
    issueUnitMoveCommand,
    setUnitMoveCommandDirect,
    setUnitAttackCommandDirect,
    setUnitGatherCommandDirect,
    setUnitBuildCommandDirect: buildRepairOps.setUnitBuildCommandDirect,
    routeUnitContextCommandDirect,
    routeUnitContextAtEntityCommandDirect,
    routeMonkContextAtEntityCommandDirect,
    issueUnitAttackCommand,
    issueUnitContextCommand,
    issueUnitGatherCommand,
    issueUnitAttackMoveCommand,
    setUnitAttackMoveCommandDirect,
    setUnitAttackGroundCommandDirect,
    issueUnitPatrolCommand,
    setUnitPatrolCommandDirect,
    clearPatrolRoute,
    resumePatrolLeg,
    issueUnitContextCommandAtEntity,
  };
}
