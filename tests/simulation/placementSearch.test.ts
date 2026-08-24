import { describe, expect, it } from 'vitest';

import {
  findPlacementAnchorNear,
  placementKeepsGroundConnected,
} from '../../src/game/simulation/bridge/placementSearch';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { MAP_HEIGHT, MAP_WIDTH } from '../../src/game/simulation/mapGeneration/constants';
import { selectOwnedUnitDirect } from './createSimulationBridge.helpers';

// v0.1.93 FIND → v0.1.94 fix: the AI could never place a 4x4 building (market,
// castle, wonder) in an established base — findBuildPlacementNear only scanned
// Chebyshev radius 2..6 around the Town Center, and no 4x4 gap survives the
// packed inner rings, so the search returned null and the AI hoarded resources
// on a build it could never complete. The fix widens the default cap to 12.

const ORIGIN = { x: 20, y: 20 };
const MAP = 48;
// A base whose inner rings (Chebyshev distance <= 6 from the origin) are fully
// built up; open ground only starts at radius 7.
const innerRingBlocked = (x: number, y: number): boolean =>
  Math.max(Math.abs(x - ORIGIN.x), Math.abs(y - ORIGIN.y)) <= 6;

describe('findPlacementAnchorNear — reaches past a crowded base for large footprints', () => {
  it('finds a 4x4 (market/castle/wonder) anchor past the packed inner rings', () => {
    // The old radius-6 cap cannot reach it — proves the bug.
    expect(
      findPlacementAnchorNear(ORIGIN, { width: 4, height: 4 }, MAP, MAP, innerRingBlocked, 6),
    ).toBeNull();
    // The default cap must reach the open radius-7+ ring.
    const anchor = findPlacementAnchorNear(ORIGIN, { width: 4, height: 4 }, MAP, MAP, innerRingBlocked);
    expect(anchor).not.toBeNull();
    // ...and the anchor it returns must actually be unblocked.
    expect(innerRingBlocked(anchor!.x, anchor!.y)).toBe(false);
  });

  it('still finds a 3x3 building an anchor in the near ring (no regression for small buildings)', () => {
    // Only radius 2 blocked; a 3x3 slots into radius 3 as before.
    const justCoreBlocked = (x: number, y: number): boolean =>
      Math.max(Math.abs(x - ORIGIN.x), Math.abs(y - ORIGIN.y)) <= 2;
    const anchor = findPlacementAnchorNear(ORIGIN, { width: 3, height: 3 }, MAP, MAP, justCoreBlocked);
    expect(anchor).not.toBeNull();
  });

  it('returns null when the entire search area is blocked', () => {
    const allBlocked = (): boolean => true;
    expect(findPlacementAnchorNear(ORIGIN, { width: 4, height: 4 }, MAP, MAP, allBlocked)).toBeNull();
  });
});

