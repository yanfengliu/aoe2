// Unit-transform + occupancy bookkeeping. The bridge owns
// `worldOccupancy`, the unit-transform components, and the world; these
// helpers wire them together so movement systems, scenario seeding, and
// the destroy/garrison paths share one occupancy-sync definition.

import type { Position, SubcellSlotOffset } from 'civ-engine';
import type { SyncUnitResult, WorldOccupancy } from '../worldOccupancy';
import type {
  BuildingComponent,
  ResourceComponent,
  TerrainComponent,
  UnitComponent,
  UnitTransformComponent,
} from '../types';
import {
  buildingFootprint,
  clampUnitTransformToMap,
  getUnitTargetTransformForCell,
  gridPositionFromUnitTransform,
  isAtTarget,
  isUnitTransformAtTarget,
  stepUnitTransformToward,
  type GameWorld,
} from './pureHelpers';
import { UNIT_SUBGRID_RESOLUTION, UNIT_SUBGRID_STEP_PER_TICK } from './pureHelpers';
import {
  constructionStatesCodec,
  playerCivilizationsCodec,
  researchedTechnologiesCodec,
} from './bridgeStateSerialize';
import {
  movementEntitlement,
  movementSpeedPercent,
  settleMovementCarry,
} from '../movementTechEffects';
import type { UnitAttackFeedRuntime } from './bridgeState';
import { markUnitAttackMovementStartedForEntity } from './unitAttackAnimationFeed';

type CivWorld = GameWorld;

// Spec §12.6 contract surface — worldOccupancy returns this and exposes
// `placeUnitForSpawn` / `getUnitSlotOffset` so spawn/movement layers consume
// the engine-allocated visual slot. Paths without live occupancy use the
// pureHelpers.
export interface TransformOpsDeps {
  world: GameWorld;
  mapWidth: number;
  mapHeight: number;
  worldOccupancy: WorldOccupancy;
  tiles: number[][];
  // Phase 2D: constructionStates migrated to world.state.aoe2.* via accessor.
  // The factory's other slot reads were already on the accessor side, so we
  // can drop the bridgeState dep entirely here.
  accessor: import('./bridgeStateAccessor').BridgeStateAccessor;
  unitAttackFeed: UnitAttackFeedRuntime;
  isBootstrappingScenario: () => boolean;
}

export interface TransformOps {
  getUnitTransform(id: number, activeWorld?: CivWorld): UnitTransformComponent | null;
  getUnitTargetTransformForPosition(id: number, position: Position): UnitTransformComponent;
  syncUnitTransformToPosition(
    id: number,
    position: Position,
    activeWorld?: CivWorld,
  ): void;
  moveUnitOneSubgridStep(
    id: number,
    target: Position,
    activeWorld?: CivWorld,
    stepUnits?: number,
    laneAxis?: import('./movementTrafficOps').MovementLaneAxis,
  ): Position | null;
  isUnitAtTarget(id: number, target: Position, activeWorld?: CivWorld): boolean;
  // Spec §12.7 lazy redirect: returns null if the unit found a free slot at
  // its arrival cell; returns a redirected cell when the unit is in overflow
  // and a free slot exists in a neighbor cell. Caller rewrites the move
  // command's target so movement does not re-aim at the original full target.
  resolveArrivalRedirect(unitId: number, arrivalCell: Position): Position | null;
  syncOccupancyForEntity(
    entity: number,
    activeWorld?: CivWorld,
    preferredUnitOffset?: SubcellSlotOffset,
  ): void;
  setPositionAndSyncOccupancy(
    entity: number,
    position: Position,
    activeWorld?: CivWorld,
  ): void;
  placeFreshSpawnUnit(entity: number, position: Position): Position | null;
  clearPositionAndSyncOccupancy(entity: number, activeWorld?: CivWorld): void;
  syncSpawnedEntityOccupancy(entity: number): void;
  rebuildWorldOccupancyFromWorld(): void;
}

