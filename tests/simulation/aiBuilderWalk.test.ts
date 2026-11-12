// The computer sends to a building site the available villager with the
// shortest walk to it, ties by entity order, and passes over a resource's last
// gatherer while another can be sent (work 152 M1d, spec §13.2).
//
// What happened. `findAvailableVillagerForBuild` returned the first villager
// in entity order that held no command, wherever it stood and before the site
// was known, and both phases that send builders used it: the build order's
// placements and the crews that reinforce a site or take up one nobody is
// building. In the lobby's default all-AI match a House at (46,24) went to a
// woodcutter 6 cells away in a straight line and 56 by foot, while six
// villagers stood on the site's own approach cell; work started 69 s after the
// House was placed (plan 152, "The House builder's long way round, traced").
// Played from the start on main 2d8824a6, 21 of that match's 24 placements in
// its first 15 minutes passed over a villager with a shorter walk, by 267 cells
// in all and 49 at the most.
//
// The fixture (`aiBuilderWalk.ts`) is that defect at its plainest: the first
// villager in entity order two cells from the site in a straight line behind a
// wall and 46 cells by foot, two more a step or two away. Each seed sends one
// of the phase's paths down it: the build order's next building, a crew for a
// site nobody is building, the Watch Tower a sighting asks for, a nomad's Town
// Center, and a Wonder with the crew that follows it.
//
// The last-gatherer seed is the walk's own cost. The walk alone sent the lobby
// match's first barracks to owner 1's only wood villager, one cell nearer than
// a food villager: it walked and built for 80 s, the seat banked no wood from
// 0:10 to 2:35 and sat housed for 94 s (plan 152). So a villager who is the
// only one its seat has on a resource is passed over while another can be
// sent: here the seat's one wood villager stands a step from the site and a
// food villager three steps from it, and the food villager goes.
//
// WHAT GOES RED, with each defect put back (plan 152 has the runs):
//   main 2d8824a6                           every case but the last-gatherer one names the walled-off villager; work starts at tick 559
//   no walk handed to the helpers (main)    those cases                                         RED
//   the next building keeps its first       the next-building case                              RED
//   the tower keeps its first               the tower case                                      RED
//   the nomad Town Center keeps its first   the nomad case                                      RED
//   the Wonder keeps its first              the Wonder case                                     RED
//   the crew phase asks without the site    the crew case, and the Wonder's crew                RED
//   the nearest by straight line sent       the next-building, crew and nomad cases             RED
//   a tie broken by the higher id           the next-building and crew cases                    RED
//   a resource's last gatherer taken        the last-gatherer case (the wood villager goes)     RED
//
// BOUND: one layout, villagers that hold no command, a Standard seat. The
// nomad opening's Lumber Camp is placed beside the first villager and has no
// case that tells the rules apart. A seat whose every available villager is
// the last on its resource is `aiBuilderNearestWalk.test.ts`'s: this AI's own
// rebalance leaves no such seat at a first decision. Every placement and crew
// order of whole matches is the class case in `aiEconomySelfPlay.test.ts` and
// `selfPlayContentCoverage.test.ts`; the walk itself is
// `siteBuilderWalk.test.ts`. Nothing here says where a site is put: the sites
// below are where the search puts them today, read off the game and asserted
// only so a moved site fails by name instead of by a wrong villager.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  BUILDER_WALK_LAST_GATHERER,
  BUILDER_WALK_SEEDS,
  BUILDER_WALK_SITE,
  BUILDER_WALK_VILLAGERS,
  type BuilderWalkVariant,
} from '../../src/game/simulation/fixtures/aiBuilderWalk';
import { betterBuilders, describeOrder, observeBuilderOrders, passabilityGrid, walkToSite } from './builderWalkProbe';

type Bridge = ReturnType<typeof createSimulationBridge>;

const AI_OWNER = 2;
const SITE = { ...BUILDER_WALK_SITE, width: 3, height: 3 };
/** The seat decides on its first tick; its second decision is 30 ticks on. */
const FIRST_DECISION_TICKS = 5;
const SECOND_DECISION_TICKS = 35;
/** A walk of a few cells is about 12 ticks a cell, and the order lands the
 *  tick after the decision. The walled-off villager's 46 cells take about 560. */
const WORK_STARTS_BY_TICK = 120;

function boot(variant: BuilderWalkVariant) {
  const bridge = createSimulationBridge(BUILDER_WALK_SEEDS[variant], {
    disableAiForOwners: new Set([1]),
    renderProjection: 'on-read',
  });
  const villagers = bridge.getEconomyState().units
    .filter((unit) => unit.owner === AI_OWNER && unit.unitType === 'villager')
    .sort((a, b) => a.id - b.id);
  return { bridge, villagers, orders: observeBuilderOrders(bridge) };
}

