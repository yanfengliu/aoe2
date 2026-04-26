// Villager economy state machine. Each idle villager gets routed to its
// owner's nearest matching resource; once at the resource the gather loop
// counts ticks toward `gatherTicksFor(resourceType)` and drops carried
// resources at the nearest drop-off building. Drop-off retries are
// throttled so a stuck villager doesn't re-plan every tick.

import type { Position, World } from 'civ-engine';
import type {
  GathererComponent,
  PlayerResources,
  ResourceComponent,
  UnitComponent,
} from '../../types';
import { type GameCommands, type GameEvents, type GameWorld } from '../pureHelpers';
import {
  gatherAmountFor,
  gatherTicksFor,
  resourceKindToEconomyResource,
} from '../../prototypeEconomyRules';
import { gatherMultiplier } from '../../ai';
import type { UnitMovementPlan } from '../movementTypes';
import type { UnitCommand } from './systemTypes';

type CivWorld = World<GameEvents, GameCommands>;

const GATHER_DROPOFF_RETRY_INTERVAL = 30;

interface AiStateLike {
  difficulty: import('../../ai').DifficultyLevel;
}

interface PlayerScoreCountersLike {
  resourcesGathered: number;
}

export interface VillagerEconomySystemDeps {
  world: GameWorld;
  unitCommands: Map<number, UnitCommand>;
  sheepMoveOrders: Map<number, Position>;
  gathererDropOffStuckSinceTick: Map<number, number>;
  playerResources: Map<number, PlayerResources>;
  aiStates: Map<number, AiStateLike>;
  shouldMaintainGatheringOrder: (owner: number, gatherer: GathererComponent) => boolean;
  assignNearestResource: (
    activeWorld: CivWorld,
    villagerId: number,
    gatherer: GathererComponent,
    owner: number,
  ) => void;
  findResourceApproachPlan: (
    villagerId: number,
    resourceId: number,
    activeWorld: CivWorld,
  ) => UnitMovementPlan | null;
  isHarvestableResource: (id: number, resource: ResourceComponent) => boolean;
  isUnitAtTarget: (
    unitId: number,
    target: Position,
    activeWorld: CivWorld,
  ) => boolean;
  moveUnitOneSubgridStep: (
    entityId: number,
    nextStep: Position,
    activeWorld?: CivWorld,
    stepPerTick?: number,
  ) => void;
  destroyResourceEntity: (id: number) => void;
  findNearestDropOffBuilding: (
    activeWorld: CivWorld,
    owner: number,
    resource: 'food' | 'wood' | 'gold' | 'stone',
    position: Position,
  ) => number | null;
  findBuildingApproachPlan: (
    unitId: number,
    targetId: number,
    range: number,
    activeWorld: CivWorld,
  ) => UnitMovementPlan | null;
  ensurePlayerScoreCounters: (owner: number) => PlayerScoreCountersLike;
}

