// structures.csv's Town Center row says "15 units (supports 5 population)" and
// "max 10 arrows". The game held 5 and fired at most 5 — so a base under raid
// could shelter a quarter of its villagers, and a full Town Center shot at half
// strength. Both are the data's numbers, and both matter: sheltering villagers
// from a raid is the whole reason a Town Center takes people in.

import { describe, it, expect } from 'vitest';

import {
  buildingArrowCount,
  buildingGarrisonCapacity,
  canGarrisonAt,
} from '../../src/game/simulation/prototypeBuildingRules';

describe('Town Center shelter', () => {
  it('holds fifteen, the number the data gives it', () => {
    expect(buildingGarrisonCapacity('town-center')).toBe(15);
    expect(canGarrisonAt('town-center', 'villager')).toBe(true);
  });

  it('shoots one arrow per sheltered unit, to a ceiling of ten', () => {
    // The empty Town Center's single arrow is this game's deliberate departure
    // (spec §10.8) and stays.
    expect(buildingArrowCount('town-center', 0, 0)).toBe(1);
    expect(buildingArrowCount('town-center', 3, 0)).toBe(4);
    expect(buildingArrowCount('town-center', 9, 0)).toBe(10);
    // structures.csv: "max 10 arrows" — a fifteenth villager adds no more.
    expect(buildingArrowCount('town-center', 15, 0)).toBe(10);
  });
});
