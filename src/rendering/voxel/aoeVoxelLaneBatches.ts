// The snapshot's instance batches, built so that what did not change is not rebuilt (work 130).
//
// WHY LANES. Until work 130 every part sat in one batch per surface, and every batch took a new revision every frame,
// so the runtime re-validated, re-paged and re-uploaded every instance of the known world on every drawn frame, and
// that work grew with the match (docs/debugging/2026-10-15-frame-rate-through-a-match.md). Here the opaque surfaces
// are split by where their parts come from, and a batch keeps its revision while its parts are unchanged, which is
// what lets the runtime keep it: it reuses a batch whose key, incarnation and revision match and whose contents are
// equal, and skips presenting one whose version did not move.
//  - terrain: the ground's decor and water detail. Changes when the visible ground does.
//  - still:   buildings, resources that are not wildlife, and everything remembered. Changes when one of them does.
//  - moving:  units, wildlife and the frame's overlays (selection, health, projectiles, deaths). Rebuilt every frame.
//
// WHY NOT THE TRANSLUCENT SURFACES. The shadow lane blends each pixel exactly once only because overlapping pieces
// draw highest first (aoeVoxelCastShadows.ts), and that order holds inside one batch. Three.js orders separate
// translucent batches by the depth of each one's bounding-sphere centre, which aoe2 cannot set, so a unit's shadow in
// a batch of its own would draw before or after a tree's whatever their heights, and their overlap would darken
// twice. The see-through memory lane has the same shape: fog ghosts, then the behind-building silhouettes that must
// blend after them. So `shadow-parts` and `memory-parts` stay one batch each, built exactly as before from parts the
// still entities keep, and rebuilt only on a frame that changes them.
//
// WHAT HOLDS THE PICTURE. Opaque instances may draw in any order (the depth test decides), so splitting an opaque
// surface into lanes changes no pixel; each lane is still sorted by key. The translucent lanes are produced by the
// same functions over the same parts as `makePartBatches`. `tests/rendering/aoeVoxelLaneEquivalence.test.ts` holds
// the lanes, merged back, equal to the former adapter's ordered picture over the same projected frames.
import type { InstanceBatchV1 } from 'voxel/core';
import { MAX_ACTIVE_INSTANCE_ANIMATIONS_V1 } from 'voxel/core';

import { resolveShadowLevels } from './aoeVoxelCastShadows';
import { compareParts, type VoxelPart, type VoxelSurface } from './aoeVoxelRecipeTypes';
import { animatableSurface, enabledAnimationKeys, makeInstanceBatch } from './aoeVoxelResources';

export type VoxelLaneSource = 'terrain' | 'still' | 'moving';

export interface VoxelLaneInput {
  /** Terrain decor and water detail, and a version that changes whenever they do. */
  readonly terrain: { readonly version: number; readonly parts: readonly VoxelPart[] };
  /** The still entities' parts, one array per entity, and a version that changes whenever any of them does. */
  readonly still: { readonly version: number; readonly parts: readonly (readonly VoxelPart[])[] };
  /** Everything posed this frame: moving entities, overlays, behind-building silhouettes. */
  readonly moving: readonly VoxelPart[];
}

/** The opaque lanes every snapshot carries, so their meshes live for the whole match; a part that lands in any
 *  other source and surface pair gets a lane on the frames it exists. */
const STANDING_LANES: readonly string[] = [
  'terrain-matte', 'terrain-water', 'terrain-water-animated',
  'still-matte', 'still-metal',
  'moving-matte', 'moving-matte-animated', 'moving-metal', 'moving-metal-animated', 'moving-ui',
];

const SHADOW_BATCH_KEY = 'aoe2:batch:shadow-parts';
const MEMORY_BATCH_KEY = 'aoe2:batch:memory-parts';

/** How many batches a snapshot carries when every part lands in a standing lane. */
export const STANDING_BATCH_COUNT = STANDING_LANES.length + 2;

function laneKey(lane: string): string {
  return `aoe2:batch:${lane}-parts`;
}

function laneName(source: VoxelLaneSource, surface: VoxelSurface, animated: boolean): string {
  return `${source}-${surface}${animated ? '-animated' : ''}`;
}

