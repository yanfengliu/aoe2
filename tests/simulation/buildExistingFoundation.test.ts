// Ordering a villager onto a foundation that ALREADY EXISTS — AoE2's way of
// rescuing an interrupted build and of adding builders to speed one up.
//
// The click under test is the one on the foundation's GROUND CELL, which the
// bridge routes through `unit.context` (`bridge.issueContextCommand`). That is
// the route the pointer falls back to whenever the entity hit test does not
// claim the click, and it is the route that had no build branch at all: the
// villager was handed a plain move to a cell its own foundation blocks, so it
// walked up to the site and stood there for the rest of the match. The by-id
// route (`unit.contextAtEntity`) is a different function and is covered by
// `multiVillagerConstruction.test.ts`.
//
// Every case asserts REAL PROGRESS — `buildProgressTicks` climbing to
// `totalBuildTicks` — never that a task was assigned. A task that is assigned
// and never runs is exactly what this defect looked like from the HUD:
// `issueContextCommand` returned true both before and after the fix.
//
// BOUND — what a green run here does NOT prove:
//   * Only the CELL route is exercised. Nothing here says which of the two
//     routes a given mouse pixel lands in; the entity hit test lives in
//     `src/input/` and is the browser suite's job.
//   * Three building types (house 2x2, mill 2x2, barracks 3x3) on the flat
//     all-grass `multi-villager-construction-fixture`, owner 1, AI disabled,
//     Dark Age, no build-rate technology and no Incas/Treadmill multiplier.
//     It does not cover terrain that blocks the approach, a foundation under
//     fog, an ALLY's foundation, or a non-villager actor.
//   * Progress is read from `getEconomyState()`, so it proves the simulation
//     advanced the site — not that the HUD or the renderer showed it.
//   * The multi-builder case asserts a RATIO between two runs of this fixture,
//     not an absolute tick count, so it cannot detect a uniform slowdown.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { BuildableBuildingType } from '../../src/game/simulation/types';

type Bridge = ReturnType<typeof createSimulationBridge>;

const FIXTURE = 'multi-villager-construction-fixture';
const OWNER = 1;
// Far corner of the all-grass fixture map, well clear of every anchor below.
const AWAY = { x: 2, y: 2 };

function villagerIds(bridge: Bridge): number[] {
  return bridge
    .getEconomyState()
    .units.filter((unit) => unit.owner === OWNER && unit.unitType === 'villager')
    .map((unit) => unit.id);
}

function buildingById(bridge: Bridge, id: number) {
  return bridge.getEconomyState().buildings.find((building) => building.id === id);
}

function unitById(bridge: Bridge, id: number) {
  return bridge.getEconomyState().units.find((unit) => unit.id === id);
}

function stepTicks(bridge: Bridge, ticks: number): void {
  for (let t = 0; t < ticks; t += 1) bridge.step(100);
}

/** Walks `unitId` to a cell and returns the ticks it took (-1 if it never got
 *  there). Uses the plain move command, never the context click under test. */
function walkTo(bridge: Bridge, unitId: number, x: number, y: number, maxTicks = 900): number {
  expect(bridge.selectUnitsByIds([unitId])).toBe(true);
  expect(bridge.issueMoveCommand(x, y)).toBe(true);
  for (let t = 1; t <= maxTicks; t += 1) {
    bridge.step(100);
    const unit = unitById(bridge, unitId);
    if (unit && unit.x === x && unit.y === y) return t;
  }
  return -1;
}

/** Places `buildingType` at `anchor` with the first villager, then walks that
 *  villager off the site — leaving the orphaned foundation a player finds when
 *  a build was interrupted. Returns the foundation's entity id. */
