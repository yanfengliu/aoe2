import type { BuildingType, ProjectedEntityView } from '../../game/simulation/types';
import { buildingRole } from '../roles/buildingRole';
import { createBuildingDetailParts, damageFlames } from './aoeVoxelBuildingDetails';
import {
  contactShadow,
  makePart,
  mixTint,
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
  // The AoE2 read: a building's ROOF carries its owner's colour, not just a
  // flag and a band — three bases at a glance are three colours of skyline.
  // Blending (rather than painting flat team colour) keeps the tile/thatch
  // material identity underneath, so Briton blue thatch still reads as thatch.
  const owned = mixTint(tint, context.team, 0.55);
  const layerHeight = 0.16;
  for (let layer = 0; layer < layers; layer += 1) {
    const inset = layer * 0.055;
    add(
      context,
      `${prefix}-roof-${String(layer + 1)}`,
      'matte',
      shade(owned, 1 - layer * 0.08),
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
  add(context, 'town-center-tower-roof', 'matte', mixTint(VOXEL_COLORS.roofTileDark, context.team, 0.55), 0.5, 2.52, 0.5, 0.24, 0.18, 0.24);
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
  // Heavy ashlar coursing: a castle keep should read as laid stone.
  wallCourses(context, 'fortress', {
    bottom: 0.2, height: 1.65, width: 0.58, depth: 0.58,
    tint: shade(VOXEL_COLORS.stone, 0.82), count: 5,
  });
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

// Wall material relief (spec §14.5 detail pass, user directive 2026-07-14).
// Thin proud courses banded up a wall face read as laid masonry or stacked
// timber at default zoom, instead of one flat slab. Strictly original
// procedural geometry: every course is inset inside the wall's own footprint,
// so footprints, hit testing, health bars, and selection are unchanged.
function wallCourses(
  context: BuildingContext,
  role: string,
  options: {
    readonly bottom: number;
    readonly height: number;
    readonly width: number;
    readonly depth: number;
    readonly tint: number;
    readonly count?: number;
    readonly centerX?: number;
    readonly centerZ?: number;
  },
): void {
  const count = options.count ?? 3;
  const step = options.height / (count + 1);
  const centerX = options.centerX ?? 0.5;
  const centerZ = options.centerZ ?? 0.5;
  const faceZ = centerZ + options.depth / 2;
  for (let index = 0; index < count; index += 1) {
    const bottom = options.bottom + step * (index + 1);
    add(
      context,
      `${role}-course-${String(index)}`,
      'matte',
      options.tint,
      centerX,
      bottom,
      faceZ,
      options.width * 0.94,
      0.035,
      0.02,
    );
    add(
      context,
      `${role}-course-side-${String(index)}`,
      'matte',
      options.tint,
      centerX + options.width / 2,
      bottom,
      centerZ,
      0.02,
      0.035,
      options.depth * 0.94,
    );
  }
}

function mill(context: BuildingContext): void {
  add(context, 'mill-plinth', 'matte', VOXEL_COLORS.stone, 0.5, 0, 0.5, 0.72, 0.15, 0.7);
  add(context, 'mill-body', 'matte', VOXEL_COLORS.plaster, 0.5, 0.15, 0.5, 0.52, 1.25, 0.5);
  wallCourses(context, 'mill', {
    bottom: 0.15, height: 1.25, width: 0.52, depth: 0.5,
    tint: shade(VOXEL_COLORS.plaster, 0.86),
  });
  add(context, 'mill-door', 'matte', VOXEL_COLORS.timberDark, 0.5, 0.15, 0.765, 0.14, 0.58, 0.035);
  add(context, 'mill-door-trim', 'matte', VOXEL_COLORS.timber, 0.5, 0.72, 0.767, 0.19, 0.04, 0.03);
  steppedRoof(context, 'mill', 1.4, 0.5, 0.5, 0.65, 0.63, VOXEL_COLORS.thatch);
  add(context, 'mill-axle', 'metal', VOXEL_COLORS.steelDark, 0.5, 1.03, 0.78, 0.08, 0.08, 0.18);
  add(context, 'mill-blade-a', 'matte', VOXEL_COLORS.timber, 0.5, 0.58, 0.89, 0.045, 1.02, 0.035, { roll: Math.PI / 4 });
  add(context, 'mill-blade-b', 'matte', VOXEL_COLORS.timber, 0.5, 0.58, 0.895, 0.045, 1.02, 0.035, { roll: -Math.PI / 4 });
  add(context, 'mill-team-sail', 'matte', context.team, 0.63, 1.22, 0.91, 0.1, 0.24, 0.025, { roll: Math.PI / 4 });
}

function hall(context: BuildingContext, role: 'military' | 'drop-site'): void {
  add(context, `${role}-platform`, 'matte', VOXEL_COLORS.stone, 0.5, 0, 0.5, 0.84, 0.14, 0.8);
  const wallTint = role === 'military' ? VOXEL_COLORS.plaster : VOXEL_COLORS.timber;
  add(context, `${role}-walls`, 'matte', wallTint, 0.5, 0.14, 0.5, 0.68, 0.92, 0.62);
  // Military halls read as coursed plaster; timber drop-sites as stacked logs.
  wallCourses(context, role, {
    bottom: 0.14, height: 0.92, width: 0.68, depth: 0.62,
    tint: shade(wallTint, role === 'military' ? 0.85 : 1.16),
    count: role === 'military' ? 3 : 4,
  });
  add(context, `${role}-door`, 'matte', VOXEL_COLORS.timberDark, 0.5, 0.14, 0.825, 0.2, 0.62, 0.035);
  add(context, `${role}-door-trim`, 'matte', VOXEL_COLORS.timber, 0.5, 0.76, 0.827, 0.25, 0.045, 0.03);
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
    // Plank seams across the stall front, and a timber post at each corner.
    add(context, `market-stall-${name}-timber-seam`, 'matte', shade(VOXEL_COLORS.timber, 1.2), x, 0.4, 0.79, 0.28, 0.03, 0.02);
    add(context, `market-stall-${name}-post`, 'matte', VOXEL_COLORS.timberDark, x - 0.14, 0.12, 0.78, 0.04, 0.58, 0.04);
    add(context, `market-awning-${name}`, 'matte', name === 'left' ? context.team : shade(context.team, 0.72), x, 0.7, 0.56, 0.36, 0.12, 0.52);
  }
  add(context, 'market-crate-left', 'matte', VOXEL_COLORS.timberDark, 0.2, 0.12, 0.82, 0.13, 0.2, 0.13);
  add(context, 'market-crate-right', 'matte', VOXEL_COLORS.thatch, 0.8, 0.12, 0.82, 0.13, 0.2, 0.13);
  add(context, 'market-banner-pole', 'metal', VOXEL_COLORS.steelDark, 0.5, 0.12, 0.25, 0.018, 1.35, 0.018);
  add(context, 'market-banner', 'matte', context.team, 0.54, 1.14, 0.25, 0.11, 0.22, 0.025);
}

// M5 naval: a boathouse set back on the land side with a plank pier running
// out toward the water, plus mooring posts and a hull under repair. The pier
// deliberately reaches to the footprint edge so the building reads as
// belonging to the waterline it must be built against.
function dock(context: BuildingContext): void {
  // Boathouse: an open-fronted shed at the landward end.
  add(context, 'dock-house', 'matte', VOXEL_COLORS.timber, 0.5, 0, 0.26, 0.62, 0.5, 0.4);
  add(context, 'dock-house-roof', 'matte', mixTint(VOXEL_COLORS.thatch, context.team, 0.55), 0.5, 0.5, 0.26, 0.7, 0.14, 0.48);
  add(context, 'dock-house-post-left', 'matte', VOXEL_COLORS.timberDark, 0.23, 0, 0.44, 0.06, 0.5, 0.06);
  add(context, 'dock-house-post-right', 'matte', VOXEL_COLORS.timberDark, 0.77, 0, 0.44, 0.06, 0.5, 0.06);
  // Pier decking, running out over the water side.
  add(context, 'dock-pier', 'matte', shade(VOXEL_COLORS.timber, 0.88), 0.5, 0.04, 0.72, 0.46, 0.08, 0.56);
  for (const [name, z] of [['near', 0.6], ['far', 0.92]] as const) {
    add(context, `dock-pier-plank-${name}`, 'matte', VOXEL_COLORS.timberDark, 0.5, 0.12, z, 0.46, 0.02, 0.03);
  }
  // Mooring posts at the seaward corners, with a coil of rope on one.
  add(context, 'dock-mooring-left', 'matte', VOXEL_COLORS.timberDark, 0.3, 0.12, 0.95, 0.07, 0.28, 0.07);
  add(context, 'dock-mooring-right', 'matte', VOXEL_COLORS.timberDark, 0.7, 0.12, 0.95, 0.07, 0.28, 0.07);
  add(context, 'dock-rope-coil', 'matte', VOXEL_COLORS.cloth, 0.7, 0.38, 0.95, 0.11, 0.05, 0.11);
  // A hull on the slipway, and the owner's pennant over the boathouse.
  add(context, 'dock-hull', 'matte', shade(VOXEL_COLORS.timber, 1.1), 0.24, 0.1, 0.74, 0.16, 0.12, 0.34);
  add(context, 'dock-banner-pole', 'metal', VOXEL_COLORS.steelDark, 0.5, 0.64, 0.1, 0.018, 0.5, 0.018);
  add(context, 'dock-banner', 'matte', context.team, 0.54, 0.94, 0.1, 0.1, 0.18, 0.024);
}

// An Outpost is four legs, a ladder and a railed platform with a lookout on it
// — deliberately open, because the one thing a player must read at a glance is
// that this is NOT a tower and will not shoot back.
function outpost(context: BuildingContext): void {
  for (const [name, x, z] of [
    ['front-left', 0.3, 0.3], ['front-right', 0.7, 0.3],
    ['back-left', 0.3, 0.7], ['back-right', 0.7, 0.7],
  ] as const) {
    add(context, `outpost-leg-${name}`, 'matte', VOXEL_COLORS.timberDark, x, 0, z, 0.07, 0.9, 0.07);
  }
  // Cross-brace, so the legs read as a frame rather than four separate posts.
  add(context, 'outpost-brace', 'matte', VOXEL_COLORS.timberDark, 0.5, 0.42, 0.3, 0.5, 0.04, 0.04);
  add(context, 'outpost-platform', 'matte', VOXEL_COLORS.timber, 0.5, 0.9, 0.5, 0.62, 0.09, 0.62);
  // Rail on three sides; the fourth is where the ladder comes up.
  add(context, 'outpost-rail-back', 'matte', VOXEL_COLORS.timber, 0.5, 1.12, 0.78, 0.62, 0.16, 0.05);
  add(context, 'outpost-rail-left', 'matte', VOXEL_COLORS.timber, 0.22, 1.12, 0.5, 0.05, 0.16, 0.62);
  add(context, 'outpost-rail-right', 'matte', VOXEL_COLORS.timber, 0.78, 1.12, 0.5, 0.05, 0.16, 0.62);
  // Ladder up the open face.
  add(context, 'outpost-ladder', 'matte', VOXEL_COLORS.timberDark, 0.5, 0.45, 0.2, 0.22, 0.9, 0.03);
  // The lookout, in the owner's colour — the only team-coloured part, so
  // ownership reads from the one thing that moves the eye.
  add(context, 'outpost-watchman', 'matte', context.team, 0.5, 1.14, 0.42, 0.16, 0.28, 0.16);
}

// A Fish Trap is a ring of stakes with netting slung between them, standing in
// the water — low and dark, so it reads as tackle rather than as a structure.
function fishTrap(context: BuildingContext): void {
  for (const [name, x, z] of [
    ['nw', 0.24, 0.24], ['ne', 0.76, 0.24], ['sw', 0.24, 0.76], ['se', 0.76, 0.76],
  ] as const) {
    add(context, `fish-trap-stake-${name}`, 'matte', VOXEL_COLORS.timberDark, x, 0, z, 0.06, 0.46, 0.06);
  }
  // Netting: four low panels between the stakes.
  add(context, 'fish-trap-net-north', 'matte', VOXEL_COLORS.cloth, 0.5, 0.18, 0.24, 0.52, 0.2, 0.02);
  add(context, 'fish-trap-net-south', 'matte', VOXEL_COLORS.cloth, 0.5, 0.18, 0.76, 0.52, 0.2, 0.02);
  add(context, 'fish-trap-net-west', 'matte', VOXEL_COLORS.cloth, 0.24, 0.18, 0.5, 0.02, 0.2, 0.52);
  add(context, 'fish-trap-net-east', 'matte', VOXEL_COLORS.cloth, 0.76, 0.18, 0.5, 0.02, 0.2, 0.52);
  // A marker float in the owner's colour, so whose trap it is reads at a glance.
  add(context, 'fish-trap-marker', 'matte', context.team, 0.5, 0.4, 0.5, 0.14, 0.14, 0.14);
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

// A gate reads as a wall with a way through it: two piers carrying a lintel,
// with the road left open between them. The piers are taller and heavier than
// the wall's own mass so a long line's opening is findable at a glance, which is
// the whole point of building one.
function gate(context: BuildingContext): void {
  const timber = context.entity.entityType === 'palisade-gate';
  const pier = timber ? VOXEL_COLORS.timberDark : VOXEL_COLORS.stone;
  const cap = timber ? VOXEL_COLORS.timber : VOXEL_COLORS.stoneLight;
  // Two piers carrying a lintel, with one door hung between them. The piers
  // stand taller than the wall they interrupt and the lintel bridges them, so
  // the opening in a long line reads as a portal from across the map — which is
  // the only reason to look for a gate in the first place. A first attempt hung
  // two half-doors and read as two dark slots instead of one way through.
  // Every part stays inside the 1x1 footprint: the caps are the widest thing
  // here, so they set the pier centres rather than the other way round.
  for (const [side, centerX] of [['left', 0.15], ['right', 0.85]] as const) {
    add(context, `gate-pier-${side}`, 'matte', pier, centerX, 0, 0.5, 0.26, 1.12, 0.62);
    add(context, `gate-pier-cap-${side}`, 'matte', cap, centerX, 1.12, 0.5, 0.3, 0.14, 0.68);
  }
  add(context, 'gate-lintel', 'matte', cap, 0.5, 1.0, 0.5, 0.78, 0.16, 0.56);
  // The door sits back from the piers' faces so the opening keeps a visible
  // depth rather than reading as one flat wall.
  add(context, 'gate-door', 'matte', VOXEL_COLORS.timber, 0.5, 0.04, 0.5, 0.5, 0.96, 0.2);
  add(context, 'gate-door-band', 'matte', VOXEL_COLORS.timberDark, 0.5, 0.62, 0.5, 0.52, 0.08, 0.24);
  add(context, 'gate-team-banner', 'matte', context.team, 0.5, 1.02, 0.79, 0.26, 0.22, 0.04);
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
    // (role dispatch below; a 'damaged' building renders its normal body and
    // then wears fire — see the flames appended after the switch.)
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
    case 'gate': gate(context); break;
    case 'dock': dock(context); break;
    case 'outpost': outpost(context); break;
    case 'fish-trap': fishTrap(context); break;
  }
  context.parts.push(...createBuildingDetailParts(entity, identity, ground));
  if (entity.visualVariant === 'damaged') {
    context.parts.push(...damageFlames(entity, identity, ground, width, depth));
  }
  return context.parts;
}

