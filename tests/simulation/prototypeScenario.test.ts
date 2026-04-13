import { describe, expect, it } from 'vitest';

import { getBuildingFootprint } from '../../src/game/content/buildingFootprints';
import {
  DEFAULT_SEED,
  MAP_HEIGHT,
  MAP_WIDTH,
  createPrototypeScenario,
} from '../../src/game/simulation/prototypeScenario';
import type { BuildingType } from '../../src/game/simulation/types';

describe('createPrototypeScenario', () => {
  const BUILDING_KINDS = new Set<BuildingType>([
    'town-center',
    'house',
    'mill',
    'lumber-camp',
    'mining-camp',
    'barracks',
    'watch-tower',
    'stable',
    'archery-range',
    'blacksmith',
    'market',
  ]);

  it('builds the same map and spawns for the same seed', () => {
    const left = createPrototypeScenario(DEFAULT_SEED);
    const right = createPrototypeScenario(DEFAULT_SEED);

    expect(left).toEqual(right);
  });

  it('creates the expected standard two-player opening package', () => {
    const scenario = createPrototypeScenario(DEFAULT_SEED);
    const countBy = (kind: string, baseOwner?: number) =>
      scenario.spawns.filter(
        (spawn) => spawn.kind === kind && (baseOwner === undefined || spawn.baseOwner === baseOwner),
      ).length;
    const startingScouts = scenario.spawns.filter(
      (spawn) =>
        spawn.kind === 'scout'
        && !(spawn.owner === 2 && spawn.x === 13 && spawn.y === 5),
    );
    const forwardEnemyScout = scenario.spawns.find(
      (spawn) => spawn.kind === 'scout' && spawn.owner === 2 && spawn.x === 13 && spawn.y === 5,
    );
    const forwardEnemyHouse = scenario.spawns.find(
      (spawn) => spawn.kind === 'house' && spawn.owner === 2 && spawn.x === 12 && spawn.y === 3,
    );

    expect(scenario.width).toBe(MAP_WIDTH);
    expect(scenario.height).toBe(MAP_HEIGHT);
    expect(countBy('town-center')).toBe(2);
    expect(countBy('villager')).toBe(6);
    expect(countBy('scout')).toBe(3);
    expect(countBy('house')).toBe(1);
    expect(startingScouts).toHaveLength(2);
    expect(forwardEnemyScout).toBeDefined();
    expect(forwardEnemyHouse).toBeDefined();

    for (const owner of [1, 2]) {
      expect(countBy('sheep', owner)).toBe(4);
      expect(countBy('boar', owner)).toBe(2);
      expect(countBy('berry-bush', owner)).toBe(6);
      expect(countBy('tree', owner)).toBe(24);
      expect(countBy('gold-mine', owner)).toBe(4);
      expect(countBy('stone-mine', owner)).toBe(4);
    }
    expect(countBy('fish')).toBeGreaterThan(0);
    for (const fish of scenario.spawns.filter((spawn) => spawn.kind === 'fish')) {
      expect(scenario.terrain[fish.y][fish.x]?.kind).toBe('water');
      expect(fish.owner).toBeNull();
      expect(fish.baseOwner).toBeNull();
    }
  });

  it('spawns human starting units without autonomous roam state', () => {
    const scenario = createPrototypeScenario(DEFAULT_SEED);
    const humanScout = scenario.spawns.find(
      (spawn) => spawn.kind === 'scout' && spawn.owner === 1,
    );
    const enemyScout = scenario.spawns.find(
      (spawn) => spawn.kind === 'scout' && spawn.owner === 2 && spawn.x !== 13,
    );

    expect(humanScout).toBeDefined();
    expect(humanScout?.velocity).toBeUndefined();
    expect(humanScout?.wanderBounds).toBeUndefined();

    expect(enemyScout).toBeDefined();
    expect(enemyScout?.velocity).toBeDefined();
    expect(enemyScout?.wanderBounds).toBeDefined();
  });

  it('keeps the town-center area open and buildable', () => {
    const scenario = createPrototypeScenario(DEFAULT_SEED);

    for (const start of scenario.starts) {
      for (let y = start.townCenter.y - 3; y <= start.townCenter.y + 3; y += 1) {
        for (let x = start.townCenter.x - 3; x <= start.townCenter.x + 3; x += 1) {
          const dx = x - start.townCenter.x;
          const dy = y - start.townCenter.y;
          if (dx * dx + dy * dy > 9) {
            continue;
          }

          const cell = scenario.terrain[y][x];
          expect(cell.kind).not.toBe('water');
          expect(cell.kind).not.toBe('forest');
          expect(cell.buildable).toBe(true);
        }
      }
    }
  });

  it('provides focused conquest fixtures for deterministic win/loss tests', () => {
    const victoryScenario = createPrototypeScenario('conquest-victory-fixture');
    const defeatScenario = createPrototypeScenario('conquest-defeat-fixture');

    expect(victoryScenario.starts).toHaveLength(2);
    expect(
      victoryScenario.spawns.some(
        (spawn) => spawn.kind === 'militia' && spawn.owner === 1,
      ),
    ).toBe(true);
    expect(
      victoryScenario.spawns.some(
        (spawn) => spawn.kind === 'house' && spawn.owner === 2,
      ),
    ).toBe(true);
    expect(
      defeatScenario.spawns.some(
        (spawn) => spawn.kind === 'militia' && spawn.owner === 2,
      ),
    ).toBe(true);
    expect(
      defeatScenario.spawns.filter((spawn) => spawn.owner === 1 && spawn.kind === 'villager'),
    ).toHaveLength(0);
  });

  it('provides focused Feudal fixtures for age-up gating and production tests', () => {
    const missingPrereqScenario = createPrototypeScenario('feudal-missing-prereq-fixture');
    const feudalScenario = createPrototypeScenario('feudal-age-fixture');
    const blacksmithScenario = createPrototypeScenario('feudal-blacksmith-fixture');
    const stableScenario = createPrototypeScenario('feudal-stable-fixture');
    const castleScenario = createPrototypeScenario('castle-age-fixture');
    const castleTownCenterScenario = createPrototypeScenario('castle-town-center-fixture');
    const spearmanScenario = createPrototypeScenario('feudal-spearman-fixture');
    const skirmisherScenario = createPrototypeScenario('feudal-skirmisher-fixture');
    const towerScenario = createPrototypeScenario('feudal-watch-tower-fixture');
    const marketScenario = createPrototypeScenario('feudal-market-fixture');
    const townCenterDefenseScenario = createPrototypeScenario('town-center-defense-fixture');
    const villagerSelectionScenario = createPrototypeScenario('villager-selection-fixture');
    const mixedSelectionScenario = createPrototypeScenario('mixed-selection-fixture');
    const tileSelectionCycleScenario = createPrototypeScenario('tile-selection-cycle-fixture');
    const doubleClickSelectionScenario = createPrototypeScenario('double-click-selection-fixture');
    const movingEnemyAttackScenario = createPrototypeScenario('moving-enemy-attack-fixture');
    const fishScenario = createPrototypeScenario('fish-fixture');
    const blockedStableSpawnScenario = createPrototypeScenario('blocked-stable-spawn-fixture');
    const isolatedScoutSpawnScenario = createPrototypeScenario('isolated-scout-spawn-fixture');
    const boarAggroScenario = createPrototypeScenario('boar-aggro-fixture');
    const wolfAggroScenario = createPrototypeScenario('wolf-aggro-fixture');

    expect(
      missingPrereqScenario.spawns.filter(
        (spawn) => spawn.owner === 1 && (spawn.kind === 'mill' || spawn.kind === 'barracks'),
      ),
    ).toHaveLength(1);
    expect(
      feudalScenario.spawns.filter(
        (spawn) => spawn.owner === 1 && (spawn.kind === 'mill' || spawn.kind === 'barracks'),
      ),
    ).toHaveLength(2);
    expect(
      feudalScenario.spawns.some(
        (spawn) => spawn.owner === 1 && spawn.kind === 'villager' && spawn.x === 6 && spawn.y === 10,
      ),
    ).toBe(true);
    expect(
      feudalScenario.starts.find((start) => start.owner === 1)?.startingResources,
    ).toEqual({
      food: 700,
      wood: 375,
      gold: 200,
      stone: 200,
    });
    expect(
      blacksmithScenario.starts.find((start) => start.owner === 1)?.startingAge,
    ).toBe('feudal-age');
    expect(
      blacksmithScenario.spawns.some(
        (spawn) => spawn.owner === 1 && spawn.kind === 'blacksmith',
      ),
    ).toBe(true);
    expect(
      stableScenario.starts.find((start) => start.owner === 1)?.startingAge,
    ).toBe('feudal-age');
    expect(
      stableScenario.spawns.some(
        (spawn) => spawn.owner === 1 && spawn.kind === 'barracks',
      ),
    ).toBe(true);
    expect(
      castleScenario.starts.find((start) => start.owner === 1)?.startingAge,
    ).toBe('feudal-age');
    expect(
      castleScenario.starts.find((start) => start.owner === 1)?.startingResources,
    ).toEqual({
      food: 1000,
      wood: 300,
      gold: 400,
      stone: 200,
    });
    expect(
      castleScenario.spawns.filter(
        (spawn) =>
          spawn.owner === 1
          && (
            spawn.kind === 'stable'
            || spawn.kind === 'blacksmith'
          ),
      ),
    ).toHaveLength(2);
    expect(
      castleTownCenterScenario.starts.find((start) => start.owner === 1)?.startingAge,
    ).toBe('castle-age');
    expect(
      castleTownCenterScenario.starts.find((start) => start.owner === 1)?.startingResources,
    ).toEqual({
      food: 200,
      wood: 700,
      gold: 100,
      stone: 350,
    });
    expect(
      castleTownCenterScenario.spawns.filter(
        (spawn) => spawn.owner === 1 && spawn.kind === 'town-center',
      ),
    ).toHaveLength(1);
    expect(
      castleTownCenterScenario.spawns.filter(
        (spawn) => spawn.owner === 1 && spawn.kind === 'villager',
      ),
    ).toHaveLength(1);
    expect(
      spearmanScenario.starts.find((start) => start.owner === 1)?.startingAge,
    ).toBe('feudal-age');
    expect(
      spearmanScenario.spawns.some(
        (spawn) => spawn.owner === 2 && spawn.kind === 'scout',
      ),
    ).toBe(true);
    expect(
      skirmisherScenario.starts.find((start) => start.owner === 1)?.startingAge,
    ).toBe('feudal-age');
    expect(
      skirmisherScenario.spawns.some(
        (spawn) => spawn.owner === 2 && spawn.kind === 'archer',
      ),
    ).toBe(true);
    expect(
      towerScenario.starts.find((start) => start.owner === 1)?.startingAge,
    ).toBe('feudal-age');
    expect(
      towerScenario.spawns.some(
        (spawn) => spawn.owner === 1 && spawn.kind === 'blacksmith',
      ),
    ).toBe(true);
    expect(
      marketScenario.starts.find((start) => start.owner === 1)?.startingAge,
    ).toBe('feudal-age');
    expect(
      marketScenario.starts.find((start) => start.owner === 1)?.startingResources,
    ).toEqual({
      food: 700,
      wood: 450,
      gold: 200,
      stone: 200,
    });
    expect(
      marketScenario.spawns.some(
        (spawn) => spawn.owner === 1 && spawn.kind === 'barracks',
      ),
    ).toBe(true);
    expect(
      townCenterDefenseScenario.spawns.some(
        (spawn) => spawn.owner === 2 && spawn.kind === 'scout' && spawn.x === 12 && spawn.y === 8,
      ),
    ).toBe(true);
    expect(
      townCenterDefenseScenario.spawns.some(
        (spawn) => spawn.owner === 1 && spawn.kind === 'villager' && spawn.x === 6 && spawn.y === 8,
      ),
    ).toBe(true);
    expect(
      villagerSelectionScenario.spawns.filter(
        (spawn) => spawn.owner === 1 && spawn.kind === 'villager',
      ),
    ).toHaveLength(3);
    expect(
      mixedSelectionScenario.spawns.filter(
        (spawn) =>
          spawn.owner === 1
          && (
            spawn.kind === 'villager'
            || spawn.kind === 'militia'
            || spawn.kind === 'scout'
          ),
      ),
    ).toHaveLength(3);
    expect(
      mixedSelectionScenario.spawns.some(
        (spawn) => spawn.owner === 1 && spawn.kind === 'house' && spawn.x === 12 && spawn.y === 12,
      ),
    ).toBe(true);
    expect(
      tileSelectionCycleScenario.spawns.filter(
        (spawn) => spawn.x === 13 && spawn.y === 12,
      ),
    ).toHaveLength(3);
    expect(
      tileSelectionCycleScenario.spawns.some(
        (spawn) => spawn.kind === 'sheep' && spawn.x === 13 && spawn.y === 12,
      ),
    ).toBe(true);
    expect(
      doubleClickSelectionScenario.spawns.filter(
        (spawn) => spawn.owner === 1 && spawn.kind === 'villager',
      ),
    ).toHaveLength(3);
    expect(
      doubleClickSelectionScenario.spawns.filter(
        (spawn) => spawn.owner === 1 && spawn.kind === 'scout',
      ),
    ).toHaveLength(1);
    expect(
      movingEnemyAttackScenario.spawns.some(
        (spawn) => spawn.owner === 1 && spawn.kind === 'militia',
      ),
    ).toBe(true);
    expect(
      movingEnemyAttackScenario.spawns.some(
        (spawn) =>
          spawn.owner === 2
          && spawn.kind === 'scout'
          && spawn.velocity?.dx === 1
          && spawn.wanderBounds?.minX === 15
          && spawn.wanderBounds?.maxX === 17,
      ),
    ).toBe(true);
    expect(
      fishScenario.spawns.some(
        (spawn) =>
          spawn.kind === 'fish'
          && fishScenario.terrain[spawn.y][spawn.x]?.kind === 'water',
      ),
    ).toBe(true);
    expect(
      fishScenario.spawns.some(
        (spawn) => spawn.owner === 1 && spawn.kind === 'villager',
      ),
    ).toBe(true);
    expect(
      blockedStableSpawnScenario.spawns.some(
        (spawn) => spawn.owner === 1 && spawn.kind === 'stable',
      ),
    ).toBe(true);
    expect(
      blockedStableSpawnScenario.spawns.filter((spawn) => spawn.kind === 'tree'),
    ).toHaveLength(16);
    expect(
      isolatedScoutSpawnScenario.spawns.some(
        (spawn) =>
          spawn.owner === 1
          && spawn.kind === 'scout'
          && spawn.x === 12
          && spawn.y === 10,
      ),
    ).toBe(true);
    expect(
      boarAggroScenario.spawns.some(
        (spawn) => spawn.kind === 'boar' && spawn.x === 13 && spawn.y === 8,
      ),
    ).toBe(true);
    expect(
      wolfAggroScenario.spawns.some(
        (spawn) => spawn.kind === 'wolf' && spawn.x === 13 && spawn.y === 8,
      ),
    ).toBe(true);
  });

  it('keeps focused fixture unit spawns outside building footprints', () => {
    const fixtureNames = [
      'orders-fixture',
      'militia-combat-fixture',
      'moving-enemy-attack-fixture',
      'ai-rush-fixture',
      'castle-town-center-fixture',
      'mining-camp-fixture',
      'blocked-stable-spawn-fixture',
      'isolated-scout-spawn-fixture',
      'unit-sharing-fixture',
    ] as const;

    for (const fixtureName of fixtureNames) {
      const scenario = createPrototypeScenario(fixtureName);
      const buildingSpawns = scenario.spawns.filter(
        (spawn): spawn is typeof spawn & { kind: BuildingType } => BUILDING_KINDS.has(spawn.kind as BuildingType),
      );
      const unitSpawns = scenario.spawns.filter(
        (spawn) =>
          spawn.kind === 'villager'
          || spawn.kind === 'militia'
          || spawn.kind === 'scout'
          || spawn.kind === 'archer'
          || spawn.kind === 'skirmisher'
          || spawn.kind === 'spearman'
          || spawn.kind === 'knight',
      );

      for (const unitSpawn of unitSpawns) {
        const overlapsBuilding = buildingSpawns.some((buildingSpawn) => {
          const footprint = getBuildingFootprint(buildingSpawn.kind);
          return (
            unitSpawn.x >= buildingSpawn.x
            && unitSpawn.x < buildingSpawn.x + footprint.width
            && unitSpawn.y >= buildingSpawn.y
            && unitSpawn.y < buildingSpawn.y + footprint.height
          );
        });
        expect(overlapsBuilding, `${fixtureName} spawned ${unitSpawn.kind} inside a building`).toBe(false);
      }
    }
  });

  it('provides a unit-sharing fixture with adjacent friendly units and no Town Center overlap', () => {
    const scenario = createPrototypeScenario('unit-sharing-fixture');

    expect(
      scenario.spawns.some(
        (spawn) => spawn.owner === 1 && spawn.kind === 'scout' && spawn.x === 6 && spawn.y === 10,
      ),
    ).toBe(true);
    expect(
      scenario.spawns.some(
        (spawn) => spawn.owner === 1 && spawn.kind === 'villager' && spawn.x === 7 && spawn.y === 10,
      ),
    ).toBe(true);
    expect(
      scenario.spawns.some(
        (spawn) =>
          spawn.owner === 1
          && spawn.kind === 'town-center'
          && 7 >= spawn.x
          && 7 < spawn.x + 4
          && 10 >= spawn.y
          && 10 < spawn.y + 4,
      ),
    ).toBe(false);
  });
});
