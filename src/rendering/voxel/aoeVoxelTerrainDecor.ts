// Land-cell decoration drawn from small procedural variant libraries —
// grass tuft clusters, scattered flecks, pebbles, and hill stone formations —
// selected and parameterized per tile by position hashes. Deterministic:
// equal cells always decorate identically; nothing here reads time.
import type { ProjectedEntityView, TerrainKind } from '../../game/simulation/types';
import { hash01, makePart, shade, VOXEL_COLORS, type VoxelPart } from './aoeVoxelRecipeTypes';

interface BladeSpec {
  /** Offset from the cluster anchor before the cluster yaw is applied. */
  readonly dx: number;
  readonly dz: number;
  readonly heightScale: number;
}

// Tuft cluster library: pair, fan, ring, tall sentinel, low patch. Offsets
// stay within 0.16 of the anchor so leaned blades never leave the cell.
const TUFT_VARIANTS: readonly (readonly BladeSpec[])[] = [
  [{ dx: -0.07, dz: 0.02, heightScale: 1 }, { dx: 0.07, dz: -0.03, heightScale: 0.82 }],
  [
    { dx: -0.11, dz: 0.04, heightScale: 0.72 },
    { dx: 0, dz: -0.02, heightScale: 1.05 },
    { dx: 0.1, dz: 0.05, heightScale: 0.85 },
  ],
  [
    { dx: -0.09, dz: -0.08, heightScale: 0.8 },
    { dx: 0.1, dz: -0.06, heightScale: 0.95 },
    { dx: 0.08, dz: 0.09, heightScale: 0.75 },
    { dx: -0.06, dz: 0.1, heightScale: 0.9 },
  ],
  [{ dx: 0, dz: 0, heightScale: 1.2 }, { dx: 0.09, dz: 0.06, heightScale: 0.55 }],
  [
    { dx: -0.12, dz: 0, heightScale: 0.55 },
    { dx: -0.02, dz: 0.06, heightScale: 0.62 },
    { dx: 0.08, dz: -0.04, heightScale: 0.5 },
    { dx: 0.14, dz: 0.06, heightScale: 0.58 },
    { dx: 0.02, dz: -0.1, heightScale: 0.66 },
  ],
];

interface StoneSpec {
  readonly dx: number;
  readonly dz: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  /** Stacked stones sit on top of the formation's first stone. */
  readonly stacked?: boolean;
}

// Stone formation library: boulder+shard, twin boulders, slab cluster, cairn.
// Sizes ≤0.26×0.20 and offsets ≤0.10 keep rotated corners inside the cell.
const ROCK_VARIANTS: readonly (readonly StoneSpec[])[] = [
  [
    { dx: -0.03, dz: 0.02, width: 0.24, height: 0.2, depth: 0.18 },
    { dx: 0.1, dz: -0.06, width: 0.12, height: 0.13, depth: 0.1 },
  ],
  [
    { dx: -0.07, dz: 0, width: 0.19, height: 0.16, depth: 0.15 },
    { dx: 0.08, dz: 0.05, width: 0.17, height: 0.14, depth: 0.14 },
  ],
  [
    { dx: -0.08, dz: -0.05, width: 0.2, height: 0.07, depth: 0.14 },
    { dx: 0.06, dz: 0.02, width: 0.24, height: 0.06, depth: 0.16 },
    { dx: -0.02, dz: 0.09, width: 0.16, height: 0.08, depth: 0.12 },
  ],
  [
    { dx: 0, dz: 0, width: 0.22, height: 0.14, depth: 0.18 },
    { dx: 0.02, dz: -0.01, width: 0.14, height: 0.1, depth: 0.12, stacked: true },
  ],
];

const STONE_TINTS = [VOXEL_COLORS.stone, VOXEL_COLORS.stoneLight, VOXEL_COLORS.stoneDark] as const;

function rotated(dx: number, dz: number, yaw: number): { dx: number; dz: number } {
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  return { dx: dx * cosine + dz * sine, dz: -dx * sine + dz * cosine };
}

