import type { BuildingType, ProjectedEntityView } from '../../game/simulation/types';
import { buildingRole } from '../roles/buildingRole';
import {
  contactShadow,
  makePart,
  shade,
  VOXEL_COLORS,
  type VoxelPart,
  type VoxelSurface,
} from './aoeVoxelRecipeTypes';

interface BuildingContext {
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

function add(
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
    tint,
    context.x + context.width * xFraction,
    context.ground + bottom + height / 2,
    context.z + context.depth * zFraction,
    Math.max(0.045, context.width * widthFraction),
    height,
    Math.max(0.045, context.depth * depthFraction),
    rotation,
  ));
}

function steppedRoof(
  context: BuildingContext,
  prefix: string,
  bottom: number,
  xFraction: number,
  zFraction: number,
  widthFraction: number,
  depthFraction: number,
  tint: number = VOXEL_COLORS.roofTile,
  layers = 3,
): number {
  const layerHeight = 0.16;
  for (let layer = 0; layer < layers; layer += 1) {
    const inset = layer * 0.055;
    add(
      context,
      `${prefix}-roof-${String(layer + 1)}`,
      'matte',
      shade(tint, 1 - layer * 0.08),
      xFraction,
      bottom + layer * layerHeight,
      zFraction,
      Math.max(0.08, widthFraction - inset * 2),
      layerHeight,
      Math.max(0.08, depthFraction - inset * 2),
    );
  }
  return bottom + layers * layerHeight;
}

function construction(context: BuildingContext): void {
  add(context, 'construction-foundation', 'matte', VOXEL_COLORS.stone, 0.5, 0, 0.5, 0.82, 0.14, 0.82);
  add(context, 'construction-wall-course', 'matte', VOXEL_COLORS.plaster, 0.5, 0.14, 0.5, 0.66, 0.38, 0.66);
  const posts = [
    ['front-left', 0.16, 0.18],
    ['front-right', 0.84, 0.18],
    ['back-left', 0.16, 0.82],
    ['back-right', 0.84, 0.82],
  ] as const;
  for (const [name, x, z] of posts) {
    add(context, `construction-scaffold-${name}`, 'matte', VOXEL_COLORS.timber, x, 0.1, z, 0.045, 1.15, 0.045);
  }
  add(context, 'construction-scaffold-rail-front', 'matte', VOXEL_COLORS.timberDark, 0.5, 0.62, 0.18, 0.72, 0.07, 0.04);
  add(context, 'construction-scaffold-rail-back', 'matte', VOXEL_COLORS.timberDark, 0.5, 0.62, 0.82, 0.72, 0.07, 0.04);
}

function townCenter(context: BuildingContext): void {
  add(context, 'town-center-plinth', 'matte', VOXEL_COLORS.stone, 0.5, 0, 0.5, 0.86, 0.18, 0.82);
  add(context, 'town-center-hall', 'matte', VOXEL_COLORS.plaster, 0.5, 0.18, 0.5, 0.5, 1.28, 0.48);
  add(context, 'town-center-wing-left', 'matte', VOXEL_COLORS.plasterLight, 0.22, 0.18, 0.53, 0.19, 0.86, 0.38);
  add(context, 'town-center-wing-right', 'matte', VOXEL_COLORS.plasterLight, 0.78, 0.18, 0.53, 0.19, 0.86, 0.38);
  add(context, 'town-center-door', 'matte', VOXEL_COLORS.timberDark, 0.5, 0.18, 0.75, 0.11, 0.67, 0.035);
  add(context, 'town-center-window-left', 'matte', VOXEL_COLORS.window, 0.4, 0.82, 0.745, 0.07, 0.25, 0.025);
  add(context, 'town-center-window-right', 'matte', VOXEL_COLORS.window, 0.6, 0.82, 0.745, 0.07, 0.25, 0.025);
  for (const [name, x, z] of [
    ['front-left', 0.26, 0.74],
    ['front-right', 0.74, 0.74],
    ['back-left', 0.26, 0.27],
    ['back-right', 0.74, 0.27],
  ] as const) {
    add(context, `town-center-beam-${name}`, 'matte', VOXEL_COLORS.timber, x, 0.18, z, 0.035, 1.22, 0.035);
  }
  steppedRoof(context, 'town-center-main', 1.46, 0.5, 0.5, 0.58, 0.57);
  steppedRoof(context, 'town-center-left', 1.04, 0.22, 0.53, 0.24, 0.46, VOXEL_COLORS.thatch, 2);
  steppedRoof(context, 'town-center-right', 1.04, 0.78, 0.53, 0.24, 0.46, VOXEL_COLORS.thatch, 2);
  add(context, 'town-center-tower', 'matte', VOXEL_COLORS.stoneLight, 0.5, 1.94, 0.5, 0.18, 0.58, 0.18);
  add(context, 'town-center-tower-roof', 'matte', VOXEL_COLORS.roofTileDark, 0.5, 2.52, 0.5, 0.24, 0.18, 0.24);
  add(context, 'town-center-flag-pole', 'metal', VOXEL_COLORS.steelDark, 0.5, 2.7, 0.5, 0.018, 0.58, 0.018);
  add(context, 'town-center-flag', 'matte', context.team, 0.535, 3.02, 0.5, 0.09, 0.22, 0.025);
  add(context, 'town-center-team-band', 'matte', context.team, 0.5, 1.32, 0.755, 0.42, 0.09, 0.025);
}

