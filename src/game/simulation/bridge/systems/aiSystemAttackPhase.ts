// AI attack phase: maintains the owner's attack group (prunes dead units, adds
// new military), and — once the group meets the age-scaled threshold — issues
// attack/move intentions, preferring the TARGET enemy's villager, then visible
// enemy units/buildings, then that enemy's Town Center.
//
// The target is the owner's nearest enemy (aiSystem.pickAttackTarget), not the
// human player. Looking it up on the human alone meant an AI occupying the
// human slot had nobody to attack, and no AI ever attacked another AI.

import { type Position } from 'civ-engine';
import type { BuildingComponent, ResourceComponent, UnitComponent } from '../../types';
import { attackGroupSize } from '../../ai';
import { wildlifeStatesCodec } from '../bridgeStateSerialize';
import type { AiOwnerContext, AiSystemDeps } from './aiSystemTypes';

export function runAttackPhase(deps: AiSystemDeps, ctx: AiOwnerContext): void {
  const {
    accessor,
    currentEntityId,
    findOwnedUnitOnMap,
    ownerHasUnitOnMap,
    ownedMilitaryUnitIdsOnMap,
    findOwnedMilitaryUnits,
    findPreferredVisibleEnemyUnit,
    findPreferredVisibleEnemyBuilding,
    submitUnitAttackIntention,
    submitUnitMoveIntention,
  } = deps;
  const {
    activeWorld,
    owner,
    state,
    currentAge,
    unitCommands,
    targetOwner,
    targetTownCenterId,
    targetTownCenterPosition,
    lastResortTargetId,
    lastResortTargetPosition,
  } = ctx;

  const liveMilitary = ownedMilitaryUnitIdsOnMap(owner);
  state.attackGroup = state.attackGroup.filter((id) => liveMilitary.has(id));
  const militaryUnits = findOwnedMilitaryUnits(owner);
  for (const { id } of militaryUnits) {
    if (!state.attackGroup.includes(id)) {
      state.attackGroup.push(id);
    }
  }

  const threshold = attackGroupSize(currentAge);
  // The group threshold exists so a single lost unit does not commit the AI to
  // a base walk. It has nothing to hold back against an enemy that has NO UNITS
  // LEFT ON THE MAP: there is no army to be caught by, the buildings do not
  // move, and by the conquest rule that enemy is alive only because those
  // buildings still stand. Without this exception the last-resort branch below
  // — added in v0.3.197 for exactly that case — could never fire below the
  // threshold, and an AI whose army was cut down to six in the Castle Age idled
  // at its own base for the rest of the match. Reproduced on the garrisoned-
  // defender fixture with the attackers reduced under the threshold: owner 2
  // with zero units and two buildings, owner 1 idle for 8,000 ticks.
  const targetHasNothingOnTheMap =
    targetOwner !== null && !ownerHasUnitOnMap(targetOwner);
  const shouldPush = state.attackGroup.length >= threshold || targetHasNothingOnTheMap;

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
          && accessor.get(wildlifeStatesCodec).get(targetId)?.isAlive
          && activeWorld.getComponent<Position>(targetId, 'position');
        if (hasUnitTarget || hasBuildingTarget || hasResourceTarget) {
          continue;
        }
      }
    }

    // Phase 1C + iter-1 R2-M2: the `submitUnit*Intention` deps always
    // return true (queue push, handler runs at next tick). The pre-1B
    // `&& submit(...)` early-out idiom relied on the facade returning
    // false when the target was stale; that contract no longer holds,
    // so the chain is split into separate clauses.
    const targetVillagerId =
      targetOwner === null ? null : findOwnedUnitOnMap(targetOwner, 'villager');
    if (shouldPush && targetVillagerId !== null) {
      submitUnitAttackIntention(id, targetVillagerId, 'unit');
      continue;
    }

    const visibleTargetId = findPreferredVisibleEnemyUnit(owner, position);
    if (visibleTargetId !== null) {
      submitUnitAttackIntention(id, visibleTargetId, 'unit');
      continue;
    }

    const visibleBuildingId = findPreferredVisibleEnemyBuilding(owner, position);
    if (visibleBuildingId !== null) {
      submitUnitAttackIntention(id, visibleBuildingId, 'building');
      continue;
    }

    if (shouldPush) {
      if (targetTownCenterId !== null) {
        submitUnitAttackIntention(id, targetTownCenterId, 'building');
        continue;
      }

      if (targetTownCenterPosition) {
        submitUnitMoveIntention(id, targetTownCenterPosition);
        continue;
      }

      // Nothing with a Town Center left to march on. An enemy that still holds
      // a BUILDING is still alive by the conquest rule, so it is still a
      // target — without this the army idles beside a base it cannot finish
      // and the match never ends (`gold-rush`: owner 2 held a blacksmith and a
      // house with zero units from tick 48,000 to the horizon).
      if (lastResortTargetId !== null) {
        submitUnitAttackIntention(id, lastResortTargetId, 'building');
        continue;
      }
      if (lastResortTargetPosition) {
        submitUnitMoveIntention(id, lastResortTargetPosition);
      }
    }
  }
}
