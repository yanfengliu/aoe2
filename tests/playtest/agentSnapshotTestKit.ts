// Shared fixtures for the agentSnapshot test files (split to keep each
// file under the 500-LOC budget).

import type {
  EconomyState,
  SelectionState,
  AgeType,
  PlayerResources,
  PopulationState,
} from '../../src/game/simulation/types';
import type { AgentScreenMapping } from '../../src/game/playtest/types';

export const MAP_RESOURCES: Record<number, PlayerResources> = {
  1: { wood: 200, food: 200, gold: 100, stone: 200 },
  2: { wood: 200, food: 200, gold: 100, stone: 200 },
};
export const MAP_POP: Record<number, PopulationState> = {
  1: { current: 3, cap: 5, rawSupply: 5 },
  2: { current: 3, cap: 5, rawSupply: 5 },
};
export const MAP_AGES: Record<number, AgeType> = { 1: 'feudal-age', 2: 'dark-age' };

export const SCREEN: AgentScreenMapping = {
  worldBbox: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
  pixelBbox: { x: 0, y: 0, width: 800, height: 600 },
  worldToScreen: [],
};

export function makeEconomy(overrides: Partial<EconomyState> = {}): EconomyState {
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

export function makeSelection(overrides: Partial<SelectionState> = {}): SelectionState {
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
    pierceArmor: null,
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
