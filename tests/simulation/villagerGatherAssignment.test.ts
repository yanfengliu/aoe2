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

  it('prefers the resource nearest the DROP-OFF over one nearest the villager (round-trip locality)', () => {
    // v0.1.79 wood-locality fix: the steady-state gather cost is the resource↔
    // drop-off round-trip, so a villager idle in a far forest should pick a
    // base-proximate tree (walk back once, then cycle near the base), NOT the
    // tree nearest its current far position (which would spiral it into the
    // far forest doing huge round-trips — the grounded AI wood-starvation).
    const DROP_OFF = 50;
    const NEAR_BASE = 60; // 2 from the drop-off, 28 from the villager
    const NEAR_VILLAGER = 61; // 28 from the drop-off, 2 from the villager
    const berry = (amount: number): ResourceComponent =>
      ({ resourceType: 'berry-bush', owner: null, baseOwner: 1, amount } as ResourceComponent);
    const world = makeWorld({
      [VILLAGER]: { position: { x: 20, y: 20 } satisfies Position },
      [DROP_OFF]: { position: { x: 5, y: 5 }, building: {} },
      [NEAR_BASE]: { position: { x: 6, y: 6 }, resource: berry(100) },
      [NEAR_VILLAGER]: { position: { x: 19, y: 19 }, resource: berry(100) },
    });
    const localityDeps: GatherAssignmentDeps = {
      isHarvestableResource: (_id, resource) => resource.amount > 0,
      findNearestDropOffBuilding: () => DROP_OFF,
      findResourceApproachPlan: () =>
        ({ destination: { x: 5, y: 5 }, nextStep: { x: 1, y: 1 } } as UnitMovementPlan),
    };
    const gatherer = makeGatherer();
    assignNearestResource(localityDeps, world, VILLAGER, gatherer, 1, new Map(), {
      preferUnsaturated: true,
      spreadCap: 2,
    });
    expect(gatherer.targetResourceId).toBe(NEAR_BASE);
    expect(gatherer.task).toBe('to-resource');
  });

  it('falls back to villager distance when no drop-off position is known (legacy behaviour)', () => {
    // scenarioWorld's findNearestDropOffBuilding returns id 99 which has no
    // position → drop-off distance is unavailable for every candidate → the
    // sort falls back to villager distance (nearest wins), byte-identical to
    // the pre-v0.1.79 order.
    const gatherer = makeGatherer();
    assignNearestResource(deps(new Set([UNREACHABLE_NEAR, REACHABLE_FAR])), scenarioWorld(), VILLAGER, gatherer, 1, new Map(), {
      preferUnsaturated: true,
      spreadCap: 2,
    });
    expect(gatherer.targetResourceId).toBe(UNREACHABLE_NEAR); // nearest to the villager at (0,0)
  });

  it('requireReachable probes in VILLAGER order: a walled pocket near the drop-off cannot starve a villager beside a reachable resource', () => {
    // Review 2026-07-02 medium finding (verified with a repro): the drop-off-
    // locality sort must NOT govern the bounded recovery probe. With 17
    // unreachable trees packed around the drop-off and a reachable tree right
    // next to the villager, a drop-off-ordered probe would burn all 16 probes
    // on the pocket and idle the villager forever; the villager-ordered probe
    // finds the adjacent reachable tree immediately.
    const DROP = 900;
    const REACHABLE_ADJACENT = 800; // next to the villager, far from the drop-off
    const entities: Record<number, Record<string, unknown>> = {
      [VILLAGER]: { position: { x: 30, y: 30 } },
      [DROP]: { position: { x: 0, y: 0 }, building: {} },
      [REACHABLE_ADJACENT]: {
        position: { x: 31, y: 30 },
        resource: { resourceType: 'berry-bush', owner: null, baseOwner: 1, amount: 100 } as ResourceComponent,
      },
    };
    for (let i = 0; i < 17; i += 1) {
      entities[700 + i] = {
        position: { x: i + 1, y: 0 }, // pocket hugging the drop-off
        resource: { resourceType: 'berry-bush', owner: null, baseOwner: 1, amount: 100 } as ResourceComponent,
      };
    }
    const pocketDeps: GatherAssignmentDeps = {
      isHarvestableResource: (_id, resource) => resource.amount > 0,
      findNearestDropOffBuilding: () => DROP,
      findResourceApproachPlan: (_v, resourceId) =>
        resourceId === REACHABLE_ADJACENT
          ? ({ destination: { x: 31, y: 30 }, nextStep: { x: 1, y: 0 } } as UnitMovementPlan)
          : null,
    };
    const gatherer = makeGatherer({ targetResourceId: 700 });
    assignNearestResource(pocketDeps, makeWorld(entities), VILLAGER, gatherer, 1, new Map(), {
      preferUnsaturated: true,
      spreadCap: 2,
      requireReachable: true,
      excludeResourceId: 700,
    });
    expect(gatherer.targetResourceId).toBe(REACHABLE_ADJACENT);
    expect(gatherer.task).toBe('to-resource');
  });

  it('idles immediately (no drop-off lookup) when no matching resource exists', () => {
    let dropOffLookups = 0;
    const countingDeps: GatherAssignmentDeps = {
      isHarvestableResource: () => false, // everything depleted
      findNearestDropOffBuilding: () => {
        dropOffLookups += 1;
        return 99;
      },
      findResourceApproachPlan: () => null,
    };
    const gatherer = makeGatherer();
    assignNearestResource(countingDeps, scenarioWorld(), VILLAGER, gatherer, 1, new Map(), {
      preferUnsaturated: true,
      spreadCap: 2,
    });
    expect(gatherer.task).toBe('idle');
    expect(gatherer.targetResourceId).toBeNull();
    expect(dropOffLookups).toBe(0);
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
