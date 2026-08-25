// Phase 1C — AI intention pushers: write to `state.pendingCommands`
// (dispatcher submits between ticks). Extracted from the registerBridgeSystems
// wireup in wireBridgeOps so the op-category stays isolated; the returned
// object is spread into the registerBridgeSystems deps in the original order.

import type { Position } from 'civ-engine';

import { hasPendingUnitCommand } from './pendingCommandQuery';
import type { BridgeState } from './bridgeState';
import type {
  BuildableBuildingType,
  MarketActionType,
  ResearchableTechnologyType,
  TrainableUnitType,
} from '../types';

export interface AiIntentionPushersDeps {
  state: BridgeState;
}

export function createAiIntentionPushers({ state }: AiIntentionPushersDeps) {
  return {
    pushQueueTrainIntention: (buildingId: number, unitType: TrainableUnitType) => {
      state.pendingCommands.push({
        type: 'queue.train',
        data: { buildingId, unitType },
      });
    },
    // v0.1.91: AI market trade for an age-up shortfall (validator gates ownership + afford).
    pushMarketActionIntention: (playerId: number, actionType: MarketActionType) => {
      state.pendingCommands.push({ type: 'market.action', data: { playerId, actionType } });
    },
    // v0.3.92: AI tribute to a poor ally — the direct executor re-validates.
    pushTributeIntention: (
      playerId: number,
      toPlayerId: number,
      resource: import('../types').EconomyResourceKind,
      amount: number,
    ) => {
      state.pendingCommands.push({
        type: 'tribute.send',
        data: { playerId, toPlayerId, resource, amount },
      });
    },
    pushQueueResearchIntention: (
      buildingId: number,
      technologyType: ResearchableTechnologyType,
    ) => {
      state.pendingCommands.push({
        type: 'queue.research',
        data: { buildingId, technologyType },
      });
    },
    pushBuildingPlaceConfirmIntention: (
      builderId: number,
      buildingType: BuildableBuildingType,
      anchor: Position,
    ) => {
      state.pendingCommands.push({
        type: 'building.placeConfirm',
        data: { builderId, buildingType, position: anchor },
      });
    },
    // The AI's raid response (spec §13.3): send a villager into a building.
    // Rides the ordinary right-click-on-an-entity channel, so it is recorded,
    // validated and replayed exactly like a player's own garrison order — and
    // since v0.3.42 that means the villager WALKS there.
    pushUnitContextAtEntityIntention: (
      unitId: number,
      targetEntityId: number,
      garrison: boolean,
    ) => {
      state.pendingCommands.push({
        type: 'unit.contextAtEntity',
        data: { unitId, targetEntityId, garrison },
      });
    },
    // Empties a building of everyone sheltering in it — the AI's "all clear".
    pushBuildingActionIntention: (buildingId: number, actionType: 'ungarrison') => {
      state.pendingCommands.push({
        type: 'building.action',
        data: { buildingId, actionType },
      });
    },
    pushMonkContextAtEntityIntention: (
      monkId: number,
      targetEntityId: number,
      options: {
        expectedOwner: number;
        intendedTaskKind: import('./sharedTypes').MonkTask['kind'];
      },
    ) => {
      state.pendingCommands.push({
        type: 'monk.contextAtEntity',
        data: { unitId: monkId, targetEntityId, ...options },
      });
    },
    // Pass the queue by reference (aiSystem captures it once + reads it every
    // tick to fold pending intentions into its gates). The dispatcher must
    // mutate `state.pendingCommands` IN PLACE (push + length=0) — never reassign
    // it, or aiSystem's captured reference goes stale and the gates break.
    pendingCommands: state.pendingCommands,
    // Phase 1B unit.attack (DESIGN v17 §6.5): AI systems push to
    // `pendingCommands`. Returns `true` so callers can keep `if (issued)` flow.
    pushUnitAttackIntention: (
      attackerId: number,
      targetId: number,
      targetKind: 'unit' | 'building' | 'resource',
    ) => {
      state.pendingCommands.push({
        type: 'unit.attack',
        data: { unitId: attackerId, targetEntityId: targetId, targetEntityKind: targetKind },
      });
      return true;
    },
    // Phase 1B unit.attack (post review-impl-3): preserves the pre-1B
    // priority where aiSystem's strategic target wins over autoAggression's
    // local target when both want the same unit on the same tick. Linear
    // scan over the queue (typically <10 entries per tick during AI macro);
    // returns true if any unit.move/unit.attack intention is queued for the
    // given unit.
    hasPendingUnitCommand: (unitId: number) => hasPendingUnitCommand(state.pendingCommands, unitId),
    // Phase 1B unit.move (DESIGN v17 §6.5): AI-decision systems push to
    // `pendingCommands` during `execute`; the dispatcher submits between
    // ticks. Returns `true` so callers can preserve their existing
    // `if (issued)` flow even though the actual handler runs at next step.
    pushUnitMoveIntention: (unitId: number, target: Position) => {
      state.pendingCommands.push({ type: 'unit.move', data: { unitId, target } });
      return true;
    },
  };
}
