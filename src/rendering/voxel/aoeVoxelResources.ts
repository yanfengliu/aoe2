import type {
  GeometryResourceV1,
  InstanceBatchV1,
  InstanceTransformAnimationV1,
  MaterialResourceV1,
} from 'voxel/core';
import { MAX_ACTIVE_INSTANCE_ANIMATIONS_V1 } from 'voxel/core';
import { DensePaletteChunk, meshVisibleFaces } from 'voxel/meshing';

import {
  compareParts,
  matrixForPart,
  type VoxelPart,
  type VoxelSurface,
} from './aoeVoxelRecipeTypes';
import { TERRAIN_MATERIAL_KEY } from './aoeVoxelTerrain';

export const CUBE_GEOMETRY_KEY = 'aoe2:geometry:centered-cube';

const MATERIAL_KEYS = {
  matte: 'aoe2:material:matte',
  metal: 'aoe2:material:metal',
  shadow: 'aoe2:material:shadow',
  memory: 'aoe2:material:memory',
  ui: 'aoe2:material:ui',
} as const satisfies Record<VoxelSurface, string>;

const SURFACES = [
  'matte',
  'metal',
  'shadow',
  'memory',
  'ui',
] as const satisfies readonly VoxelSurface[];

function material(
  key: string,
  overrides: Partial<MaterialResourceV1> = {},
): MaterialResourceV1 {
  return {
    kind: 'material',
    key,
    incarnation: 1,
    revision: 1,
    shading: 'lambert',
    color: { r: 255, g: 255, b: 255, a: 255 },
    vertexColors: false,
    transparent: false,
    opacity: 1,
    doubleSided: false,
    roughness: 1,
    metalness: 0,
    ...overrides,
  };
}

const MATERIALS: readonly MaterialResourceV1[] = [
  material(TERRAIN_MATERIAL_KEY, { vertexColors: true }),
  material(MATERIAL_KEYS.matte),
  material(MATERIAL_KEYS.metal, { shading: 'standard', roughness: 0.48, metalness: 0.5 }),
  material(MATERIAL_KEYS.shadow, {
    shading: 'unlit',
    transparent: true,
    opacity: 0.22,
    doubleSided: true,
  }),
  material(MATERIAL_KEYS.memory, {
    transparent: true,
    opacity: 0.5,
  }),
  material(MATERIAL_KEYS.ui, {
    shading: 'unlit',
  }),
];

function centeredCubeGeometry(): GeometryResourceV1 {
  const chunk = new DensePaletteChunk({
    origin: { x: 0, y: 0, z: 0 },
    size: { x: 1, y: 1, z: 1 },
    voxels: new Uint16Array([1]),
  });
  const mesh = meshVisibleFaces(chunk);
  if (!mesh.bounds) throw new Error('Unit-cube meshing unexpectedly produced no bounds.');
  return {
    kind: 'geometry',
    key: CUBE_GEOMETRY_KEY,
    incarnation: 1,
    revision: 1,
    topology: 'triangles',
    positions: mesh.positions,
    normals: mesh.normals,
    indices: mesh.indices,
    // Group-less geometry lets each instance batch select its own material.
    groups: [],
    bounds: {
      min: { x: mesh.bounds.min[0], y: mesh.bounds.min[1], z: mesh.bounds.min[2] },
      max: { x: mesh.bounds.max[0], y: mesh.bounds.max[1], z: mesh.bounds.max[2] },
    },
    pivot: { x: 0.5, y: 0.5, z: 0.5 },
  };
}

const CUBE_GEOMETRY = centeredCubeGeometry();

function copyMaterial(resource: MaterialResourceV1): MaterialResourceV1 {
  return { ...resource, color: { ...resource.color } };
}

function copyGeometry(): GeometryResourceV1 {
  return {
    ...CUBE_GEOMETRY,
    positions: CUBE_GEOMETRY.positions.slice(),
    normals: CUBE_GEOMETRY.normals.slice(),
    indices: CUBE_GEOMETRY.indices.slice() as Uint16Array | Uint32Array,
    groups: CUBE_GEOMETRY.groups.map((group) => ({ ...group })),
    bounds: { min: { ...CUBE_GEOMETRY.bounds.min }, max: { ...CUBE_GEOMETRY.bounds.max } },
    pivot: { ...CUBE_GEOMETRY.pivot },
  };
}

