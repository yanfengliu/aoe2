// A drop-off building belongs beside the resource it serves (2026-08-30).
//
// Measured across three seeds before this existed: camps landed a median 5
// tiles from what they serve, with a Mining Camp at 16 and a Mill at 52 — the
// AI anchored every building at its Town Center (or, for the bootstrap Lumber
// Camp, at the builder's feet). AoE2 puts the camp on the woodline.

import { describe, expect, it } from 'vitest';

import {
  DROP_OFF_ANCHOR_RADIUS,
  dropOffAnchorFor,
  isDropOffBuilding,
} from '../../src/game/simulation/bridge/systems/dropOffAnchor';

type Res = { id: number; x: number; y: number; kind: string; amount: number };

function worldWith(resources: Res[]) {
  return {
    query: (...components: string[]) => (
      components.includes('resource') ? resources.map((r) => r.id) : []
    ),
    getComponent: (id: number, kind: string) => {
      const r = resources.find((x) => x.id === id);
      if (!r) return undefined;
      if (kind === 'position') return { x: r.x, y: r.y };
      if (kind === 'resource') return { resourceType: r.kind, amount: r.amount };
      return undefined;
    },
  };
}

const TC = { x: 10, y: 10 };

describe('where a drop-off building belongs', () => {
  it('knows which buildings exist to shorten a carry', () => {
    expect(isDropOffBuilding('lumber-camp')).toBe(true);
    expect(isDropOffBuilding('mining-camp')).toBe(true);
    expect(isDropOffBuilding('mill')).toBe(true);
    expect(isDropOffBuilding('barracks')).toBe(false);
    expect(isDropOffBuilding('house')).toBe(false);
  });

  it('anchors a lumber camp at the nearest tree, not the town centre', () => {
    const world = worldWith([
      { id: 1, x: 18, y: 10, kind: 'tree', amount: 100 },
      { id: 2, x: 13, y: 10, kind: 'tree', amount: 100 },
      { id: 3, x: 11, y: 10, kind: 'gold-mine', amount: 800 },
    ]);
    expect(dropOffAnchorFor(world as never, 'lumber-camp', TC)).toEqual({ x: 13, y: 10 });
  });

  it('sends a mining camp to ore and a mill to wild food', () => {
    const world = worldWith([
      { id: 1, x: 14, y: 10, kind: 'gold-mine', amount: 800 },
      { id: 2, x: 12, y: 10, kind: 'berry-bush', amount: 125 },
      { id: 3, x: 16, y: 10, kind: 'tree', amount: 100 },
    ]);
    expect(dropOffAnchorFor(world as never, 'mining-camp', TC)).toEqual({ x: 14, y: 10 });
    expect(dropOffAnchorFor(world as never, 'mill', TC)).toEqual({ x: 12, y: 10 });
  });

  it('never anchors a mill on a sheep or a boar — those come to the town centre', () => {
    // Including them moved mills from 2 tiles off the berries to 8, because a
    // wandering sheep won the nearest-resource contest.
    const world = worldWith([
      { id: 1, x: 11, y: 10, kind: 'sheep', amount: 100 },
      { id: 2, x: 11, y: 11, kind: 'boar', amount: 340 },
      { id: 3, x: 14, y: 10, kind: 'berry-bush', amount: 125 },
    ]);
    expect(dropOffAnchorFor(world as never, 'mill', TC)).toEqual({ x: 14, y: 10 });
  });

  it('ignores exhausted resources — a camp on empty ground helps nobody', () => {
    const world = worldWith([
      { id: 1, x: 11, y: 10, kind: 'tree', amount: 0 },
      { id: 2, x: 15, y: 10, kind: 'tree', amount: 100 },
    ]);
    expect(dropOffAnchorFor(world as never, 'lumber-camp', TC)).toEqual({ x: 15, y: 10 });
  });

  it('refuses to send the AI across the map, and says so by returning null', () => {
    // The 52-tile Mill this exists to prevent: the caller must fall back to
    // its own anchor rather than march a builder into the unknown.
    const far = { id: 1, x: 10 + DROP_OFF_ANCHOR_RADIUS + 5, y: 10, kind: 'berry-bush', amount: 125 };
    expect(dropOffAnchorFor(worldWith([far]) as never, 'mill', TC)).toBeNull();
  });

  it('returns null for a building that is not a drop-off at all', () => {
    const world = worldWith([{ id: 1, x: 11, y: 10, kind: 'tree', amount: 100 }]);
    expect(dropOffAnchorFor(world as never, 'barracks', TC)).toBeNull();
  });
});
