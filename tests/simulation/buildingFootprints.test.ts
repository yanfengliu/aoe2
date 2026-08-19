import { describe, expect, it } from 'vitest';

import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import type { BuildingType } from '../../src/game/simulation/types';

describe('AUTHORITATIVE_BUILDING_FOOTPRINTS', () => {
  it('pins the implemented building footprints used by gameplay and rendering', () => {
    const expected: Record<BuildingType, { width: number; height: number }> = {
      'town-center': { width: 4, height: 4 },
      house: { width: 2, height: 2 },
      mill: { width: 2, height: 2 },
      'lumber-camp': { width: 2, height: 2 },
      'mining-camp': { width: 2, height: 2 },
      barracks: { width: 3, height: 3 },
      'watch-tower': { width: 1, height: 1 },
      stable: { width: 3, height: 3 },
      'archery-range': { width: 3, height: 3 },
      blacksmith: { width: 3, height: 3 },
      market: { width: 4, height: 4 },
      'siege-workshop': { width: 3, height: 3 },
      monastery: { width: 2, height: 2 },
      university: { width: 2, height: 2 },
      dock: { width: 3, height: 3 },
      castle: { width: 4, height: 4 },
      wonder: { width: 4, height: 4 },
      'stone-wall': { width: 1, height: 1 },
      'palisade-wall': { width: 1, height: 1 },
      farm: { width: 1, height: 1 },
    };

    expect(AUTHORITATIVE_BUILDING_FOOTPRINTS).toEqual(expected);
  });
});
