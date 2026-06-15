import { describe, expect, it } from 'vitest';

import { terrainCellTint } from '../../src/phaser/scenes/gameScene/terrainRenderer';

// Base terrain tints, mirroring scenarioSeedOps.seedTerrain. The renderer
// applies a deterministic per-cell jitter on top so adjacent same-kind cells
// stop reading as one flat block (M7 graphics — original/procedural art only).
const GRASS = 0x587f4e;
const WATER = 0x295a75;

function channels(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

describe('terrainCellTint — per-cell terrain texture variation', () => {
  it('is deterministic per cell (no frame-to-frame shimmer)', () => {
    // Same cell must always map to the same tint; otherwise static terrain
    // would flicker every render frame.
    expect(terrainCellTint(GRASS, 3, 5)).toBe(terrainCellTint(GRASS, 3, 5));
    expect(terrainCellTint(GRASS, 12, 0)).toBe(terrainCellTint(GRASS, 12, 0));
  });

  it('returns a valid 24-bit colour with every channel in 0..255', () => {
    for (let y = 0; y < 36; y++) {
      for (let x = 0; x < 60; x++) {
        const tint = terrainCellTint(GRASS, x, y);
        expect(tint).toBeGreaterThanOrEqual(0);
        expect(tint).toBeLessThanOrEqual(0xffffff);
        for (const ch of channels(tint)) {
          expect(ch).toBeGreaterThanOrEqual(0);
          expect(ch).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it('handles edge tints without overflow and exercises the upper clamp', () => {
    // Pure black stays black for every cell (0 * any multiplier = 0); a
    // negative or NaN channel would surface here.
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        expect(terrainCellTint(0x000000, x, y)).toBe(0x000000);
      }
    }
    // Pure white must never exceed the gamut, and cells whose jitter brightens
    // (multiplier > 1) must actually engage the upper clamp at 255 — the branch
    // the mid-tone GRASS/WATER cases never reach.
    let sawUpperClamp = false;
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const tint = terrainCellTint(0xffffff, x, y);
        expect(tint).toBeLessThanOrEqual(0xffffff);
        for (const ch of channels(tint)) {
          expect(ch).toBeLessThanOrEqual(255);
          if (ch === 255) sawUpperClamp = true;
        }
      }
    }
    expect(sawUpperClamp).toBe(true);
  });

  it('keeps the variation subtle (each channel within ~10% of the base)', () => {
    // The jitter must read as gentle texture, not garish noise. Guards
    // against someone cranking the jitter amplitude.
    const [br, bg, bb] = channels(GRASS);
    const bound = (base: number) => Math.ceil(base * 0.1) + 2;
    for (let y = 0; y < 36; y++) {
      for (let x = 0; x < 60; x++) {
        const [r, g, b] = channels(terrainCellTint(GRASS, x, y));
        expect(Math.abs(r - br)).toBeLessThanOrEqual(bound(br));
        expect(Math.abs(g - bg)).toBeLessThanOrEqual(bound(bg));
        expect(Math.abs(b - bb)).toBeLessThanOrEqual(bound(bb));
      }
    }
  });

  it('actually varies across cells (breaks up the flat block)', () => {
    const seen = new Set<number>();
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        seen.add(terrainCellTint(GRASS, x, y));
      }
    }
    // 400 cells yield many distinct shades — a flat fill would yield 1. The
    // jitter is a single brightness multiplier (hue preserved), so the three
    // channels move together and ±7% resolves to a few dozen distinct tints;
    // that is plenty to break the block while reading as light/shade.
    expect(seen.size).toBeGreaterThan(30);
  });

  it('is unbiased on average (preserves the designer-chosen base colour)', () => {
    // Symmetric jitter: the mean over a large field stays close to the base,
    // so terrain does not globally darken or brighten.
    const [br, bg, bb] = channels(WATER);
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let n = 0;
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        const [r, g, b] = channels(terrainCellTint(WATER, x, y));
        sr += r;
        sg += g;
        sb += b;
        n++;
      }
    }
    expect(Math.abs(sr / n - br)).toBeLessThanOrEqual(3);
    expect(Math.abs(sg / n - bg)).toBeLessThanOrEqual(3);
    expect(Math.abs(sb / n - bb)).toBeLessThanOrEqual(3);
  });
});