function house(context: BuildingContext): void {
  add(context, 'house-plinth', 'matte', VOXEL_COLORS.stone, 0.5, 0, 0.5, 0.78, 0.12, 0.72);
  add(context, 'house-walls', 'matte', VOXEL_COLORS.plaster, 0.5, 0.12, 0.5, 0.65, 0.9, 0.6);
  add(context, 'house-door', 'matte', VOXEL_COLORS.timberDark, 0.5, 0.12, 0.81, 0.16, 0.58, 0.035);
  add(context, 'house-window', 'matte', VOXEL_COLORS.window, 0.7, 0.52, 0.805, 0.12, 0.23, 0.025);
  for (const [name, x, z] of [
    ['front-left', 0.19, 0.8],
    ['front-right', 0.81, 0.8],
    ['back-left', 0.19, 0.2],
    ['back-right', 0.81, 0.2],
  ] as const) {
    add(context, `house-beam-${name}`, 'matte', VOXEL_COLORS.timber, x, 0.12, z, 0.04, 0.9, 0.04);
  }
  add(context, 'house-team-eave', 'matte', context.team, 0.5, 0.92, 0.82, 0.7, 0.08, 0.035);
  steppedRoof(context, 'house', 1.02, 0.5, 0.5, 0.78, 0.75, VOXEL_COLORS.thatch);
  add(context, 'house-chimney', 'matte', VOXEL_COLORS.stoneDark, 0.72, 1.25, 0.42, 0.1, 0.58, 0.1);
  add(context, 'house-chimney-cap', 'matte', VOXEL_COLORS.stone, 0.72, 1.83, 0.42, 0.13, 0.08, 0.13);
}

function fortress(context: BuildingContext): void {
  add(context, 'fortress-plinth', 'matte', VOXEL_COLORS.stoneDark, 0.5, 0, 0.5, 0.9, 0.2, 0.88);
  add(context, 'fortress-keep', 'matte', VOXEL_COLORS.stone, 0.5, 0.2, 0.5, 0.58, 1.65, 0.58);
  for (const [name, x, z] of [
    ['north-west', 0.2, 0.2], ['north-east', 0.8, 0.2],
    ['south-west', 0.2, 0.8], ['south-east', 0.8, 0.8],
  ] as const) {
    add(context, `fortress-tower-${name}`, 'matte', VOXEL_COLORS.stoneLight, x, 0.2, z, 0.22, 1.85, 0.22);
    add(context, `fortress-tower-cap-${name}`, 'matte', VOXEL_COLORS.stoneDark, x, 2.05, z, 0.27, 0.15, 0.27);
  }
  add(context, 'fortress-gate', 'matte', VOXEL_COLORS.timberDark, 0.5, 0.2, 0.795, 0.16, 0.88, 0.03);
  for (let index = 0; index < 5; index += 1) {
    add(context, `fortress-merlon-${String(index)}`, 'matte', VOXEL_COLORS.stoneLight, 0.3 + index * 0.1, 1.85, 0.5, 0.06, 0.25, 0.07);
  }
  add(context, 'fortress-banner-pole', 'metal', VOXEL_COLORS.steelDark, 0.5, 2.0, 0.5, 0.018, 0.72, 0.018);
  add(context, 'fortress-banner', 'matte', context.team, 0.54, 2.46, 0.5, 0.1, 0.24, 0.025);
}

