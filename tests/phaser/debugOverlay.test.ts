import { describe, expect, it } from 'vitest';

import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type {
  ProjectedEntityView,
  ProjectedFrameView,
  SelectionState,
  SimulationDebugSnapshot,
} from '../../src/game/simulation/types';
import { createDebugOverlayRenderer } from '../../src/phaser/scenes/gameScene/debugOverlay';
import { worldToIso } from '../../src/phaser/scenes/gameScene/isoProjection';

// Full-review M1: the F-key debug overlays used to paint at the pre-iso
// top-down `cell*cellSize` position, so on the isometric map the selection
// bounds / pathing lines / fog-state cells / coarse-vs-fine probes landed where
// the world ISN'T. These tests record the draw primitives and assert every
// world-space point is routed through `worldToIso` (iso diamonds / projected
// endpoints), never an axis-aligned `x*cellSize` square.
function createLayerSpy() {
  const calls: Array<{ op: string; args: number[]; pts?: Array<{ x: number; y: number }> }> = [];
  const layer = {
    clear: () => {},
    fillStyle: () => {},
    lineStyle: () => {},
    fillRect: (x: number, y: number, w: number, h: number) =>
      calls.push({ op: 'fillRect', args: [x, y, w, h] }),
    strokeRect: (x: number, y: number, w: number, h: number) =>
      calls.push({ op: 'strokeRect', args: [x, y, w, h] }),
    fillPoints: (pts: Array<{ x: number; y: number }>) =>
      calls.push({ op: 'fillPoints', args: [], pts: pts.map((p) => ({ x: p.x, y: p.y })) }),
    strokePoints: (pts: Array<{ x: number; y: number }>) =>
      calls.push({ op: 'strokePoints', args: [], pts: pts.map((p) => ({ x: p.x, y: p.y })) }),
    lineBetween: (x1: number, y1: number, x2: number, y2: number) =>
      calls.push({ op: 'lineBetween', args: [x1, y1, x2, y2] }),
    fillCircle: (x: number, y: number, r: number) =>
      calls.push({ op: 'fillCircle', args: [x, y, r] }),
  } as unknown as Phaser.GameObjects.Graphics;
  return { layer, calls };
}

function emptySnapshot(overrides: Partial<SimulationDebugSnapshot>): SimulationDebugSnapshot {
  return {
    tick: 0,
    tickDurationMs: 0,
    entityCount: 0,
    unitPaths: [],
    aiSummaries: [],
    coarseVsFine: [],
    ...overrides,
  };
}

function bridgeWith(snapshot: SimulationDebugSnapshot): SimulationBridge {
  return { getDebugSnapshot: () => snapshot } as unknown as SimulationBridge;
}

function building(overrides: Partial<ProjectedEntityView>): ProjectedEntityView {
  return {
    id: 1,
    kind: 'building',
    layer: 'building',
    entityType: 'town-center',
    owner: 1,
    x: 10,
    y: 10,
    tint: 0,
    size: 1,
    footprintWidth: 4,
    footprintHeight: 4,
    visualVariant: 'default',
    selected: false,
    currentHp: 100,
    maxHp: 100,
    isMemory: false,
    ...overrides,
  };
}

const selection = (ids: number[]): SelectionState =>
  ({ selectedEntityIds: ids } as unknown as SelectionState);

function frame(overrides: Partial<ProjectedFrameView>): ProjectedFrameView {
  return {
    tick: 1,
    playerId: 1,
    seed: 's',
    mapWidth: 2,
    mapHeight: 2,
    visibleCells: [],
    exploredCells: [],
    recentUnitDeaths: [],
    ...overrides,
  };
}

describe('debugOverlay — iso projection (not the pre-iso square grid)', () => {
  it('strokes the selection AABB as an iso diamond of its four world corners', () => {
    const { layer, calls } = createLayerSpy();
    const renderer = createDebugOverlayRenderer({ debugLayer: layer, bridge: bridgeWith(emptySnapshot({})) });
    renderer.render('selection-bounds', [building({ id: 7, x: 10, y: 10 })], selection([7]), null);
    expect(calls.some((c) => c.op === 'strokeRect')).toBe(false);
    const stroke = calls.find((c) => c.op === 'strokePoints');
    expect(stroke?.pts).toEqual([
      worldToIso(10, 10),
      worldToIso(14, 10),
      worldToIso(14, 14),
      worldToIso(10, 14),
    ]);
  });

  it('draws a unit path line between projected cell centres, dot on the projected target', () => {
    const { layer, calls } = createLayerSpy();
    const snapshot = emptySnapshot({
      unitPaths: [{ id: 3, fromX: 5, fromY: 5, toX: 8, toY: 3, commandType: 'move' }],
    });
    const renderer = createDebugOverlayRenderer({ debugLayer: layer, bridge: bridgeWith(snapshot) });
    // No displayed position for id 3 → falls back to from(5,5).
    renderer.render('pathing', [], selection([]), null);
    const line = calls.find((c) => c.op === 'lineBetween');
    const from = worldToIso(5.5, 5.5);
    const to = worldToIso(8.5, 3.5);
    expect(line?.args).toEqual([from.x, from.y, to.x, to.y]);
    const dot = calls.find((c) => c.op === 'fillCircle');
    expect(dot?.args.slice(0, 2)).toEqual([to.x, to.y]);
  });

  it('paints fog-state cells as iso diamonds (fillPoints), never axis-aligned squares', () => {
    const { layer, calls } = createLayerSpy();
    const renderer = createDebugOverlayRenderer({ debugLayer: layer, bridge: bridgeWith(emptySnapshot({})) });
    // 2x2 map, only cell index 3 = (1,1) is neither visible nor explored.
    renderer.render(
      'fog-state',
      [],
      selection([]),
      frame({ mapWidth: 2, mapHeight: 2, visibleCells: [0, 1, 2], exploredCells: [0, 1, 2] }),
    );
    expect(calls.some((c) => c.op === 'fillRect')).toBe(false);
    const diamonds = calls.filter((c) => c.op === 'fillPoints');
    expect(diamonds).toHaveLength(4);
    for (const d of diamonds) expect(d.pts).toHaveLength(4);
    // The (1,1) cell projects to its four worldToIso corners.
    expect(diamonds[3].pts).toEqual([
      worldToIso(1, 1),
      worldToIso(2, 1),
      worldToIso(2, 2),
      worldToIso(1, 2),
    ]);
  });

  it('draws the coarse-vs-fine probe line between projected cell centres', () => {
    const { layer, calls } = createLayerSpy();
    const snapshot = emptySnapshot({
      coarseVsFine: [{ id: 2, coarseX: 3, coarseY: 3, fineX: 4, fineY: 4 }],
    });
    const renderer = createDebugOverlayRenderer({ debugLayer: layer, bridge: bridgeWith(snapshot) });
    renderer.render('coarse-vs-fine', [], selection([]), null);
    const line = calls.find((c) => c.op === 'lineBetween');
    const coarse = worldToIso(3.5, 3.5);
    const fine = worldToIso(4.5, 4.5);
    expect(line?.args).toEqual([coarse.x, coarse.y, fine.x, fine.y]);
  });
});
