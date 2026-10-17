import type { PaletteResourceV1, RenderSnapshotV1, VoxelChunkV1 } from 'voxel/core';

import type { ProjectedEntityView } from '../../game/simulation/types';
import { artStyleById, DEFAULT_ART_STYLE_ID } from '../artStyles';
import { copyAoeVoxelResources } from './aoeVoxelResources';
import {
  AOE_TERRAIN_CHUNK_SIZE,
  makeTerrainPalette,
  TERRAIN_MATERIAL_KEY,
} from './aoeVoxelTerrain';
import {
  createAoeVoxelOverlayParts,
  EMPTY_VOXEL_OVERLAYS,
  type AoeVoxelOverlayInput,
} from './aoeVoxelOverlayParts';
import type { AoeUnitMotionHistory } from './aoeVoxelUnitAnimation';
import {
  prepareVoxelHitEntity,
  type PreparedVoxelHitEntity,
  type PreparedVoxelHitState,
} from './aoeVoxelHitProxy';
import {
  computeOcclusionSilhouettes,
  type OccludedUnitState,
} from './aoeVoxelOcclusionSilhouettes';
import { AoeVoxelEntityPreparer, type PreparedVoxelEntity } from './aoeVoxelEntityPrep';
import { AoeVoxelLaneBatcher } from './aoeVoxelLaneBatches';
import { AoeVoxelTerrainFrame, type VoxelGroundDraft } from './aoeVoxelTerrainFrame';
import type { VoxelPart } from './aoeVoxelRecipeTypes';

export { AOE_TERRAIN_CHUNK_SIZE } from './aoeVoxelTerrain';

interface ChunkState {
  active: boolean;
  incarnation: number;
  revision: number;
  signature: string;
}

export interface AoeVoxelAdapterOptions {
  readonly worldId?: string;
  readonly epochPrefix?: string;
}

/** How many instance batches a snapshot may declare. The lanes (aoeVoxelLaneBatches.ts) carry twelve on every
 *  frame and a few more only while an unusual part exists; the limit leaves room for those. */
const MAX_SNAPSHOT_BATCHES = 64;

const NO_VOXEL_GROUND: VoxelGroundDraft = { cells: [], paletteSignature: '', drafts: [] };

function requireName(name: string, value: string, maxLength = 256): string {
  if (value.length === 0 || value.length > maxLength) {
    throw new RangeError(`${name} length must be from 1 to ${String(maxLength)}.`);
  }
  return value;
}

/** Builds AoE's render snapshots from projected entities. Each frame poses only what can have changed: moving
 *  entities and overlays always, still entities and the ground when their inputs changed (work 130, see
 *  aoeVoxelEntityPrep.ts and aoeVoxelLaneBatches.ts). */
export class AoeVoxelAdapter {
  private readonly worldId: string;
  private readonly epochPrefix: string;
  private epochIndex = 0;
  private revision = 0;
  private paletteSignature = '';
  private paletteRevision = 0;
  private palette: { readonly draft: VoxelGroundDraft; readonly revision: number; readonly resource: PaletteResourceV1 } | null = null;
  private readonly chunkStates = new Map<string, ChunkState>();
  private readonly entityPreparer = new AoeVoxelEntityPreparer();
  private readonly terrainFrame = new AoeVoxelTerrainFrame();
  private readonly lanes = new AoeVoxelLaneBatcher();
  private stillHitEntities = new Map<string, { readonly parts: readonly VoxelPart[]; readonly hit: PreparedVoxelHitEntity }>();
  private readonly healthByIdentity = new Map<string, number>();
  private readonly hitUntilByIdentity = new Map<string, number>();
  private lastFeedbackTimeMs = 0;
  private currentHitState: PreparedVoxelHitState | null = null;
  private currentOccludedUnits: readonly OccludedUnitState[] = [];
  private exploredGround = artStyleById(DEFAULT_ART_STYLE_ID).exploredGround;
  private voxelGround = true;

  constructor(options: AoeVoxelAdapterOptions = {}) {
    this.worldId = requireName('worldId', options.worldId ?? 'aoe2');
    this.epochPrefix = requireName('epochPrefix', options.epochPrefix ?? 'aoe2:bridge', 230);
  }

  /** How bright explored-but-unseen ground is drawn, from the next snapshot
   *  on. It is the art style's; unexplored ground is black whatever it is. */
  setExploredGround(level: number): void {
    if (!Number.isFinite(level) || level < 0 || level > 1) {
      throw new RangeError(
        `Explored ground brightness must be a number from 0 to 1; got ${String(level)}.`,
      );
    }
    this.exploredGround = level;
  }

  /** Whether snapshots carry the voxel terrain chunks and the shore surf that follows their tile edges, from
   *  the next snapshot on. The Natural style draws its own ground (aoeDeGround.ts) and leaves both out; turned
   *  back on, the chunks return as new incarnations. */
  setVoxelGround(enabled: boolean): void {
    this.voxelGround = enabled;
  }

  get epoch(): string {
    return `${this.epochPrefix}:${String(this.epochIndex)}`;
  }

  /** Bounded diagnostic seam used by the browser gait proof. */
  inspectUnitMotion(identity: string): AoeUnitMotionHistory | null {
    return this.entityPreparer.inspectUnitMotion(identity);
  }

  latestHitState(): PreparedVoxelHitState | null {
    return this.currentHitState;
  }

  /** Units whose silhouette cue fired in the latest snapshot (browser-test seam). */
  latestOccludedUnits(): readonly OccludedUnitState[] {
    return this.currentOccludedUnits;
  }

