// GATE: the incremental presentation (work 130) draws the same picture as the presentation it replaced.
//
// WHY. Work 130 stopped rebuilding the whole known world on every frame: still entities keep their parts while
// their view is unchanged (aoeVoxelEntityPrep.ts), and the opaque surfaces come in lanes that keep their revision
// (aoeVoxelLaneBatches.ts). A stale cache would draw last frame's building, or a tree that has gone; a lane that
// drops or doubles a part would show at once in a capture, but a wrong order in the shadow lane would only darken
// the overlap of two shadows. So the new adapter and the old one (tests/rendering/helpers/legacyVoxelAdapter.ts,
// kept verbatim) are driven through the same frames and compared as the GPU draws them (helpers/laneEquivalence.ts):
// translucent lanes instance for instance in order, opaque surfaces as sets, plus resources, chunks, the hit state
// and the behind-building list.
//
// HOW. (1) A real match: the lobby's map with the computer playing both seats, stepped at the game's 100 ms tick
// and drawn three frames a tick through the presentation's own position smoother, as the frame loop does. (2) A
// scripted sequence for what a short match may not reach: a boar's strike and the facing it keeps, trees turning to
// fog memory and back, a building selected and damaged, a unit walking behind a building, deaths and shots in the
// frame, fog lifting from cells, and both art styles' ground switches.
//
// BOUND. One seed and 40 ticks of real play from tick 600; a scripted list of transitions. It compares snapshots,
// not pixels: that the opaque order and lanes change no pixel rests on the depth test, and the captures of work
// 130's plan are the pixel check.
import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView, ProjectedFrameView } from '../../src/game/simulation/types';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { TPS } from '../../src/game/simulation/prototypeScenario';
import { createDisplayedPositionSmoother } from '../../src/rendering/displayedPositionSmoother';
import { AoeVoxelAdapter } from '../../src/rendering/voxel/aoeVoxelAdapter';
import type { AoeVoxelOverlayInput } from '../../src/rendering/voxel/aoeVoxelOverlayParts';
import { LegacyAoeVoxelAdapter } from './helpers/legacyVoxelAdapter';
import { expectSamePicture } from './helpers/laneEquivalence';

type Frame = {
  readonly entities: readonly ProjectedEntityView[];
  readonly sampleTimeMs: number;
  readonly overlays: AoeVoxelOverlayInput;
};

function drive(frames: Iterable<Frame>, setup?: (adapters: { current: AoeVoxelAdapter; legacy: LegacyAoeVoxelAdapter }, index: number) => void): number {
  const current = new AoeVoxelAdapter();
  const legacy = new LegacyAoeVoxelAdapter();
  let index = 0;
  for (const frame of frames) {
    setup?.({ current, legacy }, index);
    const actual = current.createSnapshot(frame.entities, frame.sampleTimeMs, frame.overlays);
    const expected = legacy.createSnapshot(frame.entities, frame.sampleTimeMs, frame.overlays);
    const label = `frame ${String(index)}`;
    expectSamePicture(actual, expected, label);
    expect(current.latestHitState(), `${label}: hit state`).toEqual(legacy.latestHitState());
    expect(current.latestOccludedUnits(), `${label}: behind-building list`).toEqual(legacy.latestOccludedUnits());
    index += 1;
  }
  return index;
}

function overlaysFor(frame: ProjectedFrameView | null): AoeVoxelOverlayInput {
  return { frame, placementPreview: null, selectionPreviewEntityIds: [], selectionMarqueeWorldCorners: null };
}

