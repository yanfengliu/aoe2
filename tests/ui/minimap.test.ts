import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView, RenderState } from '../../src/game/simulation/types';
import {
  cellToMinimap,
  drawMinimap,
  getMinimapLayout,
  minimapCameraSignature,
  minimapContentSignature,
  minimapToCell,
  type MinimapCameraState,
} from '../../src/ui/hud/minimap';

interface DrawCall {
  op: 'fillRect' | 'strokeRect' | 'clearRect' | 'setTransform' | 'beginPath' | 'moveTo' | 'lineTo' | 'closePath' | 'fill' | 'stroke' | 'arc';
  args: number[];
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
}

function createCanvasSpy(width = 100, height = 100) {
  const calls: DrawCall[] = [];
  const context = {
    _fillStyle: '',
    _strokeStyle: '',
    _lineWidth: 1,
    get fillStyle() {
      return this._fillStyle;
    },
    set fillStyle(value: string) {
      this._fillStyle = value;
    },
    get strokeStyle() {
      return this._strokeStyle;
    },
    set strokeStyle(value: string) {
      this._strokeStyle = value;
    },
    get lineWidth() {
      return this._lineWidth;
    },
    set lineWidth(value: number) {
      this._lineWidth = value;
    },
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
      calls.push({ op: 'setTransform', args: [a, b, c, d, e, f] });
    },
    clearRect(x: number, y: number, w: number, h: number) {
      calls.push({ op: 'clearRect', args: [x, y, w, h] });
    },
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ op: 'fillRect', args: [x, y, w, h], fillStyle: this._fillStyle });
    },
    beginPath() {
      calls.push({ op: 'beginPath', args: [] });
    },
    moveTo(x: number, y: number) {
      calls.push({ op: 'moveTo', args: [x, y] });
    },
    lineTo(x: number, y: number) {
      calls.push({ op: 'lineTo', args: [x, y] });
    },
    arc(x: number, y: number, radius: number, start: number, end: number) {
      calls.push({ op: 'arc', args: [x, y, radius, start, end] });
    },
    closePath() {
      calls.push({ op: 'closePath', args: [] });
    },
    fill() {
      calls.push({ op: 'fill', args: [], fillStyle: this._fillStyle });
    },
    stroke() {
      calls.push({ op: 'stroke', args: [], strokeStyle: this._strokeStyle, lineWidth: this._lineWidth });
    },
  };
  const canvas = {
    width,
    height,
    dataset: {} as Record<string, string>,
    getContext: (kind: string) => (kind === '2d' ? context : null),
  } as unknown as HTMLCanvasElement;
  return { canvas, calls };
}

function entity(overrides: Partial<ProjectedEntityView>): ProjectedEntityView {
  return {
    id: 1,
    kind: 'tile',
    layer: 'terrain',
    entityType: 'grass',
    owner: null,
    x: 0,
    y: 0,
    tint: 0x5a8f52,
    size: 1,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: null,
    maxHp: null,
    isMemory: false,
    ...overrides,
  };
}

function visibleFrame(width = 10, height = 10): RenderState['frame'] {
  const cells = Array.from({ length: width * height }, (_, index) => index);
  return {
    tick: 0,
    playerId: 1,
    seed: 'minimap-test',
    mapWidth: width,
    mapHeight: height,
    visibleCells: cells,
    exploredCells: cells,
    recentUnitDeaths: [],
    projectiles: [],
  };
}

const canvasFor = (w: number, h: number) =>
  ({ width: w, height: h } as unknown as HTMLCanvasElement);

