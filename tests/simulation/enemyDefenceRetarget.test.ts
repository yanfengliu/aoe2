// A villager already committed to a node that has come under enemy arrows —
// a tower or Castle finished beside it, a truce ended, a save from before the
// rule — is moved on its next decision (§6.4). This is the only mechanism of
// the six in that rule that the 45,000-tick class gate cannot exercise: the
// boot map's economies never build a tower onto the other side's woodline, so
// deleting this module leaves that gate green. It gets its own test for
// exactly that reason (found by an independent critic, which noticed the
// register claimed three layers of coverage that between them covered four of
// the six mechanisms).

import { describe, expect, it } from 'vitest';

import type { GathererComponent } from '../../src/game/simulation/types';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import { retargetOutOfEnemyDefence } from '../../src/game/simulation/bridge/enemyDefenceRetarget';
import type { StaticDefenceView } from '../../src/game/simulation/bridge/enemyDefenceRange';
import type { AssignmentOutcome } from '../../src/game/simulation/bridge/villagerGatherAssignment';

const VILLAGER = 8;
/** `shouldRetryReachability` fires when `(tick + id) % 8 === 0`, so these two
 *  ticks are the probe tick and its neighbour for this villager id. */
const PROBE_TICK = 16;
const QUIET_TICK = 17;

const DANGEROUS_NODE = { x: 15, y: 11 };
const SAFE_NODE = { x: 40, y: 11 };

// 4x4 Town Centre at (10,10), range 6 — so 15,11 is 2 from its east edge and
// 40,11 is 27 away.
const ENEMY_TOWN_CENTER: StaticDefenceView = {
  owner: 1,
  buildingType: 'town-center',
  anchor: { x: 10, y: 10 },
  attackRange: 6,
  isComplete: true,
};

const world = (tick: number): GameWorld => ({ tick } as unknown as GameWorld);

function makeGatherer(overrides: Partial<GathererComponent> = {}): GathererComponent {
  return {
    desiredResource: 'food',
    task: 'to-resource',
    targetResourceId: 3,
    dropOffBuildingId: null,
    gatherProgressTicks: 40,
    carriedResource: 'food',
    carriedAmount: 4,
    carryCapacity: 10,
    hasExplicitGatherOrder: false,
    ...overrides,
  } as GathererComponent;
}

interface Call {
  requireSafe: boolean | undefined;
  spreadCap: number | undefined;
}

/** A stand-in for `assignNearestResource` that answers however the case needs
 *  and records what it was asked, including the mutation a real success makes. */
function assigner(outcome: AssignmentOutcome, newTargetId = 9) {
  const calls: Call[] = [];
  const assignResource = (
    _world: GameWorld,
    _villagerId: number,
    gatherer: GathererComponent,
    _owner: number,
    counts: Map<number, number>,
    options: { requireSafe?: boolean; spreadCap?: number },
  ): AssignmentOutcome => {
    calls.push({ requireSafe: options.requireSafe, spreadCap: options.spreadCap });
    if (outcome === 'assigned') {
      gatherer.task = 'to-resource';
      gatherer.targetResourceId = newTargetId;
      gatherer.gatherProgressTicks = 0;
      counts.set(newTargetId, (counts.get(newTargetId) ?? 0) + 1);
    } else {
      // What `parkOrDeliver` does on the refusing paths.
      gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
      gatherer.targetResourceId = null;
    }
    return outcome;
  };
  return { assignResource, calls };
}

function run(args: {
  tick?: number;
  gatherer?: GathererComponent;
  targetPosition?: { x: number; y: number };
  defences?: StaticDefenceView[];
  outcome?: AssignmentOutcome;
  counts?: Map<number, number>;
}) {
  const gatherer = args.gatherer ?? makeGatherer();
  const counts = args.counts ?? new Map<number, number>([[3, 1]]);
  const { assignResource, calls } = assigner(args.outcome ?? 'assigned');
  const moved = retargetOutOfEnemyDefence({
    activeWorld: world(args.tick ?? PROBE_TICK),
    id: VILLAGER,
    owner: 2,
    gatherer,
    gatherTargetCounts: counts,
    targetPosition: args.targetPosition ?? DANGEROUS_NODE,
    enemyDefences: args.defences ?? [ENEMY_TOWN_CENTER],
    spreadCap: 4,
    assignResource,
  });
  return { moved, gatherer, counts, calls };
}

describe('retargetOutOfEnemyDefence', () => {
  it('moves a gatherer off a node that is under enemy arrows, and asks for a SAFE replacement', () => {
    const { moved, gatherer, counts, calls } = run({});
    expect(moved).toBe(true);
    expect(gatherer.targetResourceId).toBe(9);
    // The old slot was released and the new one reserved.
    expect(counts.get(3)).toBe(0);
    expect(counts.get(9)).toBe(1);
    expect(calls).toEqual([{ requireSafe: true, spreadCap: 4 }]);
  });

  it('keeps the carry, so a partial load goes home rather than being dropped', () => {
    const { gatherer } = run({});
    expect(gatherer.carriedResource).toBe('food');
    expect(gatherer.carriedAmount).toBe(4);
  });

  it('leaves the gatherer exactly as it was when nothing safe of the kind exists', () => {
    // The exception: a villager that would otherwise starve keeps working the
    // dangerous node rather than oscillating between idle and assigned.
    const { moved, gatherer, counts } = run({ outcome: 'dangerous-only' });
    expect(moved).toBe(false);
    expect(gatherer.task).toBe('to-resource');
    expect(gatherer.targetResourceId).toBe(3);
    expect(gatherer.gatherProgressTicks).toBe(40);
    expect(counts.get(3)).toBe(1);
  });

  it('restores the reservation when the replacement search finds nothing at all', () => {
    const { moved, gatherer, counts } = run({ outcome: 'none' });
    expect(moved).toBe(false);
    expect(gatherer.targetResourceId).toBe(3);
    expect(counts.get(3)).toBe(1);
  });

  it('never overrides an explicit player gather order', () => {
    const { moved, gatherer, calls } = run({
      gatherer: makeGatherer({ hasExplicitGatherOrder: true }),
    });
    expect(moved).toBe(false);
    expect(gatherer.targetResourceId).toBe(3);
    expect(calls).toHaveLength(0);
  });

  it('does nothing when the node is clear of every enemy defence', () => {
    const { moved, calls } = run({ targetPosition: SAFE_NODE });
    expect(moved).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('does nothing when there are no enemy defences at all', () => {
    const { moved, calls } = run({ defences: [] });
    expect(moved).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('runs only on the staggered probe tick, so eighty safe villagers cost nothing', () => {
    const quiet = run({ tick: QUIET_TICK });
    expect(quiet.moved).toBe(false);
    expect(quiet.calls).toHaveLength(0);
    // ...and the same villager on its own probe tick does move.
    expect(run({ tick: PROBE_TICK }).moved).toBe(true);
  });
});
