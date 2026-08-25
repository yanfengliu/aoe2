// AI building phase: reacts to fresh enemy sightings with a watch tower, then
// pursues a wonder or the next macro build target, honoring the concurrent-build
// cap and pending-intention gates.

import { playerCivilizationsCodec } from '../bridgeStateSerialize';
import { effectiveConstructionCost } from '../../civBonusEffects';
import type { BuildableBuildingType, BuildingComponent } from '../../types';
import { canAfford } from '../../prototypeEconomyRules';
import { pickNextBuildTarget, shouldPursueWonder } from '../../ai';
import { playerResourcesCodec } from '../bridgeStateSerialize';
import type { AiOwnerContext, AiSystemDeps } from './aiSystemTypes';

export function runBuildingPhase(deps: AiSystemDeps, ctx: AiOwnerContext): void {
  const {
    accessor,
    currentEntityId,
    findOwnedBuilding,
    isConstructingBuilding,
    pickWatchTowerPlacement,
    pushBuildingPlaceConfirmIntention,
    findBuildPlacementNear,
    countOwnedUnits,
    hasOwnedWonder,
  } = deps;
  const {
    activeWorld,
    owner,
    state,
    interval,
    currentTick,
    ownerTownCenterPosition,
    currentAge,
    stockpile,
    populationBlocked,
    claimedVillagers,
    findAvailableVillagerForBuild,
    pendingBuildsByOwner,
    unitCommands,
  } = ctx;
  // Civ-priced buildings: the AI pays the same discounted price a human does.
  const civilization = accessor.get(playerCivilizationsCodec).get(owner);

  if (ownerTownCenterPosition) {
    const sightingFresh =
      state.lastEnemySightingTick >= 0
      && currentTick - state.lastEnemySightingTick <= interval * 2;
    if (
      sightingFresh
      && state.lastEnemySightingPosition
      && !findOwnedBuilding(owner, 'watch-tower')
    ) {
      const builderId = findAvailableVillagerForBuild(owner);
      const anchor = pickWatchTowerPlacement(
        ownerTownCenterPosition,
        state.lastEnemySightingPosition,
      );
      // Phase 1C: gate on raw stockpile affordability (symmetry with
      // wonder/nextBuild paths below).
      const watchTowerCost = effectiveConstructionCost(civilization, 'watch-tower');
      if (
        builderId !== null
        && anchor
        && stockpile
        && canAfford(stockpile, watchTowerCost)
      ) {
        pushBuildingPlaceConfirmIntention(builderId, 'watch-tower', anchor);
        claimedVillagers.add(builderId);
        // Phase 1C: watch tower push happens BEFORE the ongoingBuilds
        // calculation below, so we must update pendingBuildsByOwner so
        // the calculation reflects this tick's push.
        pendingBuildsByOwner.set(
          owner,
          (pendingBuildsByOwner.get(owner) ?? 0) + 1,
        );
      }
    }

    // Farms are the one build target the AI wants SEVERAL of, so it needs a
    // count rather than the missing/present question the rest of the list asks.
    const countOwnedFarms = (): number => {
      let farms = 0;
      for (const id of activeWorld.query('building')) {
        const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
        if (building?.owner === owner && building.buildingType === 'farm') farms += 1;
      }
      return farms;
    };

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
    // Phase 1C: include pending building.placeConfirm intentions —
    // unitCommands.build only flips after the handler runs.
    ongoingBuilds += pendingBuildsByOwner.get(owner) ?? 0;
    const totalVillagers = countOwnedUnits(owner, 'villager');
    const maxConcurrentBuilds = Math.max(1, totalVillagers - 1);

    const aiResources = accessor.get(playerResourcesCodec).get(owner);
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
      const builderId = findAvailableVillagerForBuild(owner);
      const anchor = findBuildPlacementNear(ownerTownCenterPosition, 'wonder');
      const wonderCost = effectiveConstructionCost(civilization, 'wonder');
      if (
        builderId !== null
        && anchor
        && stockpile
        && canAfford(stockpile, wonderCost)
      ) {
        pushBuildingPlaceConfirmIntention(builderId, 'wonder', anchor);
        claimedVillagers.add(builderId);
        ongoingBuilds += 1;
      }
    }

    const nextBuild = pickNextBuildTarget(currentAge, missing, populationBlocked, {
      owned: countOwnedFarms(),
      villagerCount: countOwnedUnits(owner, 'villager'),
      // Farms outrank the rest of the build order only while the food is
      // actually short; a well-fed AI that keeps replacing depleted soil never
      // reaches the halls it has the resources for.
      food: stockpile?.food ?? 0,
    });
    if (nextBuild && ongoingBuilds < maxConcurrentBuilds && !wonderPursuit) {
      const builderId = findAvailableVillagerForBuild(owner);
      const anchor = findBuildPlacementNear(ownerTownCenterPosition, nextBuild);
      const buildCost = effectiveConstructionCost(civilization, nextBuild);
      if (
        builderId !== null
        && anchor
        && stockpile
        && canAfford(stockpile, buildCost)
      ) {
        pushBuildingPlaceConfirmIntention(builderId, nextBuild, anchor);
        claimedVillagers.add(builderId);
        ongoingBuilds += 1;
      }
    }
  }
}
