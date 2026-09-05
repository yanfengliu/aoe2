// The delivery walk follows the drop-off walk field (register entry
// 2026-09-01, the deposit leg). A carrier standing on the field walks its
// gradient — the true shortest route to the walk-nearest ring cell — and the
// drop-off it records is the one that route ends at; a carrier off the field
// falls back to the Manhattan-nearest drop-off and its A* approach plan.
//
// BOUND: the field and the planners are fakes, so this pins which of them the
// step consults and what it does with the answer, not the routes themselves
// (`dropOffWalkField.test.ts`) and not a match (`gatherWalkRanking.test.ts`).

import { describe, expect, it } from 'vitest';

import type { Position } from 'civ-engine';
import type { GathererComponent, UnitComponent } from '../../src/game/simulation/types';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import type { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import type { DropOffWalkField } from '../../src/game/simulation/bridge/dropOffWalkField';
import {
  runDropOffStep,
  type DropOffStepContext,
} from '../../src/game/simulation/bridge/systems/dropOffStep';

const VILLAGER = 1;
const WALK_NEAREST = 40;
const MANHATTAN_NEAREST = 41;
const AT: Position = { x: 14, y: 14 };
const DESCENT_STEP: Position = { x: 13, y: 14 };
const DESCENT_END: Position = { x: 11, y: 10 };
const PLAN_STEP: Position = { x: 15, y: 14 };
const PLAN_END: Position = { x: 10, y: 11 };

function carrier(): GathererComponent {
  return {
    desiredResource: 'wood',
    task: 'to-dropoff',
    targetResourceId: 7,
    dropOffBuildingId: null,
    gatherProgressTicks: 0,
    carriedResource: 'wood',
    carriedAmount: 10,
    carryCapacity: 10,
    hasExplicitGatherOrder: false,
  } as GathererComponent;
}

interface Harness {
  ctx: DropOffStepContext;
  steps: Position[];
  planLookups: number;
}

function harness(field: DropOffWalkField | null): Harness {
  const steps: Position[] = [];
  const counters = { planLookups: 0 };
  const world = { tick: 100 } as unknown as GameWorld;
  const ctx: DropOffStepContext = {
    world,
    accessor: { get: () => new Map(), markDirty: () => {} } as unknown as BridgeStateAccessor,
    id: VILLAGER,
    unit: { owner: 1, unitType: 'villager' } as UnitComponent,
    gatherer: carrier(),
    position: AT,
    aiStates: new Map(),
    stuckMap: new Map(),
    setStuck: () => {},
    clearStuck: () => {},
    dropOffDeps: {
      findNearestDropOffBuilding: () => MANHATTAN_NEAREST,
      findBuildingApproachPlan: () => null,
    },
    findNearestDropOffBuilding: () => MANHATTAN_NEAREST,
    findBuildingApproachPlan: () => {
      counters.planLookups += 1;
      return { destination: PLAN_END, nextStep: PLAN_STEP };
    },
    findDropOffWalkField: () => field,
    isUnitAtTarget: (_id, target) => target.x === AT.x && target.y === AT.y,
    moveUnitOneSubgridStep: (_id, step) => { steps.push(step); },
    ensurePlayerScoreCounters: () => ({ resourcesGathered: 0 }),
  };
  return { ctx, steps, get planLookups() { return counters.planLookups; } };
}

const onTheField: DropOffWalkField = {
  haulDistance: () => 10,
  nearestDropOffId: () => WALK_NEAREST,
  descendFrom: () => ({ destination: DESCENT_END, nextStep: DESCENT_STEP, dropOffId: WALK_NEAREST }),
};

const offTheField: DropOffWalkField = {
  haulDistance: () => Number.POSITIVE_INFINITY,
  nearestDropOffId: () => null,
  descendFrom: () => null,
};

describe('a carrier walking its load home', () => {
  it('steps down the walk field and records the drop-off that walk ends at', () => {
    const h = harness(onTheField);
    expect(runDropOffStep(h.ctx)).toBe('continue');
    expect(h.steps).toEqual([DESCENT_STEP]);
    expect(h.ctx.gatherer.dropOffBuildingId).toBe(WALK_NEAREST);
    expect(h.planLookups, 'no per-carrier search while the field answers').toBe(0);
  });

  it('falls back to the Manhattan-nearest drop-off and its approach plan when it stands off the field', () => {
    const h = harness(offTheField);
    runDropOffStep(h.ctx);
    expect(h.steps).toEqual([PLAN_STEP]);
    expect(h.ctx.gatherer.dropOffBuildingId).toBe(MANHATTAN_NEAREST);
    expect(h.planLookups).toBe(1);
  });

  it('falls back the same way when the owner has no drop-off for the kind', () => {
    const h = harness(null);
    runDropOffStep(h.ctx);
    expect(h.steps).toEqual([PLAN_STEP]);
    expect(h.planLookups).toBe(1);
  });

  it('deposits when the descent ends on the cell it stands on', () => {
    const h = harness({
      ...onTheField,
      descendFrom: () => ({ destination: AT, nextStep: AT, dropOffId: WALK_NEAREST }),
    });
    runDropOffStep(h.ctx);
    expect(h.steps).toEqual([]);
    expect(h.ctx.gatherer.task).toBe('idle');
    expect(h.ctx.gatherer.carriedAmount).toBe(0);
  });
});