export function copyAoeVoxelResources(): readonly (
  | MaterialResourceV1
  | GeometryResourceV1
)[] {
  return [...MATERIALS.map(copyMaterial), copyGeometry()];
}

function tintToBytes(tint: number): readonly [number, number, number, number] {
  return [(tint >>> 16) & 0xff, (tint >>> 8) & 0xff, tint & 0xff, 255];
}

function packedAnimation(parts: readonly VoxelPart[]): InstanceTransformAnimationV1 | undefined {
  if (!parts.some((part) => part.animation !== undefined)) return undefined;
  return {
    schemaVersion: 'voxel.instance-transform-animation/1',
    periodsMs: new Float32Array(parts.map((part) => part.animation?.periodMs ?? 0)),
    phasesRadians: new Float32Array(parts.map((part) => part.animation?.phaseRadians ?? 0)),
    translationAmplitudes: new Float32Array(parts.flatMap((part) => {
      const value = part.animation?.translationAmplitude;
      return value ? [value.x, value.y, value.z] : [0, 0, 0];
    })),
    rotationAmplitudesRadians: new Float32Array(parts.flatMap((part) => {
      const value = part.animation?.rotationAmplitude;
      return value ? [value.x, value.y, value.z] : [0, 0, 0];
    })),
    scaleAmplitudes: new Float32Array(parts.flatMap((part) => {
      const value = part.animation?.scaleAmplitude;
      return value ? [value.x, value.y, value.z] : [0, 0, 0];
    })),
  };
}

function identityOf(part: VoxelPart): string {
  return part.key.slice(0, part.key.lastIndexOf(':'));
}

function enabledAnimationKeys(parts: readonly VoxelPart[]): ReadonlySet<string> {
  const groups = new Map<string, VoxelPart[]>();
  for (const part of parts) {
    if (!part.animation || (part.surface !== 'matte' && part.surface !== 'metal')) continue;
    const identity = identityOf(part);
    const group = groups.get(identity) ?? [];
    group.push(part);
    groups.set(identity, group);
  }
  let remaining = MAX_ACTIVE_INSTANCE_ANIMATIONS_V1;
  const enabled = new Set<string>();
  for (const group of groups.values()) {
    if (group.length > remaining) continue;
    for (const part of group) enabled.add(part.key);
    remaining -= group.length;
  }
  return enabled;
}

function makeBatch(
  surface: VoxelSurface,
  lane: 'static' | 'animated',
  parts: readonly VoxelPart[],
  revision: number,
): InstanceBatchV1 {
  const matrices = new Float32Array(parts.flatMap((part) => matrixForPart(part)));
  const colors = new Uint8Array(parts.flatMap((part) => tintToBytes(part.tint)));
  const animation = lane === 'animated' ? packedAnimation(parts) : undefined;
  return {
    key: lane === 'static'
      ? `aoe2:batch:${surface}-parts`
      : `aoe2:batch:${surface}-animated-parts`,
    incarnation: 1,
    revision,
    geometryKey: CUBE_GEOMETRY_KEY,
    materialKey: MATERIAL_KEYS[surface],
    instanceKeys: parts.map((part) => part.key),
    matrices,
    colors,
    ...(animation ? { animation } : {}),
  };
}

export function makePartBatches(
  input: readonly VoxelPart[],
  revision: number,
): InstanceBatchV1[] {
  const parts = [...input].sort(compareParts);
  const seen = new Set<string>();
  for (const part of parts) {
    if (seen.has(part.key)) throw new Error(`Duplicate voxel instance key: ${part.key}`);
    seen.add(part.key);
  }
  const enabled = enabledAnimationKeys(parts);
  const batches: InstanceBatchV1[] = [];
  for (const surface of SURFACES) {
    const surfaceParts = parts.filter((part) => part.surface === surface);
    const staticParts = surfaceParts
      .filter((part) => !enabled.has(part.key))
      .map((part) => part.animation ? { ...part, animation: undefined } : part);
    batches.push(makeBatch(surface, 'static', staticParts, revision));
    if (surface === 'matte' || surface === 'metal') {
      batches.push(makeBatch(
        surface,
        'animated',
        surfaceParts.filter((part) => enabled.has(part.key)),
        revision,
      ));
    }
  }
  return batches;
}
