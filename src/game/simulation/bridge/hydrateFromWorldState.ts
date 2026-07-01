import type {
  BuildingComponent,
  MatchState,
  ResearchableTechnologyType,
  UnitComponent,
} from '../types';
import type { PersistedMatchState } from '../saveSchema';
import { clonePendingCommand } from '../dispatcher';
import type { BridgeState } from './bridgeState';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { GameWorld } from './pureHelpers';
import {
  buildingCombatStatesCodec,
  buildingHealthStatesCodec,
  combatStatesCodec,
  constructionStatesCodec,
  conversionStateCodec,
  gathererDropOffStuckSinceTickCodec,
  garrisonedByBuildingCodec,
  garrisonedUnitToBuildingCodec,
  garrisonedUnitVisionSourcesCodec,
  inFlightTechByOwnerCodec,
  monkCarriedRelicCodec,
  monkHealCountersCodec,
  monkTasksCodec,
  productionQueuesCodec,
  rallyPointsCodec,
  relicsInMonasteryCodec,
  sheepMoveOrdersCodec,
  TIER_1_CODECS,
  TIER_3_SLOTS,
  type SlotCodec,
  trebuchetPackStatesCodec,
  unitCommandsCodec,
  wildlifeStatesCodec,
  wonderCountdownsCodec,
} from './bridgeStateSerialize';

interface RuntimeHydrationDeps {
  world: GameWorld;
  state: BridgeState;
  accessor: BridgeStateAccessor;
  inFlightTechSetFor: (owner: number) => Set<ResearchableTechnologyType>;
}

interface WorldStateHydrationDeps extends RuntimeHydrationDeps {
  matchState: MatchState;
}

export function clearLegacyTier1MapSlots(accessor: BridgeStateAccessor): void {
  for (const codec of TIER_1_CODECS) {
    const native = accessor.get(codec);
    if (native instanceof Map) {
      native.clear();
    }
  }
}

export function hydrateRuntimeFromWorldState(deps: WorldStateHydrationDeps): void {
  const { world, state, matchState } = deps;
  const pendingCommands = world.getState(TIER_3_SLOTS.pendingCommands) as
    | ReturnType<typeof clonePendingCommand>[]
    | undefined;
  state.pendingCommands.length = 0;
  state.pendingCommands.push(...(pendingCommands ?? []).map(clonePendingCommand));

  const persisted = world.getState(TIER_3_SLOTS.matchState) as
    | PersistedMatchState
    | undefined;
  if (!persisted) {
    throw new Error(`Save schema 2 is missing ${TIER_3_SLOTS.matchState}.`);
  }
  matchState.outcome = persisted.outcome;
  matchState.summary = persisted.summary;
  matchState.winCondition = persisted.winCondition;
  matchState.scores = persisted.scores ? { ...persisted.scores } : null;
  matchState.wonderCountdownTicks = null;
  matchState.relicCountdownTicks = null;

  rebuildHydratedRuntimeState(deps);
  validateAndPruneHydratedState(deps);
}

export function rebuildHydratedRuntimeState(deps: RuntimeHydrationDeps): void {
  const { world, state, accessor, inFlightTechSetFor } = deps;

  accessor.get(inFlightTechByOwnerCodec).clear();
  for (const [buildingId, queue] of accessor.get(productionQueuesCodec).entries()) {
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    if (!building) continue;
    for (const entry of queue) {
      if (entry.kind === 'technology' && entry.technologyType) {
        inFlightTechSetFor(building.owner).add(entry.technologyType);
      }
    }
  }

  state.monksByOwner.clear();
  for (const id of world.query('unit')) {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (!unit || unit.unitType !== 'monk') continue;
    let monkSet = state.monksByOwner.get(unit.owner);
    if (!monkSet) {
      monkSet = new Set();
      state.monksByOwner.set(unit.owner, monkSet);
    }
    monkSet.add(id);
  }
}

