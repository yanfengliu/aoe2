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
    expect(snap.visibleEnemies).toHaveLength(200);
  });

  it('excludes own units from visibleEnemies', () => {
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
    expect(snap.visibleEnemies.map((e) => e.entityId)).toEqual([6]);
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
});
