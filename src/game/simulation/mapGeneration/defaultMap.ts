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
} from './startingOffsets';

export function createDefaultMap(seed: string): PrototypeScenario {
  const terrain = createBaseTerrain(seed);
  const starts = createPlayerStarts();
  const spawns = createSpawnList();

  for (const start of starts) {
    applyStandardPlayerOpeningProcedural(terrain, start, spawns, seed);
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
  spawns.addUnitSpawn({
    kind: 'scout',
    x: FORWARD_ENEMY_SCOUT_POSITION.x,
    y: FORWARD_ENEMY_SCOUT_POSITION.y,
    owner: 2,
    baseOwner: 2,
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

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts,
    spawns: spawns.toArray(),
  };
}
