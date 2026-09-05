// The geometry under the 2026-09-02 register entry: a node inside an ENEMY
// static defence's reach — Town Centre, tower, Castle — is off limits to
// automatic gather assignment, with one cell of margin, and only complete
// buildings of a player the owner is at war with count.

import { describe, expect, it } from 'vitest';

import type { Position } from 'civ-engine';
import type { GathererComponent, ResourceComponent } from '../../src/game/simulation/types';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import type { UnitMovementPlan } from '../../src/game/simulation/bridge/movementTypes';
import {
  ENEMY_DEFENCE_MARGIN,
  effectiveStaticDefenceRange,
  isFootprintInsideDefenceReach,
  isNodeInsideEnemyDefenceRange,
  type StaticDefenceView,
} from '../../src/game/simulation/bridge/enemyDefenceRange';
import type { ResearchableTechnologyType } from '../../src/game/simulation/types';
import {
  assignNearestResource,
  type GatherAssignmentDeps,
} from '../../src/game/simulation/bridge/villagerGatherAssignment';

const NO_TEAMS: ReadonlyMap<number, number> = new Map();

// A 4x4 Town Centre at (10,10) covers 10..13 on both axes; range 6.
const TOWN_CENTER_RANGE = 6;
const townCenter = (owner: number, isComplete = true): StaticDefenceView => ({
  owner,
  buildingType: 'town-center',
  anchor: { x: 10, y: 10 },
  attackRange: TOWN_CENTER_RANGE,
  isComplete,
});
// Manhattan distance `d` east of the footprint's east edge (x = 13).
const eastOfTownCenter = (d: number): Position => ({ x: 13 + d, y: 11 });

describe('isNodeInsideEnemyDefenceRange', () => {
  it('keeps one cell of margin: a node at range + 1 is inside, range + 2 is not', () => {
    expect(ENEMY_DEFENCE_MARGIN).toBe(1);
    const defences = [townCenter(1)];
    expect(isNodeInsideEnemyDefenceRange(eastOfTownCenter(TOWN_CENTER_RANGE), defences, 2, NO_TEAMS)).toBe(true);
    expect(isNodeInsideEnemyDefenceRange(eastOfTownCenter(TOWN_CENTER_RANGE + 1), defences, 2, NO_TEAMS)).toBe(true);
    expect(isNodeInsideEnemyDefenceRange(eastOfTownCenter(TOWN_CENTER_RANGE + 2), defences, 2, NO_TEAMS)).toBe(false);
  });

  it('measures from the footprint, not the anchor corner', () => {
    // (13 + 7, 13 + 0): seven from the south-east cell (13,13) but fourteen
    // from the anchor (10,10) by Manhattan — inside by footprint distance.
    expect(isNodeInsideEnemyDefenceRange({ x: 20, y: 13 }, [townCenter(1)], 2, NO_TEAMS)).toBe(true);
    // Diagonal: (13 + 4, 13 + 4) is eight from the nearest cell — outside.
    expect(isNodeInsideEnemyDefenceRange({ x: 17, y: 17 }, [townCenter(1)], 2, NO_TEAMS)).toBe(false);
  });

  it('never excludes on an allied or an own Town Centre', () => {
    const node = eastOfTownCenter(1);
    expect(isNodeInsideEnemyDefenceRange(node, [townCenter(2)], 2, NO_TEAMS)).toBe(false);
    const allied = new Map([[1, 7], [2, 7]]);
    expect(isNodeInsideEnemyDefenceRange(node, [townCenter(1)], 2, allied)).toBe(false);
    // And the same building is dangerous again once the teams say war.
    expect(isNodeInsideEnemyDefenceRange(node, [townCenter(1)], 2, NO_TEAMS)).toBe(true);
  });

  it('never excludes on a foundation still under construction', () => {
    expect(isNodeInsideEnemyDefenceRange(eastOfTownCenter(1), [townCenter(1, false)], 2, NO_TEAMS)).toBe(false);
  });

  it('uses the building\'s own effective range, so an upgraded tower reaches further', () => {
    const tower = (attackRange: number): StaticDefenceView => ({
      owner: 1, buildingType: 'watch-tower', anchor: { x: 5, y: 5 }, attackRange, isComplete: true,
    });
    const node = { x: 5 + 8 + 1, y: 5 };
    expect(isNodeInsideEnemyDefenceRange(node, [tower(7)], 2, NO_TEAMS)).toBe(false);
    expect(isNodeInsideEnemyDefenceRange(node, [tower(8)], 2, NO_TEAMS)).toBe(true);
  });
});

