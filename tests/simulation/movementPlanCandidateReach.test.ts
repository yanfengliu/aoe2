// A move to a far target from a cell that cannot reach it costs ONE failed
// search, not one failed search per candidate cell (work 123).
//
// What happened. de-ground.spec.ts:139 orders every human unit, the four
// sheep included, to (36, 14) and steps 300 ticks; it ran 84-90 s of its 90 s
// limit on CI. The herd system replans each ordered sheep every tick through
// findMovementPathToCandidates, whose candidates are every cell of the map
// nearest the target first, and it ran one A* per candidate until one reached.
// A sheep boxed in near its Town Centre reaches none of the near candidates,
// so each tick it ran 1,756-2,731 failing searches (counted in Node on
// aoe2-prototype, 2026-10-11): 300-600 ms for each of 150 of the 300 ticks.
//
// The fix keeps the answer and drops the repeats: after the first failed
// search the planner floods the start's reachable cells once and skips every
// candidate outside them. A* here steps orthogonally and refuses a blocked
// start, so it can never reach a goal outside that region, and every
// candidate inside it still gets its own search (with civ-engine's
// 10,000-iteration cap, which can only bind on a map past about 8,000 cells).
//
// Two checks. (1) Equivalence: on seeded random grids, the planner returns
// what the old one-search-per-candidate planner returns — the same
// destination and the same path, or null — copied below as the oracle. The
// rounds that matter are the ones where a search fails before the answer, so
// the test counts them and requires plenty of both outcomes after a failure.
// (2) Cost: on the boxed-in case the number of passability reads stays within
// a few map areas, where the old planner's grows with every candidate.
//
// BOUND: the oracle is the old algorithm on a pure predicate; a predicate
// with side effects would see a different number of reads. The bridge-level
// equivalence (same world, tick by tick, on the de-ground walk and on AI
// self-play) is in the work 123 plan's evidence, not in this file.

import { findGridPath, World, type Position } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { createMovementPlanOps } from '../../src/game/simulation/bridge/movementPlanOps';
import type { GameCommands, GameComponents, GameEvents, GameWorld } from '../../src/game/simulation/bridge/pureHelpers';

type Grid = { width: number; height: number; open: (x: number, y: number) => boolean };

function makeWorld(width: number, height: number): GameWorld {
  return new World<GameEvents, GameCommands, GameComponents>({ gridWidth: width, gridHeight: height, seed: 'candidate-reach', tps: 10 });
}

function counted(grid: Grid) {
  const counter = { reads: 0 };
  const isPassable = (_id: number, x: number, y: number): boolean => {
    counter.reads += 1;
    return x >= 0 && y >= 0 && x < grid.width && y < grid.height && grid.open(x, y);
  };
  return { counter, isPassable };
}

/** The planner before work 123, verbatim in what it decides: the oracle. It
 *  also counts its failed searches, the case the new planner shortcuts. */
