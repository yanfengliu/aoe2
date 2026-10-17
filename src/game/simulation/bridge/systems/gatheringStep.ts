// The `gathering` leg of the gatherer state machine: one tick of a gatherer
// standing at its node. Extracted from villagerEconomySystem for the 500-line
// budget when work 131 gave the node that runs out its carry-on (spec §6.4,
// "Carrying on when a resource runs out"). It owns every way a swing can end:
// the node went away, the node came under enemy arrows, the gatherer is no
// longer beside it, or the swing lands — and, when that swing empties the
// node, what every gatherer of the node does next.

import type { Position } from 'civ-engine';

import type {
  GathererComponent,
  ResearchableTechnologyType,
  ResourceComponent,
  UnitComponent,
} from '../../types';
import type { GameWorld } from '../pureHelpers';
import type { UnitMovementPlan } from '../movementTypes';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import {
  gatherAmountFor,
  gatherTicksFor,
  resourceKindToEconomyResource,
} from '../../prototypeEconomyRules';
import {
  effectiveCarryCapacity,
  heavyPlowFarmCarryBonus,
  gatherRateMultiplierForKind,
} from '../../economyTechEffects';
import { civCarryBonus, civFishingShipRateMultiplier,
  civGatherRateMultiplier, civResourceDurationMultiplier } from '../../civBonusEffects';
import { tryReseedFarm } from '../farmReseed';
import { payGatherSwing } from './gatherCredit';
import { playerAgesCodec } from '../bridgeStateSerialize';
import { retargetOutOfEnemyDefence } from '../enemyDefenceRetarget';
import type { EnemyStaticDefenceLookup } from '../enemyDefenceRange';
import type {
  AssignNearestResourceOptions,
  AssignmentOutcome,
  GatherAssignmentDeps,
} from '../villagerGatherAssignment';
import { carryOnFromEndedNode } from '../gatherCarryOn';

// Stable empty-set sentinel for owners with no researched techs, so the
// per-gather-tick gatherRateMultiplierForKind lookup never allocates.
const NO_RESEARCHED_TECHS: ReadonlySet<ResearchableTechnologyType> = new Set();

export interface GatheringStepContext {
  activeWorld: GameWorld;
  accessor: BridgeStateAccessor;
  id: number;
  unit: UnitComponent;
  gatherer: GathererComponent;
  /** The human player re-tasks this villager (gatherCarryOn.isPlayerTaskedVillager). */
  playerTasked: boolean;
  gatherTargetCounts: Map<number, number>;
  spreadCap: number;
  researchedTechnologies: ReadonlyMap<number, ReadonlySet<ResearchableTechnologyType>>;
  playerCivilizations: ReadonlyMap<number, string>;
  creditDeps: Parameters<typeof payGatherSwing>[0];
  carryOnDeps: GatherAssignmentDeps;
  enemyStaticDefences: EnemyStaticDefenceLookup;
  assignResource: (
    activeWorld: GameWorld,
    villagerId: number,
    gatherer: GathererComponent,
    owner: number,
    gatherTargetCounts: Map<number, number>,
    options: AssignNearestResourceOptions,
  ) => AssignmentOutcome;
  findResourceApproachPlan: (villagerId: number, resourceId: number, activeWorld: GameWorld) => UnitMovementPlan | null;
  isHarvestableResource: (id: number, resource: ResourceComponent) => boolean;
  isUnitAtTarget: (unitId: number, target: Position, activeWorld: GameWorld) => boolean;
  destroyResourceEntity: (id: number) => void;
  endExplicitOrderIfChained: (id: number, gatherer: GathererComponent) => void;
  hasQueuedEntityOrders: (unitId: number) => boolean;
}