describe('minimap iso projection (pure)', () => {
  it('fits a square map into a centred 2:1 diamond', () => {
    const layout = getMinimapLayout(canvasFor(100, 100), visibleFrame(10, 10))!;
    expect(layout).not.toBeNull();
    // span=20, hw=min(100/20, 200/20)*0.96 = 5*0.96 = 4.8, hh=2.4.
    expect(layout.hw).toBeCloseTo(4.8, 5);
    expect(layout.hh).toBeCloseTo(2.4, 5);
    // Square map → horizontally centred; originY lifts the diamond so its
    // vertical midpoint sits at canvas centre.
    expect(layout.originX).toBeCloseTo(50, 5);
    expect(layout.originY).toBeCloseTo(50 - 10 * 2.4, 5);
  });

  it('projects the four map corners into a diamond (top/right/bottom/left)', () => {
    const layout = getMinimapLayout(canvasFor(100, 100), visibleFrame(10, 10))!;
    const top = cellToMinimap(0, 0, layout);
    const right = cellToMinimap(10, 0, layout);
    const bottom = cellToMinimap(10, 10, layout);
    const left = cellToMinimap(0, 10, layout);
    // Top corner is highest (smallest y), bottom lowest; right is rightmost.
    expect(top.y).toBeLessThan(left.y);
    expect(top.y).toBeLessThan(right.y);
    expect(bottom.y).toBeGreaterThan(left.y);
    expect(right.x).toBeGreaterThan(top.x);
    expect(left.x).toBeLessThan(top.x);
    // Top and bottom share the horizontal centre; left and right share it too.
    expect(top.x).toBeCloseTo(bottom.x, 5);
    expect(left.x).toBeCloseTo(right.x - (right.x - left.x), 5);
  });

  it('minimapToCell inverts cellToMinimap (round-trip)', () => {
    const layout = getMinimapLayout(canvasFor(128, 96), visibleFrame(60, 36))!;
    for (const [cx, cy] of [[0, 0], [30, 18], [59, 35], [12.5, 7.25]]) {
      const px = cellToMinimap(cx, cy, layout);
      const back = minimapToCell(px.x, px.y, layout);
      expect(back.cellX).toBeCloseTo(cx, 4);
      expect(back.cellY).toBeCloseTo(cy, 4);
    }
  });

  it('returns null layout without a frame', () => {
    expect(getMinimapLayout(canvasFor(100, 100), null)).toBeNull();
  });

  it('projects a diamond-centre click to an in-map cell and canvas corners to off-map cells', () => {
    // Mirrors the click-to-pan bounds check in createHudController: a click is
    // accepted iff its projected cell is inside [0,mapWidth]x[0,mapHeight].
    const mapWidth = 60;
    const mapHeight = 36;
    const layout = getMinimapLayout(canvasFor(200, 130), visibleFrame(mapWidth, mapHeight))!;
    const inMap = (cx: number, cy: number) =>
      cx >= 0 && cx <= mapWidth && cy >= 0 && cy <= mapHeight;

    // The map-centre cell projects to a pixel that inverts back inside the map.
    const centrePixel = cellToMinimap(mapWidth / 2, mapHeight / 2, layout);
    const centreCell = minimapToCell(centrePixel.x, centrePixel.y, layout);
    expect(inMap(centreCell.cellX, centreCell.cellY)).toBe(true);

    // The four canvas corners are the off-map wedges around the diamond.
    for (const [px, py] of [[0, 0], [200, 0], [0, 130], [200, 130]]) {
      const cell = minimapToCell(px, py, layout);
      expect(inMap(cell.cellX, cell.cellY), `corner (${px},${py}) should be off-map`).toBe(false);
    }
  });
});