describe('the incremental presentation draws what the full rebuild drew', () => {
  it('through a real match, three frames a tick', () => {
    const bridge = createSimulationBridge('aoe2-prototype', {
      civilizationsByOwner: new Map([[1, 'Britons']]),
      forceAiForOwners: new Set([1]),
    });
    for (let tick = 0; tick < 600; tick += 1) bridge.step(1000 / TPS);
    const smoother = createDisplayedPositionSmoother();
    function* frames(): Generator<Frame> {
      for (let tick = 0; tick < 40; tick += 1) {
        bridge.step(1000 / TPS);
        const state = bridge.getRenderState();
        for (const alpha of [0, 1 / 3, 2 / 3]) {
          yield {
            entities: smoother.apply(state.entities, state.tick, alpha),
            sampleTimeMs: (state.tick + alpha) * 1000 / TPS,
            overlays: overlaysFor(state.frame),
          };
        }
      }
    }
    expect(drive(frames())).toBe(120);
  }, 60_000);

  it('through scripted transitions of every kind the caches keep', () => {
    const base = (overrides: Partial<ProjectedEntityView>): ProjectedEntityView => ({
      id: 1, generation: 1, kind: 'tile', layer: 'terrain', entityType: 'grass', owner: null, x: 0, y: 0,
      elevation: 0, tint: 0x587f4e, size: 1, footprintWidth: 1, footprintHeight: 1, visualVariant: 'default',
      selected: false, currentHp: null, maxHp: null, isMemory: false, ...overrides,
    });
    const tiles: ProjectedEntityView[] = [];
    for (let y = 0; y < 12; y += 1) {
      for (let x = 0; x < 12; x += 1) {
        tiles.push(base({ id: 1000 + y * 12 + x, x, y, entityType: x > 9 ? 'water' : 'grass', tint: x > 9 ? 0x2f5f8f : 0x587f4e }));
      }
    }
    const tree = (id: number, x: number, y: number, isMemory = false) => base({
      id, kind: 'resource', layer: 'resource', entityType: 'tree', x, y, size: 0.6, tint: 0x2f5e34, isMemory,
    });
    const townCenter = (overrides: Partial<ProjectedEntityView> = {}) => base({
      id: 50, kind: 'building', layer: 'building', entityType: 'town-center', owner: 1, x: 4, y: 4,
      footprintWidth: 4, footprintHeight: 4, visualVariant: 'complete', tint: 0x3366cc, currentHp: 2400, maxHp: 2400,
      ...overrides,
    });
    const villager = (x: number, y: number, overrides: Partial<ProjectedEntityView> = {}) => base({
      id: 70, kind: 'unit', layer: 'unit', entityType: 'villager', owner: 1, x, y, size: 0.72, tint: 0x3568c0,
      currentHp: 25, maxHp: 25, ...overrides,
    });
    const boar = (overrides: Partial<ProjectedEntityView> = {}) => base({
      id: 90, kind: 'resource', layer: 'resource', entityType: 'boar', x: 2, y: 9, size: 0.9, tint: 0x6b4a2f,
      currentHp: 69, maxHp: 75, ...overrides,
    });
    const allCells = Array.from({ length: 144 }, (_, index) => index);
    const fog = (visible: readonly number[], tick: number, extra: Partial<ProjectedFrameView> = {}): ProjectedFrameView => ({
      tick, playerId: 1, seed: 'lanes', mapWidth: 12, mapHeight: 12, visibleCells: [...visible],
      exploredCells: allCells, recentUnitDeaths: [], projectiles: [], ...extra,
    });
    const westHalf = allCells.filter((index) => index % 12 < 6);
    const strike = { tick: 0, sourceX: 2, sourceY: 9, targetX: 1, targetY: 9 };
    const steps: Array<{ entities: ProjectedEntityView[]; frame: ProjectedFrameView | null }> = [
      { entities: [...tiles, tree(10, 1, 1), tree(11, 2, 1), townCenter(), villager(2, 3)], frame: fog(allCells, 1) },
      { entities: [...tiles, tree(10, 1, 1), tree(11, 2, 1), townCenter(), villager(2.25, 3)], frame: fog(allCells, 1) },
      { entities: [...tiles, tree(10, 1, 1), tree(11, 2, 1, true), townCenter(), villager(2.5, 3.5)], frame: fog(westHalf, 2) },
      { entities: [...tiles, tree(10, 1, 1), townCenter({ selected: true }), villager(4.5, 3.6)], frame: fog(westHalf, 3) },
      { entities: [...tiles, tree(10, 1, 1), townCenter({ selected: true, currentHp: 2000 }), villager(5, 3.8)], frame: fog(westHalf, 4) },
      { entities: [...tiles, tree(10, 1, 1), townCenter({ visualVariant: 'construction', currentHp: 300 }), villager(5.2, 4)], frame: fog(allCells, 5) },
      { entities: [...tiles, tree(10, 1, 1), townCenter(), villager(5.2, 4), boar({ attackAnimation: strike } as Partial<ProjectedEntityView>)], frame: fog(allCells, 6) },
      { entities: [...tiles, tree(10, 1, 1), townCenter(), villager(5.2, 4), boar()], frame: fog(allCells, 7) },
      { entities: [...tiles, tree(10, 1, 1), tree(12, 8, 8), townCenter(), boar()], frame: fog(allCells, 8, {
        recentUnitDeaths: [{ id: 70, tick: 7, unitType: 'villager', owner: 1, x: 5.7, y: 4.5, tint: 0x3568c0, size: 0.72 }],
      } as Partial<ProjectedFrameView>) },
      { entities: [...tiles, tree(10, 1, 1, true), tree(12, 8, 8), townCenter({ isMemory: true, currentHp: null, maxHp: null })], frame: null },
    ];
    function* frames(): Generator<Frame> {
      let time = 0;
      for (const step of steps) {
        for (let repeat = 0; repeat < 2; repeat += 1) {
          time += 40;
          yield { entities: step.entities, sampleTimeMs: time, overlays: overlaysFor(step.frame) };
        }
      }
    }
    const count = drive(frames(), ({ current, legacy }, index) => {
      // Switch the art style's ground halfway: the voxel chunks and the shore surf come back with Moebius.
      const voxelGround = index >= 10 && index < 16;
      current.setVoxelGround(voxelGround);
      legacy.setVoxelGround(voxelGround);
      const explored = index >= 13 ? 0.5 : 0.35;
      current.setExploredGround(explored);
      legacy.setExploredGround(explored);
    });
    expect(count).toBe(steps.length * 2);
  });
});
