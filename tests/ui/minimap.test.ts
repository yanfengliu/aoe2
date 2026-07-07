import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView, RenderState } from '../../src/game/simulation/types';
import { drawMinimap } from '../../src/ui/hud/minimap';

interface RectCall {
  op: 'fillRect' | 'strokeRect' | 'clearRect';
  x: number;
  y: number;
  width: number;
  height: number;
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
}

function createCanvasSpy(width = 100, height = 100) {
  const rects: RectCall[] = [];
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
    clearRect(x: number, y: number, rectWidth: number, rectHeight: number) {
      rects.push({ op: 'clearRect', x, y, width: rectWidth, height: rectHeight });
    },
    fillRect(x: number, y: number, rectWidth: number, rectHeight: number) {
      rects.push({
        op: 'fillRect',
        x,
        y,
        width: rectWidth,
        height: rectHeight,
        fillStyle: this._fillStyle,
      });
    },
    strokeRect(x: number, y: number, rectWidth: number, rectHeight: number) {
      rects.push({
        op: 'strokeRect',
        x,
        y,
        width: rectWidth,
        height: rectHeight,
        strokeStyle: this._strokeStyle,
        lineWidth: this._lineWidth,
      });
    },
  };

  const canvas = {
    width,
    height,
    dataset: {} as Record<string, string>,
    getContext: (kind: string) => (kind === '2d' ? context : null),
  } as unknown as HTMLCanvasElement;

  return { canvas, rects };
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
  };
}

describe('drawMinimap', () => {
  it('draws dark-backed live entity markers so units and buildings stay legible on terrain', () => {
    const { canvas, rects } = createCanvasSpy();
    const renderState: RenderState = {
      tick: 0,
      frame: visibleFrame(),
      entities: [
        entity({ id: 10, x: 2, y: 3, tint: 0x5a8f52 }),
        entity({
          id: 20,
          kind: 'unit',
          layer: 'unit',
          entityType: 'villager',
          owner: 1,
          x: 2,
          y: 3,
          tint: 0x3fa7ff,
          size: 0.5,
          currentHp: 25,
          maxHp: 25,
        }),
        entity({
          id: 30,
          kind: 'building',
          layer: 'building',
          entityType: 'town-center',
          owner: 2,
          x: 6,
          y: 4,
          tint: 0xff5a4d,
          size: 1,
          footprintWidth: 4,
          footprintHeight: 4,
          currentHp: 2400,
          maxHp: 2400,
        }),
      ],
    };

    drawMinimap(canvas, renderState, null);

    const unitHalo = rects.find(
      (rect) =>
        rect.op === 'fillRect'
        && rect.fillStyle === 'rgba(4, 8, 9, 0.72)'
        && rect.x === 20
        && rect.y === 30
        && rect.width === 10
        && rect.height === 10,
    );
    const unitMarker = rects.find(
      (rect) =>
        rect.op === 'fillRect'
        && rect.fillStyle === '#3fa7ff'
        && rect.x === 21
        && rect.y === 31
        && rect.width === 8
        && rect.height === 8,
    );
    const buildingHalo = rects.find(
      (rect) =>
        rect.op === 'fillRect'
        && rect.fillStyle === 'rgba(4, 8, 9, 0.72)'
        && rect.x === 57
        && rect.y === 37
        && rect.width === 16
        && rect.height === 16,
    );
    const buildingMarker = rects.find(
      (rect) =>
        rect.op === 'fillRect'
        && rect.fillStyle === '#ff5a4d'
        && rect.x === 58
        && rect.y === 38
        && rect.width === 14
        && rect.height === 14,
    );

    expect(unitHalo).toBeDefined();
    expect(unitMarker).toBeDefined();
    expect(buildingHalo).toBeDefined();
    expect(buildingMarker).toBeDefined();
    expect(rects.indexOf(unitHalo!)).toBeLessThan(rects.indexOf(unitMarker!));
    expect(rects.indexOf(buildingHalo!)).toBeLessThan(rects.indexOf(buildingMarker!));
  });

  it('draws live entity markers after all terrain cells regardless of render-state ordering', () => {
    const { canvas, rects } = createCanvasSpy();
    const renderState: RenderState = {
      tick: 0,
      frame: visibleFrame(),
      entities: [
        entity({
          id: 20,
          kind: 'unit',
          layer: 'unit',
          entityType: 'villager',
          owner: 1,
          x: 2,
          y: 3,
          tint: 0x3fa7ff,
          size: 0.5,
          currentHp: 25,
          maxHp: 25,
        }),
        entity({ id: 10, x: 2, y: 3, tint: 0x5a8f52 }),
      ],
    };

    drawMinimap(canvas, renderState, null);

    const terrain = rects.find(
      (rect) =>
        rect.op === 'fillRect'
        && rect.fillStyle === '#5a8f52'
        && rect.x === 20
        && rect.y === 30
        && rect.width === 10
        && rect.height === 10,
    );
    const marker = rects.find(
      (rect) =>
        rect.op === 'fillRect'
        && rect.fillStyle === '#3fa7ff'
        && rect.x === 21
        && rect.y === 31
        && rect.width === 8
        && rect.height === 8,
    );

    expect(terrain).toBeDefined();
    expect(marker).toBeDefined();
    expect(rects.indexOf(marker!)).toBeGreaterThan(rects.indexOf(terrain!));
  });
});
