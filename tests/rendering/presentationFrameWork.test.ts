// GATE: between simulation ticks, a frame re-sends none of the still world (work 130).
//
// WHY. The play session of 2026-10-14 measured the frame rate falling through a match, 59.7 fps at 00:15 to about
// 21 at 19:30, the same over the base and over an empty corner. The cause (docs/debugging/2026-10-15-frame-rate-
// through-a-match.md): the presentation rebuilt and re-sent every instance of everything the player sees or
// remembers on every drawn frame, and the runtime re-validated, re-paged and re-uploaded all of it, at about 4.8 us
// an instance per frame. Instances grow with the match (1,513 at the opening, about 3,000 at tick 11,700 in an
// AI-played match), so frames slowed as the match went on.
//
// WHAT IT MEASURES. A count, not a timing, so the machine's load cannot move it: on a frame where only the
// interpolation alpha moved, the instances in batches the adapter re-sent (a batch whose revision changed must be
// re-paged and rewritten by the runtime; one that kept its revision is kept), and of those, the instances that
// belong to the still world on an opaque surface: buildings, resources that are not wildlife, remembered entities
// and terrain detail. The old presentation re-sends them all on every frame; the gate requires none. The old
// presentation (tests/rendering/helpers/legacyVoxelAdapter.ts) is measured beside it in every run, as the control
// that proves the count sees the defect.
//
// HOW. The lobby's map with the computer playing both seats (the headless harness's own switch), at the opening and
// at tick 1,700, drawn the way the frame loop draws: the presentation's own position smoother, one frame on the
// tick and three between, the sample time advancing with them.
//
// BOUND. Opaque surfaces only. The translucent shadow and memory lanes are still rebuilt and re-sent on a frame
// where a unit moved, because their in-batch order is what makes a pixel blend once (aoeVoxelLaneBatches.ts), so
// shadows of the still world are re-sent too: that is work 130's open trade, not a pass of this gate. One seed, two
// match times; a state the AI does not reach (a player's larger base) is not measured.
import { describe, expect, it } from 'vitest';
import type { RenderSnapshotV1 } from 'voxel/core';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { TPS } from '../../src/game/simulation/prototypeScenario';
import { createDisplayedPositionSmoother } from '../../src/rendering/displayedPositionSmoother';
import { AoeVoxelAdapter } from '../../src/rendering/voxel/aoeVoxelAdapter';
import { voxelEntityMotion } from '../../src/rendering/voxel/aoeVoxelEntityPrep';
import { LegacyAoeVoxelAdapter } from './helpers/legacyVoxelAdapter';

interface FrameWork {
  readonly instances: number;
  readonly resent: number;
  readonly stillOpaqueResent: number;
}

const TRANSLUCENT = new Set(['aoe2:batch:shadow-parts', 'aoe2:batch:memory-parts']);

/** Instances re-sent between the two snapshots, and how many of those are the still world on an opaque surface. */
function frameWork(previous: RenderSnapshotV1, next: RenderSnapshotV1, still: ReadonlySet<string>): FrameWork {
  const kept = new Map(previous.batches.map((batch) => [batch.key, batch.revision]));
  let instances = 0;
  let resent = 0;
  let stillOpaqueResent = 0;
  for (const batch of next.batches) {
    instances += batch.instanceKeys.length;
    if (kept.get(batch.key) === batch.revision) continue;
    resent += batch.instanceKeys.length;
    if (TRANSLUCENT.has(batch.key)) continue;
    for (const key of batch.instanceKeys) {
      const identity = key.split(':').slice(0, 2).join(':');
      if (key.startsWith('terrain:') || still.has(identity) || still.has(key.split(':')[0]!)) stillOpaqueResent += 1;
    }
  }
  return { instances, resent, stillOpaqueResent };
}

/** The identities of the still world in a frame, as the projection names them (id:generation, or the id alone). */
function stillIdentities(entities: readonly ProjectedEntityView[]): Set<string> {
  const still = new Set<string>();
  for (const entity of entities) {
    if (entity.layer === 'terrain') continue;
    if (voxelEntityMotion(entity, false) !== 'still') continue;
    still.add(entity.generation === undefined ? String(entity.id) : `${String(entity.id)}:${String(entity.generation)}`);
  }
  return still;
}

interface RecordedFrame {
  readonly entities: readonly ProjectedEntityView[];
  readonly sampleTimeMs: number;
  readonly frame: ReturnType<ReturnType<typeof createSimulationBridge>['getRenderState']>['frame'];
  readonly alpha: number;
}

/** Six ticks of a match from `ticksBefore` on, four frames a tick, as the frame loop would draw them. */
function recordFrames(ticksBefore: number): RecordedFrame[] {
  const bridge = createSimulationBridge('aoe2-prototype', {
    civilizationsByOwner: new Map([[1, 'Britons']]),
    forceAiForOwners: new Set([1]),
  });
  for (let tick = 0; tick < ticksBefore; tick += 1) bridge.step(1000 / TPS);
  const smoother = createDisplayedPositionSmoother();
  const frames: RecordedFrame[] = [];
  for (let tick = 0; tick < 6; tick += 1) {
    bridge.step(1000 / TPS);
    const state = bridge.getRenderState();
    for (const alpha of [0, 0.25, 0.5, 0.75]) {
      frames.push({
        entities: smoother.apply(state.entities, state.tick, alpha),
        sampleTimeMs: (state.tick + alpha) * 1000 / TPS,
        frame: state.frame,
        alpha,
      });
    }
  }
  return frames;
}

function measure(frames: readonly RecordedFrame[], adapter: AoeVoxelAdapter | LegacyAoeVoxelAdapter): FrameWork[] {
  adapter.setVoxelGround(false);
  const between: FrameWork[] = [];
  let previous: RenderSnapshotV1 | null = null;
  for (const recorded of frames) {
    const snapshot = adapter.createSnapshot(recorded.entities, recorded.sampleTimeMs, {
      frame: recorded.frame, placementPreview: null, selectionPreviewEntityIds: [], selectionMarqueeWorldCorners: null,
    });
    // The first frame of a tick may rebuild whatever the tick changed; the gate is about the frames between.
    if (previous && recorded.alpha > 0) between.push(frameWork(previous, snapshot, stillIdentities(recorded.entities)));
    previous = snapshot;
  }
  return between;
}

describe('a frame between ticks re-sends none of the still world', () => {
  for (const [label, ticksBefore] of [['the opening', 0], ['tick 1,700', 1_700]] as const) {
    it(`at ${label}`, () => {
      const frames = recordFrames(ticksBefore);
      const current = measure(frames, new AoeVoxelAdapter());
      const legacy = measure(frames, new LegacyAoeVoxelAdapter());
      expect(current).toHaveLength(18);
      // The control: the presentation work 130 replaced re-sends the still world on every frame, so a count of zero
      // below means the presentation kept it, not that the count saw nothing.
      expect(Math.min(...legacy.map((frame) => frame.stillOpaqueResent)), 'the old presentation, as the control')
        .toBeGreaterThan(300);
      expect(current.map((frame) => frame.stillOpaqueResent), 'still-world instances re-sent between ticks')
        .toEqual(current.map(() => 0));
      // Fewer instances re-sent than the frame holds, by at least the still world the control re-sent.
      for (let index = 0; index < current.length; index += 1) {
        expect(current[index]!.resent).toBeLessThanOrEqual(current[index]!.instances - legacy[index]!.stillOpaqueResent);
      }
    }, 60_000);
  }
});
