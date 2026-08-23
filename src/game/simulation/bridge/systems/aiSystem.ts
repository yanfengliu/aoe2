// AI planner driver. Runs once per decision interval for each AI owner:
// macro plan, production/research intentions, monk tasks, and attack pushes.

import { type Position } from 'civ-engine';
import type { UnitComponent } from '../../types';
import {
  AI_BASE_VISION_RADIUS,
  decisionIntervalTicks,
  planForAge,
  villagerTargetsEqual,
  villagerTargetsForAge,
} from '../../ai';
import {
  aiStatesCodec,
  playerResourcesCodec,
  populationCodec,
  townCenterRefsCodec,
  unitCommandsCodec,
} from '../bridgeStateSerialize';
import type { AiOwnerContext, AiSystemDeps } from './aiSystemTypes';
import { buildPendingIntentionMaps, createOwnerProducerHelpers } from './aiSystemGating';
import { runBuildingPhase } from './aiSystemBuildingPhase';
import { runDefensePhase } from './aiSystemDefensePhase';
import { runProductionPhase } from './aiSystemProductionPhase';
import { runAttackPhase } from './aiSystemAttackPhase';

export type { AiSystemDeps } from './aiSystemTypes';

export function registerAiSystem(deps: AiSystemDeps): void {
  const {
    world,
    humanPlayerId,
    visibility,
    accessor,
    currentEntityId,
    getPlayerAge,
    villagerRebalance,
    pendingCommands,
  } = deps;

  world.registerSystem({
    name: 'prototypeAi',
    phase: 'update',
    execute(activeWorld) {
      const humanTownCenterId = currentEntityId(
        activeWorld,
        accessor.get(townCenterRefsCodec).get(humanPlayerId),
      );
      const humanTownCenterPosition =
        humanTownCenterId === null
          ? null
          : activeWorld.getComponent<Position>(humanTownCenterId, 'position');

      const currentTick = activeWorld.tick;
      const unitCommands = accessor.get(unitCommandsCodec);

      // Phase 1C — fold pending intentions into the gates aiSystem uses to
      // decide whether to push more (built once per tick, shared across owners).
      const {
        pendingTrainsByBuilding,
        pendingResearchByBuilding,
        pendingResearchKeys,
        pendingBuildsByOwner,
      } = buildPendingIntentionMaps(activeWorld, pendingCommands);

      for (const [owner, state] of accessor.get(aiStatesCodec).entries()) {
        const interval = decisionIntervalTicks(state.difficulty);
        if (state.lastDecisionTick >= 0 && currentTick - state.lastDecisionTick < interval) {
          continue;
        }
        state.lastDecisionTick = currentTick;
        accessor.markDirty(aiStatesCodec);

        const ownerTownCenterId = currentEntityId(activeWorld, accessor.get(townCenterRefsCodec).get(owner));
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

        // Phase 1C: gates use the raw stockpile directly. DESIGN v17 §6.4 B1/B2
        // make validators best-effort + handlers do the authoritative spend with
        // silent-no-op fallback, so over-acceptance within one decision tick is
        // intentional (the handler picks the affordable subset); the queue-length
        // / pendingResearchKeys / pendingBuildsByOwner gates prevent duplicate spam.
        const stockpile = accessor.get(playerResourcesCodec).get(owner);

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

        const populationState = accessor.get(populationCodec).get(owner);
        const populationBlocked = Boolean(
          populationState && populationState.current >= populationState.cap,
        );

        const { claimedVillagers, findAvailableVillagerForBuild, findIdleProducerLocal } =
          createOwnerProducerHelpers(
            activeWorld,
            accessor,
            owner,
            unitCommands,
            pendingTrainsByBuilding,
            pendingResearchByBuilding,
          );

        const ctx: AiOwnerContext = {
          activeWorld,
          owner,
          state,
          interval,
          currentTick,
          ownerTownCenterId,
          ownerTownCenterPosition,
          humanTownCenterId,
          humanTownCenterPosition,
          currentAge,
          stockpile,
          populationBlocked,
          unitCommands,
          claimedVillagers,
          findAvailableVillagerForBuild,
          findIdleProducerLocal,
          pendingTrainsByBuilding,
          pendingResearchByBuilding,
          pendingResearchKeys,
          pendingBuildsByOwner,
        };

        runDefensePhase(deps, ctx);
        runBuildingPhase(deps, ctx);
        runProductionPhase(deps, ctx);
        runAttackPhase(deps, ctx);
      }
    },
  });
}
