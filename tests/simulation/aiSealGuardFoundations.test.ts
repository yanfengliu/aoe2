// The AI's seal guard counts a foundation nobody has started as a wall (work
// 126; aiSitePlacement.ts; the map-connectivity gate's rule 2).
//
// Units walk over an unstarted foundation now (update 185872), so the
// movement's own passability, which the seal guard floods, calls its cells
// open ground. But it is a wall the moment it starts. Read as open, the guard
// would let the AI fill the last gap beside one of its own foundations, and
// the map would seal when that foundation went up. So the guard counts every
// unstarted foundation, whoever owns it, as a wall, as the independent judge
// of aiPlacementKeepsMapConnected.test.ts (`staticGridOf`, every building
// footprint a wall) always did.
//
// BOUND: the first describe is the AI site search over hand-drawn predicates
// on a 40x40 grid: a map-wide wall along y = 20 with a two-cell gap, an
// unstarted foundation in one cell of it, and the other cell the only anchor
// the search may take. The second is the live bridge's wiring
// (trainingMarketOps.ts), read through the search's instrument seam: on one
// fixture, every search the AI makes while it owns an unstarted foundation
// must be handed a guard that calls that foundation's cells walls. It does not
// play out a seal; a real match staying connected is
// aiPlacementKeepsMapConnected.test.ts and scripts/mapConnectivity.mjs.

import { afterEach, describe, expect, it } from 'vitest';

import { createAiSitePlacement, placementSearchInstrument } from '../../src/game/simulation/bridge/aiSitePlacement';
import { createBridgeState } from '../../src/game/simulation/bridge/bridgeState';
import { findPlacementAnchorNear } from '../../src/game/simulation/bridge/placementSearch';
import { buildingFootprint } from '../../src/game/simulation/bridge/pureHelpers';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { UNBUILT_FOUNDATIONS_AI_GUARD_SEED } from '../../src/game/simulation/fixtures/unbuiltFoundations';

const SIZE = 40;
const FOUNDATION = { x: 20, y: 20 };
const GAP = { x: 21, y: 20 };

const wall = (x: number, y: number): boolean => y === 20 && x !== FOUNDATION.x && x !== GAP.x;
const inMap = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < SIZE && y < SIZE;

function search(foundationIsWall: boolean) {
  const placement = createAiSitePlacement({
    state: createBridgeState(),
    mapWidth: SIZE,
    mapHeight: SIZE,
    // The AI may build only at the gap's open cell.
    isPlacementBlocked: (x, y, width, height) => !(x === GAP.x && y === GAP.y && width === 1 && height === 1),
    // Units walk the foundation's cell; only the wall stops them.
    isCellPassableForUnit: (_unit, x, y) => inMap(x, y) && !wall(x, y),
    unstartedFoundationCells: () => {
      if (!foundationIsWall) return null;
      const mask = new Uint8Array(SIZE * SIZE);
      mask[FOUNDATION.y * SIZE + FOUNDATION.x] = 1;
      return mask;
    },
  });
  return {
    anchor: placement.findBuildPlacementNear({ x: GAP.x, y: GAP.y + 2 }, 'watch-tower', [1]),
    stats: placement.stats,
  };
}

describe('the AI\'s seal guard and unstarted foundations (work 126)', () => {
  it('refuses the last gap beside an unstarted foundation, which will be a wall', () => {
    const { anchor, stats } = search(true);
    expect(anchor, 'the AI filled the last gap beside its unstarted foundation').toBeNull();
    expect(stats.refusedByGuard, 'the gap was not refused by the guard').toBeGreaterThan(0);
  });

  it('the control: read as open ground, the same gap is taken', () => {
    expect(search(false).anchor).toEqual(GAP);
  });
});

describe('the live AI\'s seal guard is handed every unstarted foundation (work 126)', () => {
  afterEach(() => {
    placementSearchInstrument.search = null;
  });

  it('every search made while the AI owns an unstarted foundation calls its cells walls', () => {
    const AI = 2;
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_AI_GUARD_SEED);
    let searchesBesideOne = 0;
    const cellsCalledFree: string[] = [];
    placementSearchInstrument.search = (origin, footprint, mapWidth, mapHeight, isBlocked, options = {}) => {
      if (options.isFree) {
        const unstarted = bridge.getEconomyState().buildings.filter((building) => (
          building.owner === AI && !building.isComplete && building.buildProgressTicks === 0
          && building.buildingType !== 'farm'
        ));
        if (unstarted.length > 0) searchesBesideOne += 1;
        for (const building of unstarted) {
          const size = buildingFootprint(building.buildingType);
          for (let y = building.y; y < building.y + size.height; y += 1) {
            for (let x = building.x; x < building.x + size.width; x += 1) {
              if (options.isFree(x, y)) cellsCalledFree.push(`${building.buildingType} (${x},${y})`);
            }
          }
        }
      }
      return findPlacementAnchorNear(origin, footprint, mapWidth, mapHeight, isBlocked, options);
    };
    for (let tick = 0; tick < 400 && searchesBesideOne < 3; tick += 1) bridge.step(100);
    expect(searchesBesideOne, 'the premise: the AI never searched while it owned an unstarted foundation')
      .toBeGreaterThan(0);
    expect(cellsCalledFree, 'the guard took an unstarted foundation\'s cells for open ground').toEqual([]);
  });
});
