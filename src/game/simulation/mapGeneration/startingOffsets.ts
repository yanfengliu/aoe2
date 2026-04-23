import type { Position } from 'civ-engine';

import { MAP_HEIGHT, MAP_WIDTH } from './constants';
import {
  orientationFor,
  projectOffset,
  type Offset,
} from './sharedTerrainHelpers';
import type { ScenarioSpawnSpec } from '../prototypeScenario';

// Slice 1: starting unit, sheep, boar, berry, gold, stone, and forest
// offsets for every player base. Coordinates are expressed relative to
// the player's Town Center anchor and get mirrored to fit the
// orientation of each player's home base.

export const HUMAN_PLAYER_ID = 1;

export const STARTING_VILLAGERS: Offset[] = [
  { x: -2, y: 0 },
  { x: -2, y: 1 },
  { x: -1, y: 1 },
];

export const STARTING_SHEEP: Offset[] = [
  { x: 4, y: 1 },
  { x: 5, y: 1 },
  { x: 4, y: 2 },
  { x: 5, y: 2 },
];

export const STARTING_BOARS: Offset[] = [
  { x: -4, y: -4 },
  { x: 4, y: -5 },
];

export const STARTING_BERRIES: Offset[] = [
  { x: -4, y: 1 },
  { x: -4, y: 2 },
  { x: -3, y: 2 },
  { x: -3, y: 3 },
  { x: -2, y: 2 },
  { x: -2, y: 3 },
];

export const STARTING_GOLD: Offset[] = [
  { x: 5, y: -1 },
  { x: 6, y: -1 },
  { x: 5, y: 0 },
  { x: 6, y: 0 },
];

export const STARTING_STONE: Offset[] = [
  { x: 0, y: 5 },
  { x: 1, y: 5 },
  { x: 0, y: 6 },
  { x: 1, y: 6 },
];

export const SHORE_FISH_AMOUNT = 225;

export const FOREST_PATCHES: Offset[][] = [
  [
    { x: -6, y: -2 },
    { x: -6, y: -1 },
    { x: -6, y: 0 },
    { x: -5, y: -2 },
    { x: -5, y: -1 },
    { x: -5, y: 0 },
    { x: -4, y: -2 },
    { x: -4, y: -1 },
  ],
  [
    { x: 4, y: -4 },
    { x: 5, y: -4 },
    { x: 6, y: -4 },
    { x: 4, y: -3 },
    { x: 5, y: -3 },
    { x: 6, y: -3 },
    { x: 5, y: -2 },
    { x: 6, y: -2 },
  ],
  [
    { x: -2, y: 5 },
    { x: -1, y: 5 },
    { x: 0, y: 5 },
    { x: 1, y: 5 },
    { x: -2, y: 6 },
    { x: -1, y: 6 },
    { x: 0, y: 6 },
    { x: 1, y: 6 },
  ],
];

export const FORWARD_ENEMY_SCOUT_POSITION: Position = { x: 41, y: 20 };
export const FORWARD_ENEMY_HOUSE_POSITION: Position = { x: 39, y: 18 };

// Slice 5: two neutral relics on the default map. Placed on the center line
// midway between the two player starts so both players have a roughly
// symmetric path to claim them. Positions avoid resource patches and the
// default forest strips.
export const DEFAULT_RELIC_POSITIONS: Position[] = [
  { x: 24, y: 24 },
  { x: 36, y: 10 },
];

export function createStartingScoutSpawn(
  owner: number,
  townCenter: Position,
): ScenarioSpawnSpec {
  const scoutPosition = projectOffset(townCenter, { x: 2, y: -1 });
  if (owner === HUMAN_PLAYER_ID) {
    return {
      kind: 'scout',
      x: scoutPosition.x,
      y: scoutPosition.y,
      owner,
      baseOwner: owner,
      vision: { playerId: owner, radius: 6 },
      requiresSafeSpawn: true,
    };
  }

  return {
    kind: 'scout',
    x: scoutPosition.x,
    y: scoutPosition.y,
    owner,
    baseOwner: owner,
    velocity: { dx: orientationFor(townCenter).x, dy: 0 },
    wanderBounds: {
      minX: Math.max(0, townCenter.x - 5),
      maxX: Math.min(MAP_WIDTH - 1, townCenter.x + 6),
      minY: Math.max(0, townCenter.y - 4),
      maxY: Math.min(MAP_HEIGHT - 1, townCenter.y + 4),
    },
    vision: { playerId: owner, radius: 6 },
    requiresSafeSpawn: true,
  };
}