function oldPlanner(grid: Grid, start: Position, candidates: Position[], preferCurrentCell: boolean, isPassable: (id: number, x: number, y: number) => boolean, failed = { searches: 0 }) {
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    const key = `${String(c.x)},${String(c.y)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).filter((c) => isPassable(1, c.x, c.y));
  if (preferCurrentCell) {
    const here = unique.find((c) => c.x === start.x && c.y === start.y);
    if (here) return { destination: { ...here }, path: [{ ...start }] };
  }
  for (const destination of unique) {
    const result = findGridPath({ width: grid.width, height: grid.height, start, goal: destination, blocked: (x, y) => !isPassable(1, x, y) });
    if (result) return { destination: { ...destination }, path: result.path.map((step) => ({ ...step })) };
    failed.searches += 1;
  }
  return null;
}

function nearestFirst(width: number, height: number, target: Position): Position[] {
  const cells: Position[] = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) cells.push({ x, y });
  const distance = (c: Position) => Math.abs(c.x - target.x) + Math.abs(c.y - target.y);
  return cells.sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x);
}

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('findMovementPathToCandidates', () => {
  it('returns what the one-search-per-candidate planner returned, on 600 seeded random grids', () => {
    const next = random(123);
    let failedThenReached = 0;
    let failedThenNull = 0;
    for (let round = 0; round < 600; round += 1) {
      const width = 4 + Math.floor(next() * 20);
      const height = 3 + Math.floor(next() * 14);
      const density = 0.15 + next() * 0.45;
      const walls = new Set<number>();
      for (let i = 0; i < width * height; i += 1) if (next() < density) walls.add(i);
      const grid: Grid = { width, height, open: (x, y) => !walls.has(y * width + x) };
      const start = { x: Math.floor(next() * width), y: Math.floor(next() * height) };
      const target = { x: Math.floor(next() * width), y: Math.floor(next() * height) };
      let candidates = nearestFirst(width, height, target);
      if (next() < 0.4) candidates = candidates.filter(() => next() < 0.3).concat(candidates.slice(0, 3));
      const preferCurrentCell = next() < 0.5;
      const ops = createMovementPlanOps({
        world: makeWorld(width, height), mapWidth: width, mapHeight: height, movePathCache: new Map(),
        isCellPassableForUnit: () => true, isCellPassableForWildlife: () => true,
      });
      const fresh = counted(grid);
      const failed = { searches: 0 };
      const expected = oldPlanner(grid, start, candidates, preferCurrentCell, counted(grid).isPassable, failed);
      const actual = ops.findMovementPathToCandidates(1, start, candidates, preferCurrentCell, undefined, fresh.isPassable);
      expect(actual, `round ${String(round)}: ${String(width)}x${String(height)} from ${JSON.stringify(start)} to ${JSON.stringify(target)}`).toEqual(expected);
      if (failed.searches > 0) {
        if (expected === null) failedThenNull += 1; else failedThenReached += 1;
      }
    }
    // The flood-and-skip path decides only after a failed search, so both of
    // its outcomes must be exercised, or the comparison proves the easy half.
    expect(failedThenReached, 'rounds where a failed search came before the answer').toBeGreaterThan(50);
    expect(failedThenNull, 'rounds where every reachable search failed').toBeGreaterThan(50);
  });

  it('runs one failed search, not one per candidate, from a boxed-in cell to a far target', () => {
    // 60x36, the size of aoe2-prototype. The start sits in a 3x3 pocket walled
    // off from the rest of the map; the target is across it.
    const width = 60;
    const height = 36;
    const pocket = (x: number, y: number) => x >= 5 && x <= 7 && y >= 5 && y <= 7;
    const wall = (x: number, y: number) => x >= 4 && x <= 8 && y >= 4 && y <= 8 && !pocket(x, y);
    const grid: Grid = { width, height, open: (x, y) => !wall(x, y) };
    const start = { x: 6, y: 6 };
    const candidates = nearestFirst(width, height, { x: 36, y: 14 });
    const ops = createMovementPlanOps({
      world: makeWorld(width, height), mapWidth: width, mapHeight: height, movePathCache: new Map(),
      isCellPassableForUnit: () => true, isCellPassableForWildlife: () => true,
    });
    const before = counted(grid);
    const expected = oldPlanner(grid, start, candidates, false, before.isPassable);
    const after = counted(grid);
    const actual = ops.findMovementPathToCandidates(1, start, candidates, false, undefined, after.isPassable);
    expect(actual).toEqual(expected);
    // The pocket's own cell nearest the target is the answer.
    expect(actual?.destination).toEqual({ x: 7, y: 7 });
    const area = width * height;
    // The old planner read passability 68,484 times here: the filter, then one
    // pocket-sized failed search per open candidate until the pocket's own.
    expect(before.counter.reads, 'the oracle no longer shows the cost this test is about').toBeGreaterThan(20 * area);
    expect(after.counter.reads, 'passability reads for one move plan from a boxed-in cell').toBeLessThan(3 * area);
  });
});
