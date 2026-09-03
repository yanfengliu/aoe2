// The primitives every building recipe is written in: the context a recipe
// draws into, the one call that places a box in it, and the per-set door form.
//
// Split out of `aoeVoxelBuildingRecipes.ts` at the 500-LOC ceiling so the wall
// and gate recipes can share them without importing the module that imports
// THEM, which would be a cycle.
import type { ProjectedEntityView } from '../../game/simulation/types';
import { architectureDoorBoxes, architectureWallTint } from './aoeVoxelArchitecture';
import { makePart, type VoxelPart, type VoxelSurface } from './aoeVoxelRecipeTypes';

export interface BuildingContext {
  architecture?: import('../../game/simulation/architectureStyles').ArchitectureStyle;
  readonly entity: ProjectedEntityView;
  readonly identity: string;
  readonly ground: number;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly team: number;
  readonly parts: VoxelPart[];
}

export function add(
  context: BuildingContext,
  suffix: string,
  surface: VoxelSurface,
  tint: number,
  xFraction: number,
  bottom: number,
  zFraction: number,
  widthFraction: number,
  height: number,
  depthFraction: number,
  rotation: { readonly yaw?: number; readonly roll?: number } = {},
): void {
  context.parts.push(makePart(
    context.entity,
    context.identity,
    suffix,
    surface,
    // v0.3.108: wall plaster follows the building's architecture set; every
    // other colour passes through (roofs re-key at their own sites).
    architectureWallTint(context.architecture, tint),
    context.x + context.width * xFraction,
    context.ground + bottom + height / 2,
    context.z + context.depth * zFraction,
    Math.max(0.045, context.width * widthFraction),
    height,
    Math.max(0.045, context.depth * depthFraction),
    rotation,
  ));
}

// Per-set door forms (v0.3.143): one call replaces a raw door box.
export function setDoor(context: BuildingContext, prefix: string, xF: number, bottom: number, zF: number, wF: number, h: number, dF: number): void {
  for (const [sfx, tint, ...box] of architectureDoorBoxes(context.architecture, xF, bottom, zF, wF, h, dF)) add(context, `${prefix}-${sfx}`, 'matte', tint, ...box);
}