export function registerVillagerEconomySystem(deps: VillagerEconomySystemDeps): void {
  const {
    world,
    unitCommands,
    sheepMoveOrders,
    gathererDropOffStuckSinceTick,
    playerResources,
    aiStates,
    shouldMaintainGatheringOrder,
    assignNearestResource,
    findResourceApproachPlan,
    isHarvestableResource,
    isUnitAtTarget,
    moveUnitOneSubgridStep,
    destroyResourceEntity,
    findNearestDropOffBuilding,
    findBuildingApproachPlan,
    ensurePlayerScoreCounters,
  } = deps;

  world.registerSystem({
    name: 'prototypeVillagerEconomy',
    phase: 'update',
    after: ['prototypePlayerCommands'],
    execute(activeWorld) {
      for (const id of activeWorld.query('position', 'unit', 'gatherer')) {
        if (unitCommands.has(id)) {
          continue;
        }

        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        const position = activeWorld.getComponent<Position>(id, 'position');
        const gatherer = activeWorld.getComponent<GathererComponent>(id, 'gatherer');
        if (!unit || !position || !gatherer || unit.unitType !== 'villager') {
          continue;
        }

        if (gatherer.task === 'idle' && shouldMaintainGatheringOrder(unit.owner, gatherer)) {
          assignNearestResource(activeWorld, id, gatherer, unit.owner);
        }

        if (gatherer.task === 'to-resource') {
          const targetResource = gatherer.targetResourceId === null
            ? null
            : activeWorld.getComponent<ResourceComponent>(gatherer.targetResourceId, 'resource');
          const resourceApproachPlan = gatherer.targetResourceId === null
            ? null
            : findResourceApproachPlan(id, gatherer.targetResourceId, activeWorld);

          if (
            !targetResource
            || !isHarvestableResource(gatherer.targetResourceId ?? -1, targetResource)
            || !resourceApproachPlan
          ) {
            gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
            gatherer.targetResourceId = null;
          } else if (isUnitAtTarget(id, resourceApproachPlan.destination, activeWorld)) {
            gatherer.task = 'gathering';
            gatherer.gatherProgressTicks = 0;
            // A villager that has reached a sheep to harvest pins the sheep in
            // place. Any outstanding player move order on that sheep would
            // otherwise keep walking the sheep away each tick.
            if (
              gatherer.targetResourceId !== null
              && targetResource.resourceType === 'sheep'
            ) {
              sheepMoveOrders.delete(gatherer.targetResourceId);
            }
          } else {
            moveUnitOneSubgridStep(id, resourceApproachPlan.nextStep, activeWorld);
          }
        }

        if (gatherer.task === 'gathering') {
          if (gatherer.targetResourceId === null) {
            gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
          } else {
            const targetPosition = activeWorld.getComponent<Position>(
              gatherer.targetResourceId,
              'position',
            );
            const targetResource = activeWorld.getComponent<ResourceComponent>(
              gatherer.targetResourceId,
              'resource',
            );
            const resourceApproachPlan = findResourceApproachPlan(
              id,
              gatherer.targetResourceId,
              activeWorld,
            );

            if (
              !targetPosition
              || !targetResource
              || !isHarvestableResource(gatherer.targetResourceId, targetResource)
              || !resourceApproachPlan
              || !isUnitAtTarget(id, resourceApproachPlan.destination, activeWorld)
            ) {
              gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
              gatherer.targetResourceId = null;
              gatherer.gatherProgressTicks = 0;
            } else {
              gatherer.gatherProgressTicks += 1;
              if (
                gatherer.gatherProgressTicks
                >= gatherTicksFor(targetResource.resourceType)
              ) {
                gatherer.gatherProgressTicks = 0;
                const carriedResource = resourceKindToEconomyResource(targetResource.resourceType);
                if (carriedResource === null) {
                  gatherer.task = 'idle';
                  gatherer.targetResourceId = null;
                  continue;
                }
                const gatherAmount = Math.min(
                  gatherAmountFor(targetResource.resourceType),
                  targetResource.amount,
                  gatherer.carryCapacity - gatherer.carriedAmount,
                );
                targetResource.amount -= gatherAmount;
                gatherer.carriedResource = carriedResource;
                gatherer.carriedAmount += gatherAmount;

                if (targetResource.amount <= 0) {
                  const depletedResourceId = gatherer.targetResourceId;
                  gatherer.targetResourceId = null;
                  if (depletedResourceId !== null) {
                    destroyResourceEntity(depletedResourceId);
                  }
                }

                if (targetResource.amount <= 0 || gatherer.carriedAmount >= gatherer.carryCapacity) {
                  gatherer.task = 'to-dropoff';
                }
              }
            }
          }
        }

        if (gatherer.task === 'to-dropoff') {
          const carriedResource = gatherer.carriedResource;
          if (carriedResource === null || gatherer.carriedAmount <= 0) {
            gatherer.task = 'idle';
            gatherer.carriedAmount = 0;
            gatherer.carriedResource = null;
            gathererDropOffStuckSinceTick.delete(id);
            continue;
          }

          const stuckSince = gathererDropOffStuckSinceTick.get(id);
          const shouldRetry = stuckSince === undefined
            || (activeWorld.tick - stuckSince) >= GATHER_DROPOFF_RETRY_INTERVAL;
          if (!shouldRetry) {
            continue;
          }

          const dropOffId = findNearestDropOffBuilding(
            activeWorld,
            unit.owner,
            carriedResource,
            position,
          );
          gatherer.dropOffBuildingId = dropOffId;
          const dropOffPlan = dropOffId === null
            ? null
            : findBuildingApproachPlan(id, dropOffId, 1, activeWorld);

          if (!dropOffPlan) {
            gathererDropOffStuckSinceTick.set(id, activeWorld.tick);
          } else if (isUnitAtTarget(id, dropOffPlan.destination, activeWorld)) {
            const stockpile = playerResources.get(unit.owner);
            const aiState = aiStates.get(unit.owner);
            const multiplier = aiState ? gatherMultiplier(aiState.difficulty) : 1;
            const deposited = Math.round(gatherer.carriedAmount * multiplier);
            if (stockpile) {
              stockpile[carriedResource] += deposited;
            }
            ensurePlayerScoreCounters(unit.owner).resourcesGathered += deposited;
            gatherer.task = 'idle';
            gatherer.carriedAmount = 0;
            gatherer.carriedResource = null;
            gatherer.targetResourceId = null;
            gatherer.gatherProgressTicks = 0;
            gathererDropOffStuckSinceTick.delete(id);
          } else {
            gathererDropOffStuckSinceTick.delete(id);
            moveUnitOneSubgridStep(id, dropOffPlan.nextStep, activeWorld);
          }
        }

        if (gatherer.task === 'idle' && shouldMaintainGatheringOrder(unit.owner, gatherer)) {
          assignNearestResource(activeWorld, id, gatherer, unit.owner);
        }
      }
    },
  });
}
