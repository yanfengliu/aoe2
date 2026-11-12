// Who the computer may send to a building site, and that the walk decides
// among them (work 152 M1d, spec §13.2).
//
// `findAvailableVillagerForBuild` returned the first villager in entity order
// that held no command, wherever it stood. Given the site, it now hands the
// villagers that pass that same test to the walk (`siteBuilderWalk.ts`) and
// sends the one the walk names. Two things are held here.
//
// WHO IS AVAILABLE did not change: a villager with no command first; one on
// another errand only when none is free; never one that is building, and never
// one already sent to a site in this decision.
//
// A RESOURCE'S LAST GATHERER IS PASSED OVER while another available villager
// can be sent (this game's own policy, the coordinator's of 2026-11-11). The
// walk alone sent the lobby match's first barracks to owner 1's only wood
// villager, a cell nearer than a food villager, and the seat sat housed for
// 94 s for want of a House's 25 wood (plan 152). "The last" is counted as the
// rebalance counts a seat's gatherers: every villager with a gatherer's role,
// by the resource the role names, whatever the villager is doing, so a
// villager away building still holds its place. When every available villager
// is the last on its resource, or the walk reaches none of the others, the
// nearest of them all goes.
//
// BOUND: the helper against a hand-built world and a stand-in for the walk.
// The walk itself is `siteBuilderWalk.test.ts`; that the two phases pass the
// site, on a real map, is `aiBuilderWalk.test.ts`.

import { describe, expect, it } from 'vitest';

import { createOwnerProducerHelpers } from '../../src/game/simulation/bridge/systems/aiSystemGating';
import type { BuildSite } from '../../src/game/simulation/bridge/siteBuilderWalk';
import type { UnitCommand } from '../../src/game/simulation/bridge/sharedTypes';

const OWNER = 2;
const SITE: BuildSite = { x: 10, y: 10, width: 2, height: 2, toBePlaced: true };

interface StubUnit { id: number; owner?: number; unitType?: string; on?: 'food' | 'wood' | 'gold' | 'stone' }

function stubWorld(units: StubUnit[]) {
  const byId = new Map(units.map((unit) => [unit.id, { owner: OWNER, unitType: 'villager', on: 'food', ...unit }]));
  return {
    query: (component: string) => (component === 'unit' ? byId.keys() : [].values()),
    getComponent: (id: number, component: string) => {
      const unit = byId.get(id);
      if (!unit) return undefined;
      if (component === 'unit') return unit;
      return component === 'gatherer' && unit.unitType === 'villager' ? { desiredResource: unit.on } : undefined;
    },
  } as never;
}
const accessorStub = { get: () => new Map() } as never;
const command = (type: string) => ({ type }) as UnitCommand;

function helpers(units: StubUnit[], commands: Array<[number, string]>, pick: (candidates: readonly number[]) => number | null) {
  const asked: number[][] = [];
  const made = createOwnerProducerHelpers(
    stubWorld(units),
    accessorStub,
    OWNER,
    new Map(commands.map(([id, type]) => [id, command(type)])),
    new Map(),
    new Map(),
    (candidates, site) => {
      expect(site).toBe(SITE);
      asked.push([...candidates]);
      return pick(candidates);
    },
  );
  return { ...made, asked };
}
/** A stand-in walk: the nearest is the highest id offered. */
const highest = (candidates: readonly number[]): number => Math.max(...candidates);

describe('who the computer may send to a site (work 152 M1d)', () => {
  it('is the one the walk names among every villager that holds no command, offered in entity order', () => {
    const { findAvailableVillagerForBuild, asked } = helpers(
      [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4, unitType: 'militia' }, { id: 5, owner: 1 }, { id: 6 }],
      [[2, 'move']],
      highest,
    );
    expect(findAvailableVillagerForBuild(OWNER, SITE)).toBe(6);
    expect(asked).toEqual([[1, 3, 6]]);
  });

  it('is one on another errand only when none is free, and never one that is building', () => {
    const { findAvailableVillagerForBuild, asked } = helpers(
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      [[1, 'build'], [2, 'move'], [3, 'garrison']],
      highest,
    );
    expect(findAvailableVillagerForBuild(OWNER, SITE)).toBe(3);
    expect(asked).toEqual([[2, 3]]);
    // With free villagers the busy ones are not offered at all.
    const free = helpers([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], [[1, 'build'], [2, 'move']], highest);
    expect(free.findAvailableVillagerForBuild(OWNER, SITE)).toBe(4);
    expect(free.asked).toEqual([[3, 4]]);
    // Every villager is building: nobody is sent.
    const building = helpers([{ id: 1 }, { id: 2 }], [[1, 'build'], [2, 'build']], highest);
    expect(building.findAvailableVillagerForBuild(OWNER, SITE)).toBeNull();
    expect(building.asked).toEqual([]);
  });

  it('is never one already sent to a site in this decision', () => {
    const { findAvailableVillagerForBuild, claimedVillagers, asked } = helpers([{ id: 1 }, { id: 2 }, { id: 3 }], [], highest);
    claimedVillagers.add(3);
    expect(findAvailableVillagerForBuild(OWNER, SITE)).toBe(2);
    expect(asked).toEqual([[1, 2]]);
  });

  it('is the only available villager when there is one, whatever its walk', () => {
    const { findAvailableVillagerForBuild, asked } = helpers([{ id: 1 }, { id: 2 }], [[1, 'build']], () => null);
    expect(findAvailableVillagerForBuild(OWNER, SITE)).toBe(2);
    expect(asked, 'nobody to choose between: the walk is not asked').toEqual([]);
  });

  it('is the first in entity order when the walk reaches none of them', () => {
    const { findAvailableVillagerForBuild, asked } = helpers([{ id: 4 }, { id: 7 }, { id: 9 }], [], () => null);
    expect(findAvailableVillagerForBuild(OWNER, SITE)).toBe(4);
    expect(asked).toEqual([[4, 7, 9]]);
  });

  it('is the first in entity order when no site is named: the site search asks before there is one', () => {
    const { findAvailableVillagerForBuild, asked } = helpers([{ id: 4 }, { id: 7 }], [], highest);
    expect(findAvailableVillagerForBuild(OWNER)).toBe(4);
    expect(asked).toEqual([]);
  });
});

