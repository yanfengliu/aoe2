// One-shot registration of every ECS system the bridge owns. Each call
// matches the per-system factory's deps interface; this module just
// bundles them into a single setup site so createSimulationBridge keeps
// only the side-map closures + factory wirings, not the per-system noise.

import type { RegisterAllSystemsDeps } from './registerAllSystemsTypes';
export type { RegisterAllSystemsDeps } from './registerAllSystemsTypes';

import { registerAiSystem } from './systems/aiSystem';
import { registerAutoAggressionSystem } from './systems/autoAggressionSystem';
import { registerConquestOutcomeSystem } from './systems/conquestOutcomeSystem';
import { registerFogMemorySystem } from './systems/fogMemorySystem';
import { registerHerdableMovementSystem } from './systems/herdableMovementSystem';
import { registerHerdableOwnershipSystem } from './systems/herdableOwnershipSystem';
import { registerMonkBehaviorSystem } from './systems/monkBehaviorSystem';
import { registerPlayerCommandsSystem } from './systems/playerCommandsSystem';
import { registerProductionQueueSystem } from './systems/productionQueueSystem';
import { registerRelicCountdownSystem } from './systems/relicCountdownSystem';
import { registerRelicGoldSystem } from './systems/relicGoldSystem';
import { registerScoutMovementSystem } from './systems/scoutMovementSystem';
import { registerTowerCombatSystem } from './systems/towerCombatSystem';
import { registerVillagerEconomySystem } from './systems/villagerEconomySystem';
import { registerVisibilitySystem } from './systems/visibilitySystem';
import { registerWildlifeCombatSystem } from './systems/wildlifeCombatSystem';
import { registerWinConditionResolverSystem } from './systems/winConditionResolverSystem';
import { registerWonderCountdownSystem } from './systems/wonderCountdownSystem';

