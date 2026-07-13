import type { RenderSnapshotV1, VoxelChunkV1 } from 'voxel/core';

import type { ProjectedEntityView } from '../../game/simulation/types';
import { createBuildingParts } from './aoeVoxelBuildingRecipes';
import { createResourceParts } from './aoeVoxelResourceRecipes';
import { shade, type VoxelPart } from './aoeVoxelRecipeTypes';
import { copyAoeVoxelResources, makePartBatches } from './aoeVoxelResources';
import {
  AOE_TERRAIN_CHUNK_SIZE,
  draftTerrainChunks,
  elevationOf,
  makeTerrainPalette,
  TERRAIN_MATERIAL_KEY,
  terrainCells,
  createTerrainDetailParts,
} from './aoeVoxelTerrain';
import { createUnitParts } from './aoeVoxelUnitRecipes';
import {
  createAoeVoxelOverlayParts,
  EMPTY_VOXEL_OVERLAYS,
  type AoeVoxelOverlayInput,
} from './aoeVoxelOverlayParts';
import {
  resolveUnitAnimationState,
  type AoeUnitAnimationState,
  type AoeUnitMotionHistory,
} from './aoeVoxelUnitAnimation';
import { voxelPartMaxY } from './aoeVoxelGeometry';
import {
  prepareVoxelHitEntity,
  type PreparedVoxelHitState,
} from './aoeVoxelHitProxy';

export { AOE_TERRAIN_CHUNK_SIZE } from './aoeVoxelTerrain';

interface ChunkState {
  active: boolean;
  incarnation: number;
  revision: number;
  signature: string;
}

interface KeyedEntity {
  readonly entity: ProjectedEntityView;
  readonly identity: string;
  readonly ground: number;
  readonly animationState?: AoeUnitAnimationState;
  readonly parts: readonly VoxelPart[];
  readonly visualTop: number;
}

type EntityRecipeInput = Omit<KeyedEntity, 'parts' | 'visualTop'>;

interface FallbackIdentityState {
  active: boolean;
  incarnation: number;
}

export interface AoeVoxelAdapterOptions {
  readonly worldId?: string;
  readonly epochPrefix?: string;
}

function requireName(name: string, value: string, maxLength = 256): string {
  if (value.length === 0 || value.length > maxLength) {
    throw new RangeError(`${name} length must be from 1 to ${String(maxLength)}.`);
  }
  return value;
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
  // The projected contract retains elevation, while the current standalone
  // input projection remains elevation-zero.
  elevationOf(entity);
  return 0;
}

function terrainWithVoxelFog(
  entities: readonly ProjectedEntityView[],
  frame: AoeVoxelOverlayInput['frame'],
): readonly ProjectedEntityView[] {
  if (!frame) return entities;
  const visible = new Set(frame.visibleCells);
  const explored = new Set(frame.exploredCells);
  return entities.map((entity) => {
    if (entity.layer !== 'terrain') return entity;
    const index = Math.floor(entity.y) * frame.mapWidth + Math.floor(entity.x);
    if (visible.has(index)) return entity;
    return {
      ...entity,
      tint: shade(entity.tint, explored.has(index) ? 0.32 : 0.12),
    };
  });
}

