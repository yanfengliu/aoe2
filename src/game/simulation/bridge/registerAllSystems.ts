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
    accessor,
    visibilityCell,
    visibilityFingerprints,
    currentEntityId,
    getPlayerAge,
    villagerRebalance,
    findOwnedBuilding,
    findOwnedUnit,
    ownedMilitaryUnitIds,
    findOwnedMilitaryUnits,
    hasOwnedWonder,
    isConstructingBuilding,
    pickWatchTowerPlacement,
    findBuildPlacementNear,
    countOwnedUnits,
    countQueuedUnits,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    pushQueueResearchIntention,
    pushQueueTrainIntention,
    pushBuildingPlaceConfirmIntention,
    pendingCommands,
    getTrainOptions,
    getResearchOptions,
    assignAiMonkTasks,
    findPreferredVisibleEnemyUnit,
    findPreferredVisibleEnemyBuilding,
    findPreferredEnemyUnitInRadius,
    findPreferredEnemyBuildingInRadius,
    findPreferredVisibleEnemyUnitInRangeOfBuilding,
    findNearestHostileWildlifeTarget,
    // Phase 1B unit.attack: aiSystem + autoAggressionSystem use the
    // intention pusher (AI-decision). No deterministic-system call sites
    // for attack today, so no direct helper threaded through this layer.
    pushUnitAttackIntention,
    hasPendingUnitCommand,
    // Phase 1B unit.move: aiSystem and productionQueueSystem each get a
    // distinct impl (pushUnitMoveIntention / setUnitMoveCommandDirect).
    // The bridge facade `issueUnitMoveCommand` is HUD-only — never threaded
    // into systems running inside `execute`.
    setUnitMoveCommandDirect,
    pushUnitMoveIntention,
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
    aiStates,
    population,
    playerResources,
    constructionStates,
    unitCommands,
    wildlifeStates,
    combatStates,
    buildingHealthStates,
    buildingCombatStates,
    monkTasks,
    monkConvertProcessedThisTick,
    monksByOwner,
    inFlightTechByOwner,
  } = state;

  registerAiSystem({
    world,
    humanPlayerId,
    visibility,
    accessor,
    aiStates,
    population,
    playerResources,
    constructionStates,
    unitCommands,
    wildlifeStates,
    monksByOwner,
    currentEntityId,
    getPlayerAge,
    villagerRebalance,
    findOwnedBuilding,
    findOwnedUnit,
    ownedMilitaryUnitIds,
    findOwnedMilitaryUnits,
    hasOwnedWonder,
    isConstructingBuilding,
    pickWatchTowerPlacement,
    findBuildPlacementNear,
    countOwnedUnits,
    countQueuedUnits,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    pushQueueResearchIntention,
    pushQueueTrainIntention,
    pushBuildingPlaceConfirmIntention,
    pendingCommands,
    getTrainOptions,
    getResearchOptions,
    assignAiMonkTasks,
    findPreferredVisibleEnemyUnit,
    findPreferredVisibleEnemyBuilding,
    // AI-decision system — uses the intention pushers per DESIGN v17 §6.5.
    submitUnitAttackIntention: pushUnitAttackIntention,
    submitUnitMoveIntention: pushUnitMoveIntention,
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
    hasPendingUnitCommand,
    // AI-decision system — uses the intention pusher per DESIGN v17 §6.5/§6.6.
    submitUnitAttackIntention: pushUnitAttackIntention,
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
    accessor,
    monkTasks,
    monkConvertProcessedThisTick,
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

  registerRelicGoldSystem({ world, accessor, playerResources });

  registerProductionQueueSystem({
    world,
    population,
    accessor,
    inFlightTechByOwner,
    findBuildingSpawnPosition,
    addUnitEntity,
    // Deterministic-resolution system — uses the direct-mutation helper
    // per DESIGN v17 §6.4 B1 fix (mid-tick `submitWithResult` would violate
    // civ-engine's determinism contract).
    issueUnitMoveCommand: setUnitMoveCommandDirect,
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
    accessor,
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
    accessor,
    getUnitTransform,
    findMovementPlan,
    getNearestMoveCandidates,
    isCellPassableForWildlife,
    moveUnitOneSubgridStep,
    markOutOfBandRenderChange,
  });

  registerVisibilitySystem({
    world,
    visibility,
    accessor,
    visibilityCell,
    fingerprints: visibilityFingerprints,
  });

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
    accessor,
    findPreferredVisibleEnemyUnitInRangeOfBuilding,
    destroyUnitEntity,
    markOutOfBandRenderChange,
    ensurePlayerScoreCounters,
  });

  registerWonderCountdownSystem({ world, accessor, isMatchRunning });

  registerRelicCountdownSystem({
    world,
    accessor,
    currentRelicHoldingOwner,
    defaultRelicCountdownTicks,
    isMatchRunning,
  });

  registerWinConditionResolverSystem({
    world,
    humanPlayerId,
    accessor,
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
