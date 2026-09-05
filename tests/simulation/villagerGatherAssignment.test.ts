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
import type { DropOffWalkField } from '../../src/game/simulation/bridge/dropOffWalkField';
import {
  assignNearestResource,
  type GatherAssignmentDeps,
} from '../../src/game/simulation/bridge/villagerGatherAssignment';

const VILLAGER = 1;
const UNREACHABLE_NEAR = 2; // nearer, but boxed in (no approach plan)
const REACHABLE_FAR = 3; // farther, but open

/** A walk field on OPEN ground, where the walk IS the Manhattan distance —
 *  the fake for cases that are not about obstacles. */
function openGroundField(dropOff: Position, dropOffId: number): DropOffWalkField {
  return {
    haulDistance: (p) => Math.abs(p.x - dropOff.x) + Math.abs(p.y - dropOff.y),
    nearestDropOffId: () => dropOffId,
    descendFrom: () => null,
  };
}

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
    [VILLAGER]: {
      position: { x: 0, y: 0 } satisfies Position,
      // The assignment reads the gatherer's TYPE: a land unit can never
      // work a water resource, and a fish is FOOD like any berry.
      unit: { owner: 1, unitType: 'villager' },
    },
    [UNREACHABLE_NEAR]: { position: { x: 1, y: 1 }, resource: berry(null, 1, 100) },
    [REACHABLE_FAR]: { position: { x: 5, y: 5 }, resource: berry(null, 1, 100) },
  });
}

