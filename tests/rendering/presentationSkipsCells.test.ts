// @vitest-environment jsdom
// GATE: a frame between simulation ticks reads none of the map's cells (work 150 M2b, rank 1).
//
// WHY. The projected entity list holds one entity per cell, 14,400 on a DE Tiny map, and until this gate every
// drawn frame walked all of them several times over though nothing about a cell changes between ticks: the
// coordinator filtered the list for its selection key and built two lists from it that only a test reads (the
// buildings' and the health bars' states), the position smoother mapped it, the textured ground's packing filtered it for its sources, the adapter filtered it for the terrain and the
// entity preparer filtered it again for everything else. At the opening of a match, where almost nothing else is
// on the list, those walks were 0.2 ms a frame on today's map, 1.0 on DE Tiny and 2.0 on DE Medium (plan 150, "M2b
// measurement"): a cost that grows with the map and buys nothing.
//
// WHAT IT COUNTS. Not a timing. Two counts (tests/helpers/cellReadCounter.ts), each over the real coordinator,
// position smoother, renderer and adapter running the frame loop's own sequence over a real match (a stand-in for
// voxel's runtime takes the snapshots): one frame on each tick and three between, as the page draws at 60 frames a
// second and Normal speed.
//  (1) Reads of any field of any terrain view, counted by replacing every field of every terrain view the bridge
//      hands out with an accessor, and the view's prototype with a stand-in that counts a read of a field the view
//      does not hold (an optional one: a walk that asks every entity for its `attackAnimation` reads no field a cell
//      has). Between ticks the count must be zero. The control is the same loop over a copy of the list, which no
//      part of the presentation was told the two halves of: it reads every cell on every frame, so a zero means the
//      cells were skipped, not that the count saw nothing.
//  (2) Cells fetched by index from the array that is the list's terrain half, counted by a proxy in its place: a
//      walk that reads no field (a copy, or one array's objects compared with another's) is seen here and not in
//      (1). Between ticks a frame may fetch each cell once: the position smoother copies the half into the list it
//      hands on, a native copy of pointers. Anything more is another walk. The proxy is checked against a copy it
//      is known to have served, so a count that sees nothing shows.
//
// BOUND. Count (2) sees the terrain half's own array. A walk of the whole joined list that asks nothing of a cell (a
// second copy of the list, a comparison of its objects with another list's) is seen by neither count. What a frame
// WITH a tick does to the cells is reported, not held (tests/simulation/renderStateCellsStaySorted.test.ts holds the
// render state's read on a tick). The Natural style's textured ground, the default; the voxel ground of the other
// style rebuilds its chunks from the cells on a tick, never between. The counters are checked against reads whose
// number is known in tests/simulation/cellReadCounter.test.ts.
import { afterEach, describe, expect, it } from 'vitest';

