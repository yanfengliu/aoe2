import { HUMAN_PLAYER_ID } from '../../game/simulation/prototypeScenario';
import type { ProjectedEntityView } from '../../game/simulation/types';
import {
  pointInConvexPolygon,
  staticVoxelPartsForEntity,
  voxelPartIsoPolygon,
  voxelPartIsoPolygonAtTime,
  type VoxelIsoPoint,
} from './aoeVoxelGeometry';
import type { VoxelPart } from './aoeVoxelRecipeTypes';

export type VoxelHitPurpose = 'selection' | 'command';

interface IndexedHit {
  readonly entity: ProjectedEntityView;
  readonly index: number;
}

export interface PreparedVoxelHitEntity {
  readonly entity: ProjectedEntityView;
  readonly parts: readonly VoxelPart[];
}

export interface PreparedVoxelHitState {
  readonly epoch: string;
  readonly revision: number;
  readonly entities: readonly PreparedVoxelHitEntity[];
}

const LAYER_PRIORITY: Record<ProjectedEntityView['kind'], number> = {
  tile: 0,
  resource: 1,
  building: 2,
  unit: 3,
};

function ownerPriority(entity: ProjectedEntityView): number {
  if (entity.owner === HUMAN_PLAYER_ID) return 0;
  if (entity.owner === null) return 2;
  return 1;
}

export function voxelEntityHitRegions(entity: ProjectedEntityView): Array<{
  readonly key: string;
  readonly polygon: readonly VoxelIsoPoint[];
}> {
  if (entity.isMemory || entity.kind === 'tile') return [];
  return staticVoxelPartsForEntity(entity, `hit:${String(entity.id)}`)
    .filter((part) => part.surface !== 'shadow' && part.surface !== 'memory')
    .map((part) => ({ key: part.key, polygon: voxelPartIsoPolygon(part) }));
}

export function prepareVoxelHitEntity(
  entity: ProjectedEntityView,
  parts: readonly VoxelPart[],
): PreparedVoxelHitEntity {
  return {
    entity: { ...entity },
    parts: parts
      .filter((part) => part.surface !== 'shadow' && part.surface !== 'memory')
      .map((part) => ({
        ...part,
        ...(part.animation ? {
          animation: {
            ...part.animation,
            translationAmplitude: { ...part.animation.translationAmplitude },
            rotationAmplitude: { ...part.animation.rotationAmplitude },
            scaleAmplitude: { ...part.animation.scaleAmplitude },
          },
        } : {}),
      })),
  };
}

export function preparedVoxelEntityHitRegions(
  prepared: PreparedVoxelHitEntity,
  nowMs: number,
): Array<{ readonly key: string; readonly polygon: readonly VoxelIsoPoint[] }> {
  if (prepared.entity.isMemory || prepared.entity.kind === 'tile') return [];
  return prepared.parts.map((part) => ({
    key: part.key,
    polygon: voxelPartIsoPolygonAtTime(part, nowMs),
  }));
}

export function findVoxelEntitiesAtIsoPoint(
  entities: readonly ProjectedEntityView[],
  isoX: number,
  isoY: number,
  purpose: VoxelHitPurpose,
): ProjectedEntityView[] {
  const point = { x: isoX, y: isoY };
  return entities
    .map((entity, index): IndexedHit => ({ entity, index }))
    .filter(({ entity }) => voxelEntityHitRegions(entity)
      .some(({ polygon }) => pointInConvexPolygon(point, polygon)))
    .sort((left, right) => {
      const layer = LAYER_PRIORITY[right.entity.kind] - LAYER_PRIORITY[left.entity.kind];
      if (layer !== 0) return layer;
      if (purpose === 'selection') {
        const owner = ownerPriority(left.entity) - ownerPriority(right.entity);
        if (owner !== 0) return owner;
      }
      const depth = (right.entity.x + right.entity.y) - (left.entity.x + left.entity.y);
      return depth || right.index - left.index;
    })
    .map(({ entity }) => entity);
}

export function findPreparedVoxelEntitiesAtIsoPoint(
  prepared: readonly PreparedVoxelHitEntity[],
  isoX: number,
  isoY: number,
  purpose: VoxelHitPurpose,
  nowMs: number,
): ProjectedEntityView[] {
  const point = { x: isoX, y: isoY };
  return prepared
    .map(({ entity, parts }, index): IndexedHit & { parts: readonly VoxelPart[] } => ({
      entity,
      parts,
      index,
    }))
    .filter(({ entity, parts }) => preparedVoxelEntityHitRegions({ entity, parts }, nowMs)
      .some(({ polygon }) => pointInConvexPolygon(point, polygon)))
    .sort((left, right) => {
      const layer = LAYER_PRIORITY[right.entity.kind] - LAYER_PRIORITY[left.entity.kind];
      if (layer !== 0) return layer;
      if (purpose === 'selection') {
        const owner = ownerPriority(left.entity) - ownerPriority(right.entity);
        if (owner !== 0) return owner;
      }
      const depth = (right.entity.x + right.entity.y) - (left.entity.x + left.entity.y);
      return depth || right.index - left.index;
    })
    .map(({ entity }) => entity);
}
