// AI planner driver. Runs once per `decisionIntervalTicks(difficulty)` for
// each AI-controlled owner. Each pass: refresh the plan + villager targets
// for the current age, react to scouted enemies, walk the build order,
// queue villager / military / monk training, kick research that's
// affordable, and dispatch the attack group when it crosses the
// age-gated threshold.

import { VisibilityMap, type EntityRef, type Position, type World } from 'civ-engine';
import type {
  BuildableBuildingType,
  BuildingComponent,
  BuildingType,
  PlayerResources,
  PopulationState,
  ProductionQueueEntry,
  ResearchableTechnologyType,
  ResourceComponent,
  TrainableUnitType,
  UnitComponent,
  UnitType,
} from '../../types';
import { type GameCommands, type GameEvents, type GameWorld } from '../pureHelpers';
import {
  AI_BASE_VISION_RADIUS,
  AI_MONK_COUNT_CAP,
  ageUpResourceBuffer,
  attackGroupSize,
  decisionIntervalTicks,
  pickNextAgeResearch,
  pickNextBuildTarget,
  pickUnitMix,
  planForAge,
  shouldPursueWonder,
  villagerTargetsEqual,
  villagerTargetsForAge,
  type AiState,
} from '../../ai';
import { canAfford, researchCost, trainingCost } from '../../prototypeEconomyRules';
import type { WildlifeState } from './systemTypes';

type CivWorld = World<GameEvents, GameCommands>;

interface UnitCommandLike {
  type: 'attack' | 'move' | 'build';
  targetEntityRef?: EntityRef | null;
  targetEntityKind?: 'unit' | 'building' | 'resource' | null;
  buildingRef?: EntityRef | null;
}

interface ConstructionStateLike {
  isComplete: boolean;
}

export interface AiSystemDeps {
  world: GameWorld;
  humanPlayerId: number;
  visibility: VisibilityMap;
  townCenterRefs: Map<number, EntityRef>;
  aiStates: Map<number, AiState>;
  population: Map<number, PopulationState>;
  playerResources: Map<number, PlayerResources>;
  constructionStates: Map<number, ConstructionStateLike>;
  productionQueues: Map<number, ProductionQueueEntry[]>;
  unitCommands: Map<number, UnitCommandLike>;
  wildlifeStates: Map<number, WildlifeState>;
  monksByOwner: Map<number, Set<number>>;
  currentEntityId: (activeWorld: CivWorld, ref: EntityRef | null | undefined) => number | null;
  getPlayerAge: (owner: number) => import('../../types').AgeType;
  villagerRebalance: (owner: number, targets: AiState['villagerTargets']) => void;
  findOwnedBuilding: (owner: number, buildingType: BuildingType) => number | null;
  findAvailableVillager: (owner: number) => number | null;
  findOwnedUnit: (owner: number, unitType: UnitType) => number | null;
  ownedMilitaryUnitIds: (owner: number) => Set<number>;
  findOwnedMilitaryUnits: (owner: number) => Array<{ id: number }>;
  hasOwnedWonder: (owner: number) => boolean;
  isConstructingBuilding: (owner: number, buildingType: BuildingType) => boolean;
  pickWatchTowerPlacement: (
    townCenterPosition: Position,
    enemyPosition: Position,
  ) => Position | null;
  startConstruction: (
    builderId: number,
    buildingType: BuildableBuildingType,
    anchor: Position,
  ) => boolean;
  findBuildPlacementNear: (
    nearby: Position,
    buildingType: BuildingType,
  ) => Position | null;
  countOwnedUnits: (owner: number, unitType: UnitType) => number;
  countQueuedUnits: (buildingId: number, unitType: TrainableUnitType) => number;
  canAdvanceToFeudalAge: (owner: number) => boolean;
  canAdvanceToCastleAge: (owner: number) => boolean;
  canAdvanceToImperialAge: (owner: number) => boolean;
  enqueueResearch: (buildingId: number, technologyType: ResearchableTechnologyType) => boolean;
  enqueueTraining: (buildingId: number, unitType: TrainableUnitType) => boolean;
  getTrainOptions: (owner: number, buildingType: BuildingType) => TrainableUnitType[];
  getResearchOptions: (
    owner: number,
    buildingType: BuildingType,
  ) => ResearchableTechnologyType[];
  assignAiMonkTasks: (owner: number) => void;
  findPreferredVisibleEnemyUnit: (owner: number, position: Position) => number | null;
  findPreferredVisibleEnemyBuilding: (owner: number, position: Position) => number | null;
  issueUnitAttackCommand: (
    attackerId: number,
    targetId: number,
    targetKind: 'unit' | 'building' | 'resource',
  ) => boolean;
  issueUnitMoveCommand: (unitId: number, target: Position) => boolean;
}