function wonder(context: BuildingContext): void {
  add(context, 'wonder-plinth-low', 'matte', VOXEL_COLORS.stoneDark, 0.5, 0, 0.5, 0.88, 0.18, 0.86);
  add(context, 'wonder-plinth-high', 'matte', VOXEL_COLORS.stoneLight, 0.5, 0.18, 0.5, 0.76, 0.2, 0.74);
  add(context, 'wonder-hall', 'matte', VOXEL_COLORS.plasterLight, 0.5, 0.38, 0.5, 0.56, 1.35, 0.54);
  for (let index = 0; index < 4; index += 1) {
    add(context, `wonder-column-${String(index)}`, 'matte', VOXEL_COLORS.stoneLight, 0.34 + index * 0.11, 0.38, 0.79, 0.045, 1.24, 0.045);
  }
  add(context, 'wonder-team-band', 'matte', context.team, 0.5, 1.48, 0.78, 0.5, 0.1, 0.035);
  for (let layer = 0; layer < 5; layer += 1) {
    add(context, `wonder-dome-${String(layer + 1)}`, 'matte', shade(context.team, 0.78 - layer * 0.05), 0.5, 1.73 + layer * 0.18, 0.5, 0.52 - layer * 0.075, 0.18, 0.5 - layer * 0.07);
  }
  add(context, 'wonder-spire', 'metal', VOXEL_COLORS.gold, 0.5, 2.63, 0.5, 0.035, 0.58, 0.035);
}

function farm(context: BuildingContext): void {
  add(context, 'farm-soil', 'matte', VOXEL_COLORS.soil, 0.5, 0, 0.5, 0.9, 0.08, 0.88);
  for (let row = 0; row < 7; row += 1) {
    add(context, `farm-crop-row-${String(row)}`, 'matte', row % 2 === 0 ? VOXEL_COLORS.foliageLight : VOXEL_COLORS.thatch, 0.17 + row * 0.11, 0.08, 0.5, 0.035, 0.16 + (row % 3) * 0.035, 0.72);
  }
  for (const [name, x, z] of [
    ['north-west', 0.08, 0.08], ['north-east', 0.92, 0.08],
    ['south-west', 0.08, 0.92], ['south-east', 0.92, 0.92],
  ] as const) {
    add(context, `farm-fence-post-${name}`, 'matte', VOXEL_COLORS.timber, x, 0.05, z, 0.035, 0.38, 0.035);
  }
  add(context, 'farm-team-marker', 'matte', context.team, 0.1, 0.35, 0.1, 0.09, 0.16, 0.025);
}

function mill(context: BuildingContext): void {
  add(context, 'mill-plinth', 'matte', VOXEL_COLORS.stone, 0.5, 0, 0.5, 0.72, 0.15, 0.7);
  add(context, 'mill-body', 'matte', VOXEL_COLORS.plaster, 0.5, 0.15, 0.5, 0.52, 1.25, 0.5);
  add(context, 'mill-door', 'matte', VOXEL_COLORS.timberDark, 0.5, 0.15, 0.765, 0.14, 0.58, 0.035);
  steppedRoof(context, 'mill', 1.4, 0.5, 0.5, 0.65, 0.63, VOXEL_COLORS.thatch);
  add(context, 'mill-axle', 'metal', VOXEL_COLORS.steelDark, 0.5, 1.03, 0.78, 0.08, 0.08, 0.18);
  add(context, 'mill-blade-a', 'matte', VOXEL_COLORS.timber, 0.5, 0.58, 0.89, 0.045, 1.02, 0.035, { roll: Math.PI / 4 });
  add(context, 'mill-blade-b', 'matte', VOXEL_COLORS.timber, 0.5, 0.58, 0.895, 0.045, 1.02, 0.035, { roll: -Math.PI / 4 });
  add(context, 'mill-team-sail', 'matte', context.team, 0.63, 1.22, 0.91, 0.1, 0.24, 0.025, { roll: Math.PI / 4 });
}