export function registerAllSystems(deps: RegisterAllSystemsDeps): void {
  const {
    world,
    humanPlayerId,
    visibility,
    defaultRelicCountdownTicks,
    state,
    currentEntityId,
    getPlayerAge,
    villagerRebalance,
    findOwnedBuilding,
    findAvailableVillager,
    findOwnedUnit,
    findIdleProducer,
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
    findPreferredEnemyUnitInRadius,
    findPreferredEnemyBuildingInRadius,
    findPreferredVisibleEnemyUnitInRangeOfBuilding,
    findNearestHostileWildlifeTarget,
    issueUnitAttackCommand,
    issueUnitMoveCommand,
    clearUnitCommand,
    distanceToBuilding,
    advanceTrebuchetTransition,
    isTrebuchetStationary,
    isTrebuchetSilent,
    beginTrebuchetUnpack,
    beginTrebuchetPack,
    findUnitRangePlan,
    findBuildingApproachPlan,
    moveUnitOneSubgridStep,
    isUnitAtTarget,
    resolveMovePlanFromCache,
    markOutOfBandRenderChange,
    ensurePlayerScoreCounters,
    destroyUnitEntity,
    killWildlifeEntity,
    destroyBuildingEntity,
    destroyResourceEntity,
    getEntityRef,
    onBuildingConstructionComplete,
    applyMonkHeal,
    applyMonkConvert,
    applyMonkPickup,
    applyMonkDeposit,
    setPositionAndSyncOccupancy,
    syncUnitTransformToPosition,
    findBuildingSpawnPosition,
    addUnitEntity,
    applyTechnology,
    isCellPassableForUnit,
    isCellPassableForWildlife,
    isHarvestableResource,
    shouldMaintainGatheringOrder,
    findResourceApproachPlan,
    findNearestDropOffBuilding,
    findWildlifeRangePlan,
    getUnitTransform,
    findMovementPlan,
    getNearestMoveCandidates,
    isGarrisonedUnit,
    isMatchRunning,
    getOrCreateMemoryMap,
    currentRelicHoldingOwner,
    finalizeMatchEnd,
  } = deps;

  const {
    townCenterRefs,
    aiStates,
    population,
    playerResources,
    constructionStates,
    productionQueues,
    unitCommands,
    wildlifeStates,
    combatStates,
    buildingHealthStates,
    buildingCombatStates,
    monkTasks,
    monkConvertProcessedThisTick,
    monkCarriedRelic,
    monksByOwner,
    relicsInMonastery,
    rallyPoints,
    inFlightTechByOwner,
    sheepMoveOrders,
    gathererDropOffStuckSinceTick,
    trackedVisibilitySources,
    garrisonedByBuilding,
    wonderCountdowns,
    relicCountdowns,
    relicCountdownOverrides,
  } = state;

  registerAiSystem({
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
    findIdleProducer,
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
  });

  registerAutoAggressionSystem({
    world,
    humanPlayerId,
    unitCommands,
    aiStates,
    combatStates,
    isGarrisonedUnit,
    findPreferredEnemyUnitInRadius,
    findPreferredEnemyBuildingInRadius,
    issueUnitAttackCommand,
  });

  registerPlayerCommandsSystem({
    world,
    unitCommands,
    combatStates,
    buildingHealthStates,
    buildingCombatStates,
    constructionStates,
    wildlifeStates,
    population,
    clearUnitCommand,
    currentEntityId,
    distanceToBuilding,
    advanceTrebuchetTransition,
    isTrebuchetStationary,
    isTrebuchetSilent,
    beginTrebuchetUnpack,
    beginTrebuchetPack,
    findUnitRangePlan,
    findBuildingApproachPlan,
    moveUnitOneSubgridStep,
    isUnitAtTarget,
    resolveMovePlanFromCache,
    markOutOfBandRenderChange,
    ensurePlayerScoreCounters,
    destroyUnitEntity,
    killWildlifeEntity,
    destroyBuildingEntity,
    getEntityRef,
    onBuildingConstructionComplete,
  });

  registerMonkBehaviorSystem({
    world,
    monkTasks,
    monkConvertProcessedThisTick,
    monkCarriedRelic,
    distanceToBuilding,
    findBuildingApproachPlan,
    findUnitRangePlan,
    moveUnitOneSubgridStep,
    setPositionAndSyncOccupancy,
    applyMonkHeal,
    applyMonkConvert,
    applyMonkPickup,
    applyMonkDeposit,
  });

  registerRelicGoldSystem({ world, relicsInMonastery, playerResources });

  registerProductionQueueSystem({
    world,
    productionQueues,
    population,
    rallyPoints,
    inFlightTechByOwner,
    findBuildingSpawnPosition,
    addUnitEntity,
    issueUnitMoveCommand,
    applyTechnology,
  });

  registerScoutMovementSystem({
    world,
    humanPlayerId,
    unitCommands,
    isCellPassableForUnit,
    setPositionAndSyncOccupancy,
    syncUnitTransformToPosition,
  });

  registerVillagerEconomySystem({
    world,
    unitCommands,
    sheepMoveOrders,
    gathererDropOffStuckSinceTick,
    playerResources,
    aiStates,
    shouldMaintainGatheringOrder,
    findResourceApproachPlan,
    isHarvestableResource,
    isUnitAtTarget,
    moveUnitOneSubgridStep,
    destroyResourceEntity,
    findNearestDropOffBuilding,
    findBuildingApproachPlan,
    ensurePlayerScoreCounters,
  });

  registerWildlifeCombatSystem({
    world,
    wildlifeStates,
    combatStates,
    currentEntityId,
    getEntityRef,
    findNearestHostileWildlifeTarget,
    findWildlifeRangePlan,
    setPositionAndSyncOccupancy,
    destroyUnitEntity,
    markOutOfBandRenderChange,
  });

  registerHerdableOwnershipSystem({ world, markOutOfBandRenderChange });

  registerHerdableMovementSystem({
    world,
    sheepMoveOrders,
    getUnitTransform,
    findMovementPlan,
    getNearestMoveCandidates,
    isCellPassableForWildlife,
    moveUnitOneSubgridStep,
    markOutOfBandRenderChange,
  });

  registerVisibilitySystem({ world, visibility, trackedVisibilitySources });

  registerFogMemorySystem({
    world,
    humanPlayerId,
    visibility,
    getOrCreateMemoryMap,
  });

  registerTowerCombatSystem({
    world,
    constructionStates,
    buildingCombatStates,
    combatStates,
    garrisonedByBuilding,
    findPreferredVisibleEnemyUnitInRangeOfBuilding,
    destroyUnitEntity,
    markOutOfBandRenderChange,
    ensurePlayerScoreCounters,
  });

  registerWonderCountdownSystem({ world, wonderCountdowns, isMatchRunning });

  registerRelicCountdownSystem({
    world,
    relicCountdowns,
    relicCountdownOverrides,
    currentRelicHoldingOwner,
    defaultRelicCountdownTicks,
    isMatchRunning,
  });

  registerWinConditionResolverSystem({
    world,
    humanPlayerId,
    wonderCountdowns,
    relicCountdowns,
    isMatchRunning,
    finalizeMatchEnd,
  });

  registerConquestOutcomeSystem({
    world,
    humanPlayerId,
    playerResources,
    isMatchRunning,
    finalizeMatchEnd,
  });
}