export function registerAiSystem(deps: AiSystemDeps): void {
  const {
    world,
    humanPlayerId,
    visibility,
    townCenterRefs,
    aiStates,
    population,
    playerResources,
    constructionStates,
    productionQueues,
    unitCommands,
    wildlifeStates,
    monksByOwner,
    currentEntityId,
    getPlayerAge,
    villagerRebalance,
    findOwnedBuilding,
    findAvailableVillager,
    findOwnedUnit,
    ownedMilitaryUnitIds,
    findOwnedMilitaryUnits,
    hasOwnedWonder,
    isConstructingBuilding,
    pickWatchTowerPlacement,
    startConstruction,
    findBuildPlacementNear,
    countOwnedUnits,
    countQueuedUnits,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    enqueueResearch,
    enqueueTraining,
    getTrainOptions,
    getResearchOptions,
    assignAiMonkTasks,
    findPreferredVisibleEnemyUnit,
    findPreferredVisibleEnemyBuilding,
    issueUnitAttackCommand,
    issueUnitMoveCommand,
  } = deps;

  world.registerSystem({
    name: 'prototypeAi',
    phase: 'update',
    execute(activeWorld) {
      const humanTownCenterId = currentEntityId(
        activeWorld,
        townCenterRefs.get(humanPlayerId),
      );
      const humanTownCenterPosition =
        humanTownCenterId === null
          ? null
          : activeWorld.getComponent<Position>(humanTownCenterId, 'position');

      const currentTick = activeWorld.tick;

      for (const [owner, state] of aiStates.entries()) {
        const interval = decisionIntervalTicks(state.difficulty);
        if (state.lastDecisionTick >= 0 && currentTick - state.lastDecisionTick < interval) {
          continue;
        }
        state.lastDecisionTick = currentTick;

        const ownerTownCenterId = currentEntityId(activeWorld, townCenterRefs.get(owner));
        const ownerTownCenterPosition =
          ownerTownCenterId === null
            ? null
            : activeWorld.getComponent<Position>(ownerTownCenterId, 'position');

        const currentAge = getPlayerAge(owner);
        const nextPlan = planForAge(currentAge);
        if (state.plan !== 'defend' && state.plan !== nextPlan) {
          state.plan = nextPlan;
        }

        const desiredTargets = villagerTargetsForAge(currentAge);
        if (!villagerTargetsEqual(state.villagerTargets, desiredTargets)) {
          state.villagerTargets = { ...desiredTargets };
        }
        villagerRebalance(owner, state.villagerTargets);

        if (ownerTownCenterPosition) {
          for (const enemyId of activeWorld.queryInRadius(
            ownerTownCenterPosition.x,
            ownerTownCenterPosition.y,
            AI_BASE_VISION_RADIUS,
            'position',
            'unit',
          )) {
            const enemyUnit = activeWorld.getComponent<UnitComponent>(enemyId, 'unit');
            const enemyPos = activeWorld.getComponent<Position>(enemyId, 'position');
            if (
              !enemyUnit
              || !enemyPos
              || enemyUnit.owner === owner
              || !visibility.isVisible(owner, enemyPos.x, enemyPos.y)
            ) {
              continue;
            }
            state.lastEnemySightingTick = currentTick;
            state.lastEnemySightingPosition = { x: enemyPos.x, y: enemyPos.y };
            break;
          }
        }

        const populationState = population.get(owner);
        const populationBlocked = Boolean(
          populationState && populationState.current >= populationState.cap,
        );

        // V5-8: precompute the owner's buildings grouped by type once
        // per decision tick. Pre-fix the AI called the closure-form
        // findIdleProducer 10–14 times per decision tick (one per unit
        // type in pickUnitMix + one per building type for research +
        // monastery), each doing a full world.query('building') scan.
        // This reduces it to one scan per decision tick. The local
        // findIdleProducerLocal preserves the V3-24 load-balanced
        // selection (least-loaded, id-tiebreak for save/load determinism).
        const ownerBuildingsByType = new Map<BuildingType, number[]>();
        for (const id of activeWorld.query('building')) {
          const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
          if (!building || building.owner !== owner) continue;
          const list = ownerBuildingsByType.get(building.buildingType);
          if (list) {
            list.push(id);
          } else {
            ownerBuildingsByType.set(building.buildingType, [id]);
          }
        }
        const findIdleProducerLocal = (buildingType: BuildingType): number | null => {
          const candidates = ownerBuildingsByType.get(buildingType);
          if (!candidates) return null;
          let bestId: number | null = null;
          let bestQueueLength = Number.POSITIVE_INFINITY;
          for (const id of candidates) {
            const construction = constructionStates.get(id);
            if (construction && !construction.isComplete) continue;
            const queueLength = productionQueues.get(id)?.length ?? 0;
            if (queueLength >= 2) continue;
            if (
              queueLength < bestQueueLength
              || (queueLength === bestQueueLength && bestId !== null && id < bestId)
            ) {
              bestId = id;
              bestQueueLength = queueLength;
            }
          }
          return bestId;
        };

        if (ownerTownCenterPosition) {
          const sightingFresh =
            state.lastEnemySightingTick >= 0
            && currentTick - state.lastEnemySightingTick <= interval * 2;
          if (
            sightingFresh
            && state.lastEnemySightingPosition
            && !findOwnedBuilding(owner, 'watch-tower')
          ) {
            const builderId = findAvailableVillager(owner);
            const anchor = pickWatchTowerPlacement(
              ownerTownCenterPosition,
              state.lastEnemySightingPosition,
            );
            if (builderId !== null && anchor) {
              startConstruction(builderId, 'watch-tower', anchor);
            }
          }

          const missing = (buildingType: BuildableBuildingType): boolean => {
            if (buildingType === 'house') {
              if (populationBlocked) {
                return !isConstructingBuilding(owner, 'house');
              }
              return false;
            }
            return !findOwnedBuilding(owner, buildingType);
          };

          let ongoingBuilds = 0;
          for (const [, cmd] of unitCommands.entries()) {
            if (cmd.type !== 'build') continue;
            const buildingRef = cmd.buildingRef;
            if (!buildingRef) continue;
            const bid = currentEntityId(activeWorld, buildingRef);
            if (bid === null) continue;
            const b = activeWorld.getComponent<BuildingComponent>(bid, 'building');
            if (b && b.owner === owner) ongoingBuilds += 1;
          }
          const totalVillagers = countOwnedUnits(owner, 'villager');
          const maxConcurrentBuilds = Math.max(1, totalVillagers - 1);

          const aiResources = playerResources.get(owner);
          const wonderPursuit =
            ownerTownCenterPosition !== null
            && aiResources !== undefined
            && shouldPursueWonder(
              currentAge,
              hasOwnedWonder(owner),
              countOwnedUnits(owner, 'villager'),
              aiResources,
            );
          if (wonderPursuit && ongoingBuilds < maxConcurrentBuilds) {
            const builderId = findAvailableVillager(owner);
            const anchor = findBuildPlacementNear(ownerTownCenterPosition, 'wonder');
            if (builderId !== null && anchor) {
              startConstruction(builderId, 'wonder', anchor);
            }
          }

          const nextBuild = pickNextBuildTarget(currentAge, missing, populationBlocked);
          if (nextBuild && ongoingBuilds < maxConcurrentBuilds && !wonderPursuit) {
            const builderId = findAvailableVillager(owner);
            const anchor = findBuildPlacementNear(ownerTownCenterPosition, nextBuild);
            if (builderId !== null && anchor) {
              startConstruction(builderId, nextBuild, anchor);
            }
          }
        }

        const nextAgeTech: ResearchableTechnologyType | null =
          currentAge === 'dark-age' ? 'feudal-age'
          : currentAge === 'feudal-age' ? 'castle-age'
          : currentAge === 'castle-age' ? 'imperial-age'
          : null;
        const savingForAgeUp = ((): boolean => {
          if (!nextAgeTech) return false;
          const s = playerResources.get(owner);
          if (!s) return false;
          const cost = researchCost(nextAgeTech);
          const foodTarget = cost.food ?? 0;
          const goldTarget = cost.gold ?? 0;
          const foodProgress = foodTarget > 0 ? s.food / foodTarget : 1;
          const goldProgress = goldTarget > 0 ? s.gold / goldTarget : 1;
          const minProgress = Math.min(foodProgress, goldProgress);
          return minProgress >= 0.6 && !canAfford(s, cost);
        })();

        if (ownerTownCenterId !== null) {
          const tcConstruction = constructionStates.get(ownerTownCenterId);
          if (!tcConstruction || tcConstruction.isComplete) {
            const stockpile = playerResources.get(owner);
            const bufferCost = ageUpResourceBuffer(currentAge);
            const hasBuffer = stockpile ? canAfford(stockpile, bufferCost) : false;
            const nextAge = pickNextAgeResearch(
              currentAge,
              (tech) => {
                if (tech === 'feudal-age') return canAdvanceToFeudalAge(owner);
                if (tech === 'castle-age') return canAdvanceToCastleAge(owner);
                if (tech === 'imperial-age') return canAdvanceToImperialAge(owner);
                return false;
              },
              (tech) => {
                const s = playerResources.get(owner);
                return s ? canAfford(s, researchCost(tech)) : false;
              },
            );
            if (nextAge && hasBuffer) {
              enqueueResearch(ownerTownCenterId, nextAge);
            }

            const tcQueue = productionQueues.get(ownerTownCenterId) ?? [];
            const villagerCap =
              currentAge === 'dark-age' ? 6
              : currentAge === 'imperial-age' ? 50
              : 14;
            const currentVillagers =
              countOwnedUnits(owner, 'villager') + countQueuedUnits(ownerTownCenterId, 'villager');
            if (
              !populationBlocked
              && !savingForAgeUp
              && currentVillagers < villagerCap
              && tcQueue.length < 2
            ) {
              enqueueTraining(ownerTownCenterId, 'villager');
            }
          }
        }

        const mix = pickUnitMix(currentAge);
        if (!savingForAgeUp) {
          for (const { unitType, producer } of mix) {
            const producerId = findIdleProducerLocal(producer);
            if (producerId === null) continue;
            const stockpile = playerResources.get(owner);
            if (!stockpile) continue;
            if (!canAfford(stockpile, trainingCost(unitType))) continue;
            if (!getTrainOptions(owner, producer).includes(unitType)) continue;
            enqueueTraining(producerId, unitType);
          }
        }

        if (!savingForAgeUp) {
          for (const buildingType of [
            'blacksmith',
            'archery-range',
            'barracks',
            'stable',
            'siege-workshop',
            'castle',
          ] as const) {
            const buildingId = findIdleProducerLocal(buildingType);
            if (buildingId === null) continue;
            const options = getResearchOptions(owner, buildingType);
            if (options.length === 0) continue;
            const stockpile = playerResources.get(owner);
            if (!stockpile) continue;
            for (const tech of options) {
              if (canAfford(stockpile, researchCost(tech))) {
                enqueueResearch(buildingId, tech);
                break;
              }
            }
          }
        }

        if (
          !savingForAgeUp
          && (currentAge === 'castle-age' || currentAge === 'imperial-age')
        ) {
          const monasteryId = findIdleProducerLocal('monastery');
          if (monasteryId !== null) {
            // V5-1: O(1) monk count via monksByOwner side map.
            const ownedMonks =
              (monksByOwner.get(owner)?.size ?? 0) + countQueuedUnits(monasteryId, 'monk');
            const stockpile = playerResources.get(owner);
            if (
              ownedMonks < AI_MONK_COUNT_CAP
              && stockpile
              && canAfford(stockpile, trainingCost('monk'))
              && getTrainOptions(owner, 'monastery').includes('monk')
            ) {
              enqueueTraining(monasteryId, 'monk');
            }
          }
        }

        // V5-1: O(1) skip-guard via monksByOwner side map. Iter-1 V4-12
        // used countOwnedUnits(owner, 'monk') for this gate, but
        // countOwnedUnits walks world.query('unit') — same cost as
        // assignAiMonkTasks itself, doubling the steady-state cost when
        // an AI has Monks. The side map is maintained in entityCreateOps,
        // entityDestroyOps, and monkTaskAppliers.flipConvertedUnit; rebuilt
        // on save-load.
        if ((monksByOwner.get(owner)?.size ?? 0) > 0) {
          assignAiMonkTasks(owner);
        }

        const liveMilitary = ownedMilitaryUnitIds(owner);
        state.attackGroup = state.attackGroup.filter((id) => liveMilitary.has(id));
        const militaryUnits = findOwnedMilitaryUnits(owner);
        for (const { id } of militaryUnits) {
          if (!state.attackGroup.includes(id)) {
            state.attackGroup.push(id);
          }
        }

        const threshold = attackGroupSize(currentAge);
        const shouldPush = state.attackGroup.length >= threshold;

        for (const id of state.attackGroup) {
          const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
          const position = activeWorld.getComponent<Position>(id, 'position');
          if (!unit || !position) continue;

          const currentCommand = unitCommands.get(id);
          if (currentCommand?.type === 'attack') {
            const targetId = currentEntityId(activeWorld, currentCommand.targetEntityRef);
            if (targetId !== null) {
              const hasUnitTarget =
                currentCommand.targetEntityKind === 'unit'
                && activeWorld.getComponent<UnitComponent>(targetId, 'unit')
                && activeWorld.getComponent<Position>(targetId, 'position');
              const hasBuildingTarget =
                currentCommand.targetEntityKind === 'building'
                && activeWorld.getComponent<BuildingComponent>(targetId, 'building')
                && activeWorld.getComponent<Position>(targetId, 'position');
              const hasResourceTarget =
                currentCommand.targetEntityKind === 'resource'
                && activeWorld.getComponent<ResourceComponent>(targetId, 'resource')
                && wildlifeStates.get(targetId)?.isAlive
                && activeWorld.getComponent<Position>(targetId, 'position');
              if (hasUnitTarget || hasBuildingTarget || hasResourceTarget) {
                continue;
              }
            }
          }

          const humanVillagerId = findOwnedUnit(humanPlayerId, 'villager');
          if (
            shouldPush
            && humanVillagerId !== null
            && issueUnitAttackCommand(id, humanVillagerId, 'unit')
          ) {
            continue;
          }

          const visibleTargetId = findPreferredVisibleEnemyUnit(owner, position);
          if (visibleTargetId !== null) {
            issueUnitAttackCommand(id, visibleTargetId, 'unit');
            continue;
          }

          const visibleBuildingId = findPreferredVisibleEnemyBuilding(owner, position);
          if (
            visibleBuildingId !== null
            && issueUnitAttackCommand(id, visibleBuildingId, 'building')
          ) {
            continue;
          }

          if (shouldPush) {
            if (
              humanTownCenterId !== null
              && issueUnitAttackCommand(id, humanTownCenterId, 'building')
            ) {
              continue;
            }

            if (humanTownCenterPosition) {
              issueUnitMoveCommand(id, humanTownCenterPosition);
            }
          }
        }
      }
    },
  });
}
