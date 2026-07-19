import type { ProjectedEntityView } from '../../game/simulation/types';
import {
  makePart,
  type VoxelPart,
  type VoxelSurface,
} from './aoeVoxelRecipeTypes';

export interface UnitRecipeContext {
  readonly entity: ProjectedEntityView;
  readonly identity: string;
  readonly ground: number;
  readonly centerX: number;
  readonly centerZ: number;
  readonly scale: number;
  readonly team: number;
  readonly parts: VoxelPart[];
}

export function addUnitPart(
  context: UnitRecipeContext,
  suffix: string,
  surface: VoxelSurface,
  tint: number,
  offsetX: number,
  bottom: number,
  offsetZ: number,
  width: number,
  height: number,
  depth: number,
  rotation: { readonly yaw?: number; readonly pitch?: number; readonly roll?: number } = {},
): void {
  const scale = context.scale;
  context.parts.push(makePart(
    context.entity,
    context.identity,
    suffix,
    surface,
    tint,
    context.centerX + offsetX * scale,
    context.ground + (bottom + height / 2) * scale,
    context.centerZ + offsetZ * scale,
    width * scale,
    height * scale,
    depth * scale,
    rotation,
  ));
}
