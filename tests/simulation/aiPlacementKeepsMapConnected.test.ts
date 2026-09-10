// GATE: the AI never places a non-wall building whose footprint disconnects
// passable ground — on any decision, including one that places two things.
//
// Found by the standing loop, playing: a 93-minute Black Forest match in which
// the whole army was ordered across the map and nothing happened, then an
// independent flood over terrain plus building footprints showed the map had
// sealed itself (enemy units reachable from the human's ground 4/4 at tick 0,
// 0/26 by tick 20,000; with both sides AI the human's units split into 50-,
// 43- and 2-cell pockets by tick 15,000). The owner reported none of it.
//
// Two mechanisms, both on `corridorSeal.ts`:
//   1. The seal guard had a FALLBACK: when every anchor in reach would sever
//      ground, the search ran again without the guard, "because a sealed
//      pocket beats not building at all". On a map whose only site is the
//      corridor, that is the corridor filled, every time. Removed 2026-09-08.
//   2. One decision can push a watch tower and a next build, both judged
//      against the current world; the guard could not see the first
//      intention while judging the second. Now every pending
//      `building.placeConfirm` footprint counts as blocked ground.
//
// The judge is INDEPENDENT of the code under test: `staticGridOf` rebuilds
// land passability from world components — terrain kind, building footprints,
// resource cells — and a 4-connected flood from the far side's fixed cell asks
// whether any cell beside owner 2's Town Center is still reachable. Never the
// guard, and never the pathfinder.
//
// WHAT A GREEN RUN HERE DOES NOT PROVE — the bound:
//  * ONE map size (60x36) and ONE corridor family: a vertical corridor north
//    of one Town Center, three lanes wide (far-open, no-open) or four lanes
//    with a one-cell choke (same-decision). Nothing here speaks for a real
//    map's generation, for the radius-7 Black Forest pocket, or for farms.
//  * ONE footprint under the guard per case: the 3x3 barracks or blacksmith,
//    plus the 1x1 watch tower in the same-decision case. A 2x2 or 4x4 shares
//    the ring helper and is not swept.
//  * The AI's OWN ring order. The anchors it picks — (20,1), (37,14), (34,8) —
//    are consequences of that order on this geometry, measured on 2026-09-08,
//    and are asserted only where the assertion is the rule (beyond radius 12).
//  * LAND only, and the AI's placement only: the human's clicks run the same
//    validator but not this search, and the walk-order half of the finding is
//    `walkOrderUnreachable.test.ts`.
//  * A fixed window: 400 ticks, thirteen standard-difficulty decisions, on a
//    seat that can afford exactly the buildings named. What the AI does with
//    an economy, and whether Black Forest stays open to tick 20,000, is
//    `scripts/mapConnectivity.mjs`.
//  * Owner 1 has no AI seat (`disableAiForOwners`, and the human slot gets
//    none anyway), so only owner 2 builds. The far-side scout is a sighting
//    and a flood origin; in the same-decision variant the Town Center shoots
//    it, so the flood starts from its FIXED starting cell, not the live unit.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { staticGridOf } from '../../src/game/playtest/walkDistanceProbe';
import {
  AI_PLACEMENT_SEARCH_RADIUS,
  AI_PLACEMENT_WIDER_SEARCH_RADIUS,
} from '../../src/game/simulation/bridge/placementSearch';
import {
  CORRIDOR_SEAL_FAR_UNIT,
  CORRIDOR_SEAL_SEEDS,
  CORRIDOR_SEAL_TOWN_CENTER,
  type CorridorSealVariant,
} from '../../src/game/simulation/fixtures/corridorSeal';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;
type Cell = { x: number; y: number };

const AI_OWNER = 2;
const WINDOW_TICKS = 400;

function boot(variant: CorridorSealVariant): Bridge {
  return createSimulationBridge(CORRIDOR_SEAL_SEEDS[variant], {
    disableAiForOwners: new Set([1]),
  });
}

/** The cells a land unit at `from` can reach, per the INDEPENDENT flood. */
function reachableFrom(bridge: Bridge, from: Cell): Uint8Array {
  const { width, height, blocked } = staticGridOf(bridge.world);
  const seen = new Uint8Array(width * height);
  const start = from.y * width + from.x;
  expect(blocked[start], `flood origin (${from.x},${from.y}) is not open ground`).toBe(0);
  const queue: number[] = [start];
  seen[start] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!;
    const x = index % width;
    const y = (index - x) / width;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (seen[next] || blocked[next]) continue;
      seen[next] = 1;
      queue.push(next);
    }
  }
  return seen;
}

/** Whether the far side still reaches a cell orthogonally beside owner 2's
 *  4x4 Town Center. */
function farSideReachesTownCenter(bridge: Bridge, variant: CorridorSealVariant): boolean {
  const { width, height } = bridge.world.grid;
  const seen = reachableFrom(bridge, CORRIDOR_SEAL_FAR_UNIT[variant]);
  const tc = CORRIDOR_SEAL_TOWN_CENTER;
  const ring: Cell[] = [];
  for (let x = tc.x; x < tc.x + 4; x += 1) ring.push({ x, y: tc.y - 1 }, { x, y: tc.y + 4 });
  for (let y = tc.y; y < tc.y + 4; y += 1) ring.push({ x: tc.x - 1, y }, { x: tc.x + 4, y });
  return ring.some((cell) => (
    cell.x >= 0 && cell.y >= 0 && cell.x < width && cell.y < height
    && seen[cell.y * width + cell.x] === 1
  ));
}