  createSnapshot(
    entities: readonly ProjectedEntityView[],
    sampleTimeMs = 0,
    overlays: AoeVoxelOverlayInput = EMPTY_VOXEL_OVERLAYS,
  ): RenderSnapshotV1 {
    if (!Number.isFinite(sampleTimeMs) || sampleTimeMs < 0) {
      throw new RangeError('AoE voxel sample time must be a non-negative finite number.');
    }
    const terrain = entities.filter((entity) => entity.layer === 'terrain');
    const ground = this.voxelGround
      ? this.terrainFrame.groundDraft(terrain, overlays.frame, this.exploredGround)
      : NO_VOXEL_GROUND;
    const nextRevision = this.revision + 1;
    if (!Number.isSafeInteger(nextRevision)) throw new RangeError('AoE voxel revision overflow.');
    const prepared = this.entityPreparer.prepare(entities, sampleTimeMs);
    const hitEntityIdentities = this.updateHitFeedback(prepared.entities, sampleTimeMs);
    const detail = this.terrainFrame.detailParts(terrain, overlays.frame, this.voxelGround);
    const occlusion = computeOcclusionSilhouettes(prepared.entities);
    this.currentOccludedUnits = occlusion.occluded;
    const still: (readonly VoxelPart[])[] = [];
    const moving: VoxelPart[] = [];
    for (const entity of prepared.entities) {
      if (entity.motion === 'still') still.push(entity.parts);
      else moving.push(...entity.parts);
    }
    moving.push(
      ...createAoeVoxelOverlayParts(prepared.entities, { ...overlays, hitEntityIdentities }),
      ...occlusion.parts,
    );
    const batches = this.lanes.batches({
      terrain: { version: this.terrainFrame.detailVersion, parts: detail },
      still: { version: this.entityPreparer.stillVersion, parts: still },
      moving,
    }, nextRevision);
    const animatedKeys = new Set(batches.flatMap((batch) => {
      if (!batch.animation) return [];
      return batch.instanceKeys.filter((_, index) => batch.animation!.periodsMs[index]! > 0);
    }));
    this.currentHitState = {
      epoch: this.epoch,
      revision: nextRevision,
      entities: this.hitEntities(prepared.entities, animatedKeys),
    };
    this.entityPreparer.commitFallbacks(prepared.fallbacks);

    if (ground.paletteSignature !== this.paletteSignature) {
      this.paletteSignature = ground.paletteSignature;
      this.paletteRevision += 1;
    }
    if (this.paletteRevision === 0) this.paletteRevision = 1;
    if (this.palette?.draft !== ground || this.palette.revision !== this.paletteRevision) {
      this.palette = { draft: ground, revision: this.paletteRevision, resource: makeTerrainPalette(ground.cells, this.paletteRevision) };
    }

    const activeKeys = new Set(ground.drafts.map((draft) => draft.key));
    const chunks = ground.drafts.map((draft): VoxelChunkV1 => {
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
        // A copy: the draft is kept for the next frame, and a caller may change the snapshot it is handed.
        voxels: draft.voxels.slice(),
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
          maxBatches: MAX_SNAPSHOT_BATCHES,
          maxVoxelsPerChunk: AOE_TERRAIN_CHUNK_SIZE * AOE_TERRAIN_CHUNK_SIZE * 64,
          maxGeometryVertices: 1_024,
          maxGeometryIndices: 3_072,
          maxInstancesPerBatch: 200_000,
          maxTotalBytes: 512 * 1024 * 1024,
        },
      },
      revision: this.revision,
      resources: [copyPalette(this.palette.resource), ...copyAoeVoxelResources()],
      chunks,
      batches,
    };
  }

  /** Each entity's hit parts for this revision. A still entity's are kept with its parts, so a hit test reads the
   *  same geometry the batches drew; anything whose parts changed, or that animates, is prepared afresh. */
  private hitEntities(
    entities: readonly PreparedVoxelEntity[],
    animatedKeys: ReadonlySet<string>,
  ): PreparedVoxelHitEntity[] {
    const next = new Map<string, { readonly parts: readonly VoxelPart[]; readonly hit: PreparedVoxelHitEntity }>();
    const prepared = entities.map(({ entity, identity, parts, motion }) => {
      const kept = motion === 'still' ? this.stillHitEntities.get(identity) : undefined;
      if (kept && kept.parts === parts) {
        next.set(identity, kept);
        return kept.hit;
      }
      const hit = prepareVoxelHitEntity(
        entity,
        parts.map((part) => (
          part.animation && !animatedKeys.has(part.key)
            ? { ...part, animation: undefined }
            : part
        )),
      );
      if (motion === 'still' && !parts.some((part) => part.animation)) next.set(identity, { parts, hit });
      return hit;
    });
    this.stillHitEntities = next;
    return prepared;
  }

  private updateHitFeedback(
    entities: readonly PreparedVoxelEntity[],
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
    this.palette = null;
    this.chunkStates.clear();
    this.entityPreparer.reset();
    this.terrainFrame.reset();
    this.lanes.reset();
    this.stillHitEntities = new Map();
    this.healthByIdentity.clear();
    this.hitUntilByIdentity.clear();
    this.lastFeedbackTimeMs = 0;
    this.currentHitState = null;
    this.currentOccludedUnits = [];
  }
}

function copyPalette(palette: PaletteResourceV1): PaletteResourceV1 {
  return { ...palette, entries: palette.entries.map((entry) => ({ color: { ...entry.color } })) };
}
