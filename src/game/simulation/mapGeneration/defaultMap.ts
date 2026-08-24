import {
  AUTHORITATIVE_BUILDING_FOOTPRINTS,
  getBuildingFootprint,
} from '../../content/buildingFootprints';
import type { PrototypeScenario } from '../prototypeScenario';
import {
  applyShoreFishPatchesProcedural,
  applyStandardPlayerOpeningProcedural,
  createPlayerStarts,
} from './applyStandardPlayerOpening';
import { MAP_HEIGHT, MAP_WIDTH } from './constants';
import { createBaseTerrain, paintDisc } from './sharedTerrainHelpers';
import { createSpawnList } from './spawnList';
import {
  DEFAULT_RELIC_POSITIONS,
  FORWARD_ENEMY_HOUSE_POSITION,
  FORWARD_ENEMY_SCOUT_POSITION,
  scoutWanderBoundsAround,
} from './startingOffsets';
import { orientationFor } from './sharedTerrainHelpers';

export function createDefaultMap(seed: string, playerCount = 2): PrototypeScenario {
  const terrain = createBaseTerrain(seed);
  const starts = createPlayerStarts(playerCount);
  const spawns = createSpawnList();

  // Iter-3 V3-13: hand the static-landmark cells to each player's
  // procedural opening so its forest-cluster walker won't land a tree
  // on the forward-house anchor, scout cell, or relic positions —
  // any overlap would otherwise hit the bridge bootstrap validator.
  // Iter-3 verify follow-up: expand multi-cell building footprints so
  // ALL cells of the 2x2 house are reserved, not just the anchor.
  const houseFootprint = getBuildingFootprint('house');
  const reservedCells: Array<{ x: number; y: number }> = [];
  for (let dy = 0; dy < houseFootprint.height; dy += 1) {
    for (let dx = 0; dx < houseFootprint.width; dx += 1) {
      reservedCells.push({
        x: FORWARD_ENEMY_HOUSE_POSITION.x + dx,
        y: FORWARD_ENEMY_HOUSE_POSITION.y + dy,
      });
    }
  }
  reservedCells.push(FORWARD_ENEMY_SCOUT_POSITION);
  for (const relic of DEFAULT_RELIC_POSITIONS) {
    reservedCells.push(relic);
  }

  for (const start of starts) {
    applyStandardPlayerOpeningProcedural(terrain, start, spawns, seed, reservedCells);
  }

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
      dx: orientationFor(FORWARD_ENEMY_SCOUT_POSITION).x,
      dy: orientationFor(FORWARD_ENEMY_SCOUT_POSITION).y,
    },
    wanderBounds: scoutWanderBoundsAround(FORWARD_ENEMY_SCOUT_POSITION),
    vision: { playerId: 2, radius: 6 },
  });

  for (const relicPosition of DEFAULT_RELIC_POSITIONS) {
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

  // Every forest cell carries a tree, the way Black Forest already builds and
  // the way Age of Empires II works — the forest IS the trees, so cutting one
  // opens its tile and the woodline is consumed from the outside in. Without
  // this, the noise terrain painted 197 forest cells and only 48 of them held
  // wood; the remaining 149 were permanent walls, and once the AI had cut the
  // rim of a woodline every surviving tree was walled in by them. Measured at
  // tick 6000 on this map: 18 of 27 live trees had NO walkable neighbour, 83
  // of their blocked faces were bare forest terrain, and all 15 of the AI's
  // villagers had given up on wood. Runs last, so first-write-wins leaves every
  // curated spawn above untouched.
  const claimedByBuilding = new Set<string>();
  for (const spawn of spawns.toArray()) {
    if (!(spawn.kind in AUTHORITATIVE_BUILDING_FOOTPRINTS)) continue;
    const footprint = getBuildingFootprint(spawn.kind as keyof typeof AUTHORITATIVE_BUILDING_FOOTPRINTS);
    for (let dy = 0; dy < footprint.height; dy += 1) {
      for (let dx = 0; dx < footprint.width; dx += 1) {
        claimedByBuilding.add(`${String(spawn.x + dx)},${String(spawn.y + dy)}`);
      }
    }
  }
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (terrain[y]?.[x]?.kind !== 'forest') continue;
      // A building spawn's footprint is not a resource claim, so first-write-
      // wins would happily drop a tree under a Town Center and fail the
      // scenario validator.
      if (claimedByBuilding.has(`${String(x)},${String(y)}`)) continue;
      spawns.addResourceSpawn({
        kind: 'tree',
        x,
        y,
        owner: null,
        baseOwner: null,
        amount: 100,
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
