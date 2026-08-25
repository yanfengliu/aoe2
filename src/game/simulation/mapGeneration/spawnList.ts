import type { ResourceKind } from '../types';
import type { ScenarioSpawnSpec } from '../prototypeScenario';

export type AddResourceResult =
  | { accepted: true }
  | { accepted: false; reason: 'cell-occupied'; existingKind: ResourceKind };

export interface SpawnList {
  addResourceSpawn(spawn: ScenarioSpawnSpec): AddResourceResult;
  addBuildingSpawn(spawn: ScenarioSpawnSpec): void;
  addUnitSpawn(spawn: ScenarioSpawnSpec): void;
  isCellOccupiedByResource(x: number, y: number): boolean;
  /** Drop the spawn anchored at this cell (Fortress fells trees on its wall
   *  line). Removes at most one — the anchor-keyed entry. */
  removeSpawnAt(x: number, y: number): void;
  toArray(): ScenarioSpawnSpec[];
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function createSpawnList(): SpawnList {
  const spawns: ScenarioSpawnSpec[] = [];
  const resourceByCell = new Map<string, ScenarioSpawnSpec>();

  return {
    addResourceSpawn(spawn: ScenarioSpawnSpec): AddResourceResult {
      const key = cellKey(spawn.x, spawn.y);
      const existing = resourceByCell.get(key);
      if (existing) {
        return {
          accepted: false,
          reason: 'cell-occupied',
          existingKind: existing.kind as ResourceKind,
        };
      }
      resourceByCell.set(key, spawn);
      spawns.push(spawn);
      return { accepted: true };
    },

    addBuildingSpawn(spawn: ScenarioSpawnSpec): void {
      spawns.push(spawn);
    },

    addUnitSpawn(spawn: ScenarioSpawnSpec): void {
      spawns.push(spawn);
    },

    isCellOccupiedByResource(x: number, y: number): boolean {
      return resourceByCell.has(cellKey(x, y));
    },

    removeSpawnAt(x: number, y: number): void {
      const index = spawns.findIndex((spawn) => spawn.x === x && spawn.y === y);
      if (index >= 0) spawns.splice(index, 1);
      resourceByCell.delete(cellKey(x, y));
    },

    toArray(): ScenarioSpawnSpec[] {
      return spawns;
    },
  };
}
