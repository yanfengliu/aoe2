import { describe, expect, it } from 'vitest';

import {
  ISO_ELEVATION_STEP,
  ISO_TILE_HEIGHT,
  ISO_TILE_WIDTH,
  isoToWorld,
  worldToIso,
} from '../../src/phaser/scenes/gameScene/isoProjection';

// Isometric projection foundation (isometric-overhaul increment 1): the pure math seam every renderer
// and the click hit-test will run through as the game moves from a flat top-down
// grid to a 2:1 diamond-tile isometric view. Standard AoE2-style iso: the two
// grid diagonals separate along screen-X, stack along screen-Y; elevation lifts.

describe('worldToIso', () => {
  it('maps the origin cell to the origin', () => {
    expect(worldToIso(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('separates the two grid axes along the screen diagonals (diamond layout)', () => {
    // +cellX goes down-right; +cellY goes down-left; both add screen-Y.
    expect(worldToIso(1, 0)).toEqual({ x: ISO_TILE_WIDTH / 2, y: ISO_TILE_HEIGHT / 2 });
    expect(worldToIso(0, 1)).toEqual({ x: -ISO_TILE_WIDTH / 2, y: ISO_TILE_HEIGHT / 2 });
    // The two combine: (1,1) is straight down one full tile-height, centred in X.
    expect(worldToIso(1, 1)).toEqual({ x: 0, y: ISO_TILE_HEIGHT });
  });

  it('lifts higher elevation upward (negative screen-Y)', () => {
    expect(worldToIso(0, 0, 1)).toEqual({ x: 0, y: -ISO_ELEVATION_STEP });
    expect(worldToIso(2, 2, 3)).toEqual({
      x: 0,
      y: 4 * (ISO_TILE_HEIGHT / 2) - 3 * ISO_ELEVATION_STEP,
    });
  });
});

describe('isoToWorld (ground-plane inverse, for hit-testing)', () => {
  it('round-trips worldToIso for arbitrary cells (elevation 0)', () => {
    for (const [cx, cy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [3, 5],
      [12, 7],
      [-4, 9],
    ] as Array<[number, number]>) {
      const iso = worldToIso(cx, cy);
      const back = isoToWorld(iso.x, iso.y);
      expect(back.cellX).toBeCloseTo(cx, 6);
      expect(back.cellY).toBeCloseTo(cy, 6);
    }
  });

  it('maps a screen point inside a tile to fractional cell coordinates', () => {
    // The centre of the (0,0) tile's diamond is the origin → cell (0,0).
    expect(isoToWorld(0, 0).cellX).toBeCloseTo(0, 6);
    expect(isoToWorld(0, 0).cellY).toBeCloseTo(0, 6);
  });
});

describe('tile constants', () => {
  it('are a 2:1 diamond (classic isometric)', () => {
    expect(ISO_TILE_WIDTH).toBe(ISO_TILE_HEIGHT * 2);
    expect(ISO_ELEVATION_STEP).toBeGreaterThan(0);
  });
});
