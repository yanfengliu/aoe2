import type { VisibilityMapState } from 'civ-engine';
import { expect } from 'vitest';

import type { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type {
  PersistedMatchState,
  SaveBlob,
  SaveBlobV1,
  SaveBlobV2,
  SerializedMatchState,
  SerializedSideMaps,
} from '../../src/game/simulation/saveSchema';
import {
  aiStatesCodec,
  buildingCombatStatesCodec,
  buildingHealthStatesCodec,
  combatStatesCodec,
  constructionStatesCodec,
  conversionStateCodec,
  gathererDropOffStuckSinceTickCodec,
  garrisonedByBuildingCodec,
  garrisonedUnitToBuildingCodec,
  garrisonedUnitVisionSourcesCodec,
  lastSeenStaticCodec,
  marketExchangeRatesCodec,
  monkCarriedRelicCodec,
  monkHealCountersCodec,
  monkTasksCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  playerResourcesCodec,
  playerScoreCountersCodec,
  populationCodec,
  productionQueuesCodec,
  rallyPointsCodec,
  relicCountdownOverridesCodec,
  relicCountdownsCodec,
  relicsInMonasteryCodec,
  researchedTechnologiesCodec,
  sheepMoveOrdersCodec,
  type SlotCodec,
  TIER_3_SLOTS,
  townCenterRefsCodec,
  trackedVisibilitySourcesCodec,
  trebuchetPackStatesCodec,
  unitCommandsCodec,
  villagerOrdinalsCodec,
  wildlifeStatesCodec,
  wonderCountdownOverridesCodec,
  wonderCountdownsCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';

export const PENDING_COMMANDS_STATE_SLOT = 'aoe2.pendingCommands';

type Bridge = ReturnType<typeof createSimulationBridge>;

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function worldStateOf(blob: Pick<SaveBlob, 'worldSnapshot'>): Record<string, unknown> {
  const snapshot = blob.worldSnapshot as { state?: Record<string, unknown> };
  if (!snapshot.state) {
    throw new Error('expected save blob worldSnapshot.state to be present');
  }
  return snapshot.state;
}

export function stateSlot<T>(blob: Pick<SaveBlob, 'worldSnapshot'>, slot: string): T {
  const value = worldStateOf(blob)[slot];
  if (value === undefined) {
    throw new Error(`expected worldSnapshot.state[${slot}] to be present`);
  }
  return value as T;
}

export function codecSlotValue<TNative, TJson>(
  blob: Pick<SaveBlob, 'worldSnapshot'>,
  codec: SlotCodec<TNative, TJson>,
): TJson {
  return codecStateValue(worldStateOf(blob), codec);
}

export function asSchema2Blob(blob: SaveBlob): SaveBlobV2 {
  if (blob.schema === 2) {
    return cloneJson(blob);
  }
  return {
    schema: 2,
    seed: blob.seed,
    worldSnapshot: cloneJson(blob.worldSnapshot),
  };
}

export function expectNoLegacyTopLevelFields(blob: SaveBlob): void {
  expect('sideMaps' in blob).toBe(false);
  expect('visibility' in blob).toBe(false);
  expect('matchState' in blob).toBe(false);
}

function stateValue<T>(state: Record<string, unknown>, slot: string): T {
  const value = state[slot];
  if (value === undefined) {
    throw new Error(`expected ${slot} in serialized world state`);
  }
  return cloneJson(value) as T;
}

function codecStateValue<TNative, TJson>(
  state: Record<string, unknown>,
  codec: SlotCodec<TNative, TJson>,
): TJson {
  const value = state[codec.slot] as TJson | undefined;
  if (value !== undefined) {
    return cloneJson(value);
  }
  return cloneJson(codec.serialize(codec.deserialize(undefined)));
}

function sideMapsFromWorldState(state: Record<string, unknown>): SerializedSideMaps {
  return {
    trackedVisibilitySources: codecStateValue(state, trackedVisibilitySourcesCodec),
    playerAges: codecStateValue(state, playerAgesCodec),
    playerCivilizations: codecStateValue(state, playerCivilizationsCodec),
    researchedTechnologies: codecStateValue(state, researchedTechnologiesCodec),
    playerResources: codecStateValue(state, playerResourcesCodec),
    marketExchangeRates: codecStateValue(state, marketExchangeRatesCodec),
    population: codecStateValue(state, populationCodec),
    townCenterRefs: codecStateValue(state, townCenterRefsCodec),
    villagerOrdinals: codecStateValue(state, villagerOrdinalsCodec),
    unitCommands: codecStateValue(state, unitCommandsCodec),
    pendingCommands: cloneJson((state[PENDING_COMMANDS_STATE_SLOT] ?? []) as SerializedSideMaps['pendingCommands']),
    sheepMoveOrders: codecStateValue(state, sheepMoveOrdersCodec),
    rallyPoints: codecStateValue(state, rallyPointsCodec),
    monkTasks: codecStateValue(state, monkTasksCodec),
    conversionState: codecStateValue(state, conversionStateCodec),
    monkCarriedRelic: codecStateValue(state, monkCarriedRelicCodec),
    monkHealCounters: codecStateValue(state, monkHealCountersCodec),
    relicsInMonastery: codecStateValue(state, relicsInMonasteryCodec),
    wonderCountdowns: codecStateValue(state, wonderCountdownsCodec),
    wonderCountdownOverrides: codecStateValue(state, wonderCountdownOverridesCodec),
    relicCountdowns: codecStateValue(state, relicCountdownsCodec),
    relicCountdownOverrides: codecStateValue(state, relicCountdownOverridesCodec),
    playerScoreCounters: codecStateValue(state, playerScoreCountersCodec),
    trebuchetPackStates: codecStateValue(state, trebuchetPackStatesCodec),
    lastSeenStatic: codecStateValue(state, lastSeenStaticCodec),
    garrisonedByBuilding: codecStateValue(state, garrisonedByBuildingCodec),
    garrisonedUnitToBuilding: codecStateValue(state, garrisonedUnitToBuildingCodec),
    garrisonedUnitVisionSources: codecStateValue(state, garrisonedUnitVisionSourcesCodec),
    productionQueues: codecStateValue(state, productionQueuesCodec),
    constructionStates: codecStateValue(state, constructionStatesCodec),
    combatStates: codecStateValue(state, combatStatesCodec),
    buildingHealthStates: codecStateValue(state, buildingHealthStatesCodec),
    buildingCombatStates: codecStateValue(state, buildingCombatStatesCodec),
    wildlifeStates: codecStateValue(state, wildlifeStatesCodec),
    aiStates: codecStateValue(state, aiStatesCodec),
    gathererDropOffStuckSinceTick: codecStateValue(state, gathererDropOffStuckSinceTickCodec),
  };
}

function matchStateFromBridgeAndWorldState(
  bridge: Bridge,
  state: Record<string, unknown>,
): SerializedMatchState {
  const persisted = stateValue<PersistedMatchState>(state, TIER_3_SLOTS.matchState);
  const live = bridge.getMatchState();
  return {
    ...persisted,
    wonderCountdownTicks: live.wonderCountdownTicks,
    relicCountdownTicks: live.relicCountdownTicks,
  };
}

export function legacySchema1FromBridge(bridge: Bridge): SaveBlobV1 {
  const blob = bridge.saveGame();
  if (blob.schema === 1) {
    return cloneJson(blob);
  }
  const state = worldStateOf(blob);
  return {
    schema: 1,
    seed: blob.seed,
    worldSnapshot: cloneJson(blob.worldSnapshot),
    visibility: stateValue<VisibilityMapState>(state, TIER_3_SLOTS.visibility),
    matchState: matchStateFromBridgeAndWorldState(bridge, state),
    sideMaps: sideMapsFromWorldState(state),
  };
}
