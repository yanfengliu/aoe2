import { describe, expect, it } from 'vitest';

import {
  AI_PLACEMENT_SEARCH_RADIUS,
  AI_PLACEMENT_WIDER_SEARCH_RADIUS,
  createPlacementSearchStats,
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
      findPlacementAnchorNear(ORIGIN, { width: 4, height: 4 }, MAP, MAP, innerRingBlocked, {
        radius: 6,
        widerRadius: null,
      }),
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
//
// And refused WITHOUT a fallback (2026-09-08). From 2026-08-23 a search that
// found only sealing anchors ran again with the guard off, because "a sealed
// pocket beats an AI that stops building". Measured on `black-forest` with an
// independent flood (register entry 2026-09-06, "A normal match seals its own
// map"): enemy units reachable from the human's ground went 4/4 at tick 0 to
// 0/26 at tick 20,000, and no battle had ever happened in this game on any
// seed. The three cases at the end of this block are the shape of the rule
// now: only sealing anchors in reach → null; a sealing one near and an open
// one further out → the further one; both fit → the open one.
//
// WHAT A GREEN RUN HERE DOES NOT PROVE: these are the pure search's rules on
// hand-drawn grids of blocked/free predicates. Whether the AI's `isFree` is the
// ground a unit can actually walk, whether a pending intention is counted, and
// whether a real match stays connected are `aiPlacementKeepsMapConnected.test.ts`
// and `scripts/mapConnectivity.mjs`.
describe('findPlacementAnchorNear — will not seal off ground', () => {
  const MAP_SIZE = 40;
  const ORIGIN_AT = { x: 20, y: 20 };
  const chebyshev = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  /** A footprint predicate over a per-cell predicate. */
  const footprintBlockedBy = (cellBlocked: (x: number, y: number) => boolean) =>
    (x: number, y: number, width: number, height: number): boolean => {
      for (let dy = 0; dy < height; dy += 1) {
        for (let dx = 0; dx < width; dx += 1) {
          if (cellBlocked(x + dx, y + dy)) return true;
        }
      }
      return false;
    };

  it('refuses the anchor that would close a one-cell gap in a wall', () => {
    // A MAP-SPANNING wall of buildings along y = 20 with a single gap at
    // x = 20. Filling that gap severs north from south globally. (v0.3.160:
    // the guard floods the WHOLE map now, so a partial wall with open ends is
    // correctly allowed — walking around a wall is a detour, not a seal. The
    // pre-global margin-boxed guard would have called this partial wall a
    // seal, which is exactly the local blindness that let real farm walls
    // through when their collective seal lay outside any one farm's box.)
    const wall = (x: number, y: number): boolean => y === 20 && x !== 20;
    const blocked = footprintBlockedBy(wall);
    const free = (x: number, y: number): boolean => (
      x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE && !wall(x, y)
    );
    const gap = { x: 20, y: 20 };

    // Without the guard the search happily takes the gap when it is the first
    // fitting 1x1 anchor on its ring.
    const unguarded = findPlacementAnchorNear(gap, { width: 1, height: 1 }, MAP_SIZE, MAP_SIZE, blocked, {
      radius: 1,
      widerRadius: null,
    });
    expect(unguarded).toBeNull(); // radius starts at 2, so aim the search at the gap itself

    const guarded = findPlacementAnchorNear(
      { x: 20, y: 22 }, { width: 1, height: 1 }, MAP_SIZE, MAP_SIZE, blocked,
      { radius: 2, widerRadius: null, isFree: free },
    );
    expect(guarded).not.toBeNull();
    expect(guarded).not.toEqual(gap);
  });

  it('allows filling the gap of a PARTIAL wall — a detour is not a seal (v0.3.160)', () => {
    // Same wall, but spanning only x 14..26: units can walk around either
    // end, so plugging the gap merely forces a detour. The whole-map flood
    // sees that; the old 3-cell margin box could not, and its false refusals
    // were the same local blindness that let REAL multi-farm seals through.
    const wall = (x: number, y: number): boolean => y === 20 && x >= 14 && x <= 26 && x !== 20;
    const blocked = footprintBlockedBy(wall);
    const free = (x: number, y: number): boolean => (
      x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE && !wall(x, y)
    );
    const guarded = findPlacementAnchorNear(
      { x: 20, y: 22 }, { width: 1, height: 1 }, MAP_SIZE, MAP_SIZE, blocked,
      { radius: 2, widerRadius: null, isFree: free },
    );
    expect(guarded).not.toBeNull();
  });

  it('still places a building on open ground, where nothing is severed', () => {
    const nothingBlocked = (): boolean => false;
    const allFree = (x: number, y: number): boolean => (
      x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE
    );
    const anchor = findPlacementAnchorNear(
      ORIGIN_AT, { width: 3, height: 3 }, MAP_SIZE, MAP_SIZE, nothingBlocked,
      { radius: 12, widerRadius: null, isFree: allFree },
    );
    expect(anchor).not.toBeNull();
  });

  // A 2x2 gap with a free cell hanging off each of two opposite sides and no
  // way round: every 2x2 placement in it seals the two apart.
  const sealingGapAt = (gx: number, gy: number): Set<string> => new Set([
    `${String(gx)},${String(gy)}`, `${String(gx + 1)},${String(gy)}`,
    `${String(gx)},${String(gy + 1)}`, `${String(gx + 1)},${String(gy + 1)}`,
    `${String(gx - 1)},${String(gy)}`, `${String(gx + 2)},${String(gy + 1)}`,
  ]);
  const cellIn = (cells: Set<string>) => (x: number, y: number): boolean =>
    cells.has(`${String(x)},${String(y)}`);

  it('refuses to build at all when every anchor in reach would seal ground (no fallback)', () => {
    // The only 2x2 gap on the map seals whichever way it is filled. Until
    // 2026-09-08 the search returned it anyway; now nothing is better than a
    // building that cuts the map.
    const openCells = sealingGapAt(20, 20);
    const open = cellIn(openCells);
    const blocked = footprintBlockedBy((x, y) => !open(x, y));
    // The guard alone refuses it...
    expect(
      placementKeepsGroundConnected({ x: 20, y: 20 }, { width: 2, height: 2 }, MAP_SIZE, MAP_SIZE, open),
    ).toBe(false);
    // ...and so does the search, at the near radius and the wider one alike.
    const stats = createPlacementSearchStats();
    const anchor = findPlacementAnchorNear(
      { x: 18, y: 18 }, { width: 2, height: 2 }, MAP_SIZE, MAP_SIZE, blocked,
      { radius: 3, isFree: open, stats },
    );
    expect(anchor).toBeNull();
    expect(stats.nullSearches).toBe(1);
    expect(stats.refusedByGuard).toBeGreaterThanOrEqual(1);
    expect(stats.floods).toBeGreaterThanOrEqual(stats.refusedByGuard);
  });

  it('takes open ground at radius 13..24 over a sealing anchor at radius <= 12', () => {
    // Around the origin, out to radius 12, the ONLY 2x2 that fits is a sealing
    // gap at radius 10; from radius 14 outward the map is open.
    const origin = { x: 10, y: 10 };
    const nearGap = sealingGapAt(20, 20);
    const open = (x: number, y: number): boolean => (
      x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE
      && (cellIn(nearGap)(x, y) || chebyshev({ x, y }, origin) >= 14)
    );
    const blocked = footprintBlockedBy((x, y) => !open(x, y));
    const stats = createPlacementSearchStats();
    const anchor = findPlacementAnchorNear(
      origin, { width: 2, height: 2 }, MAP_SIZE, MAP_SIZE, blocked, { isFree: open, stats },
    );
    expect(anchor).not.toBeNull();
    expect(anchor).not.toEqual({ x: 20, y: 20 });
    expect(chebyshev(anchor!, origin)).toBeGreaterThan(AI_PLACEMENT_SEARCH_RADIUS);
    expect(chebyshev(anchor!, origin)).toBeLessThanOrEqual(AI_PLACEMENT_WIDER_SEARCH_RADIUS);
    expect(
      placementKeepsGroundConnected(anchor!, { width: 2, height: 2 }, MAP_SIZE, MAP_SIZE, open),
    ).toBe(true);
    // The near gap was seen, flooded, and refused before the wider pass ran.
    expect(stats.refusedByGuard).toBeGreaterThanOrEqual(1);
    expect(stats.nullSearches).toBe(0);
  });

  it('takes the open anchor when a sealing one is nearer and both fit (control)', () => {
    // A sealing gap at radius 3 and a 4x4 open block whose first 2x2 anchor is
    // at radius 5. The search must pass the near one by. This stays green with
    // the old unguarded fallback restored — it is the control that the guard
    // itself still orders anchors, not a case of the fallback's removal.
    const origin = { x: 10, y: 10 };
    const nearGap = sealingGapAt(13, 13);
    const openBlock = (x: number, y: number): boolean => x >= 15 && x <= 18 && y >= 5 && y <= 8;
    const open = (x: number, y: number): boolean => cellIn(nearGap)(x, y) || openBlock(x, y);
    const blocked = footprintBlockedBy((x, y) => !open(x, y));
    const anchor = findPlacementAnchorNear(
      origin, { width: 2, height: 2 }, MAP_SIZE, MAP_SIZE, blocked, { isFree: open },
    );
    expect(anchor).toEqual({ x: 15, y: 5 });
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
