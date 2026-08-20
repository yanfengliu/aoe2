// One tick of a villager carrying resources back to a drop-off. Extracted from
// ./villagerEconomySystem.ts for the 500-LOC budget: it is the only branch of
// that loop that reasons about the DEPOSIT rather than about the resource, and
// it carries its own reachability-reroute machinery.

import type { Position } from 'civ-engine';

import { gatherMultiplier } from '../../ai';
import type { AiState } from '../../ai';
import type { EconomyResourceKind, GathererComponent, UnitComponent } from '../../types';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { playerResourcesCodec } from '../bridgeStateSerialize';
import type { GameWorld } from '../pureHelpers';
import type { UnitMovementPlan } from '../movementTypes';
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

    // Hot path: head for the nearest drop-off by distance (unchanged).
    const nearestId = findNearestDropOffBuilding(activeWorld, unit.owner, carriedResource, position);
    let dropOffBuildingId = nearestId;
    let dropOffPlan = nearestId === null ? null : findBuildingApproachPlan(id, nearestId, 1, activeWorld);

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
      // TWO ATTEMPTS HAVE FAILED HERE — do not try a third of the same shape.
      //
      // A movement plan EXISTING is not the same as the step LANDING, so a
      // carrier whose next step is refused every tick is invisible to the
      // reachability reroute below, which only ever fires when no plan can be
      // found at all. That diagnosis is solid: traced at tick 20000, carriers
      // sit here with ten resources one cell from their own camp, indefinitely.
      //
      // What does NOT work, both measured on the default map against a baseline
      // of 18 villagers / gold climbing past 2400:
      //   1. setStuck on a single non-moving step  -> 10 villagers, Dark Age.
      //      One refused step latches the 30-tick retry skip, and transient
      //      crowding is constant, so every villager idles a third of its life.
      //   2. A CONSECUTIVE-miss count (150 ticks) in gatherProgressTicks, which
      //      is otherwise unused on this leg -> 9 villagers, gold frozen at 490.
      //      Still net-negative; gatherProgressTicks is also the gather timer,
      //      and a villager can re-enter `gathering` from here without
      //      depositing (the depleted-resource path), so the counter leaks into
      //      it.
      //
      // The next attempt should come from the TRAFFIC layer instead
      // (movementTrafficOps already builds a per-tick intent snapshot and knows
      // which movers are contending), not from another timer in this loop.
      clearStuck(id);
      moveUnitOneSubgridStep(id, dropOffPlan.nextStep, activeWorld);
    }
  }
  return 'continue';
}