export function createTransformOps(deps: TransformOpsDeps): TransformOps {
  const {
    world,
    mapWidth,
    mapHeight,
    worldOccupancy,
    tiles,
    accessor,
    unitAttackFeed,
    isBootstrappingScenario,
  } = deps;

  function getUnitTransform(
    id: number,
    activeWorld: CivWorld = world,
  ): UnitTransformComponent | null {
    return activeWorld.getComponent<UnitTransformComponent>(id, 'unitTransform') ?? null;
  }

  function getUnitTargetTransformForPosition(
    id: number,
    position: Position,
  ): UnitTransformComponent {
    return getUnitTargetTransformForCell(
      id,
      position,
      worldOccupancy.getUnitSlotOffset(id),
    );
  }

  function syncUnitTransformToPosition(
    id: number,
    position: Position,
    activeWorld: CivWorld = world,
  ): void {
    const transform = getUnitTransform(id, activeWorld);
    if (!transform) return;

    // Spec §12.6 visual non-overlap: snap to the engine-allocated slot
    // offset when one is available, otherwise fall back to the entity-id-
    // derived offset (early bootstrap, overflowed units, fixtures without
    // a worldOccupancy attached). Callers reach this from spawn-time and
    // move-arrival sites — both are stationary moments where snapping the
    // transform to the allocated slot produces visual non-overlap. This is
    // intentionally NOT called from `syncOccupancyForEntity` because that
    // path fires on every cell crossing during movement and snapping there
    // would teleport mid-flight sprites.
    const targetTransform = getUnitTargetTransformForPosition(id, position);
    const moved = transform.fineX !== targetTransform.fineX
      || transform.fineY !== targetTransform.fineY;
    activeWorld.setComponent(id, 'unitTransform', {
      ...transform,
      fineX: targetTransform.fineX,
      fineY: targetTransform.fineY,
    });
    if (moved) markUnitAttackMovementStartedForEntity(unitAttackFeed, id, activeWorld);
  }

  function syncOccupancyForEntity(
    entity: number,
    activeWorld: CivWorld = world,
    preferredUnitOffset?: SubcellSlotOffset,
  ): void {
    const position = activeWorld.getComponent<Position>(entity, 'position');
    if (!position) {
      worldOccupancy.release(entity);
      return;
    }

    const building = activeWorld.getComponent<BuildingComponent>(entity, 'building');
    if (building) {
      const construction = accessor.get(constructionStatesCodec).get(entity);
      const footprint = construction ?? buildingFootprint(building.buildingType);
      worldOccupancy.syncBuilding(entity, position, footprint);
      return;
    }

    if (activeWorld.getComponent<ResourceComponent>(entity, 'resource')) {
      worldOccupancy.syncResource(entity, position);
      return;
    }

    if (activeWorld.getComponent<UnitComponent>(entity, 'unit')) {
      // Spec §12.6: syncUnit allocates a sub-tile slot via the engine's
      // SubcellOccupancyGrid. The transform is NOT snapped here because
      // this path runs every tick during movement (cell crossings) and
      // snapping fineX/fineY mid-flight would teleport the unit. The slot
      // offset is consumed lazily — `moveUnitOneSubgridStep` reads it via
      // `getUnitSlotOffset` so the unit aims at the allocated slot in its
      // target cell, and `placeFreshSpawnUnit` / `syncSpawnedEntityOccupancy`
      // do snap once at spawn time.
      const placement = worldOccupancy.syncUnit(entity, position, preferredUnitOffset);
      recordUnitPlacement(entity, placement, activeWorld);
      return;
    }

    worldOccupancy.release(entity);
  }

  function recordUnitPlacement(
    entity: number,
    placement: SyncUnitResult,
    activeWorld: CivWorld,
  ): void {
    const transform = getUnitTransform(entity, activeWorld);
    if (transform && placement.slotOffset) {
      if (
        transform.occupancySlotX !== placement.slotOffset.x
        || transform.occupancySlotY !== placement.slotOffset.y
        || transform.occupancySlotOverflow === true
      ) {
        const assignedTransform = {
          ...transform,
          occupancySlotX: placement.slotOffset.x,
          occupancySlotY: placement.slotOffset.y,
        };
        delete assignedTransform.occupancySlotOverflow;
        activeWorld.setComponent(entity, 'unitTransform', assignedTransform);
      }
    } else if (
      transform
      && (
        transform.occupancySlotX !== undefined
        || transform.occupancySlotY !== undefined
        || transform.occupancySlotOverflow !== true
      )
    ) {
      const withoutSlot = { ...transform, occupancySlotOverflow: true as const };
      delete withoutSlot.occupancySlotX;
      delete withoutSlot.occupancySlotY;
      activeWorld.setComponent(entity, 'unitTransform', withoutSlot);
    }
  }

  function setPositionAndSyncOccupancy(
    entity: number,
    position: Position,
    activeWorld: CivWorld = world,
  ): void {
    activeWorld.setPosition(entity, position);
    syncOccupancyForEntity(entity, activeWorld);
  }

  function placeFreshSpawnUnit(
    entity: number,
    position: Position,
  ): Position | null {
    const placement = worldOccupancy.placeUnitForSpawn(entity, position);
    if (!placement) return null;
    world.setPosition(entity, placement.placedAt);
    recordUnitPlacement(entity, placement, world);
    syncUnitTransformToPosition(entity, placement.placedAt);
    return placement.placedAt;
  }

  function clearPositionAndSyncOccupancy(
    entity: number,
    activeWorld: CivWorld = world,
  ): void {
    markUnitAttackMovementStartedForEntity(unitAttackFeed, entity, activeWorld);
    worldOccupancy.release(entity);
    activeWorld.removeComponent(entity, 'position');
  }

  function syncSpawnedEntityOccupancy(entity: number): void {
    const syncSpawn = (): void => {
      syncOccupancyForEntity(entity);
      const position = world.getComponent<Position>(entity, 'position');
      if (position) {
        syncUnitTransformToPosition(entity, position);
      }
    };
    if (!isBootstrappingScenario()) {
      syncSpawn();
      return;
    }
    try {
      syncSpawn();
    } catch (err) {
      // Fresh-scenario validation owns the user-facing error for invalid
      // fixture spawns; suppress so the seed-named throw stays primary.
      // V4-15: log so unexpected errors surface in dev instead of being
      // silently swallowed under the bootstrap-mode umbrella.
      if (typeof console !== 'undefined') {
        console.warn('syncSpawnedEntityOccupancy suppressed during bootstrap', err);
      }
    }
  }

  function moveUnitOneSubgridStep(
    id: number,
    target: Position,
    activeWorld: CivWorld = world,
    stepUnits?: number,
    laneAxis?: import('./movementTrafficOps').MovementLaneAxis,
  ): Position | null {
    const transform = getUnitTransform(id, activeWorld);
    if (!transform) return null;

    // Movement-speed model (spec §12.5): an explicitly-passed stepUnits (the
    // sheep site) bypasses the model; every other mover derives its per-tick
    // grant from its owner's techs + civ via the per-unit carry accumulator
    // (movementTechEffects). The carry banks whatever a waypoint/map clamp
    // doesn't let through — legs are per-CELL, so a stateless surge loses its
    // extra step to the leg clamp. The 100-percent path never touches the
    // carry: byte-identical to the pre-speed-model behavior.
    let resolvedStepUnits = stepUnits ?? UNIT_SUBGRID_STEP_PER_TICK;
    let entitledHundredths: number | null = null;
    if (stepUnits === undefined) {
      const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
      const researched = unit
        ? accessor.get(researchedTechnologiesCodec).get(unit.owner)
        : undefined;
      const speedPercent = unit && researched
        ? movementSpeedPercent(researched, unit.unitType,
            accessor.get(playerCivilizationsCodec).get(unit.owner))
        : 100;
      if (speedPercent !== 100) {
        const entitlement = movementEntitlement(
          transform.moveCarryHundredths ?? 0,
          UNIT_SUBGRID_STEP_PER_TICK,
          speedPercent,
        );
        resolvedStepUnits = entitlement.grantedSteps;
        entitledHundredths = entitlement.entitledHundredths;
      }
    }

    const targetTransform = laneAxis
      ? getUnitTargetTransformForCell(id, target, { x: 0.5, y: 0.5 })
      : getUnitTargetTransformForPosition(id, target);
    const alignTarget = laneAxis === 'horizontal'
      ? { ...transform, fineY: targetTransform.fineY }
      : laneAxis === 'vertical'
        ? { ...transform, fineX: targetTransform.fineX }
        : targetTransform;
    const needsLaneAlignment = alignTarget.fineX !== transform.fineX
      || alignTarget.fineY !== transform.fineY;
    const stepped = stepUnitTransformToward(
      transform,
      needsLaneAlignment ? alignTarget : targetTransform,
      resolvedStepUnits,
    );
    const nextTransform = clampUnitTransformToMap(stepped, activeWorld.grid);
    const moved = nextTransform.fineX !== transform.fineX
      || nextTransform.fineY !== transform.fineY;
    let nextMoveCarryHundredths = transform.moveCarryHundredths;
    if (entitledHundredths !== null) {
      // Settle on ACTUAL movement (pre-assignment deltas) so a clamped step
      // banks its shortfall instead of losing it.
      const movedSteps = Math.abs(nextTransform.fineX - transform.fineX)
        + Math.abs(nextTransform.fineY - transform.fineY);
      nextMoveCarryHundredths = settleMovementCarry(entitledHundredths, movedSteps);
    }
    activeWorld.setComponent(id, 'unitTransform', {
      ...transform,
      fineX: nextTransform.fineX,
      fineY: nextTransform.fineY,
      ...(nextMoveCarryHundredths === undefined
        ? {}
        : { moveCarryHundredths: nextMoveCarryHundredths }),
    });
    if (moved) markUnitAttackMovementStartedForEntity(unitAttackFeed, id, activeWorld);

    const nextGridPosition = gridPositionFromUnitTransform(nextTransform, activeWorld.grid);
    const currentGridPosition = activeWorld.getComponent<Position>(id, 'position');
    if (
      !currentGridPosition
      || currentGridPosition.x !== nextGridPosition.x
      || currentGridPosition.y !== nextGridPosition.y
    ) {
      setPositionAndSyncOccupancy(id, nextGridPosition, activeWorld);
    }

    return nextGridPosition;
  }

  function isUnitAtTarget(
    id: number,
    target: Position,
    activeWorld: CivWorld = world,
  ): boolean {
    const transform = getUnitTransform(id, activeWorld);
    if (!transform) {
      const position = activeWorld.getComponent<Position>(id, 'position');
      return position ? isAtTarget(position, target) : false;
    }

    return isUnitTransformAtTarget(
      transform,
      id,
      target,
      worldOccupancy.getUnitSlotOffset(id),
    );
  }

  function resolveArrivalRedirect(unitId: number, arrivalCell: Position): Position | null {
    // No redirect when the unit holds a slot at the arrival cell.
    if (worldOccupancy.getUnitSlotOffset(unitId) !== null) {
      return null;
    }
    const freeCell = worldOccupancy.findNearestFreeUnitCell(unitId, arrivalCell);
    if (!freeCell) {
      return null;
    }
    if (freeCell.x === arrivalCell.x && freeCell.y === arrivalCell.y) {
      // The arrival cell itself reports free for this entity (the entity is
      // currently in overflow there). Rebind now, but return the same target
      // so the command stays active until the fine root converges on the new
      // slot at the normal movement bound; the arrival path must not snap.
      syncOccupancyForEntity(unitId);
      return { ...arrivalCell };
    }
    return freeCell;
  }

  function rebuildWorldOccupancyFromWorld(): void {
    worldOccupancy.reset();

    const blockedTerrainCells: Position[] = [];
    for (let y = 0; y < mapHeight; y += 1) {
      for (let x = 0; x < mapWidth; x += 1) {
        const tile = tiles[y]?.[x];
        const terrain = tile === undefined ? null : world.getComponent<TerrainComponent>(tile, 'terrain');
        if (!terrain || (terrain.kind !== 'water' && terrain.kind !== 'forest')) {
          continue;
        }
        blockedTerrainCells.push({ x, y });
      }
    }
    worldOccupancy.blockTerrain(blockedTerrainCells);

    for (const entity of world.query('position', 'building')) {
      syncOccupancyForEntity(entity);
    }
    for (const entity of world.query('position', 'resource')) {
      syncOccupancyForEntity(entity);
    }
    const unitEntities = [...world.query('position', 'unit')];
    const savedSlotFor = (entity: number): SubcellSlotOffset | null => {
      const position = world.getComponent<Position>(entity, 'position');
      const transform = getUnitTransform(entity);
      const hasSavedSlot = transform
        && Number.isFinite(transform.occupancySlotX)
        && Number.isFinite(transform.occupancySlotY);
      return position && hasSavedSlot
        ? { x: transform.occupancySlotX!, y: transform.occupancySlotY! }
        : null;
    };

    // Restore every authoritative numeric assignment before legacy or
    // explicit-overflow units. Otherwise entity-id query order can promote a
    // low-id overflow unit and displace a peer that owned the slot at save.
    for (const entity of unitEntities) {
      const savedSlot = savedSlotFor(entity);
      if (savedSlot) syncOccupancyForEntity(entity, world, savedSlot);
    }
    for (const entity of unitEntities) {
      const position = world.getComponent<Position>(entity, 'position');
      const transform = getUnitTransform(entity);
      if (savedSlotFor(entity) || transform?.occupancySlotOverflow === true) continue;
      const legacyOffset = position && transform
        ? {
            x: transform.fineX / UNIT_SUBGRID_RESOLUTION - position.x,
            y: transform.fineY / UNIT_SUBGRID_RESOLUTION - position.y,
          }
        : undefined;

      // Current saves persist the assigned slot separately because a moving
      // fine root may not have reached it yet. Legacy schema-v2 saves lack
      // that additive datum, so use their serialized root as the closest safe
      // one-time preference. Rebuild never snaps fineX/fineY: live loads and
      // replay materialization both preserve the serialized presentation root.
      syncOccupancyForEntity(entity, world, legacyOffset);
    }
    for (const entity of unitEntities) {
      const transform = getUnitTransform(entity);
      if (transform?.occupancySlotOverflow === true) {
        const position = world.getComponent<Position>(entity, 'position');
        if (position) {
          // Recreate the authoritative no-slot claim exactly. Normal sync is
          // intentionally not used: a peer may have freed a slot after this
          // unit overflowed, but load/replay cannot promote it earlier than
          // uninterrupted play would.
          worldOccupancy.syncUnit(entity, position, undefined, true);
        }
      }
    }
  }

  return {
    getUnitTransform,
    getUnitTargetTransformForPosition,
    syncUnitTransformToPosition,
    moveUnitOneSubgridStep,
    isUnitAtTarget,
    resolveArrivalRedirect,
    syncOccupancyForEntity,
    setPositionAndSyncOccupancy,
    placeFreshSpawnUnit,
    clearPositionAndSyncOccupancy,
    syncSpawnedEntityOccupancy,
    rebuildWorldOccupancyFromWorld,
  };
}
