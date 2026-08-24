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
    findOwnedUnit,
    ownedMilitaryUnitIds,
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
  } = ctx;

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
      targetOwner === null ? null : findOwnedUnit(targetOwner, 'villager');
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
      }
    }
  }
}
