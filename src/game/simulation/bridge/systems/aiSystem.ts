// AI planner driver. Runs once per decision interval for each AI owner:
// macro plan, production/research intentions, monk tasks, and attack pushes.

import { type Position } from 'civ-engine';
import type { BuildingComponent, UnitComponent } from '../../types';
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
  playerTeamsCodec,
  townCenterRefsCodec,
  unitCommandsCodec,
} from '../bridgeStateSerialize';
import type { AiOwnerContext, AiSystemDeps } from './aiSystemTypes';
import { buildPendingIntentionMaps, createOwnerProducerHelpers } from './aiSystemGating';
import { runBuildCrewPhase } from './aiBuildCrewPhase';
import { runBuildingPhase } from './aiSystemBuildingPhase';
import { runDefensePhase } from './aiSystemDefensePhase';
import { runProductionPhase } from './aiSystemProductionPhase';
import { runTradePhase } from './aiTradePhase';
import { runTributePhase } from './aiTributePhase';
import { runFerryPhase } from './aiFerryPhase';
import { runAttackPhase } from './aiSystemAttackPhase';
import { runHuntPhase } from './aiSystemHuntPhase';
import { isEnemyOwner } from '../../alliances';

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
      // Every owner's Town Center, resolved once per tick. The AI attacks its
      // NEAREST enemy, which for the ordinary two-player match is the human and
      // so is byte-identical to the old humanPlayerId lookup — but gives an AI
      // in the human slot, or a skirmish with several AI players, somebody to
      // fight. Without it two AIs build up forever and never meet.
      const townCentersByOwner = new Map<number, { id: number; position: Position | undefined }>();
      for (const [refOwner, ref] of accessor.get(townCenterRefsCodec)) {
        const id = currentEntityId(activeWorld, ref);
        if (id === null) continue;
        townCentersByOwner.set(refOwner, {
          id,
          position: activeWorld.getComponent<Position>(id, 'position'),
        });
      }
      // The nearest surviving building of an enemy that has NO Town Center —
      // the only thing left to march on once one is razed. Deterministic:
      // owners and ids both sorted, so a replay picks the same building.
      const buildingsOfTownCenterlessOwners = new Map<number, { id: number; position: Position | undefined }>();
      for (const id of [...activeWorld.query('building')].sort((a, b) => a - b)) {
        const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
        if (!building) continue;
        if (townCentersByOwner.has(building.owner)) continue;
        if (buildingsOfTownCenterlessOwners.has(building.owner)) continue;
        buildingsOfTownCenterlessOwners.set(building.owner, {
          id,
          position: activeWorld.getComponent<Position>(id, 'position'),
        });
      }
      void humanPlayerId;

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

        const { targetOwner, targetTownCenterId, targetTownCenterPosition } =
          pickAttackTarget(owner, townCentersByOwner, accessor.get(playerTeamsCodec));
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
          targetOwner,
          targetTownCenterId,
          targetTownCenterPosition,
          ...lastResortTargetFor(
            owner,
            ownerTownCenterPosition,
            buildingsOfTownCenterlessOwners,
            accessor.get(playerTeamsCodec),
          ),
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

        // Islands (v0.3.95): when the target is across open water, the ferry
        // owns the military this tick — the ordinary march stands down, and
        // so does discretionary BUILDING, because the macro list would spend
        // the very wood the Transport Ship needs (observed: barracks + mill
        // ate the bank while the dock queue stayed empty).
        // The ferry phase is the amphibious attack, so the coverage lab turns
        // it off with the march (a critic caught the claim being false on
        // water maps, 2026-09-05).
        const ferrying = deps.attacksDisabled ? false : runFerryPhase(deps, ctx);
        runDefensePhase(deps, ctx);
        if (!ferrying) {
          runBuildingPhase(deps, ctx);
          // Reinforce the sites already going up. Runs AFTER placement so a
          // freshly placed foundation is crewed on the next decision tick
          // rather than competing with its own placement for the pool.
          runBuildCrewPhase(deps, ctx);
        }
        runProductionPhase(deps, ctx);
        runTradePhase(deps, ctx);
        runTributePhase(deps, ctx);
        // After production, because a villager trained this tick is not idle yet,
        // and before the attack phase, which is about military rather than food.
        runHuntPhase(deps, ctx);
        // The coverage lab turns the attack phase off wholesale: the match
        // then runs to its horizon and the census reads the tech tree.
        if (!ferrying && !deps.attacksDisabled) {
          runAttackPhase(deps, ctx);
        }
      }
    },
  });
}