describe('drawMinimap (iso diamond)', () => {
  it('fills terrain cells under the iso transform, then draws markers in identity space', () => {
    const { canvas, calls } = createCanvasSpy();
    const layout = getMinimapLayout(canvas, visibleFrame())!;
    const renderState: RenderState = {
      tick: 0,
      frame: visibleFrame(),
      entities: [
        entity({ id: 10, x: 2, y: 3, tint: 0x5a8f52 }),
        entity({
          id: 20, kind: 'unit', layer: 'unit', entityType: 'villager', owner: 1,
          x: 2, y: 3, tint: 0x3fa7ff, size: 0.5, currentHp: 25, maxHp: 25,
        }),
      ],
    };
    drawMinimap(canvas, renderState, null);

    // The iso transform matrix (hw, hh, -hw, hh, originX, originY) is set
    // before the terrain fills and reset (identity) before the markers.
    const isoTransform = calls.find(
      (c) => c.op === 'setTransform' && c.args[0] === layout.hw && c.args[2] === -layout.hw,
    );
    expect(isoTransform).toBeDefined();
    // Terrain cell fill happens in CELL space (x≈2, y≈3) under the transform.
    const terrainFill = calls.find(
      (c) => c.op === 'fillRect' && c.fillStyle === '#5a8f52' && Math.abs(c.args[0]! - 2) < 0.1,
    );
    expect(terrainFill).toBeDefined();

    // The unit marker draws at the projected cell CENTRE (2.5, 3.5), identity space.
    const centre = cellToMinimap(2.5, 3.5, layout);
    const markerDot = calls.find(
      (c) => c.op === 'fillRect' && c.fillStyle === '#3fa7ff'
        && Math.abs(c.args[0]! + c.args[2]! / 2 - centre.x) < 0.01
        && Math.abs(c.args[1]! + c.args[3]! / 2 - centre.y) < 0.01,
    );
    expect(markerDot, 'unit marker at projected cell centre').toBeDefined();
    // The dark halo is drawn before (behind) the coloured dot.
    const halo = calls.find((c) => c.op === 'fillRect' && c.fillStyle === 'rgba(4, 8, 9, 0.72)');
    expect(halo).toBeDefined();
    expect(calls.indexOf(halo!)).toBeLessThan(calls.indexOf(markerDot!));
    // Terrain (transformed) is drawn before the markers (identity).
    expect(calls.indexOf(terrainFill!)).toBeLessThan(calls.indexOf(markerDot!));
  });

  it('draws the camera viewport as a projected quad path', () => {
    const { canvas, calls } = createCanvasSpy();
    const camera: MinimapCameraState = {
      scrollX: 0, scrollY: 0, zoom: 1, width: 0, height: 0,
      viewX: 0, viewY: 0, viewWidth: 0, viewHeight: 0,
      viewCorners: [
        { cellX: 2, cellY: 2 },
        { cellX: 6, cellY: 2 },
        { cellX: 6, cellY: 5 },
        { cellX: 2, cellY: 5 },
      ],
    };
    drawMinimap(canvas, { tick: 0, frame: visibleFrame(), entities: [] }, camera);

    // A 4-point path (moveTo + 3 lineTo + closePath) then fill + stroke.
    expect(calls.some((c) => c.op === 'beginPath')).toBe(true);
    expect(calls.filter((c) => c.op === 'lineTo').length).toBe(3);
    expect(calls.some((c) => c.op === 'stroke' && c.strokeStyle === 'rgba(247, 229, 165, 0.95)')).toBe(true);
    expect(canvas.dataset.viewportActive).toBe('true');
  });

  it('projects the actual (skewed) view corners, not their bounding box (full-review M8)', () => {
    const { canvas, calls } = createCanvasSpy();
    const frame = visibleFrame();
    // A rotated quad; its cell-space AABB would be [1,1]-[7,9] — much larger.
    const viewCorners = [
      { cellX: 1, cellY: 5 },
      { cellX: 5, cellY: 1 },
      { cellX: 7, cellY: 5 },
      { cellX: 5, cellY: 9 },
    ];
    const camera: MinimapCameraState = {
      scrollX: 0, scrollY: 0, zoom: 1, width: 0, height: 0,
      viewX: 0, viewY: 0, viewWidth: 0, viewHeight: 0,
      viewCorners,
    };
    drawMinimap(canvas, { tick: 0, frame, entities: [] }, camera);

    const layout = getMinimapLayout(canvas, frame)!;
    const expected = viewCorners.map((c) => cellToMinimap(c.cellX, c.cellY, layout));
    const drawn = calls
      .filter((c) => c.op === 'moveTo' || c.op === 'lineTo')
      .map((c) => ({ x: c.args[0]!, y: c.args[1]! }));
    expect(drawn.length).toBe(4);
    drawn.forEach((p, i) => {
      expect(p.x).toBeCloseTo(expected[i]!.x, 5);
      expect(p.y).toBeCloseTo(expected[i]!.y, 5);
    });
    // The real first corner (1,5) must NOT project to the old AABB min (1,1).
    const aabbMin = cellToMinimap(1, 1, layout);
    expect(Math.abs(drawn[0]!.y - aabbMin.y)).toBeGreaterThan(1);
  });

  it('marks the viewport inactive without a camera', () => {
    const { canvas } = createCanvasSpy();
    drawMinimap(canvas, { tick: 0, frame: visibleFrame(), entities: [] }, null);
    expect(canvas.dataset.viewportActive).toBe('false');
  });

  // v0.3.217 attack warning: the mark is drawn ON the minimap, because
  // nothing may float OVER it and AoE2's own affordance is the minimap
  // flashing where the blow landed.
  it('draws the attack-warning mark at the projected cell, well above a building marker', () => {
    const { canvas, calls } = createCanvasSpy();
    const layout = getMinimapLayout(canvas, visibleFrame())!;
    drawMinimap(
      canvas,
      { tick: 0, frame: visibleFrame(), entities: [] },
      null,
      { x: 4, y: 6, intensity: 1 },
    );
    const centre = cellToMinimap(4.5, 6.5, layout);
    const arcs = calls.filter(
      (c) => c.op === 'arc'
        && Math.abs(c.args[0]! - centre.x) < 0.001
        && Math.abs(c.args[1]! - centre.y) < 0.001,
    );
    // Backing, ring, core.
    expect(arcs).toHaveLength(3);
    const buildingMarker = Math.max(layout.hw * 1.4, 2);
    expect(Math.max(...arcs.map((c) => c.args[2]!))).toBeGreaterThan(buildingMarker);
    expect(canvas.dataset.attackWarningCell).toBe('4,6');
  });

  it('draws nothing at all in a quiet frame', () => {
    const { canvas, calls } = createCanvasSpy();
    drawMinimap(canvas, { tick: 0, frame: visibleFrame(), entities: [] }, null, null);
    expect(calls.filter((c) => c.op === 'arc')).toHaveLength(0);
    expect(canvas.dataset.attackWarningCell).toBeUndefined();
  });
});

