import { MAP_HEIGHT, MAP_WIDTH } from '../mapGeneration/constants';
import {
  createTerrainCell,
  type TerrainCellSpec,
} from '../mapGeneration/sharedTerrainHelpers';

// Shared fixture helper: most focused test fixtures start from an all-
// grass MAP_WIDTH x MAP_HEIGHT terrain matrix and then paint specific
// features on top. Keeping this in one place avoids duplicating the
// nested Array.from incantation across 100+ fixture files.
export function createGrassFixtureTerrain(): TerrainCellSpec[][] {
  return Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => createTerrainCell(x, y, 'grass')),
  );
}
