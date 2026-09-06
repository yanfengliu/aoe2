// A foundation the AI has paid for gets finished (2026-09-06).
//
// `playerCommandsSystem` drops a build command the first tick
// `findBuildingApproachPlan` comes back null, and `runBuildCrewPhase` read its
// site list from the LIVE build commands — so a site whose last builder was
// dropped became invisible to the AI forever. Nothing re-crewed it, and
// `findOwnedBuilding` kept finding it, so `missing(type)` in the build order
// read false for the rest of the match and the AI never ordered that building
// again.
//
// Measured in the coverage lab (`selfPlayContentCoverage.test.ts`) on
// 2026-09-06: owner 2's Siege Workshop foundation froze at 125/400 progress on
// tick 13,750 and stood there to the 45,000-tick horizon, so that seat trained
// no Battering Ram and no Mangonel and researched neither siege technology;
// owner 1 held three dead farm plots at 0/150, counted them among the farms it
// owned, and kept its food near zero for the whole Castle Age.
//
// BOUND: this is the phase's contract, exercised against a hand-built world,
// so it pins WHICH sites the phase adopts and nothing about the rest of the
// match. The end-to-end claim — the lab reaches its rams and its siege
// technologies — is `selfPlayContentCoverage.test.ts`, which is where the
// number above came from.

import { describe, expect, it } from 'vitest';

