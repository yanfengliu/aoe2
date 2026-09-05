// One tick of a villager carrying resources back to a drop-off. Extracted from
// ./villagerEconomySystem.ts for the 500-LOC budget: it is the only branch of
// that loop that reasons about the DEPOSIT rather than about the resource, and
// it carries its own reachability-reroute machinery.
//
// The delivery walk follows the drop-off WALK FIELD (2026-09-05, register
// entry 2026-09-01). It used to pick the Manhattan-nearest drop-off and then
// the first ring cell of it an A* could reach, in Manhattan order — so on
// Nomad a loaded villager at (14,14) was handed a 27-step loop around its base
// to the Manhattan-nearest ring cell while its neighbour at (15,14) got the
// 10-step route to the next ring cell THROUGH (14,14), and fourteen carriers
// shuffled into each other for 21,000 ticks. Descending the field gives every
// carrier the true shortest route to the walk-nearest ring cell of the
// walk-nearest drop-off, and every carrier on a cell the same route, with no
// per-carrier search at all. The A*-and-reroute path below is now the
// fallback for a carrier standing off the field: boxed in, or with no
// drop-off at all.

import type { Position } from 'civ-engine';

import { gatherMultiplier } from '../../ai';
import type { AiState } from '../../ai';
import type { EconomyResourceKind, GathererComponent, UnitComponent } from '../../types';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { playerResourcesCodec } from '../bridgeStateSerialize';
import type { GameWorld } from '../pureHelpers';
import type { UnitMovementPlan } from '../movementTypes';
import type { DropOffWalkField } from '../dropOffWalkField';
import {
  findReachableDropOff,
  type DropOffAssignmentDeps,
} from '../villagerDropOffAssignment';

const GATHER_DROPOFF_RETRY_INTERVAL = 30;

