import type { Position } from 'civ-engine';

import type { PrototypeScenario } from '../prototypeScenario';
import {
  applyStandardPlayerOpening,
  createPlayerStarts,
} from './applyStandardPlayerOpening';
import { MAP_HEIGHT, MAP_WIDTH } from './constants';
import {
  createTerrainCell,
  isInBounds,
  type TerrainCellSpec,
} from './sharedTerrainHelpers';
import { createSpawnList } from './spawnList';

// Slice 11: Arena-style map. Each start is ringed by a stone wall, with
// a gap on the side facing the map center so the player can break out.
// FU3: the ring is built from real `stone-wall` buildings (1x1, HP 2000,
// impassable, cost 5 stone). Pre-FU3 this used `stone-mine` nodes as a
// wall proxy — FU3 replaces that with the real wall type so the player
// breaches by attacking walls rather than mining them.
export function createArenaMap(seed: string): PrototypeScenario {
  const terrain: TerrainCellSpec[][] = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => createTerrainCell(x, y, 'grass')),
  );

  const starts = createPlayerStarts();
  const spawns = createSpawnList();

  // Place the standard opening FIRST so we can skip ring cells that would
  // overlap a starting resource, villager, or scout. Bridge-boot fixture
  // validation rejects overlaps (Slice 12 Task B), and the pre-FU3 Arena
  // silently ate these because `stone-mine` wasn't a building.
  applyStandardPlayerOpening(terrain, starts, spawns, seed);

  const occupiedCells = new Set<string>();
  for (const spawn of spawns.toArray()) {
    occupiedCells.add(`${spawn.x},${spawn.y}`);
  }

  const RING_INNER_RADIUS = 6;
  const RING_OUTER_RADIUS = 7;
  for (const start of starts) {
    const ringedCells = collectRingCells(
      start.townCenter,
      RING_INNER_RADIUS,
      RING_OUTER_RADIUS,
    );
    for (const cell of ringedCells) {
      // Small fixed gap on the side facing the map center so the player
      // has a single exit. Gap is deterministic per start (no seed
      // randomness) so the fixture reproduces the same shape each time.
      if (isCellInArenaGap(start.townCenter, cell)) {
        continue;
      }
      // Skip ring cells that would collide with starting resources,
      // villagers, or the scout. The gap in the wall guarantees at least
      // one exit, and the resource-overlap gaps are rare because the
      // starting patches fan out in pre-defined offset lists.
      if (occupiedCells.has(`${cell.x},${cell.y}`)) {
        continue;
      }
      spawns.addBuildingSpawn({
        kind: 'stone-wall',
        x: cell.x,
        y: cell.y,
        owner: start.owner,
        baseOwner: start.owner,
      });
    }
  }

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts,
    spawns: spawns.toArray(),
  };
}

// Arena ring helper. Collects every cell whose distance from the center
// sits between `innerRadius` and `outerRadius` inclusive. Iteration
// order is deterministic (row-major) so the spawn list is stable.
function collectRingCells(
  center: Position,
  innerRadius: number,
  outerRadius: number,
): Position[] {
  const inner2 = innerRadius * innerRadius;
  const outer2 = outerRadius * outerRadius;
  const cells: Position[] = [];
  for (let y = center.y - outerRadius; y <= center.y + outerRadius; y += 1) {
    for (let x = center.x - outerRadius; x <= center.x + outerRadius; x += 1) {
      if (!isInBounds(x, y)) {
        continue;
      }
      const dx = x - center.x;
      const dy = y - center.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < inner2 || d2 > outer2) {
        continue;
      }
      cells.push({ x, y });
    }
  }
  return cells;
}

// The Arena ring has a 2-cell-wide gap on the side of the ring that
// faces the map center. Determined by whether the cell sits in the
// direction of travel from `center` to the map midpoint.
function isCellInArenaGap(center: Position, cell: Position): boolean {
  const midX = MAP_WIDTH / 2;
  const midY = MAP_HEIGHT / 2;
  const dirX = Math.sign(midX - center.x);
  const dirY = Math.sign(midY - center.y);
  const dx = cell.x - center.x;
  const dy = cell.y - center.y;
  // 2-tile wide gap: cells whose dominant-direction offset aligns with
  // the exit vector AND whose orthogonal offset is within ±1.
  if (Math.abs(dx) > Math.abs(dy)) {
    return Math.sign(dx) === dirX && Math.abs(dy) <= 1;
  }
  if (Math.abs(dy) > Math.abs(dx)) {
    return Math.sign(dy) === dirY && Math.abs(dx) <= 1;
  }
  // Diagonal cell — include in the gap if both components line up.
  return Math.sign(dx) === dirX && Math.sign(dy) === dirY;
}
