// Turning each projected entity into its posed voxel parts, once per presented frame, and keeping what did not
// change (work 130).
//
// WHY A CACHE. The presentation draws a new snapshot on every frame the interpolation alpha moves, which is every
// frame of a running match. Until work 130 that ran every entity's recipe and cast shadow every frame: a tree is 23
// instances and its shadow a silhouette tiling, and late in a match the player knows of hundreds of trees, buildings
// and remembered things. Measured on the lobby's defaults (docs/debugging/2026-10-15-frame-rate-through-a-match.md):
// 1,513 instances at the opening and about 3,000 at tick 11,700, rebuilt at about 4.8 us each per frame.
//
// WHAT IS KEPT. An entity whose parts depend only on its projected view and identity is STILL: a building, a
// resource that is not wildlife, anything remembered under fog. Its parts are kept while its view is equal field by
// field (`sameView`), so a still entity costs one comparison a frame. Everything else is MOVING and is posed every
// frame, as before: a live unit (gait and attack poses read the sample time and the unit's motion history),
// wildlife (it walks, and its gore pose reads the sample time), and anything carrying an attack animation.
//
// WHAT IT GUARANTEES. The parts handed on are the parts the recipes would build from this view and identity this
// frame, so the picture cannot change: a still recipe reads nothing but its view, its identity and the ground
// (`compositionGround`, a constant 0). `tests/rendering/aoeVoxelStillCache.test.ts` changes every field of a
// still view one at a time and requires fresh parts each time.
import type { ProjectedEntityView } from '../../game/simulation/types';
import { createBuildingParts } from './aoeVoxelBuildingRecipes';
import { voxelPartMaxY } from './aoeVoxelGeometry';
import type { VoxelOverlayEntity } from './aoeVoxelOverlayParts';
import type { VoxelPart } from './aoeVoxelRecipeTypes';
import { createResourceParts } from './aoeVoxelResourceRecipes';
import { elevationOf } from './aoeVoxelTerrain';
import {
  resolveUnitAnimationState,
  type AoeUnitAnimationState,
  type AoeUnitMotionHistory,
} from './aoeVoxelUnitAnimation';
import { createUnitParts } from './aoeVoxelUnitRecipes';
import {
  poseWildlifeAttackParts,
  resolveWildlifeFacing,
  type WildlifeFacing,
} from './aoeVoxelWildlifePose';

/** Still: posed from its view alone and kept while that view is unchanged. Moving: posed every frame. */
export type VoxelEntityMotion = 'still' | 'moving';

export interface PreparedVoxelEntity extends VoxelOverlayEntity {
  readonly animationState?: AoeUnitAnimationState;
  readonly motion: VoxelEntityMotion;
}

export interface FallbackIdentityState {
  active: boolean;
  incarnation: number;
}

export interface PreparedVoxelEntities {
  readonly entities: PreparedVoxelEntity[];
  /** Fallback identities as they stand after this frame; committed by the caller once the snapshot is built. */
  readonly fallbacks: Map<string, FallbackIdentityState>;
}

interface StillEntry {
  readonly view: ProjectedEntityView;
  readonly parts: readonly VoxelPart[];
  readonly visualTop: number;
}

type EntityRecipeInput = Omit<PreparedVoxelEntity, 'parts' | 'visualTop' | 'motion'>;

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

/** Which entities have to be posed every frame: anything whose parts can read the sample time or the history the
 *  preparer keeps. A live unit reads both. A live resource reads them through the gore pose and its sticky facing,
 *  so one that is wildlife, carries an attack, or still holds a facing from an earlier strike is moving. A building
 *  recipe reads its view alone, whatever the view carries; a remembered entity is never posed. */
export function voxelEntityMotion(entity: ProjectedEntityView, holdsFacing: boolean): VoxelEntityMotion {
  if (entity.isMemory) return 'still';
  if (entity.layer === 'unit') return 'moving';
  if (entity.layer === 'resource'
    && (entity.wildlifeAlive !== undefined || entity.attackAnimation !== undefined || holdsFacing)) return 'moving';
  return 'still';
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  }
  return true;
}

/** Field by field, nested values included: a view that differs anywhere is a different view. */
export function sameView(a: ProjectedEntityView, b: ProjectedEntityView): boolean {
  return sameValue(a, b);
}

function partsFor(
  entity: EntityRecipeInput,
  sampleTimeMs: number,
  facing: WildlifeFacing | undefined,
): VoxelPart[] {
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
  // Wildlife retaliation (spec §14.5): the gore pose is baked onto the static
  // resource lane at snapshot-build time, so equal presented time freezes it.
  return [...poseWildlifeAttackParts(
    createResourceParts(entity.entity, entity.identity, entity.ground),
    entity.entity,
    sampleTimeMs,
    facing,
  )];
}