/**
 * The enemy an AI attacks: the one whose Town Center is NEAREST its own, or —
 * when it has no Town Center left to measure from — any enemy that still has
 * one. Returns nulls when no enemy has a Town Center at all, which is the
 * caller's signal that there is nothing to march at.
 *
 * Nearest-enemy is what makes a multi-player skirmish behave: with two owners
 * it always picks the other one, so the ordinary human-versus-AI match is
 * unchanged.
 */
/**
 * The nearest surviving building of an enemy with no Town Center left, or
 * nulls. Only the attack phase reads this — see `AiOwnerContext`.
 */
export function lastResortTargetFor(
  owner: number,
  ownerPosition: Position | null | undefined,
  buildingsOfTownCenterlessOwners: ReadonlyMap<number, { id: number; position: Position | undefined }>,
  teams: ReadonlyMap<number, number>,
): { lastResortTargetId: number | null; lastResortTargetPosition: Position | null | undefined } {
  let best: { id: number; position: Position | undefined } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidateOwner of [...buildingsOfTownCenterlessOwners.keys()].sort((a, b) => a - b)) {
    if (!isEnemyOwner(teams, owner, candidateOwner)) continue;
    const building = buildingsOfTownCenterlessOwners.get(candidateOwner)!;
    const distance =
      ownerPosition && building.position
        ? Math.abs(ownerPosition.x - building.position.x)
          + Math.abs(ownerPosition.y - building.position.y)
        : Number.POSITIVE_INFINITY;
    if (best === null || distance < bestDistance) {
      best = building;
      bestDistance = distance;
    }
  }
  return {
    lastResortTargetId: best?.id ?? null,
    lastResortTargetPosition: best?.position ?? null,
  };
}

export function pickAttackTarget(
  owner: number,
  townCentersByOwner: ReadonlyMap<number, { id: number; position: Position | undefined }>,
  teams: ReadonlyMap<number, number> = new Map(),
): {
  targetOwner: number | null;
  targetTownCenterId: number | null;
  targetTownCenterPosition: Position | null | undefined;
} {
  const own = townCentersByOwner.get(owner);
  let best: { owner: number; id: number; position: Position | undefined } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  // Sorted by owner id rather than map order, so the tie-break below is a
  // property of the game state and not of insertion order — a replay must pick
  // the same enemy every time it is played.
  const candidates = [...townCentersByOwner.keys()].sort((a, b) => a - b);
  for (const candidateOwner of candidates) {
    const townCenter = townCentersByOwner.get(candidateOwner)!;
    // An ally is not a target. With no teams recorded every owner is its own
    // side, so a free-for-all is unchanged.
    if (!isEnemyOwner(teams, owner, candidateOwner)) continue;
    const distance =
      own?.position && townCenter.position
        ? Math.abs(own.position.x - townCenter.position.x)
          + Math.abs(own.position.y - townCenter.position.y)
        : Number.POSITIVE_INFINITY;
    // Strictly-less keeps the FIRST of equal distances, which after the sort
    // above is the lowest owner id.
    if (best === null || distance < bestDistance) {
      best = { owner: candidateOwner, ...townCenter };
      bestDistance = distance;
    }
  }
  if (best === null) {
    return { targetOwner: null, targetTownCenterId: null, targetTownCenterPosition: null };
  }
  return {
    targetOwner: best.owner,
    targetTownCenterId: best.id,
    targetTownCenterPosition: best.position,
  };
}