function surfaceOfLane(lane: string): VoxelSurface {
  return lane.split('-')[1] as VoxelSurface;
}

function assertUniqueKeys(parts: readonly VoxelPart[]): void {
  const seen = new Set<string>();
  for (const part of parts) {
    if (seen.has(part.key)) throw new Error(`Duplicate voxel instance key: ${part.key}`);
    seen.add(part.key);
  }
}

function withoutAnimation(part: VoxelPart): VoxelPart {
  return part.animation ? { ...part, animation: undefined } : part;
}

/** Which animated parts the engine runs: every animatable one unless that would pass the budget, and then the
 *  exact `enabledAnimationKeys` choice over the whole frame. */
type AnimationChoice = { readonly all: true } | { readonly all: false; readonly keys: ReadonlySet<string> };

function animationChoice(groups: readonly (readonly VoxelPart[])[]): AnimationChoice {
  let candidates = 0;
  for (const parts of groups) {
    for (const part of parts) if (part.animation && animatableSurface(part.surface)) candidates += 1;
  }
  if (candidates <= MAX_ACTIVE_INSTANCE_ANIMATIONS_V1) return { all: true };
  return { all: false, keys: enabledAnimationKeys(groups.flat().sort(compareParts)) };
}

function animatedNow(part: VoxelPart, choice: AnimationChoice): boolean {
  if (!part.animation || !animatableSurface(part.surface)) return false;
  return choice.all || choice.keys.has(part.key);
}

/** One source's opaque parts, sorted by key and split into lanes by surface and by whether they animate. */
function opaqueLanes(
  source: VoxelLaneSource,
  parts: readonly VoxelPart[],
  choice: AnimationChoice,
): Map<string, VoxelPart[]> {
  const lanes = new Map<string, VoxelPart[]>();
  for (const part of parts) {
    if (part.surface === 'shadow' || part.surface === 'memory') continue;
    const animated = animatedNow(part, choice);
    const lane = laneName(source, part.surface, animated);
    let list = lanes.get(lane);
    if (!list) {
      list = [];
      lanes.set(lane, list);
    }
    list.push(animated ? part : withoutAnimation(part));
  }
  for (const list of lanes.values()) {
    list.sort(compareParts);
    assertUniqueKeys(list);
  }
  return lanes;
}

interface KeptBatch {
  readonly batch: InstanceBatchV1;
}

/** A copy whose arrays the caller may change without reaching the batch kept for the next frame. */
function copyBatch(batch: InstanceBatchV1): InstanceBatchV1 {
  return {
    ...batch,
    instanceKeys: [...batch.instanceKeys],
    matrices: batch.matrices.slice(),
    ...(batch.colors ? { colors: batch.colors.slice() } : {}),
    ...(batch.animation ? {
      animation: {
        ...batch.animation,
        periodsMs: batch.animation.periodsMs.slice(),
        phasesRadians: batch.animation.phasesRadians.slice(),
        translationAmplitudes: batch.animation.translationAmplitudes.slice(),
        rotationAmplitudesRadians: batch.animation.rotationAmplitudesRadians.slice(),
        scaleAmplitudes: batch.animation.scaleAmplitudes.slice(),
      },
    } : {}),
  };
}

/** The snapshot's batches, frame after frame, for one adapter epoch. */
export class AoeVoxelLaneBatcher {
  private kept = new Map<string, KeptBatch>();
  private keptTerrain: { version: number; lanes: Map<string, VoxelPart[]> } | null = null;
  private keptStill: { version: number; lanes: Map<string, VoxelPart[]>; shadow: VoxelPart[]; memory: VoxelPart[] } | null = null;
  private keptChoiceAll = true;
  private keptMovingShadow = 0;
  private keptMovingMemory = 0;

  reset(): void {
    this.kept = new Map();
    this.keptTerrain = null;
    this.keptStill = null;
    this.keptChoiceAll = true;
    this.keptMovingShadow = 0;
    this.keptMovingMemory = 0;
  }