export interface DropOffStepContext {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  id: number;
  unit: UnitComponent;
  gatherer: GathererComponent;
  position: Position;
  aiStates: ReadonlyMap<number, AiState>;
  stuckMap: Map<number, number>;
  setStuck: (id: number, tick: number) => void;
  clearStuck: (id: number) => void;
  dropOffDeps: DropOffAssignmentDeps;
  findNearestDropOffBuilding: (
    world: GameWorld,
    owner: number,
    resource: EconomyResourceKind,
    position: Position,
  ) => number | null;
  findBuildingApproachPlan: (
    unitId: number,
    buildingId: number,
    range: number,
    world: GameWorld,
  ) => UnitMovementPlan | null;
  /** The walk field for the carried kind (dropOffWalkField.ts); null when
   *  the owner has no drop-off for it. */
  findDropOffWalkField: (
    world: GameWorld,
    owner: number,
    kind: EconomyResourceKind,
    probeUnitId: number,
  ) => DropOffWalkField | null;
  isUnitAtTarget: (unitId: number, target: Position, world: GameWorld) => boolean;
  moveUnitOneSubgridStep: (unitId: number, step: Position, world: GameWorld) => void;
  ensurePlayerScoreCounters: (owner: number) => { resourcesGathered: number };
}

  export function runDropOffStep(ctx: DropOffStepContext): 'handled' | 'continue' {
  const {
    world: activeWorld,
    accessor,
    id,
    unit,
    gatherer,
    position,
    aiStates,
    stuckMap,
    setStuck,
    clearStuck,
    dropOffDeps,
    findNearestDropOffBuilding,
    findBuildingApproachPlan,
    findDropOffWalkField,
    isUnitAtTarget,
    moveUnitOneSubgridStep,
    ensurePlayerScoreCounters,
  } = ctx;
  {
    const carriedResource = gatherer.carriedResource;
    if (carriedResource === null || gatherer.carriedAmount <= 0) {
      gatherer.task = 'idle';
      gatherer.carriedAmount = 0;
      gatherer.carriedResource = null;
      clearStuck(id);
      return 'handled';
    }

    const stuckSince = stuckMap.get(id);
    const shouldRetry = stuckSince === undefined
      || (activeWorld.tick - stuckSince) >= GATHER_DROPOFF_RETRY_INTERVAL;
    if (!shouldRetry) {
      return 'handled';
    }

    // Hot path: down the walk field — the true shortest route to the
    // walk-nearest ring cell of the walk-nearest drop-off (see the header).
    const descent = findDropOffWalkField(activeWorld, unit.owner, carriedResource, id)
      ?.descendFrom(position) ?? null;
    let dropOffBuildingId: number | null = descent?.dropOffId ?? null;
    let dropOffPlan: UnitMovementPlan | null = descent
      ? { destination: descent.destination, nextStep: descent.nextStep }
      : null;

    if (!descent) {
      // Off the field: the legacy search. Nearest drop-off by Manhattan
      // distance, then its approach plan.
      const nearestId = findNearestDropOffBuilding(activeWorld, unit.owner, carriedResource, position);
      dropOffBuildingId = nearestId;
      dropOffPlan = nearestId === null ? null : findBuildingApproachPlan(id, nearestId, 1, activeWorld);

      // Reachability reroute (recovery path only): if the nearest drop-off
      // is unreachable AND the villager has been stuck a full retry interval
      // on it (stuckSince set → a retry, not the first block), look past it
      // for the nearest REACHABLE drop-off so a persistently boxed-in
      // villager isn't latched forever (AI-vs-AI grounding regression — the
      // symmetric twin of the v0.1.47 resource reroute). Transient blocking
      // (< one interval) still just waits → hot path byte-identical.
      if (!dropOffPlan && stuckSince !== undefined) {
        const reachable = findReachableDropOff(
          dropOffDeps, activeWorld, unit.owner, carriedResource, id, position,
        );
        if (reachable) {
          dropOffBuildingId = reachable.buildingId;
          dropOffPlan = reachable.plan;
        }
      }
    }
    gatherer.dropOffBuildingId = dropOffBuildingId;

    if (!dropOffPlan) {
      setStuck(id, activeWorld.tick);
    } else if (isUnitAtTarget(id, dropOffPlan.destination, activeWorld)) {
      const stockpile = accessor.get(playerResourcesCodec).get(unit.owner);
      const aiState = aiStates.get(unit.owner);
      const multiplier = aiState ? gatherMultiplier(aiState.difficulty) : 1;
      const deposited = Math.round(gatherer.carriedAmount * multiplier);
      if (stockpile) {
        stockpile[carriedResource] += deposited;
        accessor.markDirty(playerResourcesCodec);
      }
      ensurePlayerScoreCounters(unit.owner).resourcesGathered += deposited;
      gatherer.task = 'idle';
      gatherer.carriedAmount = 0;
      gatherer.carriedResource = null;
      gatherer.targetResourceId = null;
      gatherer.gatherProgressTicks = 0;
      clearStuck(id);
    } else {
      // SOLVED 2026-08-20, and NOT here — three attempts in this loop failed
      // because the defect was never in it. A movement plan existing is not the
      // same as the step landing, and the refusals were coming from traffic
      // arbitration: every wedged carrier was told to wait on every tick, by
      // `movementTrafficOps`, forever. Three separate rules there each admitted
      // nobody in a head-on jam (see that file). The three fixes tried here —
      // `setStuck` on a single non-moving step, a consecutive-miss count, and
      // wiring `resolveArrivalRedirect` — are recorded in
      // `docs/devlog/detailed/2026-08-17_2026-08-20.md` with their numbers.
      //
      // The lead they left behind was wrong: four carriers appearing to share
      // one fine transform read as broken slot allocation, and slot allocation
      // was fine. What made them look identical is that none of them had moved.
      // The instrument to reach for first is a per-unit count of the traffic
      // DECISION, not the transform.
      clearStuck(id);
      moveUnitOneSubgridStep(id, dropOffPlan.nextStep, activeWorld);
    }
  }
  return 'continue';
}
