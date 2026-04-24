import {
  VisibilityMap,
  World,
  type Position,
  type RenderProjector,
} from 'civ-engine';

import { MAP_HEIGHT, MAP_WIDTH } from '../prototypeScenario';
import { resourceTint } from '../prototypeEconomyRules';
import {
  distanceSquared,
  isFootprintVisible,
  projectUnitTransformCoordinate,
  toCellIndex,
  type GameCommands,
  type GameEvents,
  type GameWorld,
} from './pureHelpers';
import type {
  BuildingComponent,
  ProjectedEntityView,
  ProjectedFrameView,
  RenderableComponent,
  ResourceComponent,
  TerrainComponent,
  UnitComponent,
  UnitTransformComponent,
  VisionSourceComponent,
} from '../types';

export const SHEEP_VISION_RADIUS = 4;
export const MAX_HERDABLE_CLAIM_RADIUS = 6;

export function createProjector(
  visibility: VisibilityMap,
  playerId: number,
  seed: string,
  isSelected: (id: number) => boolean,
  getEntityHealth: (id: number) => { currentHp: number; maxHp: number } | null,
): RenderProjector<
  GameEvents,
  GameCommands,
  ProjectedEntityView,
  ProjectedFrameView
> {
  return {
    projectEntity(ref, world) {
      const position = world.getComponent<Position>(ref.id, 'position');
      const renderable = world.getComponent<RenderableComponent>(ref.id, 'renderable');
      const unitTransform = world.getComponent<UnitTransformComponent>(ref.id, 'unitTransform');
      if (!position || !renderable) {
        return null;
      }

      const terrain = world.getComponent<TerrainComponent>(ref.id, 'terrain');
      const unit = world.getComponent<UnitComponent>(ref.id, 'unit');
      const building = world.getComponent<BuildingComponent>(ref.id, 'building');
      const resource = world.getComponent<ResourceComponent>(ref.id, 'resource');
      const health = getEntityHealth(ref.id);

      let owner: number | null = null;
      let entityType: ProjectedEntityView['entityType'] = 'grass';

      if (terrain) {
        entityType = terrain.kind;
      }
      if (unit) {
        owner = unit.owner;
        entityType = unit.unitType;
      }
      if (building) {
        owner = building.owner;
        entityType = building.buildingType;
      }
      if (resource) {
        owner = resource.owner;
        entityType = resource.resourceType;
      }

      if (
        renderable.kind !== 'tile' &&
        owner !== playerId &&
        !isFootprintVisible(
          visibility,
          playerId,
          position.x,
          position.y,
          renderable.footprintWidth,
          renderable.footprintHeight,
        )
      ) {
        return null;
      }

      return {
        id: ref.id,
        kind: renderable.kind,
        layer: renderable.layer,
        entityType,
        owner,
        x: unitTransform
          ? projectUnitTransformCoordinate(unitTransform.fineX)
          : position.x,
        y: unitTransform
          ? projectUnitTransformCoordinate(unitTransform.fineY)
          : position.y,
        tint: renderable.tint,
        size: renderable.size,
        footprintWidth: renderable.footprintWidth,
        footprintHeight: renderable.footprintHeight,
        visualVariant: renderable.visualVariant,
        selected: isSelected(ref.id),
        currentHp: health?.currentHp ?? null,
        maxHp: health?.maxHp ?? null,
        isMemory: false,
      };
    },
    projectFrame(world) {
      return {
        tick: world.tick,
        playerId,
        seed,
        mapWidth: MAP_WIDTH,
        mapHeight: MAP_HEIGHT,
        visibleCells: visibility
          .getVisibleCells(playerId)
          .map((cell) => toCellIndex(cell.x, cell.y)),
        exploredCells: visibility
          .getExploredCells(playerId)
          .map((cell) => toCellIndex(cell.x, cell.y)),
      };
    },
  };
}