  batches(input: VoxelLaneInput, revision: number): InstanceBatchV1[] {
    const choice = animationChoice([input.terrain.parts, ...input.still.parts, input.moving]);
    // A choice that is not "all" can move any lane's parts between its animated and plain halves, so every lane
    // is rebuilt on such a frame and on the first frame after one.
    const choiceStable = choice.all && this.keptChoiceAll;
    this.keptChoiceAll = choice.all;

    const terrainChanged = !choiceStable || this.keptTerrain?.version !== input.terrain.version;
    if (terrainChanged) {
      this.keptTerrain = { version: input.terrain.version, lanes: opaqueLanes('terrain', input.terrain.parts, choice) };
    }
    const stillChanged = !choiceStable || this.keptStill?.version !== input.still.version;
    if (stillChanged) {
      const all = input.still.parts.flat();
      this.keptStill = {
        version: input.still.version,
        lanes: opaqueLanes('still', all, choice),
        shadow: all.filter((part) => part.surface === 'shadow'),
        memory: all.filter((part) => part.surface === 'memory'),
      };
    }
    const terrain = this.keptTerrain!;
    const still = this.keptStill!;
    const moving = opaqueLanes('moving', input.moving, choice);
    const movingShadow = input.moving.filter((part) => part.surface === 'shadow');
    const movingMemory = input.moving.filter((part) => part.surface === 'memory');

    const next = new Map<string, KeptBatch>();
    const out: InstanceBatchV1[] = [];
    // A batch that may be handed out again is kept privately and handed out as a copy, so a caller that changes a
    // snapshot's arrays cannot reach a later snapshot. A moving lane is never reused and goes out as built.
    const emit = (key: string, changed: boolean, build: () => InstanceBatchV1, reusable = true): void => {
      const previous = this.kept.get(key);
      if (!reusable) {
        out.push(build());
        return;
      }
      const batch = !changed && previous ? previous.batch : build();
      next.set(key, { batch });
      out.push(copyBatch(batch));
    };

    const laneNames = new Set<string>(STANDING_LANES);
    for (const lanes of [terrain.lanes, still.lanes, moving]) for (const lane of lanes.keys()) laneNames.add(lane);
    const ordered = [
      ...STANDING_LANES,
      ...[...laneNames].filter((lane) => !STANDING_LANES.includes(lane)).sort(),
    ];
    for (const lane of ordered) {
      const source = lane.split('-')[0] as VoxelLaneSource;
      const parts = (source === 'terrain' ? terrain.lanes : source === 'still' ? still.lanes : moving).get(lane) ?? [];
      // A lane that is not standing appears only on the frames it holds parts.
      if (parts.length === 0 && !STANDING_LANES.includes(lane)) continue;
      const changed = source === 'moving'
        || (source === 'terrain' ? terrainChanged : stillChanged)
        || !this.kept.has(laneKey(lane));
      const animated = lane.endsWith('-animated');
      emit(laneKey(lane), changed, () => makeInstanceBatch(
        laneKey(lane), surfaceOfLane(lane), animated, parts, revision,
      ), source !== 'moving');
    }

    // The shadow lane: one batch, lifted and ordered top-down by the same pass as ever.
    const shadowChanged = stillChanged || movingShadow.length > 0 || this.keptMovingShadow > 0
      || !this.kept.has(SHADOW_BATCH_KEY);
    emit(SHADOW_BATCH_KEY, shadowChanged, () => {
      const shadow = resolveShadowLevels([...still.shadow, ...movingShadow]).map(withoutAnimation);
      assertUniqueKeys(shadow);
      return makeInstanceBatch(SHADOW_BATCH_KEY, 'shadow', false, shadow, revision);
    });
    this.keptMovingShadow = movingShadow.length;

    // The see-through lane: fog ghosts, then the silhouettes, whose `ui:occlusion:` keys sort after every entity.
    const memoryChanged = stillChanged || movingMemory.length > 0 || this.keptMovingMemory > 0
      || !this.kept.has(MEMORY_BATCH_KEY);
    emit(MEMORY_BATCH_KEY, memoryChanged, () => {
      const memory = [...still.memory, ...movingMemory].sort(compareParts).map(withoutAnimation);
      assertUniqueKeys(memory);
      return makeInstanceBatch(MEMORY_BATCH_KEY, 'memory', false, memory, revision);
    });
    this.keptMovingMemory = movingMemory.length;

    this.kept = next;
    return out;
  }
}