function visualTopOf(ground: number, parts: readonly VoxelPart[]): number {
  const visibleParts = parts.filter((part) => part.surface !== 'shadow');
  return visibleParts.length === 0 ? ground : Math.max(...visibleParts.map(voxelPartMaxY));
}

/** Per-adapter entity preparation: identities, motion histories, and the still-entity cache. */
export class AoeVoxelEntityPreparer {
  private readonly fallbackIdentities = new Map<string, FallbackIdentityState>();
  private readonly unitMotionHistories = new Map<string, AoeUnitMotionHistory>();
  private readonly wildlifeFacings = new Map<string, WildlifeFacing>();
  private stillEntries = new Map<string, StillEntry>();
  private stillVersionValue = 0;

  /** Changes whenever the still entities' parts change: one is posed afresh, appears, or goes. */
  get stillVersion(): number {
    return this.stillVersionValue;
  }

  /** Bounded diagnostic seam used by the browser gait proof. */
  inspectUnitMotion(identity: string): AoeUnitMotionHistory | null {
    const history = this.unitMotionHistories.get(identity);
    return history ? { ...history } : null;
  }

  prepare(entities: readonly ProjectedEntityView[], sampleTimeMs: number): PreparedVoxelEntities {
    const fallbacks = new Map(
      [...this.fallbackIdentities].map(([key, state]) => [key, { ...state, active: false }]),
    );
    const seenFallbacks = new Set<string>();
    const nextMotionHistories = new Map<string, AoeUnitMotionHistory>();
    const nextWildlifeFacings = new Map<string, WildlifeFacing>();
    const nextStill = new Map<string, StillEntry>();
    let stillChanged = false;
    const prepared = entities.filter((entity) => entity.layer !== 'terrain').map((entity): PreparedVoxelEntity => {
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
      const ground = compositionGround(entity);
      const motion = voxelEntityMotion(entity, this.wildlifeFacings.has(identity));
      if (motion === 'still') {
        // A still identity seen twice in one frame is a broken projection; the batches' duplicate-key check
        // names it, exactly as it did before this cache.
        const kept = this.stillEntries.get(identity);
        let entry: StillEntry;
        if (kept && !nextStill.has(identity) && sameView(kept.view, entity)) {
          entry = kept;
        } else {
          const parts = partsFor({ entity, identity, ground }, sampleTimeMs, undefined);
          entry = { view: entity, parts, visualTop: visualTopOf(ground, parts) };
          stillChanged = true;
        }
        nextStill.set(identity, entry);
        return { entity, identity, ground, parts: entry.parts, visualTop: entry.visualTop, motion };
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
      // Wildlife facing is sticky between strikes, so it is retained per
      // identity exactly like unit gait history: disposable, never persisted.
      const facing = entity.layer === 'resource' && !entity.isMemory
        ? resolveWildlifeFacing(entity, sampleTimeMs, this.wildlifeFacings.get(identity))
        : undefined;
      if (facing) nextWildlifeFacings.set(identity, facing);
      const recipeInput: EntityRecipeInput = {
        entity,
        identity,
        ground,
        ...(resolvedAnimation ? { animationState: resolvedAnimation.state } : {}),
      };
      const parts = partsFor(recipeInput, sampleTimeMs, facing);
      return { ...recipeInput, parts, visualTop: visualTopOf(ground, parts), motion };
    });
    if (nextStill.size !== this.stillEntries.size) stillChanged = true;
    if (stillChanged) this.stillVersionValue += 1;
    this.stillEntries = nextStill;
    this.unitMotionHistories.clear();
    for (const [identity, history] of nextMotionHistories) {
      this.unitMotionHistories.set(identity, history);
    }
    this.wildlifeFacings.clear();
    for (const [identity, facing] of nextWildlifeFacings) {
      this.wildlifeFacings.set(identity, facing);
    }
    return { entities: prepared, fallbacks };
  }

  commitFallbacks(next: Map<string, FallbackIdentityState>): void {
    this.fallbackIdentities.clear();
    for (const [key, state] of next) this.fallbackIdentities.set(key, state);
  }

  reset(): void {
    this.fallbackIdentities.clear();
    this.unitMotionHistories.clear();
    this.wildlifeFacings.clear();
    this.stillEntries = new Map();
    this.stillVersionValue += 1;
  }
}