function orphanedFoundation(
  bridge: Bridge,
  buildingType: BuildableBuildingType,
  anchor: { x: number; y: number },
): number {
  const placer = villagerIds(bridge)[0]!;
  expect(bridge.selectUnitsByIds([placer])).toBe(true);
  expect(bridge.beginBuildingPlacement(buildingType)).toBe(true);
  expect(bridge.confirmBuildingPlacement(anchor.x, anchor.y)).toBe(true);
  bridge.step(100);

  const site = bridge
    .getEconomyState()
    .buildings.find(
      (building) =>
        building.owner === OWNER
        && building.buildingType === buildingType
        && building.x === anchor.x
        && building.y === anchor.y
        && !building.isComplete,
    );
  expect(site).toBeDefined();

  expect(walkTo(bridge, placer, AWAY.x, AWAY.y)).toBeGreaterThan(0);
  // Premise check (the instrument, not the claim): the site really is stalled
  // before the order under test, so any progress after it comes from that order.
  expect(buildingById(bridge, site!.id)!.buildProgressTicks).toBe(0);
  return site!.id;
}

/** Right-click the foundation's ground cell with `unitIds` selected. */
function orderOntoFoundationCell(
  bridge: Bridge,
  unitIds: readonly number[],
  cell: { x: number; y: number },
): void {
  expect(bridge.selectUnitsByIds([...unitIds])).toBe(true);
  expect(bridge.issueContextCommand(cell.x, cell.y)).toBe(true);
}

/** Ticks until the site completes, or -1 within the cap. A builder that DIES
 *  also reads as "no progress", and that is a broken FIXTURE rather than a
 *  broken route — player 2's Town Center shoots, and the anchors below stand
 *  clear of it — so say which one it is instead of timing out. */
function ticksToComplete(
  bridge: Bridge,
  buildingId: number,
  cap: number,
  builders: readonly number[] = [],
): number {
  for (let t = 1; t <= cap; t += 1) {
    bridge.step(100);
    for (const id of builders) {
      if (!unitById(bridge, id)) {
        throw new Error(`builder ${id} died at tick ${t}: fixture placement, not routing`);
      }
    }
    if (buildingById(bridge, buildingId)?.isComplete) return t;
  }
  return -1;
}

