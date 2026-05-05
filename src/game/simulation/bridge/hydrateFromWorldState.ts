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

  const pruneOrphanEntityKeys = (sideMap: Map<number, unknown>): void => {
    for (const id of [...sideMap.keys()]) {
      if (!world.getEntityRef(id)) {
        sideMap.delete(id);
      }
    }
  };

  accessor.mutate(unitCommandsCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(sheepMoveOrdersCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(rallyPointsCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(monkTasksCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(conversionStateCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(monkCarriedRelicCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(monkHealCountersCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(relicsInMonasteryCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(wonderCountdownsCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(trebuchetPackStatesCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(productionQueuesCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(constructionStatesCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(combatStatesCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(buildingHealthStatesCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(buildingCombatStatesCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(wildlifeStatesCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(garrisonedUnitVisionSourcesCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(garrisonedByBuildingCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(garrisonedUnitToBuildingCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(gathererDropOffStuckSinceTickCodec, (m) => pruneOrphanEntityKeys(m));

  accessor.mutate(garrisonedByBuildingCodec, (m) => {
    for (const [buildingId, list] of m) {
      const filtered = list.filter((unitId) => world.getEntityRef(unitId) !== null);
      if (filtered.length !== list.length) {
        if (filtered.length === 0) {
          m.delete(buildingId);
        } else {
          m.set(buildingId, filtered);
        }
      }
    }
  });
  accessor.mutate(garrisonedUnitToBuildingCodec, (m) => {
    for (const [unitId, buildingId] of [...m]) {
      if (world.getEntityRef(buildingId) === null) {
        m.delete(unitId);
      }
    }
  });
  accessor.mutate(monkCarriedRelicCodec, (m) => {
    for (const [monkId, relicId] of [...m]) {
      if (world.getEntityRef(relicId) === null) {
        m.delete(monkId);
      }
    }
  });
}