describe('a resource\'s last gatherer is passed over while another can be sent (work 152 M1d)', () => {
  it('passes over the only villager the seat has on a resource', () => {
    // Two on food, one on wood. The walk would name the wood villager.
    const { findAvailableVillagerForBuild, asked } = helpers([{ id: 1 }, { id: 2 }, { id: 3, on: 'wood' }], [], highest);
    expect(findAvailableVillagerForBuild(OWNER, SITE)).toBe(2);
    expect(asked, 'the walk is asked of the others only').toEqual([[1, 2]]);
  });

  it('counts a villager away building as still on its resource, as the rebalance does', () => {
    // The lobby match at 0:03: one food villager is building the first House,
    // the other is free, and so is the seat's one wood villager.
    const { findAvailableVillagerForBuild, asked } = helpers(
      [{ id: 1 }, { id: 2 }, { id: 3, on: 'wood' }],
      [[1, 'build']],
      highest,
    );
    expect(findAvailableVillagerForBuild(OWNER, SITE)).toBe(2);
    expect(asked).toEqual([[2]]);
  });

  it('counts only the seat\'s own villagers', () => {
    // Another seat's wood villager and a soldier do not give the seat's a companion.
    const { findAvailableVillagerForBuild, asked } = helpers(
      [{ id: 1 }, { id: 2 }, { id: 3, on: 'wood' }, { id: 4, on: 'wood', owner: 1 }, { id: 5, on: 'wood', unitType: 'militia' }],
      [],
      highest,
    );
    expect(findAvailableVillagerForBuild(OWNER, SITE)).toBe(2);
    expect(asked).toEqual([[1, 2]]);
  });

  it('takes the last gatherer when the walk reaches none of the others', () => {
    const reachesOnlyTheThird = (candidates: readonly number[]): number | null => (candidates.includes(3) ? 3 : null);
    const { findAvailableVillagerForBuild, asked } = helpers([{ id: 1 }, { id: 2 }, { id: 3, on: 'wood' }], [], reachesOnlyTheThird);
    expect(findAvailableVillagerForBuild(OWNER, SITE)).toBe(3);
    expect(asked).toEqual([[1, 2], [1, 2, 3]]);
  });

  it('stops passing over when every available villager is the last on its resource', () => {
    const { findAvailableVillagerForBuild, asked } = helpers(
      [{ id: 1, on: 'food' }, { id: 2, on: 'wood' }, { id: 3, on: 'gold' }],
      [],
      highest,
    );
    expect(findAvailableVillagerForBuild(OWNER, SITE)).toBe(3);
    expect(asked, 'one ask, of them all').toEqual([[1, 2, 3]]);
    // And when the only ones that are not the last are not available: the two
    // food villagers are building, and the free villagers on wood and stone
    // are each the last on theirs.
    const mixed = helpers(
      [{ id: 1 }, { id: 2, on: 'wood' }, { id: 3, on: 'stone' }, { id: 4 }],
      [[1, 'build'], [4, 'build']],
      highest,
    );
    expect(mixed.findAvailableVillagerForBuild(OWNER, SITE)).toBe(3);
    expect(mixed.asked).toEqual([[2, 3]]);
  });

  it('passes nobody over when no resource is down to one villager', () => {
    const { findAvailableVillagerForBuild, asked } = helpers(
      [{ id: 1 }, { id: 2 }, { id: 3, on: 'wood' }, { id: 4, on: 'wood' }],
      [],
      highest,
    );
    expect(findAvailableVillagerForBuild(OWNER, SITE)).toBe(4);
    expect(asked).toEqual([[1, 2, 3, 4]]);
  });
});