import { runBuildCrewPhase } from '../../src/game/simulation/bridge/systems/aiBuildCrewPhase';
import type {
  AiOwnerContext,
  AiSystemDeps,
} from '../../src/game/simulation/bridge/systems/aiSystemTypes';
import { constructionStatesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';

const OWNER = 2;

interface Site {
  id: number;
  owner: number;
  buildingType: string;
  progressTicks: number;
  totalBuildTicks: number;
  isComplete: boolean;
}

interface Harness {
  commits: Array<{ villagerId: number; siteId: number }>;
  reachAsks: Array<{ villagerId: number; siteId: number }>;
}

function run(
  sites: Site[],
  villagerCount: number,
  opts: {
    /** Sites no villager can walk to — the phase must not spend a villager. */
    unreachable?: Set<number>;
    /** Sites that already have a builder on them, id -> builder count. */
    crewed?: Map<number, number>;
  } = {},
): Harness {
  const harness: Harness = { commits: [], reachAsks: [] };
  const constructionStates = new Map(
    sites.map((s) => [
      s.id,
      {
        isComplete: s.isComplete,
        buildProgressTicks: s.progressTicks,
        totalBuildTicks: s.totalBuildTicks,
        width: 1,
        height: 1,
      },
    ]),
  );
  const byId = new Map(sites.map((s) => [s.id, s]));
  // Villager ids start above every site id so the two never collide.
  const firstVillagerId = 1000;
  let nextVillager = firstVillagerId;
  const claimedVillagers = new Set<number>();

  const activeWorld = {
    getComponent: (id: number, kind: string) => {
      if (kind === 'building') {
        const site = byId.get(id);
        return site ? { owner: site.owner, buildingType: site.buildingType } : null;
      }
      if (kind === 'position') return id >= firstVillagerId ? { x: 1, y: 1 } : null;
      return null;
    },
    query: () => [] as number[],
  };

  const unitCommands = new Map<number, { type: string; buildingRef: unknown }>();
  let crewVillager = firstVillagerId + 500;
  for (const [siteId, count] of opts.crewed ?? new Map<number, number>()) {
    for (let i = 0; i < count; i += 1) {
      unitCommands.set(crewVillager, { type: 'build', buildingRef: { id: siteId } });
      crewVillager += 1;
    }
  }

  const deps = {
    accessor: {
      get: (codec: unknown) => {
        if (codec === constructionStatesCodec) return constructionStates;
        throw new Error('unexpected codec read in the build-crew phase');
      },
    },
    currentEntityId: (_world: unknown, ref: { id: number } | null | undefined) => ref?.id ?? null,
    countOwnedUnits: () => villagerCount,
    pushUnitContextAtEntityIntention: (villagerId: number, siteId: number) => {
      harness.commits.push({ villagerId, siteId });
    },
    findBuildingApproachPlan: (villagerId: number, siteId: number) => {
      harness.reachAsks.push({ villagerId, siteId });
      if (opts.unreachable?.has(siteId)) return null;
      return { destination: { x: 1, y: 1 }, nextStep: { x: 1, y: 1 }, path: [] };
    },
  } as unknown as AiSystemDeps;

  const ctx = {
    activeWorld,
    owner: OWNER,
    unitCommands,
    claimedVillagers,
    findAvailableVillagerForBuild: () => {
      while (claimedVillagers.has(nextVillager)) nextVillager += 1;
      return nextVillager >= firstVillagerId + 400 ? null : nextVillager;
    },
  } as unknown as AiOwnerContext;

  runBuildCrewPhase(deps, ctx);
  return harness;
}

const site = (over: Partial<Site> & { id: number }): Site => ({
  owner: OWNER,
  buildingType: 'siege-workshop',
  progressTicks: 125,
  totalBuildTicks: 400,
  isComplete: false,
  ...over,
});

describe('AI build crews — a foundation nobody is building', () => {
  it('puts a builder back on a site whose crew was dropped', () => {
    const harness = run([site({ id: 7 })], 20);
    expect(
      harness.commits.map((c) => c.siteId),
      'the orphaned Siege Workshop got no builder — the site the AI already paid for stays at 125/400 forever',
    ).toContain(7);
  });

  it('leaves a completed building alone', () => {
    const harness = run(
      [site({ id: 7, isComplete: true, progressTicks: 400 })],
      20,
    );
    expect(harness.commits, 'a finished building was crewed').toEqual([]);
  });

  it('spends no villager on a site none of them can walk to', () => {
    // A villager sent to a site it cannot reach has its command cleared the
    // next tick and comes straight back, which is a permanent bounce rather
    // than a build. The phase asks the mover's own question first.
    const harness = run([site({ id: 7 })], 20, { unreachable: new Set([7]) });
    expect(harness.reachAsks.length, 'the phase never asked whether the site was reachable')
      .toBeGreaterThan(0);
    expect(harness.commits, 'a villager was spent on an unreachable site').toEqual([]);
  });

  it('still reinforces a site that already has a builder, without re-asking the path', () => {
    // A site with a live builder is known reachable, so the reinforcement path
    // must not pay for an A* per villager it adds — a Wonder crew is dozens.
    const harness = run(
      [site({ id: 9, buildingType: 'town-center', progressTicks: 0, totalBuildTicks: 1500 })],
      20,
      { crewed: new Map([[9, 1]]) },
    );
    expect(harness.commits.length, 'the Town Center got no reinforcement').toBeGreaterThan(0);
    expect(harness.reachAsks, 'reinforcing a crewed site paid for a path search').toEqual([]);
  });

  it('adopts an orphan and reinforces a crewed site in the same pass', () => {
    const harness = run(
      [
        site({ id: 7 }),
        site({ id: 9, buildingType: 'town-center', progressTicks: 0, totalBuildTicks: 1500 }),
      ],
      20,
      { crewed: new Map([[9, 1]]) },
    );
    const adopted = harness.commits.filter((c) => c.siteId === 7).length;
    const reinforced = harness.commits.filter((c) => c.siteId === 9).length;
    expect(adopted, 'the orphan was skipped when a crewed site was also open').toBe(1);
    expect(reinforced, 'the crewed site lost its reinforcement to the orphan')
      .toBeGreaterThan(0);
  });

  it('ignores another owner\'s foundation', () => {
    const harness = run([site({ id: 7, owner: OWNER + 1 })], 20);
    expect(harness.commits, 'the AI crewed a building it does not own').toEqual([]);
  });
});
