import { describe, it, expect } from 'vitest';
import { buildAgentSnapshot } from '../../src/game/playtest/agentSnapshot';
import type {
  EconomyState,
  SelectionState,
  AgeType,
  PlayerResources,
  PopulationState,
} from '../../src/game/simulation/types';
import type { AgentScreenMapping } from '../../src/game/playtest/types';

const MAP_RESOURCES: Record<number, PlayerResources> = {
  1: { wood: 200, food: 200, gold: 100, stone: 200 },
  2: { wood: 200, food: 200, gold: 100, stone: 200 },
};
const MAP_POP: Record<number, PopulationState> = {
  1: { current: 3, cap: 5 },
  2: { current: 3, cap: 5 },
};
const MAP_AGES: Record<number, AgeType> = { 1: 'feudal-age', 2: 'dark-age' };

const SCREEN: AgentScreenMapping = {
  worldBbox: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
  pixelBbox: { x: 0, y: 0, width: 800, height: 600 },
  worldToScreen: [],
};

function makeEconomy(overrides: Partial<EconomyState> = {}): EconomyState {
  return {
    ages: MAP_AGES,
    playerResources: MAP_RESOURCES,
    population: MAP_POP,
    villagers: [],
    resources: [],
    units: [],
    buildings: [],
    ...overrides,
  } as EconomyState;
}

function makeSelection(overrides: Partial<SelectionState> = {}): SelectionState {
  return {
    selectedEntityId: null,
    selectedEntityIds: [],
    selectedCount: 0,
    selectedKind: null,
    selectedEntityType: null,
    owner: null,
    health: null,
    attack: null,
    armor: null,
    faction: null,
    civ: null,
    inventory: null,
    activity: null,
    activityBreakdown: null,
    x: null,
    y: null,
    tileX: null,
    tileY: null,
    tileEntityIndex: null,
    ...overrides,
  } as SelectionState;
}