function hall(context: BuildingContext, role: 'military' | 'drop-site'): void {
  add(context, `${role}-platform`, 'matte', VOXEL_COLORS.stone, 0.5, 0, 0.5, 0.84, 0.14, 0.8);
  add(context, `${role}-walls`, 'matte', role === 'military' ? VOXEL_COLORS.plaster : VOXEL_COLORS.timber, 0.5, 0.14, 0.5, 0.68, 0.92, 0.62);
  add(context, `${role}-door`, 'matte', VOXEL_COLORS.timberDark, 0.5, 0.14, 0.825, 0.2, 0.62, 0.035);
  for (const [name, x] of [['left', 0.2], ['right', 0.8]] as const) {
    add(context, `${role}-front-post-${name}`, 'matte', VOXEL_COLORS.timberDark, x, 0.14, 0.82, 0.045, 0.96, 0.045);
  }
  steppedRoof(context, role, 1.06, 0.5, 0.5, 0.8, 0.76, role === 'military' ? VOXEL_COLORS.roofTile : VOXEL_COLORS.thatch);
  add(context, `${role}-banner-pole`, 'metal', VOXEL_COLORS.steelDark, 0.5, 1.54, 0.5, 0.018, 0.55, 0.018);
  add(context, `${role}-banner`, 'matte', context.team, 0.54, 1.85, 0.5, 0.1, 0.22, 0.025);
  if (context.entity.entityType === 'stable') {
    add(context, 'stable-stall-left', 'matte', VOXEL_COLORS.timber, 0.34, 0.14, 0.84, 0.035, 0.48, 0.05);
    add(context, 'stable-stall-right', 'matte', VOXEL_COLORS.timber, 0.66, 0.14, 0.84, 0.035, 0.48, 0.05);
  } else if (context.entity.entityType === 'archery-range') {
    add(context, 'archery-range-target', 'matte', VOXEL_COLORS.plasterLight, 0.82, 0.18, 0.82, 0.13, 0.42, 0.035);
    add(context, 'archery-range-target-center', 'matte', context.team, 0.82, 0.31, 0.845, 0.055, 0.12, 0.025);
  } else if (context.entity.entityType === 'siege-workshop') {
    add(context, 'siege-workshop-wheel', 'matte', VOXEL_COLORS.timberDark, 0.78, 0.18, 0.83, 0.18, 0.18, 0.05, { roll: Math.PI / 4 });
  }
}

function market(context: BuildingContext): void {
  add(context, 'market-platform', 'matte', VOXEL_COLORS.stone, 0.5, 0, 0.5, 0.88, 0.12, 0.84);
  for (const [name, x] of [['left', 0.25], ['right', 0.75]] as const) {
    add(context, `market-stall-${name}`, 'matte', VOXEL_COLORS.timber, x, 0.12, 0.56, 0.3, 0.58, 0.46);
    add(context, `market-awning-${name}`, 'matte', name === 'left' ? context.team : shade(context.team, 0.72), x, 0.7, 0.56, 0.36, 0.12, 0.52);
  }
  add(context, 'market-crate-left', 'matte', VOXEL_COLORS.timberDark, 0.2, 0.12, 0.82, 0.13, 0.2, 0.13);
  add(context, 'market-crate-right', 'matte', VOXEL_COLORS.thatch, 0.8, 0.12, 0.82, 0.13, 0.2, 0.13);
  add(context, 'market-banner-pole', 'metal', VOXEL_COLORS.steelDark, 0.5, 0.12, 0.25, 0.018, 1.35, 0.018);
  add(context, 'market-banner', 'matte', context.team, 0.54, 1.14, 0.25, 0.11, 0.22, 0.025);
}

function blacksmith(context: BuildingContext): void {
  house(context);
  add(context, 'blacksmith-forge', 'matte', VOXEL_COLORS.stoneDark, 0.2, 0.12, 0.78, 0.22, 0.42, 0.16);
  add(context, 'blacksmith-ember', 'matte', 0xe27632, 0.2, 0.48, 0.87, 0.1, 0.08, 0.04);
  add(context, 'blacksmith-anvil', 'metal', VOXEL_COLORS.steelDark, 0.78, 0.13, 0.8, 0.16, 0.24, 0.12);
}