// Measured on the default map at tick 6000: the AI had packed its buildings
// into a solid mass ten cells wide, sealing its own sheep, boar and forest into
// a pocket its villagers could not enter. Six of them then held that one
// unreachable sheep for the rest of the match; its economy read food 19 / wood
// 19 / 15 villagers, byte-identical from tick 17000 to tick 30000. So a
// placement that cuts the free ground around it in two is refused.
describe('findPlacementAnchorNear — will not seal off ground', () => {
  const MAP_SIZE = 40;
  const ORIGIN_AT = { x: 20, y: 20 };

  it('refuses the anchor that would close a one-cell gap in a wall', () => {
    // A wall of buildings along y = 20 with a single gap at x = 20. Filling
    // that gap severs north from south.
    const wall = (x: number, y: number): boolean => y === 20 && x >= 14 && x <= 26 && x !== 20;
    const blocked = (x: number, y: number, width: number, height: number): boolean => {
      for (let dy = 0; dy < height; dy += 1) {
        for (let dx = 0; dx < width; dx += 1) {
          if (wall(x + dx, y + dy)) return true;
        }
      }
      return false;
    };
    const free = (x: number, y: number): boolean => (
      x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE && !wall(x, y)
    );
    const gap = { x: 20, y: 20 };

    // Without the guard the search happily takes the gap when it is the first
    // fitting 1x1 anchor on its ring.
    const unguarded = findPlacementAnchorNear(gap, { width: 1, height: 1 }, MAP_SIZE, MAP_SIZE, blocked, 1);
    expect(unguarded).toBeNull(); // radius starts at 2, so aim the search at the gap itself

    const guarded = findPlacementAnchorNear(
      { x: 20, y: 22 }, { width: 1, height: 1 }, MAP_SIZE, MAP_SIZE, blocked, 2, free,
    );
    expect(guarded).not.toBeNull();
    expect(guarded).not.toEqual(gap);
  });

  it('still places a building on open ground, where nothing is severed', () => {
    const nothingBlocked = (): boolean => false;
    const allFree = (x: number, y: number): boolean => (
      x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE
    );
    const anchor = findPlacementAnchorNear(
      ORIGIN_AT, { width: 3, height: 3 }, MAP_SIZE, MAP_SIZE, nothingBlocked, 12, allFree,
    );
    expect(anchor).not.toBeNull();
  });

  it('falls back to a sealing anchor rather than refusing to build at all', () => {
    // The only 2x2 gap has a free cell hanging off each of two opposite sides
    // and no way round, so every placement seals — and building somewhere beats
    // not building at all.
    const openCells = new Set(['20,20', '21,20', '20,21', '21,21', '19,20', '22,21']);
    const blocked = (x: number, y: number, width: number, height: number): boolean => {
      for (let dy = 0; dy < height; dy += 1) {
        for (let dx = 0; dx < width; dx += 1) {
          if (!openCells.has(`${String(x + dx)},${String(y + dy)}`)) return true;
        }
      }
      return false;
    };
    const free = (x: number, y: number): boolean => openCells.has(`${String(x)},${String(y)}`);
    // The guard alone would refuse it...
    expect(
      placementKeepsGroundConnected({ x: 20, y: 20 }, { width: 2, height: 2 }, MAP_SIZE, MAP_SIZE, free),
    ).toBe(false);
    // ...and the search still returns it, because nothing else fits.
    const anchor = findPlacementAnchorNear(
      { x: 18, y: 18 }, { width: 2, height: 2 }, MAP_SIZE, MAP_SIZE, blocked, 3, free,
    );
    expect(anchor).toEqual({ x: 20, y: 20 });
  });
});

// The invariant that keeps every footprint-walking query safe: a building's
// cells are all ON the map. `isFootprintVisible` and `isFootprintExplored` walk
// from an anchor across the footprint and hand each cell to the engine's
// visibility map, which THROWS on an out-of-range coordinate rather than
// answering false — the same engine contract that let a stray arrow end a match
// in v0.3.55. Nothing in those helpers checks the range, so this is what makes
// them correct.
describe('a footprint can never leave the map', () => {
  it('refuses a 4x4 building anchored at every edge and corner', () => {
    const bridge = createSimulationBridge('imperial-age-fixture');
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('town-center');

    const offMap: Array<{ x: number; y: number }> = [
      { x: MAP_WIDTH - 1, y: MAP_HEIGHT - 1 },
      { x: MAP_WIDTH - 1, y: 10 },
      { x: 10, y: MAP_HEIGHT - 1 },
      { x: MAP_WIDTH - 2, y: MAP_HEIGHT - 2 },
    ];
    for (const anchor of offMap) {
      expect(bridge.beginBuildingPlacement('town-center')).toBe(true);
      // Refused, and refused WITHOUT throwing: an engine range error here would
      // reach the player as a crashed game rather than a rejected click.
      expect(() => bridge.confirmBuildingPlacement(anchor.x, anchor.y)).not.toThrow();
      expect(bridge.confirmBuildingPlacement(anchor.x, anchor.y)).toBe(false);
    }
  }, 60_000);
});