/** Steps the seat's first decision and returns the one builder order it made. */
function firstOrder(variant: BuilderWalkVariant) {
  const { bridge, villagers, orders } = boot(variant);
  for (let tick = 0; tick < FIRST_DECISION_TICKS; tick += 1) bridge.step(100);
  expect(orders.map(describeOrder), `${variant}: the seat's first decision makes exactly one builder order`).toHaveLength(1);
  return { bridge, villagers, orders, order: orders[0]! };
}

/** The tick the building's construction first shows progress, or null. */
function tickWorkStarts(bridge: Bridge, buildingType: string, withinTicks: number): number | null {
  const progress = () => bridge.getEconomyState().buildings
    .find((building) => building.owner === AI_OWNER && building.buildingType === buildingType)?.buildProgressTicks ?? 0;
  for (let tick = bridge.world.tick; tick < withinTicks; tick += 1) {
    bridge.step(100);
    if (progress() > 0) return bridge.world.tick;
  }
  return null;
}

describe('the villager the computer sends to a building site (work 152 M1d)', () => {
  it('the fixtures are the ones these cases describe', () => {
    for (const variant of Object.keys(BUILDER_WALK_SEEDS) as BuilderWalkVariant[]) {
      const { bridge, villagers } = boot(variant);
      expect(bridge.getDebugSnapshot().aiSummaries.map((seat) => seat.owner)).toEqual([AI_OWNER]);
      // Entity order: the walled-off villager first, then the two near the site.
      const near = variant === 'lastGatherer'
        ? [BUILDER_WALK_LAST_GATHERER.onFood, BUILDER_WALK_LAST_GATHERER.onlyOneOnWood]
        : [BUILDER_WALK_VILLAGERS.beside, BUILDER_WALK_VILLAGERS.besideToo];
      expect(villagers.slice(0, 3).map((villager) => ({ x: villager.x, y: villager.y })))
        .toEqual([BUILDER_WALK_VILLAGERS.walledOff, ...near]);
      expect(villagers, `${variant}: villagers`).toHaveLength(variant === 'wonder' ? 40 : 3);
      expect(bridge.getDebugSnapshot().unitPaths, `${variant}: nobody holds a command`).toEqual([]);
      if (variant !== 'placement' && variant !== 'crew' && variant !== 'lastGatherer') continue;
      const grid = passabilityGrid(bridge, villagers[0]!.id);
      expect(villagers.map((villager) => walkToSite(grid, villager, SITE)), `${variant}: each villager's walk to the site`)
        .toEqual(variant === 'lastGatherer' ? [46, 3, 1] : [46, 2, 2]);
      // In a straight line the walled-off villager is as near as any, and
      // nearer than both where the other two stand two steps off.
      const straight = villagers.map((villager) => Math.max(
        Math.max(SITE.x - villager.x, 0, villager.x - (SITE.x + SITE.width - 1)),
        Math.max(SITE.y - villager.y, 0, villager.y - (SITE.y + SITE.height - 1)),
      ));
      expect(straight).toEqual(variant === 'lastGatherer' ? [2, 4, 2] : [2, 3, 3]);
    }
  });

  // One decision, one placement: the building, where the site search puts it
  // today, and the walk of the villager beside it.
  const placements: Array<{ variant: BuilderWalkVariant; path: string; buildingType: string; site: typeof SITE; walk: number }> = [
    { variant: 'placement', path: 'the build order\'s next building', buildingType: 'barracks', site: SITE, walk: 2 },
    { variant: 'tower', path: 'the Watch Tower a sighting asks for', buildingType: 'watch-tower', site: { x: 38, y: 13, width: 1, height: 1 }, walk: 0 },
    { variant: 'nomad', path: 'a nomad seat\'s Town Center', buildingType: 'town-center', site: { x: 34, y: 13, width: 4, height: 4 }, walk: 1 },
    { variant: 'wonder', path: 'a Wonder', buildingType: 'wonder', site: { x: 34, y: 11, width: 4, height: 4 }, walk: 1 },
  ];
  for (const { variant, path, buildingType, site, walk } of placements) {
    it(`names the villager beside the site as the builder of ${path}, not the first in entity order`, () => {
      const { bridge, villagers, order } = firstOrder(variant);
      const [walledOff, beside] = villagers;
      expect({ kind: order.kind, buildingType: order.buildingType, site: order.site, refusal: order.refusal })
        .toEqual({ kind: 'placement', buildingType, site, refusal: null });
      // The game would have taken the walled-off villager too: it had the long walk.
      const walledOffWalk = order.others.find((other) => other.id === walledOff!.id)?.walk;
      expect(walledOffWalk, 'the walled-off villager\'s walk to the site').toBeGreaterThanOrEqual(40);
      expect(order.builderId, describeOrder(order)).toBe(beside!.id);
      expect(order.builderWalk).toBe(walk);
      expect(order.builderLastOnItsResource, 'the builder is not its seat\'s last villager on a resource').toBe(false);
      expect(betterBuilders(order), describeOrder(order)).toEqual([]);
      // And the building goes up: the order is accepted, and work starts in
      // the time a short walk takes.
      expect(tickWorkStarts(bridge, buildingType, WORK_STARTS_BY_TICK), `work on the ${buildingType} had not started by tick ${String(WORK_STARTS_BY_TICK)}`)
        .not.toBeNull();
    });
  }

  it('sends the villager beside a site nobody is building to crew it, not the first in entity order', () => {
    const { bridge, villagers, order } = firstOrder('crew');
    const [walledOff, beside, besideToo] = villagers;
    expect({ kind: order.kind, buildingType: order.buildingType, site: order.site })
      .toEqual({ kind: 'crew', buildingType: 'barracks', site: SITE });
    expect(order.others.map((other) => other.id).concat(order.builderId).sort((a, b) => a - b))
      .toEqual([walledOff!.id, beside!.id, besideToo!.id]);
    expect(order.builderId, describeOrder(order)).toBe(beside!.id);
    expect(betterBuilders(order), describeOrder(order)).toEqual([]);
    expect(tickWorkStarts(bridge, 'barracks', WORK_STARTS_BY_TICK), `work on the barracks had not started by tick ${String(WORK_STARTS_BY_TICK)}`)
      .not.toBeNull();
    expect(bridge.getDebugSnapshot().unitPaths.map((entry) => ({ id: entry.id, commandType: entry.commandType })))
      .toEqual([{ id: beside!.id, commandType: 'build' }]);
  });

  it('passes over the seat\'s only wood villager, a step from the site, for a food villager three steps from it', () => {
    const { bridge, villagers, order } = firstOrder('lastGatherer');
    const [walledOff, onFood, onlyOneOnWood] = villagers;
    expect({ kind: order.kind, buildingType: order.buildingType, site: order.site, refusal: order.refusal })
      .toEqual({ kind: 'placement', buildingType: 'barracks', site: SITE, refusal: null });
    // The fixture's premise, read at the decision: who is the last on a
    // resource, and who had which walk.
    const others = new Map(order.others.map((other) => [other.id, other]));
    expect(others.get(onlyOneOnWood!.id), 'the wood villager: the nearest, and the last on wood')
      .toEqual({ id: onlyOneOnWood!.id, walk: 1, lastOnItsResource: true });
    expect(others.get(walledOff!.id)).toEqual({ id: walledOff!.id, walk: 46, lastOnItsResource: false });
    expect(order.builderId, describeOrder(order)).toBe(onFood!.id);
    expect({ walk: order.builderWalk, last: order.builderLastOnItsResource }).toEqual({ walk: 3, last: false });
    expect(betterBuilders(order), describeOrder(order)).toEqual([]);
    expect(tickWorkStarts(bridge, 'barracks', WORK_STARTS_BY_TICK), `work on the barracks had not started by tick ${String(WORK_STARTS_BY_TICK)}`)
      .not.toBeNull();
    // The wood villager is still on wood: nothing took it.
    expect(bridge.getDebugSnapshot().unitPaths.map((entry) => ({ id: entry.id, commandType: entry.commandType })))
      .toEqual([{ id: onFood!.id, commandType: 'build' }]);
  });

  it('crews a Wonder with the nearest villagers it may take, in the order of their walks, the walled-off one left at work', () => {
    const { bridge, villagers, orders } = firstOrder('wonder');
    const [walledOff] = villagers;
    for (let tick = bridge.world.tick; tick < SECOND_DECISION_TICKS; tick += 1) bridge.step(100);
    const crew = orders.filter((order) => order.kind === 'crew');
    // Nine tenths of 40 villagers may build a Wonder: its builder and 35 more.
    expect(crew, 'crew orders at the second decision').toHaveLength(35);
    expect(crew.every((order) => order.buildingType === 'wonder')).toBe(true);
    expect(crew.filter((order) => betterBuilders(order).length > 0 || !order.builderAvailable).map(describeOrder)).toEqual([]);
    // Those not the last on a resource go nearest first; a resource's last
    // gatherer goes only once nobody else is left to send.
    const spared = crew.filter((order) => !order.builderLastOnItsResource).map((order) => order.builderWalk);
    expect(spared, 'each crew member no nearer than the one before').toEqual([...spared].sort((a, b) => a - b));
    expect(spared[0], 'the first crew member\'s walk').toBeLessThanOrEqual(15);
    expect(crew.map((order) => order.builderId), 'the villager with the 46-cell walk stays at work').not.toContain(walledOff!.id);
  });
});
