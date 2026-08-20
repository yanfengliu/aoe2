import { describe, expect, it } from 'vitest';

import type { UnitType } from '../../src/game/simulation/types';
import { UNIT_MAX_HP } from '../../src/game/simulation/prototypeUnitRules/statTables';
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
  // M4 unique units: every Castle-trained one is a land unit.
  'jaguar-warrior',
  'cataphract',
  'woad-raider',
  'chu-ko-nu',
  'throwing-axeman',
  'huskarl',
  'tarkan',
  'samurai',
  'war-wagon',
  'plumed-archer',
  'mangudai',
  'war-elephant',
  'mameluke',
  'conquistador',
  'teutonic-knight',
  'janissary',
  'berserk',
  // The elite tier of each Castle-trained unique unit.
  'elite-jaguar-warrior',
  'elite-cataphract',
  'elite-woad-raider',
  'elite-chu-ko-nu',
  'elite-throwing-axeman',
  'elite-huskarl',
  'elite-tarkan',
  'elite-samurai',
  'elite-war-wagon',
  'elite-plumed-archer',
  'elite-mangudai',
  'elite-war-elephant',
  'elite-mameluke',
  'elite-conquistador',
  'elite-teutonic-knight',
  'elite-janissary',
  'elite-berserk',
];

const WATER_UNITS: readonly UnitType[] = [
  'fishing-ship', 'transport-ship', 'galley', 'war-galley', 'galleon', 'fire-ship',
  'fast-fire-ship', 'demolition-ship', 'heavy-demolition-ship',
  'cannon-galleon', 'elite-cannon-galleon',
  // M4: the two naval unique units.
  'turtle-ship', 'longboat',
  'elite-turtle-ship', 'elite-longboat',
];

describe('unit domains', () => {
  it('puts every land unit on land and every ship on water', () => {
    for (const unitType of LAND_UNITS) {
      expect(unitDomain(unitType)).toBe('land');
      expect(isWaterUnit(unitType)).toBe(false);
    }
    for (const unitType of WATER_UNITS) {
      expect(unitDomain(unitType)).toBe('water');
      expect(isWaterUnit(unitType)).toBe(true);
    }
  });

  it('assigns every unit in the roster to exactly one domain', () => {
    // A unit missing from both lists is a unit nobody decided about — and the
    // default is land, which for a ship means it can never leave the coast.
    const named = new Set<UnitType>([...LAND_UNITS, ...WATER_UNITS]);
    for (const unitType of Object.keys(UNIT_MAX_HP) as UnitType[]) {
      expect(named.has(unitType)).toBe(true);
    }
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
