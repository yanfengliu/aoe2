import type { PrototypeScenario } from '../prototypeScenario';
import {
  applyShoreFishPatchesProcedural,
  applyStandardPlayerOpeningProcedural,
  createPlayerStarts,
} from './applyStandardPlayerOpening';
import { type MapSize, standardMapSize } from './constants';
import { createBaseTerrain, paintDisc } from './sharedTerrainHelpers';
import { getBuildingFootprint } from '../../content/buildingFootprints';
import { seedForestTrees } from './seedForestTrees';
import { createSpawnList } from './spawnList';
import {
  DEFAULT_RELIC_POSITIONS,
  FORWARD_ENEMY_HOUSE_POSITION,
  FORWARD_ENEMY_SCOUT_POSITION,
  scoutWanderBoundsAround,
} from './startingOffsets';
import { orientationFor } from './sharedTerrainHelpers';

export function createDefaultMap(seed: string, playerCount = 2): PrototypeScenario {
  // §4's size ladder: the world grows with the seat count, and the two-player
  // rung is the 60x36 map every existing fixture and screenshot was made on.
  const size = standardMapSize(playerCount);
  const seats = Math.max(2, Math.min(8, Math.floor(playerCount)));
  const terrain = createBaseTerrain(seed, size);
  const starts = createPlayerStarts(playerCount);
  const spawns = createSpawnList();
  const relicPositions = relicPositionsFor(size);
  // The forward enemy house and its scout are a landmark of the 1v1 map —
  // player 2's outpost near the middle, for the human to find. On a map with
  // more seats they are a gift to exactly one opponent, so they stay where
  // they mean something.
  const hasForwardOutpost = seats === 2;

  // Iter-3 V3-13: hand the static-landmark cells to each player's
  // procedural opening so its forest-cluster walker won't land a tree
  // on the forward-house anchor, scout cell, or relic positions —
  // any overlap would otherwise hit the bridge bootstrap validator.
  // Iter-3 verify follow-up: expand multi-cell building footprints so
  // ALL cells of the 2x2 house are reserved, not just the anchor.
  const houseFootprint = getBuildingFootprint('house');
  const reservedCells: Array<{ x: number; y: number }> = [];
  if (hasForwardOutpost) {
    for (let dy = 0; dy < houseFootprint.height; dy += 1) {
      for (let dx = 0; dx < houseFootprint.width; dx += 1) {
        reservedCells.push({
          x: FORWARD_ENEMY_HOUSE_POSITION.x + dx,
          y: FORWARD_ENEMY_HOUSE_POSITION.y + dy,
        });
      }
    }
    reservedCells.push(FORWARD_ENEMY_SCOUT_POSITION);
  }
  for (const relic of relicPositions) {
    reservedCells.push(relic);
  }

  for (const start of starts) {
    applyStandardPlayerOpeningProcedural(terrain, start, spawns, seed, reservedCells);
  }

  if (hasForwardOutpost) {
    paintDisc(terrain, FORWARD_ENEMY_SCOUT_POSITION, 1, 'grass');
    paintDisc(terrain, FORWARD_ENEMY_HOUSE_POSITION, 2, 'grass');

    spawns.addBuildingSpawn({
      kind: 'house',
      x: FORWARD_ENEMY_HOUSE_POSITION.x,
      y: FORWARD_ENEMY_HOUSE_POSITION.y,
      owner: 2,
      baseOwner: 2,
    });
    // The forward scout patrols mid-map instead of standing on its anchor
    // forever (it spawned without wander state until the 2026-07-09
    // pinned-units fix, so it never moved for entire matches).
    spawns.addUnitSpawn({
      kind: 'scout',
      x: FORWARD_ENEMY_SCOUT_POSITION.x,
      y: FORWARD_ENEMY_SCOUT_POSITION.y,
      owner: 2,
      baseOwner: 2,
      velocity: {
        dx: orientationFor(FORWARD_ENEMY_SCOUT_POSITION, size).x,
        dy: orientationFor(FORWARD_ENEMY_SCOUT_POSITION, size).y,
      },
      wanderBounds: scoutWanderBoundsAround(FORWARD_ENEMY_SCOUT_POSITION, size),
      vision: { playerId: 2, radius: 6 },
    });
  }

  for (const relicPosition of relicPositions) {
    paintDisc(terrain, relicPosition, 1, 'grass');
    spawns.addResourceSpawn({
      kind: 'relic',
      x: relicPosition.x,
      y: relicPosition.y,
      owner: null,
      baseOwner: null,
      amount: 0,
    });
  }

  applyShoreFishPatchesProcedural(terrain, starts, seed, spawns);

  // Every forest cell carries a tree. Extracted to `seedForestTrees` so every
  // map runs it: leaving it here is what left four of the nine playable maps
  // with no wood at all.
  seedForestTrees(terrain, spawns, size);

  return {
    seed,
    width: size.width,
    height: size.height,
    terrain,
    starts,
    spawns: spawns.toArray(),
  };
}

// The relics sit where they always sat on the two-player map, and at the same
// share of the world on every larger one — near the middle, between the seats,
// which is where a contested relic belongs.
function relicPositionsFor(size: MapSize): Array<{ x: number; y: number }> {
  const twoPlayer = standardMapSize(2);
  if (size.width === twoPlayer.width && size.height === twoPlayer.height) {
    return DEFAULT_RELIC_POSITIONS.map((position) => ({ ...position }));
  }
  return DEFAULT_RELIC_POSITIONS.map((position) => ({
    x: Math.round((position.x / twoPlayer.width) * size.width),
    y: Math.round((position.y / twoPlayer.height) * size.height),
  }));
}
