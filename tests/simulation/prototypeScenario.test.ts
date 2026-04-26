import { describe, expect, it } from 'vitest';

import { getBuildingFootprint } from '../../src/game/content/buildingFootprints';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
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
    const humanStart = scenario.starts.find((start) => start.owner === 1);
    const enemyStart = scenario.starts.find((start) => start.owner === 2);
    const countBy = (kind: string, baseOwner?: number) =>
      scenario.spawns.filter(
        (spawn) => spawn.kind === kind && (baseOwner === undefined || spawn.baseOwner === baseOwner),
      ).length;
    const startingScouts = scenario.spawns.filter(
      (spawn) => spawn.kind === 'scout' && spawn.wanderBounds !== undefined,
    );
    const forwardEnemyScout = scenario.spawns.find(
      (spawn) => spawn.kind === 'scout' && spawn.owner === 2 && spawn.wanderBounds === undefined,
    );
    const forwardEnemyHouse = scenario.spawns.find(
      (spawn) => spawn.kind === 'house' && spawn.owner === 2,
    );

    expect(scenario.width).toBe(MAP_WIDTH);
    expect(scenario.height).toBe(MAP_HEIGHT);
    expect(MAP_WIDTH).toBe(60);
    expect(MAP_HEIGHT).toBe(36);
    expect(countBy('town-center')).toBe(2);
    expect(countBy('villager')).toBe(6);
    expect(countBy('scout')).toBe(3);
    expect(countBy('house')).toBe(1);
    expect(startingScouts).toHaveLength(1);
    expect(forwardEnemyScout).toBeDefined();
    expect(forwardEnemyHouse).toBeDefined();
    expect(humanStart).toBeDefined();
    expect(enemyStart).toBeDefined();
    expect((enemyStart?.townCenter.x ?? 0) - (humanStart?.townCenter.x ?? 0)).toBeGreaterThanOrEqual(36);
    expect((enemyStart?.townCenter.y ?? 0) - (humanStart?.townCenter.y ?? 0)).toBeGreaterThanOrEqual(14);
    expect((forwardEnemyScout?.x ?? 0) - (humanStart?.townCenter.x ?? 0)).toBeGreaterThanOrEqual(30);
    expect((forwardEnemyHouse?.x ?? 0) - (humanStart?.townCenter.x ?? 0)).toBeGreaterThanOrEqual(28);

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
      (spawn) => spawn.kind === 'scout' && spawn.owner === 2 && spawn.wanderBounds !== undefined,
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

  // Slice 11: alternate map scripts. Each one must be deterministic on
  // its seed, keep the standard player-opening layout (Town Center +
  // resource patches + starting villagers + scout) for each player, and
  // differ from the default Arabia map.
  it('builds the Black Forest map deterministically and with dense trees', () => {
    const left = createPrototypeScenario('black-forest-fixture');
    const right = createPrototypeScenario('black-forest-fixture');

    expect(left).toEqual(right);

    const treeCount = left.spawns.filter((spawn) => spawn.kind === 'tree').length;
    // Default Arabia-style map ships with 24 trees per player (48 total);
    // Black Forest should vastly exceed that baseline.
    expect(treeCount).toBeGreaterThan(200);

    // Each player still has a full opening set: one Town Center, six
    // villagers, one scout, one mill-ready berry patch, etc.
    for (const owner of [1, 2]) {
      expect(
        left.spawns.filter(
          (spawn) => spawn.owner === owner && spawn.kind === 'villager',
        ).length,
      ).toBe(3);
      expect(
        left.spawns.some(
          (spawn) =>
            spawn.kind === 'town-center' && spawn.owner === owner,
        ),
      ).toBe(true);
      expect(
        left.spawns.filter(
          (spawn) => spawn.baseOwner === owner && spawn.kind === 'berry-bush',
        ).length,
      ).toBe(6);

      // Iter-2 H2-3: standard opening seeds 4 stone, 4 gold, 2 boar
      // for every player, but the Black Forest carve-pocket was only
      // radius 6 — so cells like STARTING_STONE (1, 6) (distance ≈
      // 6.08), STARTING_GOLD (6, 0) (distance 6), and STARTING_BOARS
      // (4, -5) (distance ≈ 6.40) fell into forest cells that were
      // already seeded as a tree, and the standard-opening
      // applyResourcePatch silently dropped the rejected resource
      // spawn. Lock the per-owner counts so the regression cannot
      // come back.
      expect(
        left.spawns.filter(
          (spawn) => spawn.baseOwner === owner && spawn.kind === 'stone-mine',
        ).length,
      ).toBe(4);
      expect(
        left.spawns.filter(
          (spawn) => spawn.baseOwner === owner && spawn.kind === 'gold-mine',
        ).length,
      ).toBe(4);
      expect(
        left.spawns.filter(
          (spawn) => spawn.baseOwner === owner && spawn.kind === 'boar',
        ).length,
      ).toBe(2);
    }
  });

  it('builds the Arena map deterministically with a stone ring around each base', () => {
    const left = createPrototypeScenario('arena-fixture');
    const right = createPrototypeScenario('arena-fixture');

    expect(left).toEqual(right);

    const humanStart = left.starts.find((start) => start.owner === 1);
    expect(humanStart).toBeDefined();

    // Count stone-wall cells that sit on the ring perimeter (between
    // radius 6 and radius 7 from the human Town Center). Rings should
    // contain more than a handful of wall cells (gap is only 2 cells
    // wide). Post-FU3, the Arena ring is made of real `stone-wall`
    // buildings rather than the pre-FU3 stone-mine proxy.
    const ringWallCount = left.spawns.filter((spawn) => {
      if (spawn.kind !== 'stone-wall' || spawn.baseOwner !== humanStart?.owner) {
        return false;
      }
      const dx = spawn.x - (humanStart?.townCenter.x ?? 0);
      const dy = spawn.y - (humanStart?.townCenter.y ?? 0);
      const distSq = dx * dx + dy * dy;
      return distSq >= 36 && distSq <= 49;
    }).length;
    expect(ringWallCount).toBeGreaterThan(10);

    // The player's canonical STARTING_STONE patch still spawns as
    // gatherable stone mines inside the ring so the economy opening is
    // unchanged. Assert at least two stone-mine spawns beside whatever
    // the ring contributes.
    const humanStones = left.spawns.filter(
      (spawn) => spawn.kind === 'stone-mine' && spawn.baseOwner === humanStart?.owner,
    ).length;
    expect(humanStones).toBeGreaterThanOrEqual(2);
  });

  it('default map: forward enemy house anchor is never claimed by a forest cluster (V3-13)', () => {
    // Iter-3 V3-13: forest-cluster placement at owner-2's TC reaches
    // ring-12 cells around (39.5, 15.5); pre-fix some seeds dropped a
    // tree on FORWARD_ENEMY_HOUSE_POSITION (39, 18) and the bridge
    // bootstrap validator threw on the resource/building overlap.
    // Sample a small seed corpus to exercise the procedural variation.
    const seeds = [
      'aoe2-prototype',
      'iter3-corpus-1',
      'iter3-corpus-2',
      'iter3-corpus-3',
      'iter3-corpus-4',
      'iter3-corpus-5',
      'iter3-corpus-6',
      'iter3-corpus-7',
      'iter3-corpus-8',
      'iter3-corpus-9',
    ];

    for (const seed of seeds) {
      const scenario = createPrototypeScenario(seed);
      const treeOnHouseCell = scenario.spawns.some(
        (spawn) =>
          spawn.kind === 'tree'
          && spawn.x === 39
          && spawn.y === 18,
      );
      expect(treeOnHouseCell, `seed=${seed}: tree must not occupy forward house cell (39, 18)`).toBe(false);

      // Sanity: bridge boots cleanly with the same seed.
      expect(() => createSimulationBridge(seed)).not.toThrow();
    }
  });
});