// The reach arithmetic itself, bonus by bonus. `towerCombatSystem` calls this
// same function to decide where its arrows land, so a divergence here is a
// divergence between the rule and the game — which is the one thing this
// module's header promises cannot happen. Before this block nothing tested it
// at all: every other case in this file hands `isInsideDefenceReach` a
// hand-written `attackRange`, which proves the predicate reads the field and
// says nothing about what fills it. Found by an independent critic, along with
// the comment elsewhere claiming this WAS gated.
const techs = (...ids: ResearchableTechnologyType[]): ReadonlySet<ResearchableTechnologyType> =>
  new Set(ids);
const NO_TECHS = techs();

describe('effectiveStaticDefenceRange', () => {
  it('is the base range with nothing researched', () => {
    expect(effectiveStaticDefenceRange('town-center', 6, NO_TECHS, undefined, 'dark-age')).toBe(6);
    expect(effectiveStaticDefenceRange('watch-tower', 7, NO_TECHS, undefined, 'dark-age')).toBe(7);
    expect(effectiveStaticDefenceRange('castle', 8, NO_TECHS, undefined, 'dark-age')).toBe(8);
  });

  it('adds one per Blacksmith arrow technology, to every building that shoots', () => {
    const three = techs('fletching', 'bodkin-arrow', 'bracer');
    expect(effectiveStaticDefenceRange('town-center', 6, techs('fletching'), undefined, 'dark-age')).toBe(7);
    expect(effectiveStaticDefenceRange('town-center', 6, three, undefined, 'dark-age')).toBe(9);
    expect(effectiveStaticDefenceRange('castle', 8, three, undefined, 'dark-age')).toBe(11);
    expect(effectiveStaticDefenceRange('bombard-tower', 8, three, undefined, 'dark-age')).toBe(11);
  });

  it('gives Keep to Watch Towers only', () => {
    expect(effectiveStaticDefenceRange('watch-tower', 7, techs('keep'), undefined, 'dark-age')).toBe(8);
    expect(effectiveStaticDefenceRange('town-center', 6, techs('keep'), undefined, 'dark-age')).toBe(6);
    expect(effectiveStaticDefenceRange('castle', 8, techs('keep'), undefined, 'dark-age')).toBe(8);
  });

  it('gives Crenellations to Castles only', () => {
    expect(effectiveStaticDefenceRange('castle', 8, techs('crenellations'), undefined, 'dark-age')).toBe(11);
    expect(effectiveStaticDefenceRange('watch-tower', 7, techs('crenellations'), undefined, 'dark-age')).toBe(7);
  });

  it('gives Koreans +1 tower range in Castle and +2 in Imperial, and nothing to anyone else', () => {
    expect(effectiveStaticDefenceRange('watch-tower', 7, NO_TECHS, 'Koreans', 'feudal-age')).toBe(7);
    expect(effectiveStaticDefenceRange('watch-tower', 7, NO_TECHS, 'Koreans', 'castle-age')).toBe(8);
    expect(effectiveStaticDefenceRange('watch-tower', 7, NO_TECHS, 'Koreans', 'imperial-age')).toBe(9);
    expect(effectiveStaticDefenceRange('castle', 8, NO_TECHS, 'Koreans', 'imperial-age')).toBe(8);
    expect(effectiveStaticDefenceRange('watch-tower', 7, NO_TECHS, 'Britons', 'imperial-age')).toBe(7);
  });

  it('stacks them, which is the widest a defence can reach', () => {
    // A Korean Imperial Watch Tower with every arrow technology and Keep:
    // 7 + 3 + 1 + 2 = 13, so the rule keeps a villager 14 cells clear of it.
    expect(effectiveStaticDefenceRange(
      'watch-tower', 7, techs('fletching', 'bodkin-arrow', 'bracer', 'keep'), 'Koreans', 'imperial-age',
    )).toBe(13);
  });
});