/** Advances one gatherer at its node. 'skip' ends this gatherer's tick. */
export function runGatheringStep(ctx: GatheringStepContext): 'skip' | 'continue' {
  const {
    activeWorld, accessor, id, unit, gatherer, gatherTargetCounts,
    researchedTechnologies, playerCivilizations, creditDeps,
    findResourceApproachPlan, isHarvestableResource, isUnitAtTarget,
    destroyResourceEntity, endExplicitOrderIfChained,
  } = ctx;
  if (gatherer.targetResourceId === null) {
    gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
    endExplicitOrderIfChained(id, gatherer);
    return 'continue';
  }
  const targetPosition = activeWorld.getComponent<Position>(gatherer.targetResourceId, 'position');
  // A node that came under enemy arrows since this villager started on it —
  // a tower or Castle completed beside it — is left for a safe one now, not
  // after the load that would get it killed. Any partial carry goes home
  // with it.
  if (targetPosition && retargetOutOfEnemyDefence({
    activeWorld, id, owner: unit.owner, gatherer, gatherTargetCounts,
    targetPosition, enemyDefences: ctx.enemyStaticDefences(activeWorld, unit.owner),
    spreadCap: ctx.spreadCap, assignResource: ctx.assignResource,
  })) {
    return 'skip';
  }
  const targetResource = activeWorld.getComponent<ResourceComponent>(gatherer.targetResourceId, 'resource');
  const resourceApproachPlan = findResourceApproachPlan(id, gatherer.targetResourceId, activeWorld);
  const harvestable = targetResource !== undefined
    && isHarvestableResource(gatherer.targetResourceId, targetResource);

  if (
    !targetPosition
    || !targetResource
    || !harvestable
    || !resourceApproachPlan
    || !isUnitAtTarget(id, resourceApproachPlan.destination, activeWorld)
  ) {
    if (targetPosition && harvestable && ctx.playerTasked) {
      // The node still stands; the villager is no longer beside it — bumped
      // off its spot, or its spot is taken. It walks back to the SAME node
      // with whatever it holds, as DE's does; the walk owns a node it cannot
      // reach (toResourceStep). The computer's villager drops it and is
      // re-tasked, as before.
      gatherer.task = 'to-resource';
      gatherer.gatherProgressTicks = 0;
      return 'continue';
    }
    gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
    gatherer.targetResourceId = null;
    gatherer.gatherProgressTicks = 0;
    endExplicitOrderIfChained(id, gatherer);
    return 'continue';
  }

  // Rate accumulation: add the owner's gather-rate multiplier each tick and
  // complete a gather cycle when it crosses the base cadence, carrying the
  // remainder so stacked gather-rate techs raise throughput faithfully even
  // at tiny base cadences (mirrors ticksToGatherCarry).
  const ownerTechs = researchedTechnologies.get(unit.owner) ?? NO_RESEARCHED_TECHS;
  // Tech gather-rate × civ gather bonus (Britons shepherds +25% on sheep).
  // Both DERIVED from persisted per-owner state; a non-bonus civ multiplies
  // by 1 so every other owner is byte-identical.
  gatherer.gatherProgressTicks += gatherRateMultiplierForKind(
    ownerTechs,
    targetResource.resourceType,
  ) * civGatherRateMultiplier(
    playerCivilizations.get(unit.owner),
    targetResource.resourceType,
  ) * civFishingShipRateMultiplier(
    playerCivilizations.get(unit.owner),
    unit.unitType,
    accessor.get(playerAgesCodec).get(unit.owner) ?? 'dark-age',
  );
  const cycleGatherTicks = gatherTicksFor(targetResource.resourceType);
  if (gatherer.gatherProgressTicks < cycleGatherTicks) return 'continue';
  gatherer.gatherProgressTicks -= cycleGatherTicks;
  const carriedResource = resourceKindToEconomyResource(targetResource.resourceType);
  if (carriedResource === null) {
    gatherer.task = 'idle';
    gatherer.targetResourceId = null;
    return 'skip';
  }
  // Carry techs (Wheelbarrow / Hand Cart) multiply; civilization carry
  // bonuses (Aztecs +3, Goth hunters +15) add to the BASE first, AoE2's own
  // order.
  const carryCapacity = effectiveCarryCapacity(
    ownerTechs,
    gatherer.carryCapacity
      + civCarryBonus(playerCivilizations.get(unit.owner), targetResource.resourceType)
      // Heavy Plow's "+1 food" carry clause, farms only.
      + heavyPlowFarmCarryBonus(ownerTechs, targetResource.resourceType),
  );
  // "Resources last longer" (Mayans, Goth hunted animals): the swing yields a
  // full load and the node loses the load divided by the bonus, so a node
  // yields its amount times the bonus. The swing that takes the last of that
  // yield empties the node; capping it at the bare amount instead left a node
  // below one swing losing a fixed fraction per swing, and a Mayan villager
  // stood at an empty bush for twenty minutes (until v0.3.248).
  const duration = civResourceDurationMultiplier(
    playerCivilizations.get(unit.owner),
    targetResource.resourceType,
  );
  const yieldLeft = targetResource.amount * duration;
  // Never below 0: hands fuller than this resource's carry (11 food from a
  // Heavy Plow farm, sent to a 10-food bush) took a negative swing that grew
  // the node (work 120 M4 review).
  const gatherAmount = Math.max(0, Math.min(
    gatherAmountFor(targetResource.resourceType),
    yieldLeft,
    carryCapacity - gatherer.carriedAmount,
  ));
  targetResource.amount = gatherAmount >= yieldLeft
    ? 0
    : targetResource.amount - gatherAmount / duration;
  // A Khmer farmer pays its food in where it stands, and a Portuguese
  // forager earns wood beside its food (gatherCredit.ts).
  if (!payGatherSwing(creditDeps, unit.owner, gatherer, targetResource.resourceType, gatherAmount)) {
    gatherer.carriedResource = carriedResource;
    gatherer.carriedAmount += gatherAmount;
  }

  // Capture depletion BEFORE a reseed refills `amount` (so the villager still
  // drops off its carry this cycle either way). M1 Farms (slice 2): a
  // depleted FARM whose owner affords the 60-wood reseed is refilled in place
  // (same entity, target kept) so gathering continues; everything else is
  // removed as before.
  const depleted = targetResource.amount <= 0;
  const depletedId = gatherer.targetResourceId; // non-null here
  if (depleted && !tryReseedFarm(activeWorld, accessor, depletedId, targetResource)) {
    // The node is gone, and only a target that actually ENDED ends anything —
    // a farm reseeded in place keeps both the flag and the farmer. Every
    // gatherer of the node carries on from it (§6.4), this one included, with
    // what it holds; a full load still goes home first, and the next node
    // waits for it.
    carryOnFromEndedNode({
      deps: ctx.carryOnDeps,
      world: activeWorld,
      ended: { id: depletedId, resourceType: targetResource.resourceType, position: targetPosition },
      gatherTargetCounts,
      spreadCap: ctx.spreadCap,
      hasQueuedEntityOrders: ctx.hasQueuedEntityOrders,
    });
    destroyResourceEntity(depletedId);
    if (gatherer.task === 'to-resource' && gatherer.carriedAmount >= carryCapacity) {
      gatherer.task = 'to-dropoff';
    }
    return 'continue';
  }
  if (gatherer.carriedAmount <= 0) {
    // Empty hands (a Khmer farmer's) take nothing home: it farms a reseeded
    // Farm on.
    if (gatherer.targetResourceId === null) gatherer.task = 'idle';
  } else if (depleted || gatherer.carriedAmount >= carryCapacity) {
    gatherer.task = 'to-dropoff';
  }
  return 'continue';
}
