import { describe, expect, it } from 'vitest';

import type { UnitType } from '../../src/game/simulation/types';
import {
  isWaterUnit,
  terrainPassableForDomain,
  unitDomain,
} from '../../src/game/simulation/unitDomain';

const LAND_UNITS: readonly UnitType[] = [
  'villager', 'scout', 'militia', 'spearman', 'archer', 'skirmisher', 'knight',
  'crossbowman', 'pikeman', 'light-cavalry', 'camel', 'cavalry-archer',
  'mangonel', 'scorpion', 'battering-ram', 'monk', 'longbowman', 'arbalest',
  'halberdier', 'hussar', 'heavy-cavalry-archer', 'cavalier', 'champion',
  'elite-longbowman', 'onager', 'heavy-scorpion', 'siege-ram', 'bombard-cannon',
  'trebuchet', 'man-at-arms', 'long-swordsman', 'two-handed-swordsman',
  'paladin', 'heavy-camel',
];

describe('unit domains', () => {
  it('puts every land unit on land and ships on water', () => {
    for (const unitType of LAND_UNITS) {
      expect(unitDomain(unitType)).toBe('land');
      expect(isWaterUnit(unitType)).toBe(false);
    }
    expect(unitDomain('fishing-ship')).toBe('water');
    expect(isWaterUnit('fishing-ship')).toBe(true);
  });
});

describe('terrain passability by domain', () => {
  it('keeps land units off water and out of forest, exactly as before', () => {
    expect(terrainPassableForDomain('grass', 'land')).toBe(true);
    expect(terrainPassableForDomain('hill', 'land')).toBe(true);
    expect(terrainPassableForDomain('water', 'land')).toBe(false);
    expect(terrainPassableForDomain('forest', 'land')).toBe(false);
  });

  it('keeps ships on water and off every kind of land', () => {
    expect(terrainPassableForDomain('water', 'water')).toBe(true);
    expect(terrainPassableForDomain('grass', 'water')).toBe(false);
    expect(terrainPassableForDomain('hill', 'water')).toBe(false);
    expect(terrainPassableForDomain('forest', 'water')).toBe(false);
  });

  it('treats the two domains as complementary on every terrain kind', () => {
    // No cell is passable to both, and water is the only cell passable to
    // ships — the property that makes a shoreline a real boundary.
    for (const kind of ['grass', 'hill', 'water', 'forest'] as const) {
      const land = terrainPassableForDomain(kind, 'land');
      const water = terrainPassableForDomain(kind, 'water');
      expect(land && water).toBe(false);
      if (water) expect(kind).toBe('water');
    }
  });
});
