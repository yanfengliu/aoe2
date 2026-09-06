import type { Position } from 'civ-engine';
// AI building phase: reacts to fresh enemy sightings with a watch tower, then
// pursues a wonder or the next macro build target, honoring the concurrent-build
// cap and pending-intention gates.

import { ownerConstructionCost } from '../ownerCosts';
import type { BuildableBuildingType, BuildingComponent } from '../../types';
import { canAfford } from '../../prototypeEconomyRules';
import { pickNextBuildTarget, shouldPursueWonder } from '../../ai';
import { matchSettingsCodec, playerResourcesCodec } from '../bridgeStateSerialize';
import { dropOffAnchorFor } from './dropOffAnchor';
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
    ownerTownCenterId,
  } = ctx;

  // Nomad opening (§5.4): with no Town Center at all, everything else waits.
  // A wood DROPSITE is the only road to the TC's 275 wood, so the lumber camp
  // comes first; the TC follows the moment it is affordable. Gated on the TC
  // actually being PLACEABLE — the nomad flag, or Castle Age on any map (a
  // TC-less Castle-Age AI rebuilds) — so an ordinary Dark-Age fixture without
  // a TC keeps its old no-op behavior.
  const townCenterPlaceable = Boolean(accessor.get(matchSettingsCodec).nomadStart)
    || currentAge === 'castle-age' || currentAge === 'imperial-age';
  if (ownerTownCenterId === null && townCenterPlaceable) {
    if ((pendingBuildsByOwner.get(owner) ?? 0) > 0) return;
    const builderId = findAvailableVillagerForBuild(owner);
    if (builderId === null) return;
    const builderPosition = activeWorld.getComponent<Position>(builderId, 'position');
    if (!builderPosition) return;
    const townCenterCost = ownerConstructionCost(accessor, owner, 'town-center');
    if (stockpile && canAfford(stockpile, townCenterCost)) {
      const anchor = findBuildPlacementNear(builderPosition, 'town-center', [builderId]);
      if (anchor) {
        pushBuildingPlaceConfirmIntention(builderId, 'town-center', anchor);
        pendingBuildsByOwner.set(owner, (pendingBuildsByOwner.get(owner) ?? 0) + 1);
      }
      return;
    }
    if (
      !findOwnedBuilding(owner, 'lumber-camp')
      && !isConstructingBuilding(owner, 'lumber-camp')
      && stockpile
      && canAfford(stockpile, ownerConstructionCost(accessor, owner, 'lumber-camp'))
    ) {
      // AoE2 plants the camp ON the woodline; the builder's own feet are
      // wherever it happened to be standing. Fall back to that only when no
      // trees are in range.
      const woodline = ownerTownCenterPosition
        ? dropOffAnchorFor(activeWorld, 'lumber-camp', ownerTownCenterPosition)
        : null;
      const anchor = findBuildPlacementNear(woodline ?? builderPosition, 'lumber-camp', [builderId]);
      if (anchor) {
        pushBuildingPlaceConfirmIntention(builderId, 'lumber-camp', anchor);
        pendingBuildsByOwner.set(owner, (pendingBuildsByOwner.get(owner) ?? 0) + 1);
      }
    }
    return;
  }

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
        builderId === null ? undefined : [builderId],
      );
      // Phase 1C: gate on raw stockpile affordability (symmetry with
      // wonder/nextBuild paths below).
      const watchTowerCost = ownerConstructionCost(accessor, owner, 'watch-tower');
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
      const anchor = findBuildPlacementNear(
        ownerTownCenterPosition,
        'wonder',
        builderId === null ? undefined : [builderId],
      );
      const wonderCost = ownerConstructionCost(accessor, owner, 'wonder');
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

    const nextBuild = pickNextBuildTarget(
      currentAge,
      missing,
      populationBlocked,
      {
        owned: countOwnedFarms(),
        villagerCount: countOwnedUnits(owner, 'villager'),
        // Farms outrank the rest of the build order only while the food is
        // actually short; a well-fed AI that keeps replacing depleted soil never
        // reaches the halls it has the resources for.
        food: stockpile?.food ?? 0,
      },
      // The order is a priority list, not a queue: the AI's OWN discounted
      // price decides what it can start now, so a Castle it can pay for in
      // stone beats a Siege Workshop it has no wood for. The gate below still
      // re-prices and re-checks what comes back.
      (buildingType) => stockpile !== undefined
        && canAfford(stockpile, ownerConstructionCost(accessor, owner, buildingType)),
    );
    if (nextBuild && ongoingBuilds < maxConcurrentBuilds && !wonderPursuit) {
      const builderId = findAvailableVillagerForBuild(owner);
      // A drop-off building exists to shorten a carry, so it belongs beside
      // what it serves rather than beside the Town Center like everything
      // else. `dropOffAnchorFor` returns null for non-drop-offs and for a
      // resource too far to be worth walking to, so both fall back here.
      const anchor = findBuildPlacementNear(
        dropOffAnchorFor(activeWorld, nextBuild, ownerTownCenterPosition) ?? ownerTownCenterPosition,
        nextBuild,
        builderId === null ? undefined : [builderId],
      );
      const buildCost = ownerConstructionCost(accessor, owner, nextBuild);
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
