import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SEED,
  FORWARD_ENEMY_SCOUT_POSITION,
  MAP_HEIGHT,
  MAP_WIDTH,
  createPrototypeScenario,
} from '../../src/game/simulation/prototypeScenario';

describe('createPrototypeScenario — default + conquest', () => {

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
    // Every scout (both starting scouts + the forward enemy scout) carries
    // wander state since the 2026-07-09 pinned-units fix; the movement
    // system only activates it for AI-driven owners.
    const startingScouts = scenario.spawns.filter(
      (spawn) => spawn.kind === 'scout' && spawn.wanderBounds !== undefined,
    );
    const forwardEnemyScout = scenario.spawns.find(
      (spawn) =>
        spawn.kind === 'scout'
        && spawn.owner === 2
        && spawn.x === FORWARD_ENEMY_SCOUT_POSITION.x
        && spawn.y === FORWARD_ENEMY_SCOUT_POSITION.y,
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
    expect(startingScouts).toHaveLength(3);
    expect(forwardEnemyScout).toBeDefined();
    expect(forwardEnemyScout?.velocity).toBeDefined();
    expect(forwardEnemyScout?.wanderBounds).toBeDefined();
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

  it('spawns every scout with wander state (runtime gate keeps human slots manual)', () => {
    // The spawn spec is uniform so the same map serves human, inert, and
    // all-AI runs; scoutMovementSystem skips the human slot unless it has a
    // forced AI state (behavior pinned by scoutWander.test.ts).
    const scenario = createPrototypeScenario(DEFAULT_SEED);
    const humanScout = scenario.spawns.find(
      (spawn) => spawn.kind === 'scout' && spawn.owner === 1,
    );
    const enemyScout = scenario.spawns.find(
      (spawn) => spawn.kind === 'scout' && spawn.owner === 2 && spawn.wanderBounds !== undefined,
    );

    expect(humanScout).toBeDefined();
    expect(humanScout?.velocity).toBeDefined();
    expect(humanScout?.wanderBounds).toBeDefined();

    expect(enemyScout).toBeDefined();
    expect(enemyScout?.velocity).toBeDefined();
    expect(enemyScout?.wanderBounds).toBeDefined();
    // 2-D wander: a zero dy ping-pongs one row and covers no area.
    expect(enemyScout?.velocity?.dy).not.toBe(0);
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

});