/** Pebble scatter shared by grass and hills: 1-4 squashed stones. */
function pebbleParts(
  entity: ProjectedEntityView,
  identity: string,
  prefix: string,
  x: number,
  z: number,
): VoxelPart[] {
  const parts: VoxelPart[] = [];
  const count = 1 + Math.floor(hash01(x, z, 179) * 4);
  const anchorX = 0.3 + hash01(x, z, 181) * 0.4;
  const anchorZ = 0.3 + hash01(x, z, 191) * 0.4;
  for (let index = 0; index < count; index += 1) {
    // Salt block 300+ is reserved for pebbles: it must stay disjoint from the
    // 131-262 land/rock streams so co-resident decorations never correlate.
    const salt = 300 + index * 11;
    const size = 0.05 + hash01(x, z, salt) * 0.08;
    const grey = STONE_TINTS[Math.floor(hash01(x, z, salt + 1) * STONE_TINTS.length)]!;
    parts.push(makePart(
      entity,
      identity,
      `${prefix}-${String(index)}`,
      'matte',
      shade(grey, 0.92 + hash01(x, z, salt + 2) * 0.16),
      x + anchorX + (hash01(x, z, salt + 3) - 0.5) * 0.24,
      size * 0.3,
      z + anchorZ + (hash01(x, z, salt + 4) - 0.5) * 0.24,
      size,
      size * 0.6,
      size * (0.75 + hash01(x, z, salt + 5) * 0.5),
      { yaw: hash01(x, z, salt + 6) * Math.PI },
    ));
  }
  return parts;
}

function grassParts(
  entity: ProjectedEntityView,
  identity: string,
  x: number,
  z: number,
): VoxelPart[] {
  const parts: VoxelPart[] = [];
  if (hash01(x, z, 131) < 0.55) {
    const count = hash01(x, z, 132) < 0.25 ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      const salt = 133 + index * 13;
      const light = hash01(x, z, salt) < 0.7;
      parts.push(makePart(
        entity,
        identity,
        `grass-fleck-${String(index)}`,
        'matte',
        shade(entity.tint, light ? 1.1 + hash01(x, z, salt + 1) * 0.12 : 0.82),
        x + 0.18 + hash01(x, z, salt + 2) * 0.64,
        0.018,
        z + 0.18 + hash01(x, z, salt + 3) * 0.64,
        0.16 + hash01(x, z, salt + 4) * 0.18,
        0.022,
        0.03 + hash01(x, z, salt + 5) * 0.03,
        { yaw: (hash01(x, z, salt + 6) - 0.5) * 0.72 },
      ));
    }
  }
  if (hash01(x, z, 137) < 0.24) {
    const variant = Math.floor(hash01(x, z, 139) * TUFT_VARIANTS.length);
    const blades = TUFT_VARIANTS[variant]!;
    const anchorX = 0.28 + hash01(x, z, 149) * 0.44;
    const anchorZ = 0.28 + hash01(x, z, 151) * 0.44;
    const clusterYaw = hash01(x, z, 157) * Math.PI * 2;
    const heightJitter = 0.85 + hash01(x, z, 163) * 0.3;
    const palette = [
      VOXEL_COLORS.foliageDark,
      VOXEL_COLORS.foliage,
      VOXEL_COLORS.foliageLight,
      shade(entity.tint, 1.22),
      shade(entity.tint, 0.78),
    ] as const;
    for (const [index, blade] of blades.entries()) {
      const salt = 167 + index * 17;
      const offset = rotated(blade.dx, blade.dz, clusterYaw);
      const height = Math.min(0.42, 0.22 * blade.heightScale * heightJitter
        + hash01(x, z, salt) * 0.06);
      parts.push(makePart(
        entity,
        identity,
        `grass-tuft-v${String(variant)}-${String(index)}`,
        'matte',
        palette[Math.floor(hash01(x, z, salt + 1) * palette.length)]!,
        x + anchorX + offset.dx,
        height * 0.45,
        z + anchorZ + offset.dz,
        0.032 + hash01(x, z, salt + 2) * 0.01,
        height,
        0.032 + hash01(x, z, salt + 3) * 0.01,
        {
          yaw: clusterYaw + (hash01(x, z, salt + 4) - 0.5) * 0.5,
          roll: (hash01(x, z, salt + 5) - 0.5) * 0.56,
        },
      ));
    }
  }
  if (hash01(x, z, 173) < 0.1) parts.push(...pebbleParts(entity, identity, 'grass-pebble', x, z));
  return parts;
}