function aiBuildings(bridge: Bridge, buildingType: string) {
  return bridge.getEconomyState().buildings
    .filter((building) => building.owner === AI_OWNER && building.buildingType === buildingType);
}

const chebyshev = (a: Cell, b: Cell): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

describe('AI placement keeps the map connected', () => {
  it('the fixtures are the ones these bounds describe', () => {
    for (const variant of Object.keys(CORRIDOR_SEAL_SEEDS) as CorridorSealVariant[]) {
      const bridge = boot(variant);
      expect(bridge.getMapSize()).toEqual({ width: 60, height: 36 });
      const townCenter = aiBuildings(bridge, 'town-center')[0];
      expect(townCenter, `${variant}: owner 2 has no Town Center`).toBeDefined();
      expect({ x: townCenter!.x, y: townCenter!.y }).toEqual(CORRIDOR_SEAL_TOWN_CENTER);
      // Only owner 2 has an AI seat, so every building below is its doing.
      expect(bridge.getDebugSnapshot().aiSummaries.map((seat) => seat.owner)).toEqual([AI_OWNER]);
      // The corridor is open before anything is built — the control the
      // three cases below are measured against.
      expect(farSideReachesTownCenter(bridge, variant), `${variant}: sealed at tick 0`).toBe(true);
    }
  });

  it('builds past radius 12 rather than fill the only corridor within it', () => {
    const bridge = boot('far-open');
    expect(stepBridgeUntil(
      bridge,
      () => aiBuildings(bridge, 'barracks').length > 0,
      { maxSteps: WINDOW_TICKS },
    ), 'the AI never placed its barracks').toBe(true);
    const placedAt = bridge.getHudState().tick;
    for (let tick = placedAt; tick < WINDOW_TICKS; tick += 1) bridge.step(100);

    const barracks = aiBuildings(bridge, 'barracks');
    expect(barracks).toHaveLength(1);
    const distance = chebyshev(barracks[0]!, CORRIDOR_SEAL_TOWN_CENTER);
    expect(distance, `barracks at (${barracks[0]!.x},${barracks[0]!.y}) is inside the corridor's radius`)
      .toBeGreaterThan(AI_PLACEMENT_SEARCH_RADIUS);
    expect(distance).toBeLessThanOrEqual(AI_PLACEMENT_WIDER_SEARCH_RADIUS);
    expect(farSideReachesTownCenter(bridge, 'far-open')).toBe(true);
    // The corridor anchors were seen and REFUSED, not merely skipped as
    // blocked — otherwise this case would pass on a fixture with no corridor.
    expect(bridge.getDebugSnapshot().aiSitePlacement?.refusedByGuard ?? 0).toBeGreaterThan(0);
  });

  it('builds nothing at all when every site in reach would seal the map', () => {
    const bridge = boot('no-open');
    for (let tick = 0; tick < WINDOW_TICKS; tick += 1) bridge.step(100);

    expect(aiBuildings(bridge, 'barracks')).toEqual([]);
    // Nothing was charged for a site that was never founded.
    expect(bridge.getEconomyState().playerResources[AI_OWNER]?.wood).toBe(175);
    expect(farSideReachesTownCenter(bridge, 'no-open')).toBe(true);
    // The search RAN, at every decision, and came back empty by refusing —
    // "no barracks" from an AI that never looked would pass the lines above.
    const stats = bridge.getDebugSnapshot().aiSitePlacement;
    expect(stats?.nullSearches ?? 0).toBeGreaterThan(0);
    expect(stats?.refusedByGuard ?? 0).toBeGreaterThan(0);
  });

  it('a watch tower and a next build pushed in ONE decision cannot seal the map between them', () => {
    const bridge = boot('same-decision');
    let towerTick: number | null = null;
    let blacksmithTick: number | null = null;
    for (let tick = 1; tick <= WINDOW_TICKS; tick += 1) {
      bridge.step(100);
      if (towerTick === null && aiBuildings(bridge, 'watch-tower').length > 0) towerTick = tick;
      if (blacksmithTick === null && aiBuildings(bridge, 'blacksmith').length > 0) blacksmithTick = tick;
    }
    // Both were founded, on the SAME tick — one decision's two intentions,
    // whose handlers ran together the tick after. Without this the case could
    // pass on two separate decisions, which the standing world already covers.
    expect(towerTick, 'the AI never placed its watch tower').not.toBeNull();
    expect(blacksmithTick, 'the AI never placed its blacksmith').not.toBeNull();
    expect(blacksmithTick).toBe(towerTick);

    const tower = aiBuildings(bridge, 'watch-tower')[0]!;
    const blacksmith = aiBuildings(bridge, 'blacksmith')[0]!;
    expect(
      farSideReachesTownCenter(bridge, 'same-decision'),
      `tower at (${tower.x},${tower.y}) and blacksmith at (${blacksmith.x},${blacksmith.y}) sealed the corridor`,
    ).toBe(true);
  });
});