import { createSimulationBridge, type SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { TPS } from '../../src/game/simulation/prototypeScenario';
import type { ProjectedEntityView, RenderState } from '../../src/game/simulation/types';
import { createAoeVoxelPresentationCoordinator } from '../../src/rendering/voxel/AoeVoxelPresentationCoordinator';
import { AoeVoxelWorldRenderer } from '../../src/rendering/voxel/AoeVoxelWorldRenderer';
import { cellReadCounter, terrainArrayReadCounter } from '../helpers/cellReadCounter';
import { createDeTinySizedBridge } from '../helpers/deTinySizedWorld';
import { FakeRuntime } from './helpers/fakeVoxelRuntime';

afterEach(() => {
  document.body.replaceChildren();
});

const CAMERA = {
  scrollX: 0, scrollY: 0, zoom: 1, width: 320, height: 200, viewX: 0, viewY: 0, viewWidth: 320, viewHeight: 200, viewCorners: [],
};

interface FrameReads { readonly cells: number; readonly frames: number; readonly betweenTicks: number; readonly onTicks: number; readonly presented: number }

interface Counter { watch?(entities: readonly ProjectedEntityView[]): void; reads(): number }

/** Six ticks of the match as the frame loop draws them, four frames a tick. `readState` is what the coordinator's
 *  bridge hands it, so the control can hand it a list the presentation knows nothing about, and the second count a
 *  list whose terrain half it watches. */
function drawFrames(bridge: SimulationBridge, readState: (state: RenderState) => RenderState, counter: Counter): FrameReads {
  const runtime = new FakeRuntime();
  const renderer = new AoeVoxelWorldRenderer({ host: document.createElement('div'), width: 320, height: 200, createRuntime: () => runtime });
  let alpha = 0;
  const coordinator = createAoeVoxelPresentationCoordinator({
    getBridge: () => ({ getRenderState: () => readState(bridge.getRenderState()), getRenderInterpolationAlpha: () => alpha }),
    isActive: () => true,
    getPlacementPreviewState: () => null,
    getSelectionBoxState: () => null,
    screenToWorldPosition: () => ({ x: 0, z: 0 }),
    centerCameraOnWorldPosition: () => undefined,
    present: (entities, displayTimeMs, overlays) => { renderer.present(entities, displayTimeMs, overlays); },
  });
  let betweenTicks = 0;
  let onTicks = 0;
  let frames = 0;
  // Two ticks drawn before the count, so every lane and cache has been built once.
  for (let tick = 0; tick < 8; tick += 1) {
    bridge.step(1000 / TPS);
    for (alpha of [0, 0.25, 0.5, 0.75]) {
      counter.watch?.(bridge.getRenderState().entities);
      const before = counter.reads();
      coordinator.syncFromBridge();
      renderer.frame(CAMERA, 16);
      if (tick < 2) continue;
      frames += 1;
      if (alpha === 0) onTicks += counter.reads() - before;
      else betweenTicks += counter.reads() - before;
    }
    // The stand-in keeps every snapshot it is handed; one is all the renderer needs.
    runtime.accepted.splice(0, runtime.accepted.length - 1);
  }
  const cells = bridge.getRenderState().entities.filter((entity) => entity.layer === 'terrain').length;
  renderer.dispose();
  return { cells, frames, betweenTicks, onTicks, presented: runtime.acceptSnapshot.mock.calls.length };
}

/** The same views in a new array each tick: a list nobody remembered the two halves of. */
function forgottenLists(): (state: RenderState) => RenderState {
  let last: { from: RenderState; copy: RenderState } | null = null;
  return (state) => {
    if (last?.from !== state) last = { from: state, copy: { ...state, entities: [...state.entities] } };
    return last.copy;
  };
}

describe('a frame between ticks reads none of the map\'s cells', () => {
  const worlds: ReadonlyArray<readonly [string, () => SimulationBridge, number]> = [
    ['a DE Tiny sized world', () => createDeTinySizedBridge(), 14_400],
    ['today\'s map', () => createSimulationBridge('aoe2-prototype', { forceAiForOwners: new Set([1]) }), 2_160],
  ];
  for (const [label, open, cells] of worlds) {
    it(`on ${label}`, () => {
      const bridge = open();
      for (let tick = 0; tick < 300; tick += 1) bridge.step(1000 / TPS);
      const drawn = drawFrames(bridge, (state) => state, cellReadCounter());
      expect(drawn.cells, 'terrain cells on the list').toBe(cells);
      expect(drawn.frames, 'frames counted').toBe(24);
      expect(drawn.presented, 'snapshots the runtime was handed, one a frame').toBe(32);
      expect(drawn.betweenTicks, 'reads of a cell\'s fields over the 18 frames between ticks').toBe(0);

      const control = drawFrames(bridge, forgottenLists(), cellReadCounter());
      // Every cell at least once on every frame between ticks, when nothing tells the presentation where they are.
      expect(control.betweenTicks, 'the control: reads over the same 18 frames of a list nobody remembered').toBeGreaterThanOrEqual(18 * cells);

      const array = terrainArrayReadCounter();
      const fetched = drawFrames(bridge, (state) => array.readState(state), array);
      expect(array.readsOfLastJoin(), 'the proxy: cells it served to a copy of the terrain half').toBe(cells);
      expect(fetched.frames, 'frames counted over the watched array').toBe(24);
      expect(fetched.betweenTicks, 'cells fetched from the terrain half over the 18 frames between ticks: one copy a frame at most').toBeLessThanOrEqual(18 * cells);
      console.log(`[cell reads] ${label}: fields between ticks ${String(drawn.betweenTicks)} (control ${String(Math.round(control.betweenTicks / 18 / cells))} a cell a frame); `
        + `on a tick ${String(Math.round(drawn.onTicks / 6 / cells))} a cell (control ${String(Math.round(control.onTicks / 6 / cells))}); `
        + `fetched from the terrain half between ticks ${(fetched.betweenTicks / 18 / cells).toFixed(2)} a cell a frame, on a tick ${(fetched.onTicks / 6 / cells).toFixed(2)}`);
    }, 120_000);
  }
});
