// One-shot registration of every ECS system the bridge owns. Each call
// matches the per-system factory's deps interface; this module just
// bundles them into a single setup site so createSimulationBridge keeps
// only the side-map closures + factory wirings, not the per-system noise.

import type { RegisterAllSystemsDeps } from './registerAllSystemsTypes';
import {
  playerCivilizationsCodec, buildingHealthStatesCodec } from './bridgeStateSerialize';
import { queuePostConstructionAutoGather } from './postConstructionAutoGather';
export type { RegisterAllSystemsDeps } from './registerAllSystemsTypes';

import { registerAiSystem } from './systems/aiSystem';
import { registerAutoAggressionSystem } from './systems/autoAggressionSystem';
import { registerFogMemorySystem } from './systems/fogMemorySystem';
import { registerGarrisonHealSystem } from './systems/garrisonHealSystem';
import { registerUnitRegenerationSystem } from './systems/unitRegenerationSystem';
import { registerBuildingDamageVariantSystem } from './systems/buildingDamageVariantSystem';
import { registerFreeTechnologySystem } from './systems/freeTechnologySystem';
import { registerMatchResolutionSystems } from './registerMatchResolutionSystems';
import { registerMonkBehaviorSystem } from './systems/monkBehaviorSystem';
import { registerPlayerCommandsSystem } from './systems/playerCommandsSystem';
import { registerProductionQueueSystem } from './systems/productionQueueSystem';
import { registerRelicGoldSystem } from './systems/relicGoldSystem';
import { registerScoutMovementSystem } from './systems/scoutMovementSystem';
import { registerPatrolSystem } from './systems/patrolSystem';
import { registerProjectileSystem } from './systems/projectileSystem';
import { registerTowerCombatSystem } from './systems/towerCombatSystem';
import { registerVillagerEconomySystem } from './systems/villagerEconomySystem';
import { registerWildlifeSystems } from './registerWildlifeSystems';
import { registerVisibilitySystem } from './systems/visibilitySystem';
import { createUnitAttackRecorder } from './unitAttackAnimationFeed';
import { createMovementTrafficOps } from './movementTrafficOps';
import { syncVisibilitySources } from './visibility';
import {
  createPlayerCommandVisibilityRevision,
  runBuildingDestructionVisibilityMutation,
} from './playerCommandVisibilityRevision';