// Deps whose `findResourceApproachPlan` returns a plan only for ids in `reach`.
function deps(reach: ReadonlySet<number>): GatherAssignmentDeps {
  return {
    // Every cell is land in these fakes: the shore test only matters for fish.
    isLandCell: () => true,
    isHarvestableResource: (_id, resource) => resource.amount > 0,
    findNearestDropOffBuilding: () => 99,
    enemyStaticDefences: () => [],
    // No drop-off of the kind: the ranking falls back to villager distance.
    findDropOffWalkField: () => null,
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
      [VILLAGER]: {
      position: { x: 20, y: 20 } satisfies Position,
      // The assignment reads the gatherer's TYPE: a land unit can never
      // work a water resource, and a fish is FOOD like any berry.
      unit: { owner: 1, unitType: 'villager' },
    },
      [DROP_OFF]: { position: { x: 5, y: 5 }, building: {} },
      [NEAR_BASE]: { position: { x: 6, y: 6 }, resource: berry(100) },
      [NEAR_VILLAGER]: { position: { x: 19, y: 19 }, resource: berry(100) },
    });
    const localityDeps: GatherAssignmentDeps = {
      isLandCell: () => true,
      enemyStaticDefences: () => [],
      isHarvestableResource: (_id, resource) => resource.amount > 0,
      findNearestDropOffBuilding: () => DROP_OFF,
      findDropOffWalkField: () => openGroundField({ x: 5, y: 5 }, DROP_OFF),
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

  it('falls back to villager distance when the owner has no drop-off (legacy behaviour)', () => {
    // `deps` answers no walk field (no drop-off of the kind) → every haul is
    // Infinity → the sort falls back to villager distance (nearest wins),
    // byte-identical to the pre-v0.1.79 order.
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
      [VILLAGER]: {
        position: { x: 30, y: 30 },
        unit: { owner: 1, unitType: 'villager' },
      },
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
      isLandCell: () => true,
      enemyStaticDefences: () => [],
      isHarvestableResource: (_id, resource) => resource.amount > 0,
      findNearestDropOffBuilding: () => DROP,
      // Open ground as far as the FIELD knows: the pocket's walls are the
      // approach plans below, so the haul ranking still puts the pocket
      // first and only the probe order can rescue the villager.
      findDropOffWalkField: () => openGroundField({ x: 0, y: 0 }, DROP),
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
      isLandCell: () => true,
      enemyStaticDefences: () => [],
      isHarvestableResource: () => false, // everything depleted
      findNearestDropOffBuilding: () => {
        dropOffLookups += 1;
        return 99;
      },
      findDropOffWalkField: () => {
        dropOffLookups += 1;
        return null;
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
      [VILLAGER]: {
        position: { x: 0, y: 0 },
        unit: { owner: 1, unitType: 'villager' },
      },
    };
    for (let i = 0; i < 20; i += 1) {
      entities[100 + i] = {
        position: { x: i + 1, y: 0 },
        resource: { resourceType: 'berry-bush', owner: null, baseOwner: 1, amount: 100 } as ResourceComponent,
      };
    }
    let probes = 0;
    const countingDeps: GatherAssignmentDeps = {
      isLandCell: () => true,
      enemyStaticDefences: () => [],
      isHarvestableResource: (_id, resource) => resource.amount > 0,
      findNearestDropOffBuilding: () => 99,
      findDropOffWalkField: () => null,
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

// The ranking key is the WALK, not the Manhattan distance (register entry
// 2026-09-01: the comparator measured a distance the units cannot walk, and
// wood villagers were sent to trees at Manhattan 8-9 whose real walk was 35-45
// cells while trees at walk 0-3 sat unused). A table stands in for the
// breadth-first search; the table is where the forest wall lives.
//
// BOUND: the field is a fake, so these cases pin what the comparator DOES with
// a walk distance, not how the distance is computed — that is
// `dropOffWalkField.test.ts` — and not that a real match benefits, which is
// `gatherWalkRanking.test.ts` on the boot map.
describe('the comparator ranks by the walk a villager can make', () => {
  const DROP_OFF = 50;
  // The id the fake field names for a reachable node. The assignment records
  // it as a hint; the deposit leg re-resolves the drop-off from the carrier's
  // live position, so nothing here pins that value.
  const WALK_NEAREST_DROP_OFF = 77;
  // Both hauls sit INSIDE the 24-cell home range, so the home filter cannot
  // decide this case and only the ranking key does — a 30-cell wall tree was
  // excluded by the range and let a comparator with no haul key pass.
  const BEHIND_THE_WALL = 60; // Manhattan 3 from the drop-off, a 20-cell walk
  const AROUND_THE_CORNER = 61; // Manhattan 6 from the drop-off, a 6-cell walk
  const tree = (): ResourceComponent =>
    ({ resourceType: 'tree', owner: null, baseOwner: 1, amount: 100 } as ResourceComponent);

  function tableField(haul: Record<string, number>): DropOffWalkField {
    const at = (p: Position): number => haul[`${String(p.x)},${String(p.y)}`] ?? Number.POSITIVE_INFINITY;
    return {
      haulDistance: at,
      nearestDropOffId: (p) => (Number.isFinite(at(p)) ? WALK_NEAREST_DROP_OFF : null),
      descendFrom: () => null,
    };
  }

  function treeDeps(haul: Record<string, number>): GatherAssignmentDeps {
    return {
      isLandCell: () => true,
      enemyStaticDefences: () => [],
      isHarvestableResource: (_id, resource) => resource.amount > 0,
      findNearestDropOffBuilding: () => DROP_OFF,
      findDropOffWalkField: () => tableField(haul),
      findResourceApproachPlan: () =>
        ({ destination: { x: 1, y: 1 }, nextStep: { x: 1, y: 1 } } as UnitMovementPlan),
    };
  }

  function forestWorld(trees: Record<number, Position>): GameWorld {
    const entities: Record<number, Record<string, unknown>> = {
      [VILLAGER]: {
        position: { x: 10, y: 10 } satisfies Position,
        unit: { owner: 1, unitType: 'villager' },
      },
      [DROP_OFF]: { position: { x: 10, y: 10 }, building: {} },
    };
    for (const [id, position] of Object.entries(trees)) {
      entities[Number(id)] = { position, resource: tree() };
    }
    return makeWorld(entities);
  }

  it('takes the tree with the shorter WALK over the one with the shorter Manhattan distance', () => {
    // Both trees sit inside the home range by either measure; only the key
    // decides. The Manhattan key picked BEHIND_THE_WALL (3 < 6).
    const gatherer = makeGatherer({ desiredResource: 'wood' });
    assignNearestResource(
      treeDeps({ '12,11': 20, '13,13': 6 }),
      forestWorld({ [BEHIND_THE_WALL]: { x: 12, y: 11 }, [AROUND_THE_CORNER]: { x: 13, y: 13 } }),
      VILLAGER, gatherer, 1, new Map(),
      { preferUnsaturated: true, spreadCap: 2 },
    );
    expect(gatherer.targetResourceId).toBe(AROUND_THE_CORNER);
  });

  it('home is a WALK: a sealed tree at Manhattan 8 is not home, and a 30-cell haul is not either', () => {
    // Three trees. CROWDED_HOME: a 20-cell haul, already at the spread cap.
    // OPEN_BUT_FAR: free, but a 30-cell haul — outside the home range.
    // SEALED: free, Manhattan 8 from the drop-off, and no drop-off can reach
    // it. The old Manhattan home range admitted SEALED and the fan-out sent
    // the villager to it (unreachable); no home range at all sends it on the
    // 30-cell haul. Only a walk-bounded home keeps it on the crowded tree
    // beside its drop-off, which is what the range exists to do.
    const CROWDED_HOME = 62;
    const OPEN_BUT_FAR = 63;
    const SEALED = 64;
    const gatherer = makeGatherer({ desiredResource: 'wood' });
    assignNearestResource(
      treeDeps({ '30,10': 20, '40,10': 30 }),
      forestWorld({
        [CROWDED_HOME]: { x: 30, y: 10 },
        [OPEN_BUT_FAR]: { x: 40, y: 10 },
        [SEALED]: { x: 14, y: 14 },
      }),
      VILLAGER, gatherer, 1, new Map([[CROWDED_HOME, 2]]),
      { preferUnsaturated: true, spreadCap: 2 },
    );
    expect(gatherer.targetResourceId).toBe(CROWDED_HOME);
  });
});