describe('isFootprintInsideDefenceReach', () => {
  // The drop-off variant: a carrier walks to whichever cell of its building is
  // nearest, so a drop-off counts as covered when ANY of its cells is. It is
  // measured box-to-box rather than cell-by-cell; these cases pin the two to
  // the same answer.
  const defence = [townCenter(1)]; // 4x4 at (10,10), range 6 -> reach 7.

  it('is true when the nearest cell of the footprint is inside, false when the whole box is clear', () => {
    // A 2x2 camp whose west edge sits 7 east of the Town Centre's east edge.
    expect(isFootprintInsideDefenceReach({ x: 20, y: 11 }, { width: 2, height: 2 }, defence)).toBe(true);
    // One cell further out: 8 away, outside reach + margin.
    expect(isFootprintInsideDefenceReach({ x: 21, y: 11 }, { width: 2, height: 2 }, defence)).toBe(false);
  });

  it('measures from the footprint of BOTH boxes, so only the near edge counts', () => {
    // A 4x4 anchored at (21,11) has its west edge where the 1x1 above was, so
    // it is out too; one cell west and it reaches in.
    expect(isFootprintInsideDefenceReach({ x: 21, y: 11 }, { width: 4, height: 4 }, defence)).toBe(false);
    expect(isFootprintInsideDefenceReach({ x: 20, y: 11 }, { width: 4, height: 4 }, defence)).toBe(true);
  });

  it('is false with no defences at all', () => {
    expect(isFootprintInsideDefenceReach({ x: 10, y: 10 }, { width: 4, height: 4 }, [])).toBe(false);
  });
});

// The assignment itself, through the dependency that hands it the enemy's
// defences: the near node is under the enemy Town Centre, the far one is not.
//
// "Near" and "far" are by the assignment's OWN ranking keys, or the case
// proves nothing: the steady-state sort ranks by distance to the reference
// drop-off (32,11) — dangerous 17, safe 20, both inside the 24-cell home
// range — and the reachability probe ranks by distance to the villager
// (30,11) — dangerous 15, safe 22. Either way the dangerous node comes first
// on distance alone, so only the keep-out rule can pick the safe one. (The
// first draft had the safe node at x=45, NEARER to the drop-off than the
// dangerous one; the red check passed it with the rule disabled.)
const VILLAGER = 1;
const DROP_OFF = 2;
const NEAR_UNDER_TOWN_CENTER = 3;
const FAR_AND_SAFE = 4;

const berry = (amount: number): ResourceComponent =>
  ({ resourceType: 'berry-bush', owner: null, baseOwner: null, amount } as ResourceComponent);

function worldWith(safeFar: boolean): GameWorld {
  const entities: Record<number, Record<string, unknown>> = {
    [VILLAGER]: {
      position: { x: 30, y: 11 } satisfies Position,
      unit: { owner: 2, unitType: 'villager' },
    },
    [DROP_OFF]: { position: { x: 32, y: 11 } satisfies Position },
    // Two cells east of the enemy Town Centre's footprint: under its arrows.
    [NEAR_UNDER_TOWN_CENTER]: { position: { x: 15, y: 11 }, resource: berry(100) },
  };
  if (safeFar) {
    entities[FAR_AND_SAFE] = { position: { x: 52, y: 11 }, resource: berry(100) };
  }
  return {
    getComponent: (id: number, name: string) => entities[id]?.[name],
    query: (...names: string[]) => Object.keys(entities).map(Number)
      .filter((id) => names.every((n) => entities[id]?.[n] !== undefined)),
  } as unknown as GameWorld;
}

