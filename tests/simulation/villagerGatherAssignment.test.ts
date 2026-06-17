// Mechanism test for the reachability-aware reroute extracted in the
// campaign-11 gather-gridlock fix. The default path is byte-identical to the
// pre-extraction inline function (pick the sorted-first match, no pathfinding);
// `requireReachable` skips the excluded id AND any candidate with no approach
// plan so a villager falls through from an unreachable resource to a reachable
// one instead of latching.

import { describe, it, expect } from 'vitest';

import type { Position } from 'civ-engine';
import type { GathererComponent, ResourceComponent } from '../../src/game/simulation/types';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import type { UnitMovementPlan } from '../../src/game/simulation/bridge/movementTypes';
import {
  assignNearestResource,
  type GatherAssignmentDeps,
} from '../../src/game/simulation/bridge/villagerGatherAssignment';

const VILLAGER = 1;
const UNREACHABLE_NEAR = 2; // nearer, but boxed in (no approach plan)
const REACHABLE_FAR = 3; // farther, but open

function makeWorld(entities: Record<number, Record<string, unknown>>): GameWorld {
  return {
    getComponent: (id: number, name: string) => entities[id]?.[name],
    query: (...names: string[]) =>
      Object.keys(entities)
        .map(Number)
        .filter((id) => names.every((n) => entities[id]?.[n] !== undefined)),
  } as unknown as GameWorld;
}

function makeGatherer(overrides: Partial<GathererComponent> = {}): GathererComponent {
  return {
    desiredResource: 'food',
    task: 'to-resource',
    targetResourceId: null,
    dropOffBuildingId: null,
    gatherProgressTicks: 0,
    carriedResource: null,
    carriedAmount: 0,
    carryCapacity: 10,
    hasExplicitGatherOrder: true,
    ...overrides,
  } as GathererComponent;
}

function scenarioWorld(): GameWorld {
  const berry = (owner: number | null, baseOwner: number | null, amount: number): ResourceComponent =>
    ({ resourceType: 'berry-bush', owner, baseOwner, amount } as ResourceComponent);
  return makeWorld({
    [VILLAGER]: { position: { x: 0, y: 0 } satisfies Position },
    [UNREACHABLE_NEAR]: { position: { x: 1, y: 1 }, resource: berry(null, 1, 100) },
    [REACHABLE_FAR]: { position: { x: 5, y: 5 }, resource: berry(null, 1, 100) },
  });
}

// Deps whose `findResourceApproachPlan` returns a plan only for ids in `reach`.
function deps(reach: ReadonlySet<number>): GatherAssignmentDeps {
  return {
    isHarvestableResource: (_id, resource) => resource.amount > 0,
    findNearestDropOffBuilding: () => 99,
    findResourceApproachPlan: (_villagerId, resourceId) =>
      reach.has(resourceId)
        ? ({ destination: { x: 4, y: 5 }, nextStep: { x: 1, y: 1 } } as UnitMovementPlan)
        : null,
  };
}

describe('assignNearestResource reachability-aware reroute', () => {
  it('default (no requireReachable) picks the nearest match even if it is unreachable — legacy behaviour', () => {
    const gatherer = makeGatherer();
    assignNearestResource(deps(new Set([REACHABLE_FAR])), scenarioWorld(), VILLAGER, gatherer, 1, new Map(), {
      preferUnsaturated: true,
      spreadCap: 2,
    });
    expect(gatherer.targetResourceId).toBe(UNREACHABLE_NEAR);
    expect(gatherer.task).toBe('to-resource');
  });

  it('requireReachable skips the unreachable nearer resource and picks a reachable one', () => {
    const gatherer = makeGatherer({ targetResourceId: UNREACHABLE_NEAR });
    assignNearestResource(
      deps(new Set([REACHABLE_FAR])),
      scenarioWorld(),
      VILLAGER,
      gatherer,
      1,
      new Map([[UNREACHABLE_NEAR, 1]]),
      { preferUnsaturated: true, spreadCap: 2, requireReachable: true, excludeResourceId: UNREACHABLE_NEAR },
    );
    expect(gatherer.targetResourceId).toBe(REACHABLE_FAR);
    expect(gatherer.task).toBe('to-resource');
  });

  it('requireReachable leaves the villager idle when nothing is reachable', () => {
    const gatherer = makeGatherer({ targetResourceId: UNREACHABLE_NEAR });
    assignNearestResource(deps(new Set()), scenarioWorld(), VILLAGER, gatherer, 1, new Map(), {
      preferUnsaturated: true,
      spreadCap: 2,
      requireReachable: true,
      excludeResourceId: UNREACHABLE_NEAR,
    });
    expect(gatherer.task).toBe('idle');
    expect(gatherer.targetResourceId).toBeNull();
  });

  it('reserves the chosen reachable target in the gatherTargetCounts map', () => {
    const gatherer = makeGatherer({ targetResourceId: UNREACHABLE_NEAR });
    const counts = new Map<number, number>();
    assignNearestResource(deps(new Set([REACHABLE_FAR])), scenarioWorld(), VILLAGER, gatherer, 1, counts, {
      preferUnsaturated: true,
      spreadCap: 2,
      requireReachable: true,
      excludeResourceId: UNREACHABLE_NEAR,
    });
    expect(counts.get(REACHABLE_FAR)).toBe(1);
  });

  it('caps reachability probes when nothing is reachable (bounds the fully-boxed BFS)', () => {
    // 20 matching food resources, all unreachable. The reroute must probe at
    // most MAX_REACHABILITY_PROBES (16) of them then idle — so a fully-boxed
    // villager does a BOUNDED amount of pathfinding per tick, not one BFS per
    // resource on the map (the campaign-11 review's per-tick-BFS-storm finding).
    const entities: Record<number, Record<string, unknown>> = {
      [VILLAGER]: { position: { x: 0, y: 0 } },
    };
    for (let i = 0; i < 20; i += 1) {
      entities[100 + i] = {
        position: { x: i + 1, y: 0 },
        resource: { resourceType: 'berry-bush', owner: null, baseOwner: 1, amount: 100 } as ResourceComponent,
      };
    }
    let probes = 0;
    const countingDeps: GatherAssignmentDeps = {
      isHarvestableResource: (_id, resource) => resource.amount > 0,
      findNearestDropOffBuilding: () => 99,
      findResourceApproachPlan: () => {
        probes += 1;
        return null; // nothing reachable
      },
    };
    const gatherer = makeGatherer({ targetResourceId: 100 });
    assignNearestResource(countingDeps, makeWorld(entities), VILLAGER, gatherer, 1, new Map(), {
      preferUnsaturated: true,
      spreadCap: 2,
      requireReachable: true,
      excludeResourceId: 100,
    });
    expect(gatherer.task).toBe('idle');
    expect(probes).toBeLessThanOrEqual(16);
  });
});