describe('minimap redraw signatures (full-review M9)', () => {
  const frameForOwner = (owner: number): RenderState['frame'] => ({
    ...visibleFrame()!,
    playerId: owner,
  });

  it('changes the content signature when the fog owner swaps at the same tick', () => {
    // A replay fog-owner swap keeps the tick fixed but changes frame.playerId;
    // the content signature MUST differ so the redraw gate fires (else the
    // minimap keeps showing the prior owner's visibility).
    const asHuman: RenderState = { tick: 500, frame: frameForOwner(1), entities: [] };
    const asEnemy: RenderState = { tick: 500, frame: frameForOwner(2), entities: [] };
    expect(minimapContentSignature(asHuman)).not.toEqual(minimapContentSignature(asEnemy));
    // Same owner + same tick → identical (no needless repaint).
    expect(minimapContentSignature(asHuman)).toEqual(
      minimapContentSignature({ tick: 500, frame: frameForOwner(1), entities: [] }),
    );
  });

  it('changes the content signature when the tick advances for the same owner', () => {
    expect(minimapContentSignature({ tick: 500, frame: frameForOwner(1), entities: [] })).not.toEqual(
      minimapContentSignature({ tick: 501, frame: frameForOwner(1), entities: [] }),
    );
  });

  it('handles a null frame without throwing and keys camera signature on scroll/zoom', () => {
    // The warning term is empty in a quiet frame (v0.3.217).
    expect(minimapContentSignature({ tick: 7, frame: null, entities: [] }, '')).toBe('7:-1:');
    const camera: MinimapCameraState = {
      scrollX: 10,
      scrollY: 20,
      zoom: 1.5,
      width: 800,
      height: 600,
      viewX: 0,
      viewY: 0,
      viewWidth: 10,
      viewHeight: 10,
      viewCorners: [],
    };
    expect(minimapCameraSignature(null)).toBe('none');
    expect(minimapCameraSignature(camera)).not.toBe('none');
    expect(minimapCameraSignature({ ...camera, scrollX: 11 })).not.toEqual(
      minimapCameraSignature(camera),
    );
  });
});