function partsFor(entity: EntityRecipeInput): VoxelPart[] {
  if (entity.entity.layer === 'unit') {
    return createUnitParts(
      entity.entity,
      entity.identity,
      entity.ground,
      entity.animationState,
    );
  }
  if (entity.entity.layer === 'building') {
    return createBuildingParts(entity.entity, entity.identity, entity.ground);
  }
  return createResourceParts(entity.entity, entity.identity, entity.ground);
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
  private readonly unitMotionHistories = new Map<string, AoeUnitMotionHistory>();
  private readonly healthByIdentity = new Map<string, number>();
  private readonly hitUntilByIdentity = new Map<string, number>();
  private lastFeedbackTimeMs = 0;
  private currentHitState: PreparedVoxelHitState | null = null;

  constructor(options: AoeVoxelAdapterOptions = {}) {
    this.worldId = requireName('worldId', options.worldId ?? 'aoe2');
    this.epochPrefix = requireName('epochPrefix', options.epochPrefix ?? 'aoe2:bridge', 230);
  }

  get epoch(): string {
    return `${this.epochPrefix}:${String(this.epochIndex)}`;
  }

  /** Bounded diagnostic seam used by the browser gait proof. */
  inspectUnitMotion(identity: string): AoeUnitMotionHistory | null {
    const history = this.unitMotionHistories.get(identity);
    return history ? { ...history } : null;
  }

  latestHitState(): PreparedVoxelHitState | null {
    return this.currentHitState;
  }

  createSnapshot(
    entities: readonly ProjectedEntityView[],
    sampleTimeMs = 0,
    overlays: AoeVoxelOverlayInput = EMPTY_VOXEL_OVERLAYS,
  ): RenderSnapshotV1 {
    if (!Number.isFinite(sampleTimeMs) || sampleTimeMs < 0) {
      throw new RangeError('AoE voxel sample time must be a non-negative finite number.');
    }
    const foggedTerrainEntities = terrainWithVoxelFog(entities, overlays.frame);
    const cells = terrainCells(foggedTerrainEntities);
    const nextRevision = this.revision + 1;
    if (!Number.isSafeInteger(nextRevision)) throw new RangeError('AoE voxel revision overflow.');
    const nextPaletteSignature = [...new Set(cells.map((cell) => cell.tint))]
      .sort((a, b) => a - b)
      .join(',');
    const drafts = draftTerrainChunks(cells, nextPaletteSignature);
    const prepared = this.prepareInstanceEntities(entities, sampleTimeMs);
    const hitEntityIdentities = this.updateHitFeedback(prepared.entities, sampleTimeMs);
    const overlayFrame = overlays.frame;
    const visibleTerrain = overlayFrame ? new Set(overlayFrame.visibleCells) : null;
    const terrainDetailEntities = visibleTerrain && overlayFrame
      ? entities.filter((entity) => (
          entity.layer !== 'terrain'
          || visibleTerrain.has(
            Math.floor(entity.y) * overlayFrame.mapWidth + Math.floor(entity.x),
          )
        ))
      : entities;
    const parts = [
      ...createTerrainDetailParts(terrainDetailEntities),
      ...prepared.entities.flatMap((entity) => entity.parts),
      ...createAoeVoxelOverlayParts(prepared.entities, {
        ...overlays,
        hitEntityIdentities,
      }),
    ];
    const batches = makePartBatches(parts, nextRevision);
    const animatedKeys = new Set(batches.flatMap((batch) => {
      if (!batch.animation) return [];
      return batch.instanceKeys.filter((_, index) => batch.animation!.periodsMs[index]! > 0);
    }));
    this.currentHitState = {
      epoch: this.epoch,
      revision: nextRevision,
      entities: prepared.entities.map(({ entity, parts: entityParts }) => prepareVoxelHitEntity(
        entity,
        entityParts.map((part) => (
          part.animation && !animatedKeys.has(part.key)
            ? { ...part, animation: undefined }
            : part
        )),
      )),
    };
    this.replaceFallbackIdentities(prepared.fallbacks);

    if (nextPaletteSignature !== this.paletteSignature) {
      this.paletteSignature = nextPaletteSignature;
      this.paletteRevision += 1;
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
          revision: existing.signature === draft.signature
            ? existing.revision
            : existing.revision + 1,
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
        paletteKey: 'aoe2:palette:terrain',
        materialKey: TERRAIN_MATERIAL_KEY,
      };
    });
    for (const [key, state] of this.chunkStates) {
      if (!activeKeys.has(key)) state.active = false;
    }

    this.revision = nextRevision;
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
          maxResources: 16,
          maxPaletteEntries: 4_096,
          maxChunks: 4_096,
          maxBatches: 7,
          maxVoxelsPerChunk: AOE_TERRAIN_CHUNK_SIZE * AOE_TERRAIN_CHUNK_SIZE * 64,
          maxGeometryVertices: 1_024,
          maxGeometryIndices: 3_072,
          maxInstancesPerBatch: 200_000,
          maxTotalBytes: 512 * 1024 * 1024,
        },
      },
      revision: this.revision,
      resources: [makeTerrainPalette(cells, this.paletteRevision), ...copyAoeVoxelResources()],
      chunks,
      batches,
    };
  }

  private prepareInstanceEntities(
    entities: readonly ProjectedEntityView[],
    sampleTimeMs: number,
  ): {
    entities: KeyedEntity[];
    fallbacks: Map<string, FallbackIdentityState>;
  } {
    const fallbacks = new Map(
      [...this.fallbackIdentities].map(([key, state]) => [key, { ...state, active: false }]),
    );
    const seenFallbacks = new Set<string>();
    const nextMotionHistories = new Map<string, AoeUnitMotionHistory>();
    const keyed = entities.filter((entity) => entity.layer !== 'terrain').map((entity) => {
      const explicit = explicitEntityKey(entity);
      let identity = explicit;
      if (!identity) {
        const namespace = entity.isMemory ? 'memory' : 'legacy';
        const slot = `${String(entity.id)}:${namespace}`;
        if (seenFallbacks.has(slot)) throw new Error(`Duplicate fallback voxel identity: ${slot}`);
        seenFallbacks.add(slot);
        const previous = this.fallbackIdentities.get(slot);
        const incarnation = previous?.active ? previous.incarnation : (previous?.incarnation ?? 0) + 1;
        fallbacks.set(slot, { active: true, incarnation });
        const suffix = incarnation === 1 ? namespace : `${namespace}:${String(incarnation)}`;
        identity = `${String(entity.id)}:${suffix}`;
      }
      const resolvedAnimation = entity.layer === 'unit' && !entity.isMemory
        ? resolveUnitAnimationState(
          entity,
          identity,
          this.unitMotionHistories.get(identity),
          sampleTimeMs,
        )
        : undefined;
      if (resolvedAnimation) nextMotionHistories.set(identity, resolvedAnimation.history);
      const recipeInput: EntityRecipeInput = {
        entity,
        identity,
        ground: compositionGround(entity),
        ...(resolvedAnimation ? { animationState: resolvedAnimation.state } : {}),
      };
      const parts = partsFor(recipeInput);
      const visibleParts = parts.filter((part) => part.surface !== 'shadow');
      return {
        ...recipeInput,
        parts,
        visualTop: visibleParts.length === 0
          ? recipeInput.ground
          : Math.max(...visibleParts.map(voxelPartMaxY)),
      };
    });
    this.unitMotionHistories.clear();
    for (const [identity, history] of nextMotionHistories) {
      this.unitMotionHistories.set(identity, history);
    }
    return { entities: keyed, fallbacks };
  }

  private replaceFallbackIdentities(next: Map<string, FallbackIdentityState>): void {
    this.fallbackIdentities.clear();
    for (const [key, state] of next) this.fallbackIdentities.set(key, state);
  }

  private updateHitFeedback(
    entities: readonly KeyedEntity[],
    sampleTimeMs: number,
  ): string[] {
    if (sampleTimeMs < this.lastFeedbackTimeMs) {
      this.healthByIdentity.clear();
      this.hitUntilByIdentity.clear();
    }
    this.lastFeedbackTimeMs = sampleTimeMs;
    const activeIdentities = new Set<string>();
    const nextHealth = new Map<string, number>();
    for (const { entity, identity } of entities) {
      if (entity.isMemory || entity.currentHp === null) continue;
      activeIdentities.add(identity);
      nextHealth.set(identity, entity.currentHp);
      const previous = this.healthByIdentity.get(identity);
      if (previous !== undefined && entity.currentHp < previous) {
        this.hitUntilByIdentity.set(identity, sampleTimeMs + 260);
      }
    }
    this.healthByIdentity.clear();
    for (const [identity, health] of nextHealth) this.healthByIdentity.set(identity, health);
    for (const identity of [...this.hitUntilByIdentity.keys()]) {
      const until = this.hitUntilByIdentity.get(identity) ?? 0;
      if (!activeIdentities.has(identity) || until <= sampleTimeMs) {
        this.hitUntilByIdentity.delete(identity);
      }
    }
    return [...this.hitUntilByIdentity.keys()].sort();
  }

  resetForBridgeSwap(): void {
    this.epochIndex += 1;
    this.revision = 0;
    this.paletteSignature = '';
    this.paletteRevision = 0;
    this.chunkStates.clear();
    this.fallbackIdentities.clear();
    this.unitMotionHistories.clear();
    this.healthByIdentity.clear();
    this.hitUntilByIdentity.clear();
    this.lastFeedbackTimeMs = 0;
    this.currentHitState = null;
  }
}