const deps: GatherAssignmentDeps = {
  isHarvestableResource: (_id, resource) => resource.amount > 0,
  isLandCell: () => true,
  findNearestDropOffBuilding: () => DROP_OFF,
  // Open ground: the walk to the drop-off at (32,11) is the Manhattan distance.
  findDropOffWalkField: () => ({
    haulDistance: (p) => Math.abs(p.x - 32) + Math.abs(p.y - 11),
    nearestDropOffId: () => DROP_OFF,
  }),
  findResourceApproachPlan: () => (
    { destination: { x: 1, y: 1 }, nextStep: { x: 1, y: 1 } } as UnitMovementPlan
  ),
  enemyStaticDefences: () => [townCenter(1)],
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

describe('assignNearestResource keeps out of enemy static defences', () => {
  it('takes the far safe node over the near one under the enemy Town Centre', () => {
    const gatherer = makeGatherer();
    assignNearestResource(deps, worldWith(true), VILLAGER, gatherer, 2, new Map(), {
      preferUnsaturated: true, spreadCap: 2,
    });
    expect(gatherer.targetResourceId).toBe(FAR_AND_SAFE);
  });

  it('still gathers the dangerous node when nothing else of the kind exists', () => {
    const gatherer = makeGatherer();
    assignNearestResource(deps, worldWith(false), VILLAGER, gatherer, 2, new Map(), {
      preferUnsaturated: true, spreadCap: 2,
    });
    expect(gatherer.targetResourceId).toBe(NEAR_UNDER_TOWN_CENTER);
  });

  it('refuses the dangerous node under requireSafe and says so, so the kind fallback can move on', () => {
    // The kind fallback asks this before it accepts the exception: "is there
    // a SAFE node of this kind?" A no parks the villager for the next kind
    // and names the reason, which is what lets the second pass visit only
    // the kinds that had dangerous nodes.
    const gatherer = makeGatherer();
    const outcome = assignNearestResource(deps, worldWith(false), VILLAGER, gatherer, 2, new Map(), {
      preferUnsaturated: true, spreadCap: 2, requireSafe: true,
    });
    expect(outcome).toBe('dangerous-only');
    expect(gatherer.task).toBe('idle');
    expect(gatherer.targetResourceId).toBeNull();
    // With a safe node present, requireSafe changes nothing.
    const relaxed = makeGatherer();
    expect(assignNearestResource(deps, worldWith(true), VILLAGER, relaxed, 2, new Map(), {
      preferUnsaturated: true, spreadCap: 2, requireSafe: true,
    })).toBe('assigned');
    expect(relaxed.targetResourceId).toBe(FAR_AND_SAFE);
  });

  it('answers dangerous-only when the safe nodes of the kind exist but cannot be reached', () => {
    // The starvation case. A safe node behind a wall is not safe WORK, so
    // under `requireSafe` this has to read as "no safe work of this kind" and
    // not as "no node of this kind at all": `assignIdleGatherer`'s second
    // pass revisits only the kinds that answered `dangerous-only`, so `none`
    // here would hide this kind's reachable-but-dangerous nodes for good and
    // could leave the villager with no work anywhere.
    const gatherer = makeGatherer();
    const outcome = assignNearestResource(
      {
        ...deps,
        // Only the dangerous node can be pathed to; the safe far one cannot.
        findResourceApproachPlan: (_villagerId, resourceId) => (
          resourceId === NEAR_UNDER_TOWN_CENTER
            ? ({ destination: { x: 1, y: 1 }, nextStep: { x: 1, y: 1 } } as UnitMovementPlan)
            : null
        ),
      },
      worldWith(true), VILLAGER, gatherer, 2, new Map(),
      { preferUnsaturated: true, spreadCap: 2, requireReachable: true, requireSafe: true },
    );
    expect(outcome).toBe('dangerous-only');
    expect(gatherer.targetResourceId).toBeNull();
    // And with `requireSafe` lifted, the same call takes the dangerous node —
    // the exception the rule grants when nothing safe can be reached.
    const relaxed = makeGatherer();
    assignNearestResource(
      {
        ...deps,
        findResourceApproachPlan: (_villagerId, resourceId) => (
          resourceId === NEAR_UNDER_TOWN_CENTER
            ? ({ destination: { x: 1, y: 1 }, nextStep: { x: 1, y: 1 } } as UnitMovementPlan)
            : null
        ),
      },
      worldWith(true), VILLAGER, relaxed, 2, new Map(),
      { preferUnsaturated: true, spreadCap: 2, requireReachable: true },
    );
    expect(relaxed.targetResourceId).toBe(NEAR_UNDER_TOWN_CENTER);
  });

  it('under requireReachable, probes the safe nodes before falling back to a dangerous one', () => {
    const gatherer = makeGatherer();
    const reachable = new Set([NEAR_UNDER_TOWN_CENTER, FAR_AND_SAFE]);
    assignNearestResource(
      {
        ...deps,
        findResourceApproachPlan: (_villagerId, resourceId) => (reachable.has(resourceId)
          ? ({ destination: { x: 1, y: 1 }, nextStep: { x: 1, y: 1 } } as UnitMovementPlan)
          : null),
      },
      worldWith(true), VILLAGER, gatherer, 2, new Map(),
      { preferUnsaturated: true, spreadCap: 2, requireReachable: true },
    );
    expect(gatherer.targetResourceId).toBe(FAR_AND_SAFE);
  });
});