function monastery(context: BuildingContext): void {
  house(context);
  add(context, 'monastery-tower', 'matte', VOXEL_COLORS.stoneLight, 0.5, 1.5, 0.5, 0.22, 0.62, 0.22);
  add(context, 'monastery-cross-upright', 'metal', VOXEL_COLORS.gold, 0.5, 2.12, 0.5, 0.025, 0.54, 0.025);
  add(context, 'monastery-crossbar', 'metal', VOXEL_COLORS.gold, 0.5, 2.42, 0.5, 0.14, 0.025, 0.025);
}

function tower(context: BuildingContext): void {
  add(context, 'tower-plinth', 'matte', VOXEL_COLORS.stoneDark, 0.5, 0, 0.5, 0.72, 0.18, 0.7);
  add(context, 'tower-shaft', 'matte', VOXEL_COLORS.stone, 0.5, 0.18, 0.5, 0.5, 1.75, 0.5);
  add(context, 'tower-platform', 'matte', VOXEL_COLORS.stoneLight, 0.5, 1.93, 0.5, 0.68, 0.16, 0.68);
  for (let index = 0; index < 6; index += 1) {
    const x = index % 2 === 0 ? 0.23 : 0.77;
    const z = 0.22 + Math.floor(index / 2) * 0.28;
    add(context, `tower-merlon-${String(index)}`, 'matte', VOXEL_COLORS.stoneLight, x, 2.09, z, 0.12, 0.28, 0.12);
  }
  add(context, 'tower-banner', 'matte', context.team, 0.5, 2.2, 0.5, 0.12, 0.3, 0.035);
}

function wall(context: BuildingContext): void {
  if (context.entity.entityType === 'palisade-wall') {
    for (let index = 0; index < 5; index += 1) {
      add(context, `palisade-stake-${String(index)}`, 'matte', index % 2 ? VOXEL_COLORS.timber : VOXEL_COLORS.timberDark, 0.14 + index * 0.18, 0, 0.5, 0.11, 1.02 + (index % 2) * 0.12, 0.28);
    }
    add(context, 'palisade-team-knot', 'matte', context.team, 0.5, 0.62, 0.66, 0.62, 0.08, 0.04);
    return;
  }
  add(context, 'wall-base', 'matte', VOXEL_COLORS.stone, 0.5, 0, 0.5, 0.92, 0.76, 0.5);
  for (let index = 0; index < 5; index += 1) {
    add(context, `wall-merlon-${String(index)}`, 'matte', VOXEL_COLORS.stoneLight, 0.1 + index * 0.2, 0.76, 0.5, 0.12, 0.3, 0.58);
  }
  add(context, 'wall-team-shield', 'matte', context.team, 0.5, 0.34, 0.77, 0.18, 0.28, 0.035);
}

export function createBuildingParts(
  entity: ProjectedEntityView,
  identity: string,
  ground: number,
): VoxelPart[] {
  const width = Math.max(0.5, entity.footprintWidth);
  const depth = Math.max(0.5, entity.footprintHeight);
  const context: BuildingContext = {
    entity,
    identity,
    ground,
    x: entity.x,
    z: entity.y,
    width,
    depth,
    team: entity.tint,
    parts: [...contactShadow(entity, identity, 'building-shadow', entity.x + width / 2, ground, entity.y + depth / 2, width * 0.82, depth * 0.78)],
  };
  if (entity.visualVariant === 'construction') {
    construction(context);
    return context.parts;
  }
  switch (buildingRole(entity.entityType as BuildingType)) {
    case 'town-center': townCenter(context); break;
    case 'fortress': fortress(context); break;
    case 'wonder': wonder(context); break;
    case 'house': house(context); break;
    case 'mill': mill(context); break;
    case 'farm': farm(context); break;
    case 'drop-site': hall(context, 'drop-site'); break;
    case 'military': hall(context, 'military'); break;
    case 'blacksmith': blacksmith(context); break;
    case 'market': market(context); break;
    case 'monastery': monastery(context); break;
    case 'tower': tower(context); break;
    case 'wall': wall(context); break;
  }
  return context.parts;
}
