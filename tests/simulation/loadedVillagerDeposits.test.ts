// A villager holding resources always takes them home (2026-08-29).
//
// Found by tracing one AI villager end to end on `aoe2-prototype`: it stood
// IDLE for 211 ticks holding a full carry of 10 food. Gather assignment sets
// `task = 'idle'` when it can find no resource of the villager's kind — and
// the idle-to-assign path re-runs assignment, finds nothing again, and leaves
// the load standing in the field. AoE2 never does this: a villager whose bush
// runs out walks its load back to the drop-off first.
//
// The cost is not only the stranded carry. An idle loaded villager is
// production the economy has already paid the walk for and cannot spend; on
// the boot map owner 2's food never passed ~50 against a 500-food age-up.

import { describe, expect, it } from 'vitest';

import { assignNearestResource } from '../../src/game/simulation/bridge/villagerGatherAssignment';
import type { GathererComponent } from '../../src/game/simulation/types';

/** A world with NO resources at all — the branch under test. */
function emptyWorld(villagerId: number) {
  return {
    query: (...components: string[]) => (components.includes('resource') ? [] : [villagerId]),
    getComponent: (id: number, kind: string) => {
      if (id !== villagerId) return undefined;
      if (kind === 'position') return { x: 5, y: 5 };
      if (kind === 'unit') return { owner: 2, unitType: 'villager' };
      return undefined;
    },
  };
}

const deps = {
  isHarvestableResource: () => true,
  isLandCell: () => true,
  findNearestDropOffBuilding: () => 42,
  findResourceApproachPlan: () => null,
};

function gathererCarrying(amount: number): GathererComponent {
  return {
    task: 'to-resource',
    desiredResource: 'food',
    targetResourceId: 7,
    carriedAmount: amount,
    carriedResource: amount > 0 ? 'food' : null,
    gatherProgressTicks: 0,
    hasExplicitGatherOrder: false,
    dropOffBuildingId: null,
  } as unknown as GathererComponent;
}

describe('a villager that can find no resource of its kind', () => {
  it('carries its load to the drop-off instead of idling with it', () => {
    const gatherer = gathererCarrying(10);
    assignNearestResource(
      deps as never, emptyWorld(1) as never, 1, gatherer, 2, new Map(),
      { preferUnsaturated: true, spreadCap: 3 },
    );
    expect(gatherer.task, 'a loaded villager must haul, not idle').toBe('to-dropoff');
    expect(gatherer.carriedAmount, 'the load must survive the decision').toBe(10);
  });

  it('still idles when it is carrying nothing', () => {
    const gatherer = gathererCarrying(0);
    assignNearestResource(
      deps as never, emptyWorld(1) as never, 1, gatherer, 2, new Map(),
      { preferUnsaturated: true, spreadCap: 3 },
    );
    expect(gatherer.task, 'an empty villager has nothing to deliver').toBe('idle');
  });
});