describe('ordering a villager onto an existing foundation', () => {
  // Two footprint sizes and three types: the cell clicked is a NON-ANCHOR cell
  // of the footprint for the barracks, which is what a player usually hits.
  const cases: Array<{
    buildingType: BuildableBuildingType;
    anchor: { x: number; y: number };
    click: { x: number; y: number };
    adjacent: { x: number; y: number };
  }> = [
    {
      buildingType: 'house',
      anchor: { x: 14, y: 8 },
      click: { x: 15, y: 9 },
      adjacent: { x: 13, y: 8 },
    },
    {
      buildingType: 'mill',
      anchor: { x: 14, y: 16 },
      click: { x: 14, y: 16 },
      adjacent: { x: 13, y: 16 },
    },
    {
      buildingType: 'barracks',
      anchor: { x: 18, y: 24 },
      click: { x: 19, y: 25 },
      adjacent: { x: 17, y: 24 },
    },
  ];

  it.each(cases)(
    'a villager standing next to an orphaned $buildingType foundation builds it out',
    ({ buildingType, anchor, click, adjacent }) => {
      const bridge = createSimulationBridge(FIXTURE);
      const siteId = orphanedFoundation(bridge, buildingType, anchor);
      const helper = villagerIds(bridge)[1]!;

      expect(walkTo(bridge, helper, adjacent.x, adjacent.y)).toBeGreaterThan(0);
      const stalled = buildingById(bridge, siteId)!.buildProgressTicks;

      orderOntoFoundationCell(bridge, [helper], click);

      // A short window first: an adjacent villager needs no walk, so progress
      // must start almost immediately. This is the half the plain move could
      // never satisfy — it produced no path at all and the villager idled.
      stepTicks(bridge, 20);
      expect(buildingById(bridge, siteId)!.buildProgressTicks).toBeGreaterThan(stalled);

      const total = buildingById(bridge, siteId)!.totalBuildTicks;
      expect(ticksToComplete(bridge, siteId, total + 200, [helper])).toBeGreaterThan(0);
      expect(buildingById(bridge, siteId)!.buildProgressTicks).toBeGreaterThanOrEqual(total);
    },
  );

  it('a villager ordered from across the map walks to the foundation and finishes it', () => {
    const bridge = createSimulationBridge(FIXTURE);
    const siteId = orphanedFoundation(bridge, 'mill', { x: 14, y: 16 });
    const helper = villagerIds(bridge)[2]!;

    // Put the helper in the opposite corner so the order is a long walk, not
    // an in-place start — the case a move-only route appears to handle,
    // because the villager does walk, and then never builds.
    expect(walkTo(bridge, helper, 32, 28)).toBeGreaterThan(0);
    expect(buildingById(bridge, siteId)!.buildProgressTicks).toBe(0);

    orderOntoFoundationCell(bridge, [helper], { x: 15, y: 17 });

    const total = buildingById(bridge, siteId)!.totalBuildTicks;
    expect(ticksToComplete(bridge, siteId, total + 900, [helper])).toBeGreaterThan(0);

    const arrived = unitById(bridge, helper)!;
    // It got there under its own steam rather than being teleported onto the
    // site: it stands OUTSIDE the 2x2 footprint, adjacent to it.
    const insideFootprint = arrived.x >= 14 && arrived.x <= 15 && arrived.y >= 16 && arrived.y <= 17;
    expect(insideFootprint).toBe(false);
  });

  it('a second villager ordered onto a half-built foundation finishes it sooner', () => {
    // Two runs of one fixture. Both start the SAME way — one builder ordered
    // onto the foundation's cell — and the second run adds three more builders
    // through the same cell click. AoE2's crew curve is 3*base/(n+2), so four
    // builders finish the remainder at twice one builder's rate.
    // The barracks is 3x3 at (18,24); these are free cells against its west and
    // north edges. Both arms park every villager here first, so the two runs
    // differ ONLY by whether the crew is ordered onto the site — never by how
    // far anyone had to walk.
    const standings = [
      { x: 17, y: 24 },
      { x: 17, y: 25 },
      { x: 17, y: 26 },
      { x: 18, y: 23 },
    ];

    function run(extraBuilders: number): number {
      const bridge = createSimulationBridge(FIXTURE);
      const siteId = orphanedFoundation(bridge, 'barracks', { x: 18, y: 24 });
      const ids = villagerIds(bridge);
      const first = ids[1]!;

      for (let i = 0; i < standings.length; i += 1) {
        const cell = standings[i]!;
        expect(walkTo(bridge, ids[i + 1]!, cell.x, cell.y)).toBeGreaterThan(0);
      }
      orderOntoFoundationCell(bridge, [first], { x: 19, y: 25 });
      stepTicks(bridge, 60);
      // Premise: the FIRST builder is already working before the crew joins,
      // so the comparison is about the joiners and not about the first order.
      expect(buildingById(bridge, siteId)!.buildProgressTicks).toBeGreaterThan(0);

      if (extraBuilders > 0) {
        const joiners = ids.slice(2, 2 + extraBuilders);
        expect(joiners).toHaveLength(extraBuilders);
        orderOntoFoundationCell(bridge, joiners, { x: 19, y: 25 });
      }

      const total = buildingById(bridge, siteId)!.totalBuildTicks;
      const ticks = ticksToComplete(bridge, siteId, total + 400, [first]);
      expect(ticks).toBeGreaterThan(0);
      return ticks;
    }

    const alone = run(0);
    const crew = run(3);
    expect(crew).toBeLessThan(alone);
    // Materially faster, not a rounding difference: a crew of four builds the
    // remaining work at 2x one villager's rate, and the joiners walk one cell.
    expect(crew).toBeLessThan(alone * 0.75);
  });
});