describe('buildAgentSnapshot', () => {
  it('returns tick + mm:ss + screen mapping', () => {
    const snap = buildAgentSnapshot({
      ownerId: 2,
      tick: 1500,
      tps: 50,
      economy: makeEconomy(),
      selection: makeSelection(),
      screenMapping: SCREEN,
    });
    expect(snap.tick).toBe(1500);
    expect(snap.elapsedMmSs).toBe('00:30');
    expect(snap.screenMapping).toBe(SCREEN);
  });

  it('formats elapsed time over a minute', () => {
    const snap = buildAgentSnapshot({
      ownerId: 2,
      tick: 5000,
      tps: 50,
      economy: makeEconomy(),
      selection: makeSelection(),
      screenMapping: SCREEN,
    });
    expect(snap.elapsedMmSs).toBe('01:40');
  });

  it('emits one player-state row per owner sorted by id', () => {
    const snap = buildAgentSnapshot({
      ownerId: 2,
      tick: 0,
      tps: 50,
      economy: makeEconomy(),
      selection: makeSelection(),
      screenMapping: SCREEN,
    });
    expect(snap.perPlayer.map((p) => p.ownerId)).toEqual([1, 2]);
  });

  it('counts villagers by task', () => {
    const economy = makeEconomy({
      villagers: [
        { owner: 2, task: 'gathering-wood', desiredResource: 'wood', carriedResource: null, carriedAmount: 0 },
        { owner: 2, task: 'gathering-wood', desiredResource: 'wood', carriedResource: null, carriedAmount: 0 },
        { owner: 2, task: 'gathering-food', desiredResource: 'food', carriedResource: null, carriedAmount: 0 },
        { owner: 1, task: 'gathering-food', desiredResource: 'food', carriedResource: null, carriedAmount: 0 },
      ],
    } as unknown as Partial<EconomyState>);
    const snap = buildAgentSnapshot({
      ownerId: 2,
      tick: 0,
      tps: 50,
      economy,
      selection: makeSelection(),
      screenMapping: SCREEN,
    });
    const owner2 = snap.perPlayer.find((p) => p.ownerId === 2)!;
    expect(owner2.villagerCountByTask).toEqual({ 'gathering-wood': 2, 'gathering-food': 1 });
  });

  it('caps queuedProduction at 64 buildings and 16 entries per queue', () => {
    // 100 buildings, each with a 30-entry queue → cap to 64 + truncate to 16.
    const buildings = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      owner: 2,
      buildingType: 'town-center' as const,
      x: 0,
      y: 0,
      footprintWidth: 4,
      footprintHeight: 4,
      isComplete: true,
      buildProgressTicks: 0,
      totalBuildTicks: 0,
      populationProvided: 5,
      queue: Array.from({ length: 30 }, () => ({ unitType: 'villager' })),
    }));
    const snap = buildAgentSnapshot({
      ownerId: 2,
      tick: 0,
      tps: 50,
      economy: makeEconomy({ buildings } as unknown as Partial<EconomyState>),
      selection: makeSelection(),
      screenMapping: SCREEN,
    });
    expect(snap.queuedProduction).toHaveLength(64);
    for (const entry of snap.queuedProduction) {
      expect(entry.queue.length).toBeLessThanOrEqual(16);
    }
  });

  it('caps visible enemies at 200', () => {
    const units = Array.from({ length: 250 }, (_, i) => ({
      id: i + 1000,
      owner: 1,
      unitType: 'archer' as const,
      x: i,
      y: 0,
      task: 'idle',
      attackDamage: 4,
      attackRange: 4,
      armor: 0,
    }));
    const economy = makeEconomy({ units } as Partial<EconomyState>);
    const snap = buildAgentSnapshot({
      ownerId: 2,
      tick: 0,
      tps: 50,
      economy,
      selection: makeSelection(),
      screenMapping: SCREEN,
    });
    expect(snap.enemies).toHaveLength(200);
  });

  it('excludes own units from enemies', () => {
    const economy = makeEconomy({
      units: [
        { id: 5, owner: 2, unitType: 'archer', x: 1, y: 1, task: 'idle', attackDamage: 4, attackRange: 4, armor: 0 },
        { id: 6, owner: 1, unitType: 'archer', x: 2, y: 2, task: 'idle', attackDamage: 4, attackRange: 4, armor: 0 },
      ],
    } as Partial<EconomyState>);
    const snap = buildAgentSnapshot({
      ownerId: 2,
      tick: 0,
      tps: 50,
      economy,
      selection: makeSelection(),
      screenMapping: SCREEN,
    });
    expect(snap.enemies.map((e) => e.entityId)).toEqual([6]);
  });

  it('caps selection at 16 entries', () => {
    const ids = Array.from({ length: 30 }, (_, i) => i + 1);
    const snap = buildAgentSnapshot({
      ownerId: 2,
      tick: 0,
      tps: 50,
      economy: makeEconomy(),
      selection: makeSelection({
        selectedEntityIds: ids,
        selectedKind: 'unit',
        selectedEntityType: 'villager',
        owner: 2,
        tileX: 0,
        tileY: 0,
      }),
      screenMapping: SCREEN,
    });
    expect(snap.selection).toHaveLength(16);
  });

  it('infers age from economy.ages (feudal mapping)', () => {
    const snap = buildAgentSnapshot({
      ownerId: 2,
      tick: 0,
      tps: 50,
      economy: makeEconomy(),
      selection: makeSelection(),
      screenMapping: SCREEN,
    });
    expect(snap.perPlayer.find((p) => p.ownerId === 1)!.age).toBe('feudal-age');
    expect(snap.perPlayer.find((p) => p.ownerId === 2)!.age).toBe('dark-age');
  });

  // Phase-6.B per-owner visibility-gating.
  describe('visibility gating', () => {
    function economyWithEnemyAt(x: number, y: number): EconomyState {
      return makeEconomy({
        units: [
          { id: 100, owner: 1, unitType: 'spearman', x, y },
        ] as unknown as EconomyState['units'],
      });
    }

    it('omits enemies in fog when visibility probe returns false (default mode)', () => {
      const snap = buildAgentSnapshot({
        ownerId: 2,
        tick: 0,
        tps: 50,
        economy: economyWithEnemyAt(5, 5),
        selection: makeSelection(),
        screenMapping: SCREEN,
        visibility: () => false,
      });
      expect(snap.enemies).toEqual([]);
    });

    it('includes enemies the probe says are visible', () => {
      const snap = buildAgentSnapshot({
        ownerId: 2,
        tick: 0,
        tps: 50,
        economy: economyWithEnemyAt(7, 9),
        selection: makeSelection(),
        screenMapping: SCREEN,
        visibility: (_owner, x, y) => x === 7 && y === 9,
      });
      expect(snap.enemies).toHaveLength(1);
      expect(snap.enemies[0]!.entityId).toBe(100);
    });

    it('omniscient=true bypasses the probe even when probe returns false', () => {
      const snap = buildAgentSnapshot({
        ownerId: 2,
        tick: 0,
        tps: 50,
        economy: economyWithEnemyAt(5, 5),
        selection: makeSelection(),
        screenMapping: SCREEN,
        visibility: () => false,
        omniscient: true,
      });
      expect(snap.enemies).toHaveLength(1);
    });

    it('default (no probe, omniscient unset) keeps cheat-mode global view', () => {
      // Backwards-compat: callers that don't supply visibility get the
      // pre-Phase-6.B behavior unchanged.
      const snap = buildAgentSnapshot({
        ownerId: 2,
        tick: 0,
        tps: 50,
        economy: economyWithEnemyAt(5, 5),
        selection: makeSelection(),
        screenMapping: SCREEN,
      });
      expect(snap.enemies).toHaveLength(1);
    });

    it('shows buildings visible only at a far footprint corner (any-cell rule)', () => {
      // Codex Phase-6.B impl-1 MED: a 4x4 castle anchored at (5,5)
      // with only cell (8,5) visible should still surface — the
      // renderer + target selection use the same any-cell rule, so
      // the snapshot must too.
      const economy = makeEconomy({
        buildings: [
          {
            id: 200,
            owner: 1,
            buildingType: 'castle',
            x: 5,
            y: 5,
            footprintWidth: 4,
            footprintHeight: 4,
            isComplete: true,
            buildProgressTicks: 0,
            totalBuildTicks: 0,
            populationProvided: 0,
            queue: [],
          },
        ] as unknown as EconomyState['buildings'],
      });
      const snap = buildAgentSnapshot({
        ownerId: 2,
        tick: 0,
        tps: 50,
        economy,
        selection: makeSelection(),
        screenMapping: SCREEN,
        visibility: (_owner, x, y) => x === 8 && y === 5,
      });
      expect(snap.enemies).toHaveLength(1);
      expect(snap.enemies[0]!.entityId).toBe(200);
    });

    it('omits a fully-fogged building (no footprint cell visible)', () => {
      const economy = makeEconomy({
        buildings: [
          {
            id: 201,
            owner: 1,
            buildingType: 'castle',
            x: 5,
            y: 5,
            footprintWidth: 4,
            footprintHeight: 4,
            isComplete: true,
            buildProgressTicks: 0,
            totalBuildTicks: 0,
            populationProvided: 0,
            queue: [],
          },
        ] as unknown as EconomyState['buildings'],
      });
      const snap = buildAgentSnapshot({
        ownerId: 2,
        tick: 0,
        tps: 50,
        economy,
        selection: makeSelection(),
        screenMapping: SCREEN,
        visibility: () => false,
      });
      expect(snap.enemies).toEqual([]);
    });

    it('passes Math.floor(x), Math.floor(y) to the probe (sub-cell unit positions)', () => {
      const probeCalls: Array<[number, number, number]> = [];
      const snap = buildAgentSnapshot({
        ownerId: 2,
        tick: 0,
        tps: 50,
        economy: economyWithEnemyAt(5.7, 9.3),
        selection: makeSelection(),
        screenMapping: SCREEN,
        visibility: (owner, x, y) => {
          probeCalls.push([owner, x, y]);
          return false;
        },
      });
      expect(probeCalls).toEqual([[2, 5, 9]]);
      expect(snap.enemies).toEqual([]);
    });
  });

  // Phase-6.A.2 schema-drift guard.
  describe('schema drift detection', () => {
    function tryBuild(economy: Partial<EconomyState>): unknown {
      try {
        return buildAgentSnapshot({
          ownerId: 2,
          tick: 0,
          tps: 50,
          economy: economy as EconomyState,
          selection: makeSelection(),
          screenMapping: SCREEN,
        });
      } catch (err) {
        return err;
      }
    }

    const cases: Array<{ field: keyof EconomyState; value: unknown }> = [
      { field: 'units', value: undefined },
      { field: 'buildings', value: 'not-an-array' },
      { field: 'villagers', value: undefined },
      { field: 'ages', value: undefined },
      { field: 'playerResources', value: null },
      { field: 'population', value: 42 },
      // Codex impl-1 MED 3: record-typed fields must reject Map/array
      // (which would otherwise silently degrade the snapshot reads).
      { field: 'ages', value: new Map([[1, 'feudal-age']]) },
      { field: 'playerResources', value: [] },
      { field: 'population', value: new Set() },
    ];
    for (const { field, value } of cases) {
      it(`throws when EconomyState.${String(field)} is missing or wrong type`, () => {
        const economy = makeEconomy();
        (economy as unknown as Record<string, unknown>)[field as string] = value;
        const result = tryBuild(economy as Partial<EconomyState>);
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toContain('schema drift detected');
        expect((result as Error).message).toContain(String(field));
      });
    }

    it('does not throw on legitimately empty arrays / fresh-game state', () => {
      // Arrays empty, maps empty — guard is shape, not content. The
      // dark-age tick-0 case must keep flowing through.
      const snap = buildAgentSnapshot({
        ownerId: 2,
        tick: 0,
        tps: 50,
        economy: makeEconomy({
          units: [],
          buildings: [],
          ages: {},
          playerResources: {},
          population: {},
        }),
        selection: makeSelection(),
        screenMapping: SCREEN,
      });
      expect(snap.tick).toBe(0);
      expect(snap.enemies).toEqual([]);
    });
  });
});