export function registerAllSystems(deps: RegisterAllSystemsDeps): void {
  const {
    world,
    systemMode = 'live',
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
    findOwnedUnitOnMap,
    ownerHasUnitOnMap,
    ownedMilitaryUnitIds,
    ownedMilitaryUnitIdsOnMap,
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
    pushMarketActionIntention,
    pushTributeIntention,
    pushUnitContextIntention,
    pushBuildingPlaceConfirmIntention,
    pendingCommands,
    getTrainOptions,
    getResearchOptions,
    pushAiMonkTaskIntentions,
    pushMonkContextAtEntityIntention,
    pushUnitContextAtEntityIntention,
    pushBuildingActionIntention,
    findPreferredVisibleEnemyUnit,
    findPreferredVisibleEnemyBuilding,
    findPreferredEnemyUnitInRadius,
    findPreferredEnemyBuildingInRadius,
    findPreferredVisibleEnemyUnitInRangeOfBuilding,
    findNearestHostileWildlifeTarget,
    // Phase 1B unit.attack: aiSystem + autoAggressionSystem use the
    // intention pusher (AI-decision). `setUnitAttackCommandDirect` is the one
    // deterministic-resolution call site — wildlife retaliation, which cannot
    // go through auto-aggression because wildlife are resources, not units.
    pushUnitAttackIntention,
    setUnitAttackCommandDirect,
    hasPendingUnitCommand,
    // Phase 1B unit.move: aiSystem and productionQueueSystem each get a
    // distinct impl (pushUnitMoveIntention / setUnitMoveCommandDirect).
    // The bridge facade `issueUnitMoveCommand` is HUD-only — never threaded
    // into systems running inside `execute`.
    setUnitMoveCommandDirect,
    pushUnitMoveIntention,
    clearUnitCommand,
    setUnitCommand,
    resumePatrolLeg,
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
    resolveArrivalRedirect,
    resolveMovePlanFromCache,
    markOutOfBandRenderChange,
    notePassabilityChange,
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
    getUnitTargetTransformForPosition,
    findBuildingSpawnPosition,
    addUnitEntity,
    applyTechnology,
    isCellPassableForUnit,
    isCellPassableForWildlife,
    isHarvestableResource,
    isLandCell,
    shouldMaintainGatheringOrder,
    findResourceApproachPlan,
    findNearestDropOffBuilding,
    findDropOffWalkField,
    findWildlifeRangePlan,
    getUnitTransform,
    findMovementPlan,
    getNearestMoveCandidates,
    isGarrisonedUnit,
    garrisonUnit,
    isMatchRunning,
    getOrCreateMemoryMap,
    noteMemoryChanged,
    currentRelicHoldingOwner,
    finalizeMatchEnd,
    computePlayerScore,
    gameLength,
  } = deps;

  const { monkConvertProcessedThisTick, monksByOwner } = state;
  const syncCurrentVisibility = (): void => {
    syncVisibilitySources(world, visibility, accessor, visibilityFingerprints, visibilityCell);
  };
  const playerCommandVisibilityRevision = createPlayerCommandVisibilityRevision(world);
  const { resolveMovementTraffic } = createMovementTrafficOps({
    world,
    accessor,
    isCellPassableForUnit,
  });
  const moveUnitWithTraffic: typeof moveUnitOneSubgridStep = (
    entityId,
    nextStep,
    activeWorld = world,
    stepPerTick,
  ) => {
    const decision = resolveMovementTraffic(entityId, nextStep, activeWorld);
    if (decision.kind === 'wait') return null;
    return moveUnitOneSubgridStep(
      entityId,
      nextStep,
      activeWorld,
      stepPerTick,
      decision.laneAxis,
    );
  };
  const recordUnitAttack = createUnitAttackRecorder({
    world,
    state,
    accessor,
    visibility,
    // Player-command attacks resolve before the normal end-of-update visibility
    // system. Ensure the first impact and every post-mutation impact sees
    // current sources without rescanning them for an unchanged max-pop burst.
    ensureVisibilityCurrent: syncCurrentVisibility,
    getVisibilitySourceRevision: playerCommandVisibilityRevision.current,
  });

  if (systemMode === 'replay') {
    registerReplayPendingCommandDrainSystem(world, pendingCommands);
  }

  registerAiSystem({
    world,
    humanPlayerId,
    isLandCell,
    visibility,
    accessor,
    monksByOwner,
    currentEntityId,
    getPlayerAge,
    villagerRebalance,
    findOwnedBuilding,
    findOwnedUnitOnMap,
    ownerHasUnitOnMap,
    ownedMilitaryUnitIds,
    ownedMilitaryUnitIdsOnMap,
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
    pushMarketActionIntention,
    pushTributeIntention,
    pushUnitContextIntention,
    pushBuildingPlaceConfirmIntention,
    pendingCommands,
    getTrainOptions,
    getResearchOptions,
    pushAiMonkTaskIntentions,
    pushMonkContextAtEntityIntention,
    pushUnitContextAtEntityIntention,
    pushBuildingActionIntention,
    findPreferredVisibleEnemyUnit,
    findPreferredVisibleEnemyBuilding,
    // AI-decision system — uses the intention pushers per DESIGN v17 §6.5.
    submitUnitAttackIntention: pushUnitAttackIntention,
    submitUnitMoveIntention: pushUnitMoveIntention,
  });

  registerAutoAggressionSystem({
    world,
    humanPlayerId,
    accessor,
    isGarrisonedUnit,
    findPreferredEnemyUnitInRadius,
    findPreferredEnemyBuildingInRadius,
    hasPendingUnitCommand,
    // AI-decision system — uses the intention pusher per DESIGN v17 §6.5/§6.6.
    // `auto: true` (v0.3.141): a guard reaction must not wipe shift chains.
    submitUnitAttackIntention: (attackerId, targetId, targetKind) =>
      pushUnitAttackIntention(attackerId, targetId, targetKind, true),
  });

  registerPlayerCommandsSystem({
    world,
    accessor,
    clearUnitCommand,
    setUnitCommand,
    garrisonUnit,
    currentEntityId,
    distanceToBuilding,
    advanceTrebuchetTransition,
    isTrebuchetStationary,
    isTrebuchetSilent,
    beginTrebuchetUnpack,
    beginTrebuchetPack,
    findUnitRangePlan,
    findBuildingApproachPlan,
    moveUnitOneSubgridStep: (...args) => {
      playerCommandVisibilityRevision.runEntityMutation(args[0], () => {
        moveUnitWithTraffic(...args);
      });
    },
    isUnitAtTarget,
    resolveArrivalRedirect,
    syncUnitTransformToPosition,
    resolveMovePlanFromCache,
    markOutOfBandRenderChange,
    notePassabilityChange,
    ensurePlayerScoreCounters,
    destroyUnitEntity: (...args) => {
      playerCommandVisibilityRevision.runEntityMutation(args[0], () => {
        destroyUnitEntity(...args);
      });
    },
    killWildlifeEntity: (...args) => {
      playerCommandVisibilityRevision.runEntityMutation(args[0], () => {
        killWildlifeEntity(...args);
      });
    },
    destroyBuildingEntity: (...args) => {
      runBuildingDestructionVisibilityMutation(
        playerCommandVisibilityRevision,
        accessor,
        args[0],
        () => destroyBuildingEntity(...args),
      );
    },
    getEntityRef,
    recordUnitAttack,
    onBuildingConstructionComplete: (buildingId, owner, buildingType, visionSourceAdded) => {
      if (visionSourceAdded) {
        playerCommandVisibilityRevision.markMutation();
      }
      // Spec §6.2: queue auto-mine intentions for the camp's active builders
      // BEFORE the completion callback so the event ordering matches live and
      // replay identically (both derive from the same recorded build stream).
      queuePostConstructionAutoGather({
        world,
        accessor,
        pendingCommands,
        buildingId,
        buildingType,
      });
      onBuildingConstructionComplete(buildingId, owner, buildingType);
    },
  });

  registerMonkBehaviorSystem({
    world,
    accessor,
    monkConvertProcessedThisTick,
    distanceToBuilding,
    findBuildingApproachPlan,
    findUnitRangePlan,
    moveUnitOneSubgridStep: moveUnitWithTraffic,
    setPositionAndSyncOccupancy,
    applyMonkHeal,
    applyMonkConvert,
    applyMonkPickup,
    applyMonkDeposit,
  });

  registerRelicGoldSystem({ world, accessor });

  // Passive garrison heal: regenerates garrisoned units' HP each tick.
  // Update-phase, accessor-only (mirrors relicGoldSystem).
  registerGarrisonHealSystem({ world, accessor });
  // Self-healing units: the Berserk line, doubled by Berserkergang.
  registerUnitRegenerationSystem({ world, accessor, markOutOfBandRenderChange });
  registerBuildingDamageVariantSystem({ world, accessor, markOutOfBandRenderChange });
  // Civilization free technologies (spec §9.2): grants ride the same menu and
  // applier a paid research uses, just at zero cost the moment they open.
  registerFreeTechnologySystem({ world, accessor, getResearchOptions, applyTechnology });

  registerProductionQueueSystem({
    world,
    accessor,
    findBuildingSpawnPosition,
    addUnitEntity,
    // Deterministic-resolution system — uses the direct-mutation helper
    // per DESIGN v17 §6.4 B1 fix (mid-tick `submitWithResult` would violate
    // civ-engine's determinism contract).
    issueUnitMoveCommand: setUnitMoveCommandDirect,
    // Rally-on-resource auto-gather: the canonical harvestability predicate
    // gates which rally targets a new villager auto-gathers (excludes live
    // wildlife + relics).
    isHarvestableResource,
    applyTechnology,
  });

  registerScoutMovementSystem({
    world,
    humanPlayerId,
    accessor,
    unitAttackFeed: state.unitAttackFeed,
    isCellPassableForUnit,
    setPositionAndSyncOccupancy,
    getUnitTargetTransformForPosition,
  });

  registerVillagerEconomySystem({
    world,
    accessor,
    popQueuedEntityOrder: deps.popQueuedEntityOrder,
    hasQueuedEntityOrders: deps.hasQueuedEntityOrders,
    isLandCell,
    shouldMaintainGatheringOrder,
    findResourceApproachPlan,
    isHarvestableResource,
    isUnitAtTarget,
    moveUnitOneSubgridStep: moveUnitWithTraffic,
    destroyResourceEntity,
    findNearestDropOffBuilding,
    findBuildingApproachPlan,
    findDropOffWalkField,
    ensurePlayerScoreCounters,
  });

  registerWildlifeSystems({
    world,
    accessor,
    currentEntityId,
    getEntityRef,
    findNearestHostileWildlifeTarget,
    findWildlifeRangePlan,
    setPositionAndSyncOccupancy,
    destroyUnitEntity,
    markOutOfBandRenderChange,
    recordUnitAttack,
    setUnitAttackCommandDirect,
    isCellPassableForWildlife,
    getUnitTransform,
    findMovementPlan,
    getNearestMoveCandidates,
    moveUnitOneSubgridStep,
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
    getCivilizationOf: (owner) => accessor.get(playerCivilizationsCodec).get(owner),
    getOrCreateMemoryMap,
    noteMemoryChanged,
  });

  registerTowerCombatSystem({
    world,
    accessor,
    findPreferredVisibleEnemyUnitInRangeOfBuilding,
    // Keep the ordinary visibility snapshot immutable across the authoritative
    // tower pass, then publish final LOS once before output suppression and
    // checkpointing. Mid-pass refreshes make later tower damage depend on
    // building entity order and repeat the full source scan for every kill.
    destroyUnitEntity,
    refreshVisibilityAfterCombat: syncCurrentVisibility,
    markOutOfBandRenderChange,
    ensurePlayerScoreCounters,
  });

  // A patrol re-issues its next leg AFTER the command system cleared the last
  // one, so an arrival and a finished fight look the same from here.
  registerPatrolSystem({
    world,
    accessor,
    resumePatrolLeg,
  });

  // Projectiles land AFTER every system that can launch one this tick, so a
  // shot always spends at least one tick in the air (spec §10.4).
  registerProjectileSystem({
    world,
    accessor,
    damageBuilding: (buildingId, damage) => {
      const health = accessor.get(buildingHealthStatesCodec).get(buildingId);
      if (!health) return false;
      health.currentHp -= damage;
      accessor.markDirty(buildingHealthStatesCodec);
      if (health.currentHp > 0) return false;
      runBuildingDestructionVisibilityMutation(
        playerCommandVisibilityRevision,
        accessor,
        buildingId,
        () => destroyBuildingEntity(buildingId),
      );
      return true;
    },
    destroyUnitEntity,
    ensurePlayerScoreCounters,
    markOutOfBandRenderChange,
    refreshVisibilityAfterCombat: syncCurrentVisibility,
    isMatchRunning,
  });

  registerMatchResolutionSystems({
    world,
    humanPlayerId,
    accessor,
    isMatchRunning,
    finalizeMatchEnd,
    currentRelicHoldingOwner,
    defaultRelicCountdownTicks,
    computePlayerScore,
    gameLength,
  });
}

function registerReplayPendingCommandDrainSystem(world: RegisterAllSystemsDeps['world'], pendingCommands: RegisterAllSystemsDeps['pendingCommands']): void {
  world.registerSystem({
    name: 'aoe2ReplayPendingCommandDrain',
    phase: 'update',
    before: ['prototypeAi'],
    execute() {
      pendingCommands.length = 0;
    },
  });
}