function hillParts(
  entity: ProjectedEntityView,
  identity: string,
  x: number,
  z: number,
): VoxelPart[] {
  const parts: VoxelPart[] = [];
  const noise = hash01(x, z, 79);
  if (noise < 0.58) {
    parts.push(makePart(
      entity,
      identity,
      'hill-strata-dark',
      'matte',
      shade(entity.tint, 0.72),
      x + 0.5,
      0.021,
      z + 0.5,
      0.55,
      0.026,
      0.045,
      { yaw: (hash01(x, z, 89) - 0.5) * 0.72 },
    ));
  }
  if (hash01(x, z, 211) < 0.3) {
    const variant = Math.floor(hash01(x, z, 223) * ROCK_VARIANTS.length);
    const anchorX = 0.3 + hash01(x, z, 227) * 0.4;
    const anchorZ = 0.3 + hash01(x, z, 229) * 0.4;
    const formationYaw = hash01(x, z, 233) * Math.PI;
    let baseTopY = 0;
    for (const [index, stone] of ROCK_VARIANTS[variant]!.entries()) {
      const salt = 239 + index * 19;
      const scale = 0.85 + hash01(x, z, salt) * 0.3;
      const offset = rotated(stone.dx, stone.dz, formationYaw);
      const height = stone.height * scale;
      const centerY = stone.stacked ? baseTopY + height * 0.42 : height * 0.46;
      if (!stone.stacked) baseTopY = Math.max(baseTopY, height * 0.92);
      parts.push(makePart(
        entity,
        identity,
        `hill-rock-v${String(variant)}-${String(index)}`,
        'matte',
        shade(
          STONE_TINTS[Math.floor(hash01(x, z, salt + 1) * STONE_TINTS.length)]!,
          0.9 + hash01(x, z, salt + 2) * 0.2,
        ),
        x + anchorX + offset.dx,
        centerY,
        z + anchorZ + offset.dz,
        Math.min(0.26, stone.width * scale),
        height,
        Math.min(0.2, stone.depth * scale),
        { yaw: formationYaw + (hash01(x, z, salt + 3) - 0.5) * 0.4 },
      ));
    }
  }
  if (hash01(x, z, 173) < 0.12) parts.push(...pebbleParts(entity, identity, 'hill-pebble', x, z));
  return parts;
}

function forestParts(
  entity: ProjectedEntityView,
  identity: string,
  x: number,
  z: number,
): VoxelPart[] {
  const parts: VoxelPart[] = [];
  const noise = hash01(x, z, 79);
  const accent = hash01(x, z, 83);
  if (noise < 0.42) {
    parts.push(makePart(
      entity,
      identity,
      'forest-leaf-litter',
      'matte',
      accent < 0.5 ? VOXEL_COLORS.soilDark : VOXEL_COLORS.foliageDark,
      x + 0.5,
      0.018,
      z + 0.5,
      0.26,
      0.022,
      0.11,
      { yaw: (hash01(x, z, 89) - 0.5) * 0.72 },
    ));
  }
  if (accent < 0.16) {
    parts.push(makePart(entity, identity, 'forest-log', 'matte', VOXEL_COLORS.timberDark, x + 0.5, 0.09, z + 0.5, 0.42, 0.14, 0.13, { yaw: noise * Math.PI }));
  }
  return parts;
}

export function landDecorParts(
  entity: ProjectedEntityView,
  identity: string,
  kind: TerrainKind,
  x: number,
  z: number,
): VoxelPart[] {
  if (kind === 'grass') return grassParts(entity, identity, x, z);
  if (kind === 'hill') return hillParts(entity, identity, x, z);
  if (kind === 'forest') return forestParts(entity, identity, x, z);
  return [];
}
