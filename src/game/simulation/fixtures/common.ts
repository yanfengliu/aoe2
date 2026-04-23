import type { Position } from 'civ-engine';

// Shared fixture position constants. Originally inlined at the top of
// prototypeScenario.ts; the fixtures that use them are spread across
// several categories (feudal prereqs, feudal stables, selection tests,
// etc.) so pulling them into one module keeps the single source of truth
// without making a single fixture file own them.

export const FIXTURE_NEARBY_VILLAGER_POSITION: Position = { x: 6, y: 10 };
export const FIXTURE_PRIMARY_BUILDING_POSITION: Position = { x: 13, y: 8 };
export const FIXTURE_SECONDARY_BUILDING_POSITION: Position = { x: 17, y: 8 };
export const FIXTURE_STACK_POSITION: Position = { x: 13, y: 12 };
export const FIXTURE_VILLAGER_CLUSTER: Position[] = [
  { x: 5, y: 10 },
  { x: 6, y: 10 },
  { x: 7, y: 10 },
];
export const FIXTURE_MIXED_SELECTION_HOUSE_POSITION: Position = { x: 12, y: 12 };
export const FIXTURE_MIXED_SELECTION_UNITS: Array<{
  kind: 'villager' | 'militia' | 'scout';
  x: number;
  y: number;
}> = [
  { kind: 'villager', x: 5, y: 10 },
  { kind: 'militia', x: 6, y: 10 },
  { kind: 'scout', x: 7, y: 10 },
];

export { createGrassFixtureTerrain } from './createGrassFixtureTerrain';
