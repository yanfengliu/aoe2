import type { ProjectedEntityView } from '../../game/simulation/types';

export type VoxelSurface = 'matte' | 'metal' | 'shadow' | 'memory';

export interface VoxelPart {
  readonly key: string;
  readonly surface: VoxelSurface;
  readonly tint: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly centerZ: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly yaw?: number;
  readonly roll?: number;
}

export const VOXEL_COLORS = {
  shadow: 0x172019,
  plaster: 0xd8c79f,
  plasterLight: 0xeadbb7,
  stone: 0xa9a79d,
  stoneLight: 0xc4c0b3,
  stoneDark: 0x6f716d,
  timber: 0x744927,
  timberDark: 0x412d20,
  roofTile: 0x8f4632,
  roofTileDark: 0x643225,
  thatch: 0xc0a35f,
  soil: 0x765331,
  soilDark: 0x493522,
  foliage: 0x39703e,
  foliageDark: 0x24512f,
  foliageLight: 0x5c8c4d,
  skin: 0xd5a77d,
  skinDark: 0xa97455,
  cloth: 0xb9a889,
  leather: 0x5b3c28,
  steel: 0xb9c2c1,
  steelDark: 0x687473,
  gold: 0xd9ae3d,
  waterGlint: 0x70acc2,
  window: 0x76979b,
  berry: 0x8b3352,
} as const;

export function requireTint(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffff) {
    throw new RangeError('Projected tint must be an integer from 0x000000 to 0xffffff.');
  }
  return value;
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function shade(tint: number, multiplier: number): number {
  requireTint(tint);
  if (!Number.isFinite(multiplier) || multiplier < 0) {
    throw new RangeError('Color multiplier must be a non-negative finite number.');
  }
  const channel = (shift: number) => clampChannel(((tint >>> shift) & 0xff) * multiplier);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export function mixTint(a: number, b: number, amount: number): number {
  requireTint(a);
  requireTint(b);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError('Color mix amount must be from 0 through 1.');
  }
  const channel = (shift: number) => clampChannel(
    ((a >>> shift) & 0xff) * (1 - amount) + ((b >>> shift) & 0xff) * amount,
  );
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export function memoryTint(tint: number): number {
  const gray = (
    ((tint >>> 16) & 0xff)
    + ((tint >>> 8) & 0xff)
    + (tint & 0xff)
  ) / 3;
  const fade = (shift: number) => clampChannel(((tint >>> shift) & 0xff) * 0.42 + gray * 0.3);
  return (fade(16) << 16) | (fade(8) << 8) | fade(0);
}

export function hash01(x: number, z: number, salt = 0): number {
  let hash = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263)
    + Math.imul(salt | 0, -2048144789)) | 0;
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

export function makePart(
  entity: ProjectedEntityView,
  identity: string,
  suffix: string,
  surface: VoxelSurface,
  tint: number,
  centerX: number,
  centerY: number,
  centerZ: number,
  width: number,
  height: number,
  depth: number,
  rotation: { readonly yaw?: number; readonly roll?: number } = {},
): VoxelPart {
  if (identity.length === 0 || suffix.length === 0) throw new Error('Voxel part keys must not be empty.');
  for (const [name, value] of Object.entries({ centerX, centerY, centerZ })) {
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
  }
  for (const [name, value] of Object.entries({ width, height, depth })) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`${name} must be a positive finite number.`);
    }
  }
  if (rotation.yaw !== undefined && !Number.isFinite(rotation.yaw)) {
    throw new RangeError('yaw must be finite.');
  }
  if (rotation.roll !== undefined && !Number.isFinite(rotation.roll)) {
    throw new RangeError('roll must be finite.');
  }
  const resolvedTint = entity.isMemory ? memoryTint(tint) : requireTint(tint);
  return {
    key: `${identity}:${suffix}`,
    surface: entity.isMemory ? 'memory' : surface,
    tint: resolvedTint,
    centerX,
    centerY,
    centerZ,
    width,
    height,
    depth,
    ...rotation,
  };
}

export function contactShadow(
  entity: ProjectedEntityView,
  identity: string,
  suffix: string,
  centerX: number,
  ground: number,
  centerZ: number,
  width: number,
  depth: number,
): VoxelPart[] {
  if (entity.isMemory) return [];
  return [makePart(
    entity,
    identity,
    suffix,
    'shadow',
    VOXEL_COLORS.shadow,
    centerX,
    ground + 0.018,
    centerZ,
    width,
    0.036,
    depth,
  )];
}

/** Column-major transform for a centred unit cube: translation * yaw * roll * scale. */
export function matrixForPart(part: VoxelPart): readonly number[] {
  const yaw = part.yaw ?? 0;
  const roll = part.roll ?? 0;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  return [
    cy * cr * part.width,
    sr * part.width,
    -sy * cr * part.width,
    0,
    -cy * sr * part.height,
    cr * part.height,
    sy * sr * part.height,
    0,
    sy * part.depth,
    0,
    cy * part.depth,
    0,
    part.centerX,
    part.centerY,
    part.centerZ,
    1,
  ];
}

export function compareParts(a: VoxelPart, b: VoxelPart): number {
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}
