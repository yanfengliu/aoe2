import type { GeometryResourceV1, InstanceBatchV1, MaterialResourceV1,
  PaletteResourceV1, RenderSnapshotV1, VoxelChunkV1 } from 'voxel/core';
import { DensePaletteChunk, meshVisibleFaces } from 'voxel/meshing';
import type { ProjectedEntityView } from '../../game/simulation/types';
export const AOE_TERRAIN_CHUNK_SIZE = 16;
const MAX_TERRAIN_LEVELS = 64;
const TERRAIN_PALETTE_KEY = 'aoe2:palette:terrain';
const TERRAIN_MATERIAL_KEY = 'aoe2:material:terrain';
const PARTS_MATERIAL_KEY = 'aoe2:material:parts';
const CUBE_GEOMETRY_KEY = 'aoe2:geometry:unit-cube';
const PARTS_BATCH_KEY = 'aoe2:batch:block-parts';
interface TerrainCell { readonly x: number; readonly z: number; readonly elevation: number; readonly tint: number }
interface ChunkDraft {
  readonly key: string;
  readonly origin: { readonly x: number; readonly y: number; readonly z: number };
  readonly size: { readonly x: number; readonly y: number; readonly z: number };
  readonly voxels: Uint16Array;
  readonly signature: string;
}
interface ChunkState { active: boolean; incarnation: number; revision: number; signature: string }
interface BoxPart {
  readonly key: string; readonly tint: number; readonly alpha: number;
  readonly minX: number; readonly minY: number; readonly minZ: number;
  readonly width: number; readonly height: number; readonly depth: number;
}
interface KeyedEntity { readonly entity: ProjectedEntityView; readonly identity: string; readonly ground: number }
interface FallbackIdentityState { active: boolean; incarnation: number }
export interface AoeVoxelAdapterOptions { readonly worldId?: string; readonly epochPrefix?: string }
const TERRAIN_MATERIAL: MaterialResourceV1 = {
  kind: 'material',
  key: TERRAIN_MATERIAL_KEY,
  incarnation: 1,
  revision: 1,
  shading: 'lambert',
  color: { r: 255, g: 255, b: 255, a: 255 },
  vertexColors: true,
  transparent: false,
  opacity: 1,
  doubleSided: false,
  roughness: 1,
  metalness: 0,
};
const PARTS_MATERIAL: MaterialResourceV1 = {
  ...TERRAIN_MATERIAL,
  key: PARTS_MATERIAL_KEY,
  // InstancedMesh supplies `instanceColor`; this cube has no vertex-color
  // attribute, so enabling both would multiply every instance by WebGL's
  // missing-attribute default (black).
  vertexColors: false,
};
function cubeGeometry(): GeometryResourceV1 {
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
    groups: [{ start: 0, count: mesh.indices.length, materialKey: PARTS_MATERIAL_KEY }],
    bounds: {
      min: { x: mesh.bounds.min[0], y: mesh.bounds.min[1], z: mesh.bounds.min[2] },
      max: { x: mesh.bounds.max[0], y: mesh.bounds.max[1], z: mesh.bounds.max[2] },
    },
    // Matrices below translate the cube's minimum corner, so keep its local
    // origin at (0, 0, 0). A centered pivot would shift every scaled part.
    pivot: { x: 0, y: 0, z: 0 },
  };
}
const CUBE_GEOMETRY = cubeGeometry();
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
function requireName(name: string, value: string, maxLength = 256): string {
  if (value.length === 0 || value.length > maxLength) {
    throw new RangeError(`${name} length must be from 1 to ${String(maxLength)}.`);
  }
  return value;
}
function requireTint(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffff) {
    throw new RangeError(`Projected tint must be an integer from 0x000000 to 0xffffff.`);
  }
  return value;
}
function requireTerrainCoordinate(name: string, value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Terrain ${name} must be a safe integer.`);
  }
  return value;
}
function elevationOf(entity: ProjectedEntityView): number {
  const elevation = entity.elevation ?? 0;
  if (!Number.isSafeInteger(elevation) || elevation < 0 || elevation >= MAX_TERRAIN_LEVELS) {
    throw new RangeError(
      `Projected elevation must be an integer from 0 to ${String(MAX_TERRAIN_LEVELS - 1)}.`,
    );
  }
  return elevation;
}
function tintToColor(tint: number, alpha = 255) {
  return { r: (tint >>> 16) & 0xff, g: (tint >>> 8) & 0xff, b: tint & 0xff, a: alpha };
}
function shade(tint: number, multiplier: number): number {
  const channel = (shift: number) => Math.max(
    0,
    Math.min(255, Math.round(((tint >>> shift) & 0xff) * multiplier)),
  );
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
function memoryTint(tint: number): number {
  const red = (tint >>> 16) & 0xff;
  const green = (tint >>> 8) & 0xff;
  const blue = tint & 0xff;
  const gray = (red + green + blue) / 3;
  const fade = (channel: number) => Math.round(channel * 0.45 + gray * 0.25);
  return (fade(red) << 16) | (fade(green) << 8) | fade(blue);
}
function explicitEntityKey(entity: ProjectedEntityView): string | null {
  if (!Number.isSafeInteger(entity.id) || entity.id < 0) {
    throw new RangeError('Projected entity id must be a non-negative safe integer.');
  }
  if (entity.generation === undefined) return null;
  if (!Number.isSafeInteger(entity.generation) || entity.generation < 0) {
    throw new RangeError('Projected entity generation must be a non-negative safe integer.');
  }
  return `${String(entity.id)}:${String(entity.generation)}`;
}
function compositionGround(entity: ProjectedEntityView): number {
  // The projected contract retains elevation for the future standalone host,
  // but the composed Phaser overlay/input plane is still elevation-zero. Keep
  // this proving slice flat so visible geometry and interaction never diverge.
  elevationOf(entity);
  return 0;
}
function box(entity: ProjectedEntityView, identity: string, suffix: string, tint: number,
  minX: number, minY: number, minZ: number, width: number, height: number, depth: number): BoxPart {
  return {
    key: `${identity}:${suffix}`,
    tint: entity.isMemory ? memoryTint(tint) : tint,
    alpha: 255,
    minX,
    minY,
    minZ,
    width,
    height,
    depth,
  };
}
function unitParts(entity: ProjectedEntityView, identity: string, ground: number): BoxPart[] {
  const size = Math.max(0.35, entity.size);
  const centerX = entity.x + 0.5;
  const centerZ = entity.y + 0.5;
  const bodyWidth = size * 0.48;
  const bodyDepth = size * 0.38;
  const bodyHeight = size * 0.78;
  const headSize = size * 0.34;
  return [
    box(entity, identity, 'unit-body', requireTint(entity.tint), centerX - bodyWidth / 2, ground,
      centerZ - bodyDepth / 2, bodyWidth, bodyHeight, bodyDepth),
    box(entity, identity, 'unit-head', 0xd9b38c, centerX - headSize / 2, ground + bodyHeight,
      centerZ - headSize / 2, headSize, headSize, headSize),
  ];
}
function buildingParts(entity: ProjectedEntityView, identity: string, ground: number): BoxPart[] {
  const width = Math.max(0.25, entity.footprintWidth);
  const depth = Math.max(0.25, entity.footprintHeight);
  const totalHeight = Math.max(0.8, Math.min(2.4, 0.65 + Math.max(width, depth) * 0.32));
  const wallHeight = totalHeight * 0.72;
  const roofHeight = totalHeight - wallHeight;
  const tint = requireTint(entity.tint);
  const roofTint = entity.visualVariant === 'construction' ? 0xb69b73 : shade(tint, 0.68);
  return [
    box(entity, identity, 'building-base', tint, entity.x + width * 0.16, ground,
      entity.y + depth * 0.16, width * 0.68, wallHeight, depth * 0.68),
    box(entity, identity, 'building-roof', roofTint, entity.x + width * 0.12,
      ground + wallHeight, entity.y + depth * 0.12, width * 0.76, roofHeight, depth * 0.76),
  ];
}
function treeParts(entity: ProjectedEntityView, identity: string, ground: number): BoxPart[] {
  const size = Math.max(0.4, entity.size);
  const centerX = entity.x + 0.5;
  const centerZ = entity.y + 0.5;
  const trunkWidth = size * 0.28;
  const trunkHeight = size * 1.05;
  const crownWidth = size * 0.95;
  return [
    box(entity, identity, 'tree-trunk', 0x6b4526, centerX - trunkWidth / 2, ground,
      centerZ - trunkWidth / 2, trunkWidth, trunkHeight, trunkWidth),
    box(entity, identity, 'tree-crown', requireTint(entity.tint), centerX - crownWidth / 2,
      ground + trunkHeight * 0.62, centerZ - crownWidth / 2, crownWidth, size * 0.9, crownWidth),
  ];
}
function resourceParts(entity: ProjectedEntityView, identity: string, ground: number): BoxPart[] {
  if (entity.entityType === 'tree') return treeParts(entity, identity, ground);
  const size = Math.max(0.3, entity.size);
  const centerX = entity.x + 0.5;
  const centerZ = entity.y + 0.5;
  const tint = requireTint(entity.tint);
  const bodyHeight = entity.entityType === 'gold-mine' || entity.entityType === 'stone-mine'
    ? size * 0.72
    : size * 0.55;
  return [
    box(entity, identity, 'resource-body', tint, centerX - size / 2, ground,
      centerZ - size * 0.38, size, bodyHeight, size * 0.76),
    box(entity, identity, 'resource-detail', shade(tint, 0.72), centerX + size * 0.12,
      ground + bodyHeight * 0.62, centerZ - size * 0.18, size * 0.32, size * 0.32, size * 0.32),
  ];
}
function matrixFor(part: BoxPart): readonly number[] {
  return [
    part.width, 0, 0, 0, 0, part.height, 0, 0,
    0, 0, part.depth, 0, part.minX, part.minY, part.minZ, 1,
  ];
}
function makeBatch(entities: readonly KeyedEntity[], revision: number): InstanceBatchV1 {
  const parts = entities
    .flatMap(({ entity, identity, ground }) => {
      if (entity.layer === 'unit') return unitParts(entity, identity, ground);
      if (entity.layer === 'building') return buildingParts(entity, identity, ground);
      return resourceParts(entity, identity, ground);
    })
    .sort((a, b) => compareText(a.key, b.key));
  const seen = new Set<string>();
  const matrices: number[] = [];
  const colors: number[] = [];
  for (const part of parts) {
    if (seen.has(part.key)) throw new Error(`Duplicate voxel instance key: ${part.key}`);
    seen.add(part.key);
    matrices.push(...matrixFor(part));
    const color = tintToColor(part.tint, part.alpha);
    colors.push(color.r, color.g, color.b, color.a);
  }
  return {
    key: PARTS_BATCH_KEY,
    incarnation: 1,
    revision,
    geometryKey: CUBE_GEOMETRY_KEY,
    materialKey: PARTS_MATERIAL_KEY,
    instanceKeys: parts.map((part) => part.key),
    matrices: new Float32Array(matrices),
    colors: new Uint8Array(colors),
  };
}
function terrainCells(entities: readonly ProjectedEntityView[]): TerrainCell[] {
  const cells = entities
    .filter((entity) => entity.layer === 'terrain')
    .map((entity) => {
      elevationOf(entity);
      return {
        x: requireTerrainCoordinate('x', entity.x),
        z: requireTerrainCoordinate('y', entity.y),
        elevation: 0,
        tint: requireTint(entity.tint),
      };
    })
    .sort((a, b) => a.z - b.z || a.x - b.x || a.elevation - b.elevation || a.tint - b.tint);
  for (let index = 1; index < cells.length; index++) {
    const previous = cells[index - 1]!;
    const current = cells[index]!;
    if (previous.x === current.x && previous.z === current.z) {
      throw new Error(`Duplicate terrain cell at (${String(current.x)}, ${String(current.z)}).`);
    }
  }
  return cells;
}
function makePalette(cells: readonly TerrainCell[], revision: number): PaletteResourceV1 {
  const tints = [...new Set(cells.map((cell) => cell.tint))].sort((a, b) => a - b);
  return {
    kind: 'palette',
    key: TERRAIN_PALETTE_KEY,
    incarnation: 1,
    revision,
    entries: [
      { color: { r: 0, g: 0, b: 0, a: 0 } },
      ...tints.map((tint) => ({ color: tintToColor(tint) })),
    ],
  };
}
function draftChunks(cells: readonly TerrainCell[], paletteSignature: string): ChunkDraft[] {
  const tints = [...new Set(cells.map((cell) => cell.tint))].sort((a, b) => a - b);
  const paletteIndex = new Map(tints.map((tint, index) => [tint, index + 1]));
  const groups = new Map<string, { chunkX: number; chunkZ: number; cells: TerrainCell[] }>();
  for (const cell of cells) {
    const chunkX = Math.floor(cell.x / AOE_TERRAIN_CHUNK_SIZE);
    const chunkZ = Math.floor(cell.z / AOE_TERRAIN_CHUNK_SIZE);
    const key = `${String(chunkX)}:${String(chunkZ)}`;
    const group = groups.get(key) ?? { chunkX, chunkZ, cells: [] };
    group.cells.push(cell);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.chunkZ - b.chunkZ || a.chunkX - b.chunkX)
    .map((group) => {
      const height = Math.max(...group.cells.map((cell) => cell.elevation)) + 1;
      const size = { x: AOE_TERRAIN_CHUNK_SIZE, y: height, z: AOE_TERRAIN_CHUNK_SIZE };
      const voxels = new Uint16Array(size.x * size.y * size.z);
      for (const cell of group.cells) {
        const localX = cell.x - group.chunkX * AOE_TERRAIN_CHUNK_SIZE;
        const localZ = cell.z - group.chunkZ * AOE_TERRAIN_CHUNK_SIZE;
        const value = paletteIndex.get(cell.tint)!;
        for (let localY = 0; localY <= cell.elevation; localY++) {
          voxels[localX + size.x * (localZ + size.z * localY)] = value;
        }
      }
      const key = `aoe2:terrain:${String(group.chunkX)}:${String(group.chunkZ)}`;
      const cellSignature = group.cells
        .map((cell) => `${String(cell.x)},${String(cell.z)},${String(cell.elevation)},${String(cell.tint)}`)
        .join('|');
      return {
        key,
        origin: {
          x: group.chunkX * AOE_TERRAIN_CHUNK_SIZE,
          y: -1,
          z: group.chunkZ * AOE_TERRAIN_CHUNK_SIZE,
        },
        size,
        voxels,
        signature: `${paletteSignature}|${cellSignature}`,
      };
    });
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
function copyMaterial(material: MaterialResourceV1): MaterialResourceV1 {
  return { ...material, color: { ...material.color } };
}
export class AoeVoxelAdapter {
  private readonly worldId: string;
  private readonly epochPrefix: string;
  private epochIndex = 0;
  private revision = 0;
  private paletteSignature = '';
  private paletteRevision = 0;
  private readonly chunkStates = new Map<string, ChunkState>();
  private readonly fallbackIdentities = new Map<string, FallbackIdentityState>();

  constructor(options: AoeVoxelAdapterOptions = {}) {
    this.worldId = requireName('worldId', options.worldId ?? 'aoe2');
    this.epochPrefix = requireName('epochPrefix', options.epochPrefix ?? 'aoe2:bridge', 230);
  }
  get epoch(): string {
    return `${this.epochPrefix}:${String(this.epochIndex)}`;
  }
  createSnapshot(entities: readonly ProjectedEntityView[]): RenderSnapshotV1 {
    const cells = terrainCells(entities);
    const nextRevision = this.revision + 1;
    if (!Number.isSafeInteger(nextRevision)) throw new RangeError('AoE voxel revision overflow.');
    const nextPaletteSignature = [...new Set(cells.map((cell) => cell.tint))]
      .sort((a, b) => a - b)
      .join(',');
    const drafts = draftChunks(cells, nextPaletteSignature);
    const prepared = this.prepareInstanceEntities(entities);
    const batch = makeBatch(prepared.entities, nextRevision);
    this.replaceFallbackIdentities(prepared.fallbacks);
    if (nextPaletteSignature !== this.paletteSignature) {
      this.paletteSignature = nextPaletteSignature;
      this.paletteRevision++;
    }
    if (this.paletteRevision === 0) this.paletteRevision = 1;
    const activeKeys = new Set(drafts.map((draft) => draft.key));
    const chunks = drafts.map((draft): VoxelChunkV1 => {
      const existing = this.chunkStates.get(draft.key);
      let state: ChunkState;
      if (!existing) {
        state = { active: true, incarnation: 1, revision: 1, signature: draft.signature };
      } else if (!existing.active) {
        state = {
          active: true,
          incarnation: existing.incarnation + 1,
          revision: 1,
          signature: draft.signature,
        };
      } else {
        state = {
          ...existing,
          active: true,
          revision: existing.signature === draft.signature ? existing.revision : existing.revision + 1,
          signature: draft.signature,
        };
      }
      this.chunkStates.set(draft.key, state);
      return {
        key: draft.key,
        incarnation: state.incarnation,
        revision: state.revision,
        origin: draft.origin,
        size: draft.size,
        voxels: draft.voxels,
        paletteKey: TERRAIN_PALETTE_KEY,
        materialKey: TERRAIN_MATERIAL_KEY,
      };
    });
    for (const [key, state] of this.chunkStates) {
      if (!activeKeys.has(key)) state.active = false;
    }

    this.revision = nextRevision;
    const palette = makePalette(cells, this.paletteRevision);
    return {
      schemaVersion: 'voxel.render-snapshot/1',
      descriptor: {
        schemaVersion: 'voxel.world/1',
        worldId: this.worldId,
        epoch: this.epoch,
        coordinates: {
          handedness: 'right',
          upAxis: '+y',
          forwardAxis: '-z',
          chunkRounding: 'floor',
          metersPerWorldUnit: 1,
          worldUnitsPerVoxel: { x: 1, y: 1, z: 1 },
        },
        colorEncoding: 'srgb8-straight-alpha',
        capabilities: ['voxel-chunks', 'geometry-resources', 'instance-batches'],
        limits: {
          maxResources: 8,
          maxPaletteEntries: 4_096,
          maxChunks: 4_096,
          maxBatches: 2,
          maxVoxelsPerChunk: AOE_TERRAIN_CHUNK_SIZE * AOE_TERRAIN_CHUNK_SIZE * 64,
          maxGeometryVertices: 1_024,
          maxGeometryIndices: 3_072,
          maxInstancesPerBatch: 200_000,
          maxTotalBytes: 512 * 1024 * 1024,
        },
      },
      revision: this.revision,
      resources: [palette, copyMaterial(TERRAIN_MATERIAL), copyMaterial(PARTS_MATERIAL), copyGeometry()],
      chunks,
      batches: [batch],
    };
  }
  private prepareInstanceEntities(entities: readonly ProjectedEntityView[]): {
    entities: KeyedEntity[];
    fallbacks: Map<string, FallbackIdentityState>;
  } {
    const fallbacks = new Map(
      [...this.fallbackIdentities].map(([key, state]) => [key, { ...state, active: false }]),
    );
    const seenFallbacks = new Set<string>();
    const keyed = entities.filter((entity) => entity.layer !== 'terrain').map((entity) => {
      const explicit = explicitEntityKey(entity);
      if (explicit) return { entity, identity: explicit, ground: compositionGround(entity) };
      const namespace = entity.isMemory ? 'memory' : 'legacy';
      const slot = `${String(entity.id)}:${namespace}`;
      if (seenFallbacks.has(slot)) throw new Error(`Duplicate fallback voxel identity: ${slot}`);
      seenFallbacks.add(slot);
      const previous = this.fallbackIdentities.get(slot);
      const incarnation = previous?.active ? previous.incarnation : (previous?.incarnation ?? 0) + 1;
      fallbacks.set(slot, { active: true, incarnation });
      const suffix = incarnation === 1 ? namespace : `${namespace}:${String(incarnation)}`;
      return { entity, identity: `${String(entity.id)}:${suffix}`, ground: compositionGround(entity) };
    });
    return { entities: keyed, fallbacks };
  }

  private replaceFallbackIdentities(next: Map<string, FallbackIdentityState>): void {
    this.fallbackIdentities.clear();
    for (const [key, state] of next) this.fallbackIdentities.set(key, state);
  }

  resetForBridgeSwap(): void {
    this.epochIndex++;
    this.revision = 0;
    this.paletteSignature = '';
    this.paletteRevision = 0;
    this.chunkStates.clear();
    this.fallbackIdentities.clear();
  }
}