export function validateAndPruneHydratedState(deps: RuntimeHydrationDeps): void {
  const { world, accessor } = deps;
  const garrisonedByBuildingForCheck = accessor.get(garrisonedByBuildingCodec);
  const garrisonedUnitToBuildingForCheck = accessor.get(garrisonedUnitToBuildingCodec);

  for (const [buildingId, list] of garrisonedByBuildingForCheck) {
    for (const unitId of list) {
      const reverse = garrisonedUnitToBuildingForCheck.get(unitId);
      if (reverse !== buildingId) {
        throw new Error(
          `Save invariant violated: garrison cross-reference mismatch for unit ${unitId} / building ${buildingId} (garrisonedUnitToBuilding=${reverse ?? 'absent'}).`,
        );
      }
    }
  }
  for (const [unitId, buildingId] of garrisonedUnitToBuildingForCheck) {
    const list = garrisonedByBuildingForCheck.get(buildingId);
    if (!list || !list.includes(unitId)) {
      throw new Error(
        `Save invariant violated: garrison cross-reference mismatch for unit ${unitId} / building ${buildingId} (not present in garrisonedByBuilding).`,
      );
    }
  }

  const pruneOrphanEntityKeys = (sideMap: Map<number, unknown>): boolean => {
    let changed = false;
    for (const id of [...sideMap.keys()]) {
      if (!world.getEntityRef(id)) {
        sideMap.delete(id);
        changed = true;
      }
    }
    return changed;
  };

  const pruneEntityKeyedSlot = <TValue, TJson>(
    codec: SlotCodec<Map<number, TValue>, TJson>,
  ): void => {
    const sideMap = accessor.get(codec);
    if (pruneOrphanEntityKeys(sideMap)) accessor.markDirty(codec);
  };

  pruneEntityKeyedSlot(unitCommandsCodec);
  pruneEntityKeyedSlot(sheepMoveOrdersCodec);
  pruneEntityKeyedSlot(rallyPointsCodec);
  pruneEntityKeyedSlot(monkTasksCodec);
  pruneEntityKeyedSlot(conversionStateCodec);
  pruneEntityKeyedSlot(monkCarriedRelicCodec);
  pruneEntityKeyedSlot(monkHealCountersCodec);
  pruneEntityKeyedSlot(relicsInMonasteryCodec);
  pruneEntityKeyedSlot(wonderCountdownsCodec);
  pruneEntityKeyedSlot(trebuchetPackStatesCodec);
  pruneEntityKeyedSlot(productionQueuesCodec);
  pruneEntityKeyedSlot(constructionStatesCodec);
  pruneEntityKeyedSlot(combatStatesCodec);
  pruneEntityKeyedSlot(buildingHealthStatesCodec);
  pruneEntityKeyedSlot(buildingCombatStatesCodec);
  pruneEntityKeyedSlot(wildlifeStatesCodec);
  pruneEntityKeyedSlot(garrisonedUnitVisionSourcesCodec);
  pruneEntityKeyedSlot(garrisonedByBuildingCodec);
  pruneEntityKeyedSlot(garrisonedUnitToBuildingCodec);
  pruneEntityKeyedSlot(gathererDropOffStuckSinceTickCodec);

  // Schema-2 migration: pre-split saves restore combat/wildlife states through
  // World.deserialize (verbatim, no field defaulting), so `pierceArmorBonus` is
  // absent. Default it to 0 here — matching the schema-1 explicit hydrate — so
  // the field is a real number before any armor-tech research does `+= 1` on it
  // (an undefined would become NaN). Reads are already `?? 0`-guarded; this
  // closes the WRITE path. See armorTechBonuses.ts.
  const defaultPierceArmorBonus = <TValue extends { pierceArmorBonus?: number }, TJson>(
    codec: SlotCodec<Map<number, TValue>, TJson>,
  ): void => {
    const sideMap = accessor.get(codec);
    let changed = false;
    for (const value of sideMap.values()) {
      if (value.pierceArmorBonus === undefined) {
        value.pierceArmorBonus = 0;
        changed = true;
      }
    }
    if (changed) accessor.markDirty(codec);
  };
  defaultPierceArmorBonus(combatStatesCodec);
  defaultPierceArmorBonus(wildlifeStatesCodec);

  const garrisonedByBuilding = accessor.get(garrisonedByBuildingCodec);
  let garrisonedByBuildingChanged = false;
  for (const [buildingId, list] of [...garrisonedByBuilding]) {
    const filtered = list.filter((unitId) => world.getEntityRef(unitId) !== null);
    if (filtered.length !== list.length) {
      if (filtered.length === 0) {
        garrisonedByBuilding.delete(buildingId);
      } else {
        garrisonedByBuilding.set(buildingId, filtered);
      }
      garrisonedByBuildingChanged = true;
    }
  }
  if (garrisonedByBuildingChanged) accessor.markDirty(garrisonedByBuildingCodec);

  const garrisonedUnitToBuilding = accessor.get(garrisonedUnitToBuildingCodec);
  let garrisonedUnitToBuildingChanged = false;
  for (const [unitId, buildingId] of [...garrisonedUnitToBuilding]) {
    if (world.getEntityRef(buildingId) === null) {
      garrisonedUnitToBuilding.delete(unitId);
      garrisonedUnitToBuildingChanged = true;
    }
  }
  if (garrisonedUnitToBuildingChanged) accessor.markDirty(garrisonedUnitToBuildingCodec);

  const monkCarriedRelic = accessor.get(monkCarriedRelicCodec);
  let monkCarriedRelicChanged = false;
  for (const [monkId, relicId] of [...monkCarriedRelic]) {
    if (world.getEntityRef(relicId) === null) {
      monkCarriedRelic.delete(monkId);
      monkCarriedRelicChanged = true;
    }
  }
  if (monkCarriedRelicChanged) accessor.markDirty(monkCarriedRelicCodec);
}