export function syncVisibilitySources(
  world: World<GameEvents, GameCommands>,
  visibility: VisibilityMap,
  trackedSources: Map<number, number>,
): void {
  const activeSources = new Map<number, number>();

  for (const id of world.query('position', 'visionSource')) {
    const position = world.getComponent<Position>(id, 'position');
    const source = world.getComponent<VisionSourceComponent>(id, 'visionSource');
    if (!position || !source) {
      continue;
    }

    visibility.setSource(source.playerId, id, {
      x: position.x,
      y: position.y,
      radius: source.radius,
    });
    activeSources.set(id, source.playerId);
  }

  for (const [id, playerId] of trackedSources.entries()) {
    if (activeSources.has(id)) {
      continue;
    }
    visibility.removeSource(playerId, id);
    trackedSources.delete(id);
  }

  for (const [id, playerId] of activeSources.entries()) {
    trackedSources.set(id, playerId);
  }

  visibility.update();
}

export function resolveSheepClaimOwner(
  typedWorld: GameWorld,
  sheepPosition: Position,
): number | null {
  let claimedOwner: number | null = null;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  let bestUnitId = Number.POSITIVE_INFINITY;

  for (const unitId of typedWorld.queryInRadius(
    sheepPosition.x,
    sheepPosition.y,
    MAX_HERDABLE_CLAIM_RADIUS,
    'unit',
    'visionSource',
  )) {
    const unitPosition = typedWorld.getComponent(unitId, 'position');
    const unit = typedWorld.getComponent(unitId, 'unit');
    const visionSource = typedWorld.getComponent(unitId, 'visionSource');
    if (!unitPosition || !unit || !visionSource) {
      continue;
    }

    const claimDistanceSquared = distanceSquared(unitPosition, sheepPosition);
    if (claimDistanceSquared > visionSource.radius * visionSource.radius) {
      continue;
    }

    if (
      claimDistanceSquared < bestDistanceSquared
      || (
        claimDistanceSquared === bestDistanceSquared
        && (
          unit.owner < (claimedOwner ?? Number.POSITIVE_INFINITY)
          || (unit.owner === claimedOwner && unitId < bestUnitId)
        )
      )
    ) {
      claimedOwner = unit.owner;
      bestDistanceSquared = claimDistanceSquared;
      bestUnitId = unitId;
    }
  }

  return claimedOwner;
}

export function syncSheepVisionSource(
  typedWorld: GameWorld,
  sheepId: number,
  owner: number | null,
): boolean {
  const sheepVisionSource = typedWorld.getComponent(sheepId, 'visionSource');
  if (owner === null) {
    if (!sheepVisionSource) {
      return false;
    }
    typedWorld.removeComponent(sheepId, 'visionSource');
    return true;
  }

  if (!sheepVisionSource) {
    typedWorld.addComponent(sheepId, 'visionSource', {
      playerId: owner,
      radius: SHEEP_VISION_RADIUS,
    });
    return true;
  }

  if (
    sheepVisionSource.playerId === owner
    && sheepVisionSource.radius === SHEEP_VISION_RADIUS
  ) {
    return false;
  }

  sheepVisionSource.playerId = owner;
  sheepVisionSource.radius = SHEEP_VISION_RADIUS;
  return true;
}

export function updateSheepOwnership(activeWorld: World<GameEvents, GameCommands>): boolean {
  const typedWorld = activeWorld as GameWorld;
  let didChange = false;

  for (const sheepId of typedWorld.query('position', 'resource', 'renderable')) {
    const sheepPosition = typedWorld.getComponent(sheepId, 'position');
    const resource = typedWorld.getComponent(sheepId, 'resource');
    const renderable = typedWorld.getComponent(sheepId, 'renderable');
    if (
      !sheepPosition
      || !resource
      || !renderable
      || resource.resourceType !== 'sheep'
      || resource.amount <= 0
    ) {
      continue;
    }

    if (resource.owner === null) {
      const claimedOwner = resolveSheepClaimOwner(typedWorld, sheepPosition);

      if (resource.owner !== claimedOwner) {
        resource.owner = claimedOwner;
        renderable.tint = resourceTint(resource.resourceType, claimedOwner);
        didChange = true;
      }
    }

    if (syncSheepVisionSource(typedWorld, sheepId, resource.owner)) {
      didChange = true;
    }
  }

  return didChange;
}
