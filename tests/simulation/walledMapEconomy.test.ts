// A walled start has to enclose an economy you can actually play (spec §5.4).
//
// BOUND: `arena` and `fortress` — the two scripts whose identity is a wall
// around the start — at both of their two seats. It checks what is INSIDE the
// wall, and that the inside is one connected place. It says nothing about
// whether the amounts are balanced, nothing about the maps without a wall, and
// nothing about what the AI then does with it.
//
// What it caught, 2026-09-04: neither map enclosed a single TREE. Every
// building that raises the population cap costs wood and so does every
// building that advances an age, so a walled player had to leave the wall in
// the first minutes and keep leaving it. Measured on `arena` owner 2: it left,
// lost four of its seven villagers to a raid, rang the town bell, and then sat
// with three villagers garrisoned and NO unit on the map from tick 7,000 to
// tick 16,000 while its walls were taken apart one segment at a time. It never
// left the Dark Age in a 60,000-tick match.

import { describe, expect, it } from 'vitest';

import { createPrototypeScenario } from '../../src/game/simulation/prototypeScenario';
import type { PrototypeScenario, ScenarioSpawnSpec } from '../../src/game/simulation/prototypeScenario';

const WALLED_MAPS = ['arena', 'fortress'] as const;

/** Every cell a wall segment of this owner stands on. */
function wallCells(scenario: PrototypeScenario, owner: number): Set<string> {
  return new Set(scenario.spawns
    .filter((spawn) => spawn.kind === 'stone-wall' && spawn.baseOwner === owner)
    .map((spawn) => `${String(spawn.x)},${String(spawn.y)}`));
}

/**
 * The cells enclosed with the Town Centre — flood fill from it, stopped by the
 * owner's own walls, by the map edge, and by the wall's own radius.
 *
 * The radius bound is what makes this work on maps that deliberately leave a
 * GATE: a plain fill walks straight out through it. `insideRadius` is the
 * distance to the NEAREST wall segment, so the gate's cells are at that
 * distance too and the fill stops there. It is a conservative reading on a
 * SQUARE wall — Fortress's corners are further out than its faces, so some
 * genuinely enclosed ground is left out — and conservative is the safe
 * direction: it can only make the resource assertions harder to satisfy.
 */
function enclosure(scenario: PrototypeScenario, owner: number): Set<string> {
  const start = scenario.starts.find((entry) => entry.owner === owner);
  if (!start) throw new Error(`no start for owner ${String(owner)}`);
  const walls = wallCells(scenario, owner);
  expect(walls.size, `${scenario.seed} seat ${String(owner)} has no wall at all`)
    .toBeGreaterThan(0);
  const distance = (x: number, y: number): number =>
    Math.hypot(x - start.townCenter.x, y - start.townCenter.y);
  const insideRadius = Math.min(...[...walls].map((key) => {
    const [x, y] = key.split(',').map(Number);
    return distance(x!, y!);
  }));

  const seen = new Set<string>([`${String(start.townCenter.x)},${String(start.townCenter.y)}`]);
  const queue = [start.townCenter];
  while (queue.length > 0) {
    const cell = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = cell.x + dx;
      const y = cell.y + dy;
      if (x < 0 || y < 0 || x >= scenario.width || y >= scenario.height) continue;
      const key = `${String(x)},${String(y)}`;
      if (seen.has(key) || walls.has(key) || distance(x, y) >= insideRadius) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return seen;
}

function insideCounts(
  scenario: PrototypeScenario,
  inside: Set<string>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const spawn of scenario.spawns as ScenarioSpawnSpec[]) {
    if (!inside.has(`${String(spawn.x)},${String(spawn.y)}`)) continue;
    counts[spawn.kind] = (counts[spawn.kind] ?? 0) + 1;
  }
  return counts;
}

describe('a walled start encloses an economy', () => {
  for (const seed of WALLED_MAPS) {
    for (const owner of [1, 2]) {
      it(`${seed} seat ${String(owner)} has food, WOOD, gold and stone behind its wall`, () => {
        const scenario = createPrototypeScenario(seed);
        const counts = insideCounts(scenario, enclosure(scenario, owner));

        const food = (counts['sheep'] ?? 0) + (counts['berry-bush'] ?? 0) + (counts['boar'] ?? 0);
        expect(food, `${seed} seat ${String(owner)} food inside: ${JSON.stringify(counts)}`)
          .toBeGreaterThan(0);
        // WOOD is the one that was missing, and it is the one that matters
        // most: every house and every age-up prerequisite costs it.
        expect(counts['tree'] ?? 0, `${seed} seat ${String(owner)} trees inside: ${JSON.stringify(counts)}`)
          .toBeGreaterThanOrEqual(12);
        expect(counts['gold-mine'] ?? 0, `${seed} seat ${String(owner)} gold inside: ${JSON.stringify(counts)}`)
          .toBeGreaterThan(0);
        expect(counts['stone-mine'] ?? 0, `${seed} seat ${String(owner)} stone inside: ${JSON.stringify(counts)}`)
          .toBeGreaterThan(0);
      });

      it(`${seed} seat ${String(owner)} keeps its enclosure walkable`, () => {
        const scenario = createPrototypeScenario(seed);
        const inside = enclosure(scenario, owner);
        // Trees are IMPASSABLE. A woodline dropped inside a wall can cut the
        // enclosure in two, and a villager on the wrong side of it is as stuck
        // as one outside. Every non-tree, non-building cell of the enclosure
        // must still be reachable from the Town Centre without crossing one.
        const blocked = new Set(scenario.spawns
          .filter((spawn) => spawn.kind === 'tree'
            || spawn.kind === 'stone-wall'
            || spawn.kind === 'gold-mine'
            || spawn.kind === 'stone-mine')
          .map((spawn) => `${String(spawn.x)},${String(spawn.y)}`));
        const start = scenario.starts.find((entry) => entry.owner === owner)!;
        const seen = new Set<string>([`${String(start.townCenter.x)},${String(start.townCenter.y)}`]);
        const queue = [start.townCenter];
        while (queue.length > 0) {
          const cell = queue.pop()!;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const x = cell.x + dx;
            const y = cell.y + dy;
            const key = `${String(x)},${String(y)}`;
            if (!inside.has(key) || seen.has(key) || blocked.has(key)) continue;
            seen.add(key);
            queue.push({ x, y });
          }
        }
        const open = [...inside].filter((key) => !blocked.has(key));
        const unreachable = open.filter((key) => !seen.has(key));
        expect(
          unreachable.length,
          `${seed} seat ${String(owner)}: ${String(unreachable.length)} of `
          + `${String(open.length)} open cells inside the wall are cut off from the Town `
          + `Centre — e.g. ${unreachable.slice(0, 6).join(' ')}`,
        ).toBe(0);
      });
    }
  }
});
