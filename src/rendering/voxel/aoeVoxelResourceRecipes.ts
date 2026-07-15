import type { ProjectedEntityView, ResourceKind } from '../../game/simulation/types';
import {
  contactShadow,
  hash01,
  makePart,
  shade,
  VOXEL_COLORS,
  type VoxelPart,
  type VoxelSurface,
} from './aoeVoxelRecipeTypes';

interface ResourceContext {
  readonly entity: ProjectedEntityView;
  readonly identity: string;
  readonly ground: number;
  readonly centerX: number;
  readonly centerZ: number;
  readonly scale: number;
  readonly parts: VoxelPart[];
}

function add(
  context: ResourceContext,
  suffix: string,
  surface: VoxelSurface,
  tint: number,
  offsetX: number,
  bottom: number,
  offsetZ: number,
  width: number,
  height: number,
  depth: number,
  rotation: { readonly yaw?: number; readonly roll?: number } = {},
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

// Per-instance variation (spec §14.5, user directive 2026-07-14). Seeded by
// the resource's MAP POSITION: immobile resources never move, so this is
// stable across every frame, save/load, and replay — no per-frame or
// per-load randomness anywhere. `vary(seed, spread)` returns a symmetric
// deviation in [-spread, +spread].
function vary(context: ResourceContext, seed: number, spread: number): number {
  return (hash01(context.entity.x, context.entity.y, seed) - 0.5) * 2 * spread;
}

function tree(context: ResourceContext): void {
  // Trunk height and a slight whole-tree lean.
  const jitter = 0.94 + vary(context, 11, 0.16);
  const leanRoll = vary(context, 12, 0.07);
  add(context, 'tree-trunk', 'matte', VOXEL_COLORS.timber, 0, 0, 0, 0.25, 1.22 * jitter, 0.25, { roll: leanRoll });
  add(context, 'tree-trunk-light', 'matte', shade(VOXEL_COLORS.timber, 1.18), -0.08, 0.18, 0.13, 0.07, 0.75, 0.06, { roll: leanRoll });
  // Canopy: each block gets its own offset, size, and yaw so no two trees
  // share a silhouette. Bounds stay inside the cell (max |offset| + half
  // width < 0.85) and the crown stack keeps its layered read.
  const crownLift = 1 + vary(context, 20, 0.1);
  add(
    context, 'tree-crown-left', 'matte', VOXEL_COLORS.foliageDark,
    -0.32 + vary(context, 13, 0.1), (0.72 + vary(context, 21, 0.08)) * crownLift, 0.1 + vary(context, 14, 0.1),
    0.78 + vary(context, 15, 0.12), 0.68 + vary(context, 22, 0.1), 0.72 + vary(context, 16, 0.12),
    { yaw: vary(context, 17, 0.5) },
  );
  add(
    context, 'tree-crown-right', 'matte', VOXEL_COLORS.foliage,
    0.32 + vary(context, 18, 0.1), (0.82 + vary(context, 23, 0.08)) * crownLift, -0.08 + vary(context, 19, 0.1),
    0.72 + vary(context, 24, 0.12), 0.72 + vary(context, 25, 0.1), 0.68 + vary(context, 26, 0.12),
    { yaw: vary(context, 27, 0.5) },
  );
  add(
    context, 'tree-crown-center', 'matte', context.entity.tint,
    vary(context, 28, 0.07), (1.02 + vary(context, 29, 0.09)) * crownLift, vary(context, 30, 0.07),
    0.92 + vary(context, 31, 0.1), 0.78 + vary(context, 32, 0.1), 0.86 + vary(context, 33, 0.1),
    { yaw: vary(context, 34, 0.5) },
  );
  add(
    context, 'tree-crown-top', 'matte', VOXEL_COLORS.foliageLight,
    -0.16 + vary(context, 35, 0.12), (1.55 + vary(context, 36, 0.1)) * crownLift, -0.08 + vary(context, 37, 0.12),
    0.54 + vary(context, 38, 0.12), 0.42 + vary(context, 39, 0.1), 0.5 + vary(context, 40, 0.12),
    { yaw: vary(context, 41, 0.6) },
  );
}

function mine(context: ResourceContext, kind: 'gold-mine' | 'stone-mine'): void {
  const base = kind === 'gold-mine' ? 0xc89f39 : 0x818784;
  const light = kind === 'gold-mine' ? VOXEL_COLORS.gold : VOXEL_COLORS.stoneLight;
  const rocks = [
    ['center', 0, 0, 0.62, 0.72],
    ['left', -0.34, 0.08, 0.48, 0.5],
    ['right', 0.34, -0.06, 0.5, 0.56],
    ['front', 0.08, 0.31, 0.43, 0.44],
    ['back', -0.12, -0.32, 0.4, 0.46],
  ] as const;
  // Per-instance layout variation (spec §14.5): each rock shifts, resizes,
  // and turns on its own position-seeded deviation, so a mine cluster reads
  // as distinct deposits rather than one shape stamped repeatedly. Offsets
  // stay small enough that every rock remains inside the cell.
  for (const [index, [name, x, z, width, height]] of rocks.entries()) {
    const seed = 40 + index * 7;
    const rockWidth = width * (1 + vary(context, seed + 1, 0.16));
    add(
      context,
      `${kind}-rock-${name}`,
      'matte',
      name === 'center' ? base : shade(base, 0.82 + name.length * 0.03),
      x + vary(context, seed + 2, 0.1),
      0,
      z + vary(context, seed + 3, 0.1),
      rockWidth,
      height * (1 + vary(context, seed + 4, 0.18)),
      rockWidth * 0.82,
      {
        yaw: vary(context, seed + 5, 0.45),
        roll: (name === 'center' ? 0.12 : -0.08) + vary(context, seed + 6, 0.06),
      },
    );
  }
  add(
    context, `${kind}-glint`, kind === 'gold-mine' ? 'metal' : 'matte', light,
    -0.12 + vary(context, 80, 0.16), 0.59 + vary(context, 81, 0.1), 0.16 + vary(context, 82, 0.16),
    0.24, 0.14, 0.16, { roll: -0.25 + vary(context, 83, 0.3) },
  );
  add(
    context, `${kind}-vein`, kind === 'gold-mine' ? 'metal' : 'matte', light,
    0.27 + vary(context, 84, 0.14), 0.3 + vary(context, 85, 0.12), 0.25 + vary(context, 86, 0.14),
    0.08, 0.34 * (1 + vary(context, 87, 0.25)), 0.08, { roll: 0.38 + vary(context, 88, 0.35) },
  );
}

function berryBush(context: ResourceContext): void {
  add(context, 'berry-bush-stem-left', 'matte', VOXEL_COLORS.timber, -0.2, 0, 0.08, 0.08, 0.46, 0.08, { roll: -0.3 });
  add(context, 'berry-bush-stem-right', 'matte', VOXEL_COLORS.timber, 0.2, 0, -0.04, 0.08, 0.44, 0.08, { roll: 0.3 });
  add(context, 'berry-bush-leaves-left', 'matte', VOXEL_COLORS.foliageDark, -0.27, 0.18, 0.08, 0.52, 0.46, 0.46);
  add(context, 'berry-bush-leaves-right', 'matte', VOXEL_COLORS.foliage, 0.27, 0.2, -0.04, 0.5, 0.48, 0.44);
  add(context, 'berry-bush-leaves-center', 'matte', VOXEL_COLORS.foliageLight, 0, 0.38, 0, 0.58, 0.48, 0.52);
  add(context, 'berry-bush-berry-left', 'matte', context.entity.tint, -0.22, 0.42, 0.3, 0.14, 0.14, 0.13);
  add(context, 'berry-bush-berry-right', 'matte', context.entity.tint, 0.24, 0.5, 0.26, 0.14, 0.14, 0.13);
  add(context, 'berry-bush-berry-top', 'matte', VOXEL_COLORS.berry, 0.02, 0.7, 0.12, 0.13, 0.13, 0.12);
}

function sheep(context: ResourceContext): void {
  add(context, 'sheep-leg-front-left', 'matte', VOXEL_COLORS.leather, 0.25, 0, 0.18, 0.1, 0.32, 0.1);
  add(context, 'sheep-leg-front-right', 'matte', VOXEL_COLORS.leather, 0.25, 0, -0.18, 0.1, 0.32, 0.1);
  add(context, 'sheep-leg-back-left', 'matte', VOXEL_COLORS.leather, -0.25, 0, 0.18, 0.1, 0.32, 0.1);
  add(context, 'sheep-leg-back-right', 'matte', VOXEL_COLORS.leather, -0.25, 0, -0.18, 0.1, 0.32, 0.1);
  add(context, 'sheep-body', 'matte', 0xe6dfcc, 0, 0.28, 0, 0.82, 0.56, 0.54);
  add(context, 'sheep-wool-top', 'matte', 0xf2ead6, -0.08, 0.72, 0, 0.58, 0.34, 0.46);
  add(context, 'sheep-head', 'matte', shade(context.entity.tint, 0.72), 0.48, 0.48, -0.02, 0.3, 0.32, 0.3);
  add(context, 'sheep-ear', 'matte', VOXEL_COLORS.leather, 0.52, 0.72, 0.05, 0.34, 0.08, 0.1, { yaw: -0.3 });
}

function boar(context: ResourceContext): void {
  add(context, 'boar-leg-left', 'matte', VOXEL_COLORS.timberDark, -0.22, 0, 0.18, 0.13, 0.36, 0.13);
  add(context, 'boar-leg-right', 'matte', VOXEL_COLORS.timberDark, 0.22, 0, -0.16, 0.13, 0.36, 0.13);
  add(context, 'boar-body', 'matte', context.entity.tint, 0, 0.27, 0, 0.88, 0.58, 0.52);
  add(context, 'boar-bristles', 'matte', shade(context.entity.tint, 0.6), -0.08, 0.77, -0.02, 0.62, 0.16, 0.22);
  add(context, 'boar-head', 'matte', shade(context.entity.tint, 0.82), 0.5, 0.38, -0.04, 0.4, 0.4, 0.4);
  add(context, 'boar-tusk-left', 'metal', 0xeee0c2, 0.7, 0.36, 0.14, 0.08, 0.24, 0.08, { roll: -0.42 });
  add(context, 'boar-tusk-right', 'metal', 0xeee0c2, 0.7, 0.36, -0.14, 0.08, 0.24, 0.08, { roll: -0.42 });
}

function wolf(context: ResourceContext): void {
  add(context, 'wolf-leg-front', 'matte', shade(context.entity.tint, 0.68), 0.28, 0, -0.14, 0.12, 0.4, 0.12);
  add(context, 'wolf-leg-back', 'matte', shade(context.entity.tint, 0.68), -0.28, 0, 0.14, 0.12, 0.4, 0.12);
  add(context, 'wolf-body', 'matte', context.entity.tint, 0, 0.31, 0, 0.9, 0.45, 0.38, { yaw: -0.22 });
  add(context, 'wolf-neck', 'matte', shade(context.entity.tint, 0.84), 0.38, 0.52, -0.12, 0.34, 0.44, 0.32, { roll: -0.25 });
  add(context, 'wolf-head', 'matte', context.entity.tint, 0.55, 0.72, -0.18, 0.36, 0.3, 0.3);
  add(context, 'wolf-ear-left', 'matte', shade(context.entity.tint, 0.6), 0.48, 1.01, -0.1, 0.12, 0.22, 0.12);
  add(context, 'wolf-ear-right', 'matte', shade(context.entity.tint, 0.6), 0.62, 0.99, -0.22, 0.12, 0.2, 0.12);
  add(context, 'wolf-tail', 'matte', shade(context.entity.tint, 0.7), -0.56, 0.42, 0.22, 0.13, 0.7, 0.13, { roll: 0.72 });
}

function fish(context: ResourceContext): void {
  add(context, 'fish-body', 'matte', context.entity.tint, 0, 0.03, 0, 0.72, 0.22, 0.32, { yaw: -0.45 });
  add(context, 'fish-head', 'matte', shade(context.entity.tint, 1.15), 0.32, 0.05, -0.15, 0.26, 0.24, 0.28, { yaw: -0.45 });
  add(context, 'fish-tail-upper', 'matte', shade(context.entity.tint, 0.75), -0.38, 0.12, 0.18, 0.1, 0.36, 0.12, { roll: -0.52, yaw: -0.45 });
  add(context, 'fish-tail-lower', 'matte', shade(context.entity.tint, 0.75), -0.38, -0.04, 0.18, 0.1, 0.36, 0.12, { roll: 0.52, yaw: -0.45 });
  add(context, 'fish-fin', 'matte', shade(context.entity.tint, 0.7), 0, 0.22, 0, 0.2, 0.18, 0.08, { roll: -0.4 });
}

function relic(context: ResourceContext): void {
  add(context, 'relic-pedestal', 'matte', VOXEL_COLORS.stoneDark, 0, 0, 0, 0.58, 0.18, 0.52);
  add(context, 'relic-step', 'matte', VOXEL_COLORS.stoneLight, 0, 0.18, 0, 0.42, 0.16, 0.38);
  add(context, 'relic-shrine', 'metal', VOXEL_COLORS.gold, 0, 0.34, 0, 0.25, 0.62, 0.22);
  add(context, 'relic-gem', 'matte', context.entity.tint, 0, 0.72, 0.13, 0.16, 0.18, 0.08);
  add(context, 'relic-upright', 'metal', VOXEL_COLORS.gold, 0, 0.94, 0, 0.07, 0.52, 0.07);
  add(context, 'relic-crossbar', 'metal', VOXEL_COLORS.gold, 0, 1.24, 0, 0.36, 0.07, 0.07);
}

function farm(context: ResourceContext): void {
  add(context, 'farm-resource-soil', 'matte', VOXEL_COLORS.soil, 0, 0, 0, 0.94, 0.08, 0.9);
  for (let row = 0; row < 5; row += 1) {
    add(context, `farm-resource-row-${String(row)}`, 'matte', row % 2 ? VOXEL_COLORS.thatch : VOXEL_COLORS.foliageLight, -0.36 + row * 0.18, 0.08, 0, 0.06, 0.2, 0.74);
  }
}

// Spec §14.5 wildlife carcass: a killed huntable is tipped onto its side so
// it reads as dead at default zoom, for as long as the simulation keeps its
// gatherable corpse. Render-only — the part SET is unchanged (the hit
// silhouette derives from these same parts), every part stays inside the
// footprint cell, and the ground shadow stays planted.
const CARCASS_ROLL = Math.PI / 2;

function fellWildlifeParts(parts: VoxelPart[], entity: ProjectedEntityView): VoxelPart[] {
  const rootX = entity.x + 0.5;
  const rootZ = entity.y + 0.5;
  return parts.map((part) => {
    if (part.surface === 'shadow') return part;
    // Rotate the body about the root's forward axis: height becomes lateral
    // spread and the mass settles at ground level.
    const localY = part.centerY;
    const localZ = part.centerZ - rootZ;
    return {
      ...part,
      centerY: Math.max(0.04, localZ === 0 ? localY * 0.22 : Math.abs(localZ) * 0.5 + 0.04),
      centerZ: rootZ + Math.max(-0.42, Math.min(0.42, localY * 0.6 - 0.1)),
      centerX: rootX + Math.max(-0.42, Math.min(0.42, (part.centerX - rootX) * 0.9)),
      roll: (part.roll ?? 0) + CARCASS_ROLL,
    };
  });
}

export function createResourceParts(
  entity: ProjectedEntityView,
  identity: string,
  ground: number,
): VoxelPart[] {
  const scale = Math.max(0.38, entity.size);
  const context: ResourceContext = {
    entity,
    identity,
    ground,
    centerX: entity.x + 0.5,
    centerZ: entity.y + 0.5,
    scale,
    parts: [...contactShadow(entity, identity, 'resource-shadow', entity.x + 0.5, ground, entity.y + 0.5, scale * 0.88, scale * 0.64)],
  };
  switch (entity.entityType as ResourceKind) {
    case 'tree': tree(context); break;
    case 'gold-mine': mine(context, 'gold-mine'); break;
    case 'stone-mine': mine(context, 'stone-mine'); break;
    case 'berry-bush': berryBush(context); break;
    case 'sheep': sheep(context); break;
    case 'boar': boar(context); break;
    case 'wolf': wolf(context); break;
    case 'fish': fish(context); break;
    case 'relic': relic(context); break;
    case 'farm': farm(context); break;
  }
  return entity.wildlifeAlive === false
    ? fellWildlifeParts(context.parts, entity)
    : context.parts;
}
