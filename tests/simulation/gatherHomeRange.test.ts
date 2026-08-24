import { describe, expect, it } from 'vitest';

import type { Position } from 'civ-engine';
import type { GathererComponent, ResourceComponent } from '../../src/game/simulation/types';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import type { UnitMovementPlan } from '../../src/game/simulation/bridge/movementTypes';
import {
  assignNearestResource,
  type GatherAssignmentDeps,
} from '../../src/game/simulation/bridge/villagerGatherAssignment';

const VILLAGER = 1;
const DROP_OFF = 2;
const NEAR_BUT_CROWDED = 3;
const FAR_AND_FREE = 4;

const berry = (amount: number): ResourceComponent =>
  ({ resourceType: 'berry-bush', owner: null, baseOwner: null, amount } as ResourceComponent);

function worldWith(farPosition: Position, nearPosition: Position | null): GameWorld {
  const entities: Record<number, Record<string, unknown>> = {
    [VILLAGER]: {
      position: { x: 0, y: 0 } satisfies Position,
      unit: { owner: 1, unitType: 'villager' },
    },
    [DROP_OFF]: { position: { x: 0, y: 0 } satisfies Position },
    [FAR_AND_FREE]: { position: farPosition, resource: berry(100) },
  };
  if (nearPosition) {
    entities[NEAR_BUT_CROWDED] = { position: nearPosition, resource: berry(100) };
  }
  return {
    getComponent: (id: number, name: string) => entities[id]?.[name],
    query: (...names: string[]) => Object.keys(entities).map(Number)
      .filter((id) => names.every((n) => entities[id]?.[n] !== undefined)),
  } as unknown as GameWorld;
}

const deps: GatherAssignmentDeps = {
  isHarvestableResource: (_id, resource) => resource.amount > 0,
  // Every cell is land in these fakes: the shore test only matters for fish.
  isLandCell: () => true,
  findNearestDropOffBuilding: () => DROP_OFF,
  findResourceApproachPlan: () => (
    { destination: { x: 1, y: 1 }, nextStep: { x: 1, y: 1 } } as UnitMovementPlan
  ),
};

function makeGatherer(): GathererComponent {
  return {
    desiredResource: 'food',
    task: 'idle',
    targetResourceId: null,
    dropOffBuildingId: null,
    gatherProgressTicks: 0,
    carriedResource: null,
    carriedAmount: 0,
    carryCapacity: 10,
    hasExplicitGatherOrder: false,
  } as GathererComponent;
}

describe('how far from its drop-off a villager will be sent', () => {
  // Ranking alone only ORDERS candidates, so once the nodes beside the base
  // were crowded the fan-out ran on to the far side of the map: AI villagers
  // were assigned resources forty to sixty cells away, walked into the enemy's
  // base and were killed there — twenty of them in one match, which is what
  // emptied the AI's economy.
  it('takes a crowded resource at home over an empty one across the map', () => {
    const gatherer = makeGatherer();
    // The near node is over its spread cap, so the fan-out ranks the far one
    // first — exactly the case that used to send a villager across the map.
    assignNearestResource(
      deps,
      worldWith({ x: 40, y: 0 }, { x: 6, y: 0 }),
      VILLAGER, gatherer, 1,
      new Map([[NEAR_BUT_CROWDED, 4]]),
      { preferUnsaturated: true, spreadCap: 2 },
    );
    expect(gatherer.targetResourceId).toBe(NEAR_BUT_CROWDED);
  });

  it('still crosses the map when home has nothing of that kind left', () => {
    // A player whose own food is gone must not simply stop gathering.
    const gatherer = makeGatherer();
    assignNearestResource(
      deps,
      worldWith({ x: 40, y: 0 }, null),
      VILLAGER, gatherer, 1, new Map(),
      { preferUnsaturated: true, spreadCap: 2 },
    );
    expect(gatherer.targetResourceId).toBe(FAR_AND_FREE);
  });
});
