// Measured on the default map: the AI reached Castle Age with 866 stone, 1271
// gold and 3004 food, and its buildings were a Town Center, a Barracks, a
// Blacksmith, an Archery Range, a Mill, two drop-off camps, seven Houses and
// five Farms. No Castle. No Stable, Market, Monastery, University or tower —
// with the stone for a Castle sitting unspent since tick 10000.
//
// The reason is that farms come FIRST in the build order and a farm is
// CONSUMED. The target is a third of the villager force, so with 21 villagers
// it wants seven; two deplete, it drops to five, and the very next decision
// asks for another farm. The queue never gets past the farm gate, so nothing
// else is ever built.
//
// Farms come first for a real reason — an Archery Range built while the food
// income is dead spends wood to get no closer to the next age — so the fix is
// not to demote them, but to stop treating a well-fed player as starving.

import { describe, it, expect } from 'vitest';

import { pickNextBuildTarget, targetFarmCount } from '../../src/game/simulation/ai';
import type { BuildableBuildingType } from '../../src/game/simulation/types';

const has = (...owned: BuildableBuildingType[]) =>
  (buildingType: BuildableBuildingType): boolean => !owned.includes(buildingType);

describe('the AI build order gets past farms', () => {
  it('still puts farms first when the food is actually gone', () => {
    // Two farms short of target and no food banked: this is the starvation the
    // farm-first rule was written for, and it must not change.
    expect(
      pickNextBuildTarget(
        'castle-age',
        has('barracks', 'mill', 'blacksmith', 'archery-range'),
        false,
        { owned: 2, villagerCount: 21, food: 40 },
      ),
    ).toBe('farm');
  });

  it('builds the missing hall instead of a seventh farm when the food is banked', () => {
    // Same shortfall, but 3004 food in the bank — the measured state. A Stable
    // is what the order asks for next.
    expect(
      pickNextBuildTarget(
        'castle-age',
        has('barracks', 'mill', 'blacksmith', 'archery-range'),
        false,
        { owned: 5, villagerCount: 21, food: 3004 },
      ),
    ).toBe('stable');
  });

  it('never drops below the two-farm floor, however rich it is', () => {
    // The floor is what keeps a food income alive at all; a full stockpile is
    // not a reason to have no farms.
    expect(
      pickNextBuildTarget(
        'castle-age',
        has('barracks', 'mill', 'blacksmith', 'archery-range'),
        false,
        { owned: 1, villagerCount: 21, food: 3004 },
      ),
    ).toBe('farm');
    expect(targetFarmCount('castle-age', 21)).toBe(7);
  });

  it('goes back to farms once every building it wants is standing', () => {
    const everythingBuilt = (): boolean => false;
    expect(
      pickNextBuildTarget('castle-age', everythingBuilt, false, {
        owned: 5,
        villagerCount: 21,
        food: 3004,
      }),
    ).toBe('farm');
  });
});
