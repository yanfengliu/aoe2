import type { ProjectedEntityView } from '../../game/simulation/types';
import {
  ISO_TILE_HEIGHT,
  ISO_TILE_WIDTH,
} from '../isometricProjection';
import { createBuildingParts } from './aoeVoxelBuildingRecipes';
import { createResourceParts } from './aoeVoxelResourceRecipes';
import { matrixForPart, type VoxelPart } from './aoeVoxelRecipeTypes';
import { createUnitParts } from './aoeVoxelUnitRecipes';

export interface VoxelPoint3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface VoxelIsoPoint {
  readonly x: number;
  readonly y: number;
}

export const VOXEL_VERTICAL_PIXELS_PER_WORLD_UNIT = (
  ISO_TILE_WIDTH / Math.SQRT2
) * Math.sqrt(1 - (ISO_TILE_HEIGHT / ISO_TILE_WIDTH) ** 2);

export function staticVoxelPartsForEntity(
  entity: ProjectedEntityView,
  identity = `geometry:${String(entity.id)}`,
): VoxelPart[] {
  if (entity.kind === 'tile') return [];
  if (entity.kind === 'building') return createBuildingParts(entity, identity, 0);
  if (entity.kind === 'unit') return createUnitParts(entity, identity, 0);
  return createResourceParts(entity, identity, 0);
}

export function voxelPartWorldCorners(part: VoxelPart): VoxelPoint3[] {
  const matrix = matrixForPart(part);
  const corners: VoxelPoint3[] = [];
  for (const localX of [-0.5, 0.5]) {
    for (const localY of [-0.5, 0.5]) {
      for (const localZ of [-0.5, 0.5]) {
        corners.push({
          x: matrix[0]! * localX + matrix[4]! * localY
            + matrix[8]! * localZ + matrix[12]!,
          y: matrix[1]! * localX + matrix[5]! * localY
            + matrix[9]! * localZ + matrix[13]!,
          z: matrix[2]! * localX + matrix[6]! * localY
            + matrix[10]! * localZ + matrix[14]!,
        });
      }
    }
  }
  return corners;
}

/**
 * Exact rigid-part corners for the same renderer-clock transform used by the
 * voxel Three runtime. Keeping this math data-only lets input query the
 * presented recipe pose without importing Three.js or touching the DOM.
 */
export function voxelPartWorldCornersAtTime(
  part: VoxelPart,
  nowMs: number,
): VoxelPoint3[] {
  const animation = part.animation;
  if (!animation || animation.periodMs <= 0) return voxelPartWorldCorners(part);
  const phase = (
    ((nowMs % animation.periodMs) + animation.periodMs) % animation.periodMs
  ) / animation.periodMs * Math.PI * 2 + animation.phaseRadians;
  const wave = Math.sin(phase);
  const offsetX = animation.rotationAmplitude.x * wave;
  const offsetY = animation.rotationAmplitude.y * wave;
  const offsetZ = animation.rotationAmplitude.z * wave;
  const a = Math.cos(offsetX);
  const b = Math.sin(offsetX);
  const c = Math.cos(offsetY);
  const d = Math.sin(offsetY);
  const e = Math.cos(offsetZ);
  const f = Math.sin(offsetZ);
  const ae = a * e;
  const af = a * f;
  const be = b * e;
  const bf = b * f;
  // Column-major XYZ Euler matrix, matching Three's Matrix4.makeRotationFromEuler.
  const rotation = [
    c * e, af + be * d, bf - ae * d,
    -c * f, ae - bf * d, be + af * d,
    d, -b * c, a * c,
  ] as const;
  const base = matrixForPart(part);
  const translation = animation.translationAmplitude;
  const corners: VoxelPoint3[] = [];
  for (const localX of [-0.5, 0.5]) {
    for (const localY of [-0.5, 0.5]) {
      for (const localZ of [-0.5, 0.5]) {
        const scaledX = localX * (1 + animation.scaleAmplitude.x * wave);
        const scaledY = localY * (1 + animation.scaleAmplitude.y * wave);
        const scaledZ = localZ * (1 + animation.scaleAmplitude.z * wave);
        const rotatedX = rotation[0] * scaledX
          + rotation[3] * scaledY + rotation[6] * scaledZ;
        const rotatedY = rotation[1] * scaledX
          + rotation[4] * scaledY + rotation[7] * scaledZ;
        const rotatedZ = rotation[2] * scaledX
          + rotation[5] * scaledY + rotation[8] * scaledZ;
        corners.push({
          x: base[0]! * rotatedX + base[4]! * rotatedY + base[8]! * rotatedZ
            + base[12]! + translation.x * wave,
          y: base[1]! * rotatedX + base[5]! * rotatedY + base[9]! * rotatedZ
            + base[13]! + translation.y * wave,
          z: base[2]! * rotatedX + base[6]! * rotatedY + base[10]! * rotatedZ
            + base[14]! + translation.z * wave,
        });
      }
    }
  }
  return corners;
}

export function voxelPartMaxY(part: VoxelPart): number {
  return Math.max(...voxelPartWorldCorners(part).map((corner) => corner.y));
}

export function projectVoxelPointToIso(point: VoxelPoint3): VoxelIsoPoint {
  return {
    x: (point.x - point.z) * ISO_TILE_WIDTH / 2,
    y: (point.x + point.z) * ISO_TILE_HEIGHT / 2
      - point.y * VOXEL_VERTICAL_PIXELS_PER_WORLD_UNIT,
  };
}

export function convexHull(points: readonly VoxelIsoPoint[]): VoxelIsoPoint[] {
  const sorted = [...points].sort((left, right) => left.x - right.x || left.y - right.y);
  if (sorted.length <= 2) return sorted;
  const cross = (origin: VoxelIsoPoint, a: VoxelIsoPoint, b: VoxelIsoPoint) => (
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x)
  );
  const lower: VoxelIsoPoint[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: VoxelIsoPoint[] = [];
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

export function voxelPartIsoPolygon(part: VoxelPart): VoxelIsoPoint[] {
  return convexHull(voxelPartWorldCorners(part).map(projectVoxelPointToIso));
}

export function voxelPartIsoPolygonAtTime(
  part: VoxelPart,
  nowMs: number,
): VoxelIsoPoint[] {
  return convexHull(voxelPartWorldCornersAtTime(part, nowMs).map(projectVoxelPointToIso));
}

export function pointInConvexPolygon(
  point: VoxelIsoPoint,
  polygon: readonly VoxelIsoPoint[],
): boolean {
  if (polygon.length < 3) return false;
  let sign = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;
    const cross = (end.x - start.x) * (point.y - start.y)
      - (end.y - start.y) * (point.x - start.x);
    if (Math.abs(cross) < 1e-9) continue;
    const nextSign = Math.sign(cross);
    if (sign !== 0 && nextSign !== sign) return false;
    sign = nextSign;
  }
  return true;
}
