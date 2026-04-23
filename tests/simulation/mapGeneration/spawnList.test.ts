import { describe, expect, it } from 'vitest';

import { createSpawnList } from '../../../src/game/simulation/mapGeneration/spawnList';
import type { ScenarioSpawnSpec } from '../../../src/game/simulation/prototypeScenario';

describe('createSpawnList', () => {
  it('accepts the first resource at a cell and returns it from toArray in order', () => {
    const list = createSpawnList();
    const stone: ScenarioSpawnSpec = {
      kind: 'stone-mine',
      x: 9,
      y: 13,
      owner: null,
      baseOwner: 1,
      amount: 350,
    };

    expect(list.addResourceSpawn(stone)).toEqual({ accepted: true });
    expect(list.toArray()).toEqual([stone]);
  });

  it('rejects a second resource spawn at an already-claimed cell', () => {
    const list = createSpawnList();
    const stone: ScenarioSpawnSpec = {
      kind: 'stone-mine',
      x: 9,
      y: 13,
      owner: null,
      baseOwner: 1,
      amount: 350,
    };
    const tree: ScenarioSpawnSpec = {
      kind: 'tree',
      x: 9,
      y: 13,
      owner: null,
      baseOwner: 1,
      amount: 100,
    };

    list.addResourceSpawn(stone);
    const result = list.addResourceSpawn(tree);

    expect(result).toEqual({
      accepted: false,
      reason: 'cell-occupied',
      existingKind: 'stone-mine',
    });
    expect(list.toArray()).toEqual([stone]);
  });

  it('accepts resources of different kinds at different cells', () => {
    const list = createSpawnList();
    const stone: ScenarioSpawnSpec = {
      kind: 'stone-mine',
      x: 9,
      y: 13,
      owner: null,
      baseOwner: 1,
      amount: 350,
    };
    const tree: ScenarioSpawnSpec = {
      kind: 'tree',
      x: 10,
      y: 13,
      owner: null,
      baseOwner: 1,
      amount: 100,
    };

    expect(list.addResourceSpawn(stone)).toEqual({ accepted: true });
    expect(list.addResourceSpawn(tree)).toEqual({ accepted: true });
    expect(list.toArray()).toEqual([stone, tree]);
  });

  it('addBuildingSpawn is pass-through and does not dedupe', () => {
    const list = createSpawnList();
    const house1: ScenarioSpawnSpec = {
      kind: 'house',
      x: 5,
      y: 5,
      owner: 1,
      baseOwner: 1,
    };
    const house2: ScenarioSpawnSpec = {
      kind: 'house',
      x: 5,
      y: 5,
      owner: 2,
      baseOwner: 2,
    };

    list.addBuildingSpawn(house1);
    list.addBuildingSpawn(house2);

    expect(list.toArray()).toEqual([house1, house2]);
  });

  it('addUnitSpawn is pass-through and does not dedupe', () => {
    const list = createSpawnList();
    const villager1: ScenarioSpawnSpec = {
      kind: 'villager',
      x: 6,
      y: 9,
      owner: 1,
      baseOwner: 1,
    };
    const villager2: ScenarioSpawnSpec = {
      kind: 'villager',
      x: 6,
      y: 9,
      owner: 1,
      baseOwner: 1,
    };

    list.addUnitSpawn(villager1);
    list.addUnitSpawn(villager2);

    expect(list.toArray()).toEqual([villager1, villager2]);
  });

  it('reports whether a cell already holds a resource', () => {
    const list = createSpawnList();
    const stone: ScenarioSpawnSpec = {
      kind: 'stone-mine',
      x: 9,
      y: 13,
      owner: null,
      baseOwner: 1,
      amount: 350,
    };

    expect(list.isCellOccupiedByResource(9, 13)).toBe(false);
    list.addResourceSpawn(stone);
    expect(list.isCellOccupiedByResource(9, 13)).toBe(true);
    expect(list.isCellOccupiedByResource(10, 13)).toBe(false);
  });
});
