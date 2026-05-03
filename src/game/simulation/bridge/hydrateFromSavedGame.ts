import type { EntityRef } from 'civ-engine';
import type {
  AgeType,
  BuildingComponent,
  MatchState,
  ResearchableTechnologyType,
  TrainableUnitType,
  UnitComponent,
} from '../types';
import type { GameWorld } from './pureHelpers';
import type { SaveBlob } from '../saveSchema';
import type { UnitCommand } from './sharedTypes';
import type { MemoryEntry } from './memoryTypes';
import type { AiPlan } from '../ai';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  gathererDropOffStuckSinceTickCodec,
  aiStatesCodec,
  buildingCombatStatesCodec,
  buildingHealthStatesCodec,
  constructionStatesCodec,
  combatStatesCodec,
  conversionStateCodec,
  garrisonedByBuildingCodec,
  garrisonedUnitToBuildingCodec,
  garrisonedUnitVisionSourcesCodec,
  inFlightTechByOwnerCodec,
  lastSeenStaticCodec,
  productionQueuesCodec,
  marketExchangeRatesCodec,
  monkCarriedRelicCodec,
  playerResourcesCodec,
  populationCodec,
  researchedTechnologiesCodec,
  monkHealCountersCodec,
  playerScoreCountersCodec,
  rallyPointsCodec,
  relicCountdownsCodec,
  relicsInMonasteryCodec,
  sheepMoveOrdersCodec,
  townCenterRefsCodec,
  trebuchetPackStatesCodec,
  trackedVisibilitySourcesCodec,
  wildlifeStatesCodec,
  wonderCountdownsCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  relicCountdownOverridesCodec,
  villagerOrdinalsCodec,
  wonderCountdownOverridesCodec,
} from './bridgeStateSerialize';

export interface SaveLoadHydrationDeps {
  world: GameWorld;
  savedGame: SaveBlob;
  matchState: MatchState;
  state: import('./bridgeState').BridgeState;
  // Phase 2D — slots that have moved to `world.state.aoe2.*` are written
  // through the accessor on hydrate.
  accessor: BridgeStateAccessor;
  setUnitCommand: (id: number, command: UnitCommand) => void;
  inFlightTechSetFor: (owner: number) => Set<ResearchableTechnologyType>;
}

export function hydrateFromSavedGame(deps: SaveLoadHydrationDeps): void {
  const { world, savedGame, matchState, state, accessor, setUnitCommand, inFlightTechSetFor } = deps;
  const {
    monkTasks,
    unitCommands,
    monksByOwner,
  } = state;

  const blob = savedGame.sideMaps;
  const refFromSerialized = (s: { id: number; generation: number }): EntityRef | null => {
    const ref = world.getEntityRef(s.id);
    if (!ref || ref.generation !== s.generation) return null;
    return ref;
  };

  accessor.mutate(trackedVisibilitySourcesCodec, (m) => {
    for (const [k, v] of blob.trackedVisibilitySources) {
      m.set(k, v);
    }
  });
  accessor.mutate(playerAgesCodec, (m) => {
    for (const [owner, age] of blob.playerAges) {
      m.set(owner, age as AgeType);
    }
  });
  accessor.mutate(playerCivilizationsCodec, (m) => {
    for (const [owner, civ] of blob.playerCivilizations) {
      m.set(owner, civ);
    }
  });
  accessor.mutate(researchedTechnologiesCodec, (m) => {
    m.clear();
    for (const [owner, techs] of blob.researchedTechnologies) {
      m.set(owner, new Set(techs as ResearchableTechnologyType[]));
    }
  });
  accessor.mutate(playerResourcesCodec, (m) => {
    m.clear();
    for (const [owner, res] of blob.playerResources) {
      m.set(owner, { ...res });
    }
  });
  accessor.mutate(marketExchangeRatesCodec, (m) => {
    m.food = blob.marketExchangeRates.food;
    m.wood = blob.marketExchangeRates.wood;
    m.stone = blob.marketExchangeRates.stone;
  });
  accessor.mutate(populationCodec, (m) => {
    m.clear();
    for (const [owner, pop] of blob.population) {
      m.set(owner, { ...pop });
    }
  });
  accessor.mutate(townCenterRefsCodec, (m) => {
    for (const [owner, refData] of blob.townCenterRefs) {
      const ref = refFromSerialized(refData);
      if (ref) m.set(owner, ref);
    }
  });
  // Phase 2D — villagerOrdinals routes through the accessor.
  accessor.mutate(villagerOrdinalsCodec, (m) => {
    for (const [owner, ord] of blob.villagerOrdinals) {
      m.set(owner, ord);
    }
  });
  for (const [id, cmd] of blob.unitCommands) {
    const restored: UnitCommand = {
      type: cmd.type,
      target: { x: cmd.target.x, y: cmd.target.y },
    };
    if (cmd.targetEntityKind) {
      restored.targetEntityKind = cmd.targetEntityKind;
    }
    if (cmd.targetEntityRef) {
      const ref = refFromSerialized(cmd.targetEntityRef);
      if (ref) restored.targetEntityRef = ref;
    }
    if (cmd.buildingRef) {
      const ref = refFromSerialized(cmd.buildingRef);
      if (ref) restored.buildingRef = ref;
    }
    setUnitCommand(id, restored);
  }
  accessor.mutate(sheepMoveOrdersCodec, (m) => {
    for (const [id, pos] of blob.sheepMoveOrders) {
      m.set(id, { x: pos.x, y: pos.y });
    }
  });
  accessor.mutate(rallyPointsCodec, (m) => {
    for (const [id, pos] of blob.rallyPoints) {
      m.set(id, { x: pos.x, y: pos.y });
    }
  });
  for (const [id, task] of blob.monkTasks) {
    const ref = refFromSerialized(task.targetEntityRef);
    if (ref) monkTasks.set(id, { kind: task.kind, targetEntityRef: ref });
  }
  accessor.mutate(conversionStateCodec, (m) => {
    for (const [id, conv] of blob.conversionState) {
      m.set(id, { byOwner: conv.byOwner, progress: conv.progress });
    }
  });
  accessor.mutate(monkCarriedRelicCodec, (m) => {
    for (const [id, relicId] of blob.monkCarriedRelic) {
      m.set(id, relicId);
    }
  });
  accessor.mutate(monkHealCountersCodec, (m) => {
    for (const [id, count] of blob.monkHealCounters) {
      m.set(id, count);
    }
  });
  accessor.mutate(relicsInMonasteryCodec, (m) => {
    for (const [id, count] of blob.relicsInMonastery) {
      m.set(id, count);
    }
  });
  accessor.mutate(wonderCountdownsCodec, (m) => {
    for (const [id, entry] of blob.wonderCountdowns) {
      m.set(id, {
        remainingTicks: entry.remainingTicks,
        totalTicks: entry.totalTicks,
        lastCompletedTick: entry.lastCompletedTick ?? null,
      });
    }
  });
  accessor.mutate(wonderCountdownOverridesCodec, (m) => {
    for (const [owner, ticks] of blob.wonderCountdownOverrides) {
      m.set(owner, ticks);
    }
  });
  accessor.mutate(relicCountdownsCodec, (m) => {
    for (const [owner, entry] of blob.relicCountdowns) {
      m.set(owner, {
        remainingTicks: entry.remainingTicks,
        totalTicks: entry.totalTicks,
        lastCompletedTick: entry.lastCompletedTick ?? null,
      });
    }
  });
  accessor.mutate(relicCountdownOverridesCodec, (m) => {
    for (const [owner, ticks] of blob.relicCountdownOverrides) {
      m.set(owner, ticks);
    }
  });
  accessor.mutate(playerScoreCountersCodec, (m) => {
    for (const [owner, counters] of blob.playerScoreCounters) {
      m.set(owner, {
        unitsProduced: counters.unitsProduced,
        buildingsProduced: counters.buildingsProduced,
        resourcesGathered: counters.resourcesGathered,
        unitsKilled: counters.unitsKilled ?? 0,
        wonderCompleted: counters.wonderCompleted,
      });
    }
  });
  accessor.mutate(trebuchetPackStatesCodec, (m) => {
    for (const [id, packState] of blob.trebuchetPackStates ?? []) {
      m.set(id, {
        packed: packState.packed,
        transitionTicksRemaining: packState.transitionTicksRemaining,
      });
    }
  });
  accessor.mutate(lastSeenStaticCodec, (outer) => {
    for (const [playerId, innerEntries] of blob.lastSeenStatic) {
      const inner = new Map<number, MemoryEntry>();
      for (const [entityId, entry] of innerEntries) {
        inner.set(entityId, {
          kind: entry.kind,
          entityType: entry.entityType as MemoryEntry['entityType'],
          position: { x: entry.position.x, y: entry.position.y },
          footprintWidth: entry.footprintWidth,
          footprintHeight: entry.footprintHeight,
          tint: entry.tint,
          owner: entry.owner,
          size: entry.size,
          visualVariant: entry.visualVariant as MemoryEntry['visualVariant'],
          lastSeenTick: entry.lastSeenTick,
        });
      }
      outer.set(playerId, inner);
    }
  });
  // Codex slot-21 review HIGH: clear before populate. World.deserialize
  // restored `world.state.aoe2.garrisonedByBuilding` from `worldSnapshot`,
  // and now we populate from `sideMaps`. Without clearing first, a corrupt
  // save where `sideMaps.garrisonedByBuilding` is missing an entry would
  // silently pick up the stale entry from worldSnapshot — masking the
  // cross-reference invariant that's supposed to fire on load-time
  // corruption. Same logic for the reverse map below. Phase 2F will
  // unify to a single source of truth (worldSnapshot only) but until
  // then, sideMaps is treated as the strict source of truth for the
  // garrison invariant.
  accessor.mutate(garrisonedByBuildingCodec, (m) => {
    m.clear();
    for (const [id, list] of blob.garrisonedByBuilding) {
      m.set(id, [...list]);
    }
  });
  accessor.mutate(garrisonedUnitToBuildingCodec, (m) => {
    m.clear();
    for (const [id, buildingId] of blob.garrisonedUnitToBuilding) {
      m.set(id, buildingId);
    }
  });
  accessor.mutate(garrisonedUnitVisionSourcesCodec, (m) => {
    for (const [id, src] of blob.garrisonedUnitVisionSources) {
      m.set(id, { playerId: src.playerId, radius: src.radius });
    }
  });
  // Cross-reference invariant for the garrison maps (Iter-1 H-3).
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
  accessor.mutate(productionQueuesCodec, (m) => {
    for (const [id, queue] of blob.productionQueues) {
      m.set(
        id,
        queue.map((entry) => ({
          kind: entry.kind,
          label: entry.label,
          ...(entry.unitType !== undefined ? { unitType: entry.unitType as TrainableUnitType } : {}),
          ...(entry.technologyType !== undefined
            ? { technologyType: entry.technologyType as ResearchableTechnologyType }
            : {}),
          remainingTicks: entry.remainingTicks,
          totalTicks: entry.totalTicks,
          isBlocked: entry.isBlocked,
        })),
      );
    }
  });
  // Iter-3 V3-6: rebuild inFlightTechByOwner from the loaded queues.
  // Phase 2D: clear first (the accessor's cache may have entries from the
  // pre-load world; the rebuild authoritatively reflects the loaded
  // queues). inFlightTechByOwner is Tier-2 — runtime cache only, never
  // flushed to worldSnapshot; we deliberately use accessor.get + clear()
  // rather than accessor.mutate so the Tier-2 dirty-bit invariant holds.
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
  // Codex slot-21 review HIGH: clear before populate (same logic as the
  // garrison slots).
  accessor.mutate(constructionStatesCodec, (m) => {
    m.clear();
    for (const [id, conState] of blob.constructionStates) {
      m.set(id, { ...conState });
    }
  });
  accessor.mutate(combatStatesCodec, (m) => {
    m.clear();
    for (const [id, combat] of blob.combatStates) {
      m.set(id, { ...combat });
    }
  });
  accessor.mutate(buildingHealthStatesCodec, (m) => {
    m.clear();
    for (const [id, hp] of blob.buildingHealthStates) {
      m.set(id, { ...hp });
    }
  });
  accessor.mutate(buildingCombatStatesCodec, (m) => {
    m.clear();
    for (const [id, bc] of blob.buildingCombatStates) {
      m.set(id, { ...bc });
    }
  });
  accessor.mutate(aiStatesCodec, (m) => {
    m.clear();
    for (const [owner, ai] of blob.aiStates ?? []) {
      m.set(owner, {
        difficulty: ai.difficulty,
        plan: ai.plan as AiPlan,
        villagerTargets: { ...ai.villagerTargets },
        attackGroup: [...ai.attackGroup],
        lastDecisionTick: ai.lastDecisionTick,
        lastEnemySightingTick: ai.lastEnemySightingTick,
        lastEnemySightingPosition: ai.lastEnemySightingPosition
          ? { x: ai.lastEnemySightingPosition.x, y: ai.lastEnemySightingPosition.y }
          : null,
      });
    }
  });
  accessor.mutate(wildlifeStatesCodec, (m) => {
    m.clear();
    for (const [id, wildState] of blob.wildlifeStates) {
      const ref = wildState.targetEntityRef ? refFromSerialized(wildState.targetEntityRef) : null;
      m.set(id, {
        currentHp: wildState.currentHp,
        maxHp: wildState.maxHp,
        attackDamage: wildState.attackDamage,
        attackRange: wildState.attackRange,
        reloadTicks: wildState.reloadTicks,
        cooldownTicks: wildState.cooldownTicks,
        armor: wildState.armor,
        autoAggro: wildState.autoAggro,
        isAlive: wildState.isAlive,
        corpsePersists: wildState.corpsePersists,
        aggroRange: wildState.aggroRange,
        targetEntityRef: ref,
      });
    }
  });

  // Iter-4 V4-7: drop-off retry throttle survives save+load. Older blobs
  // (pre-V4-7) omit the field; treat absence as "no throttled gatherers".
  if (blob.gathererDropOffStuckSinceTick) {
    accessor.mutate(gathererDropOffStuckSinceTickCodec, (m) => {
      if (blob.gathererDropOffStuckSinceTick) {
        for (const [id, tick] of blob.gathererDropOffStuckSinceTick) {
          m.set(id, tick);
        }
      }
    });
  }

  // V5-1: rebuild monksByOwner from the loaded world. The side map is
  // derivable from world.query('unit'), so it's not persisted in the
  // save blob — just rebuilt here. Doing it after the unit-related side
  // maps so any prior cleanup (e.g. orphan-prune) doesn't matter.
  for (const id of world.query('unit')) {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (!unit || unit.unitType !== 'monk') continue;
    let monkSet = monksByOwner.get(unit.owner);
    if (!monkSet) {
      monkSet = new Set();
      monksByOwner.set(unit.owner, monkSet);
    }
    monkSet.add(id);
  }

  matchState.outcome = savedGame.matchState.outcome;
  matchState.summary = savedGame.matchState.summary;
  matchState.winCondition = savedGame.matchState.winCondition;
  matchState.scores = savedGame.matchState.scores
    ? { ...savedGame.matchState.scores }
    : null;
  matchState.wonderCountdownTicks = savedGame.matchState.wonderCountdownTicks;
  matchState.relicCountdownTicks = savedGame.matchState.relicCountdownTicks;

  // Iter-3 V3-8: orphan-key prune across every entity-id-keyed side map.
  const pruneOrphanEntityKeys = (sideMap: Map<number, unknown>): void => {
    for (const id of [...sideMap.keys()]) {
      if (!world.getEntityRef(id)) {
        sideMap.delete(id);
      }
    }
  };
  pruneOrphanEntityKeys(unitCommands);
  accessor.mutate(sheepMoveOrdersCodec, (m) => pruneOrphanEntityKeys(m));
  accessor.mutate(rallyPointsCodec, (m) => pruneOrphanEntityKeys(m));
  pruneOrphanEntityKeys(monkTasks);
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
  // Phase 2D — prune via accessor.
  accessor.mutate(gathererDropOffStuckSinceTickCodec, (m) =>
    pruneOrphanEntityKeys(m),
  );

  // Full-review iter-1 Gemini MAJOR: orphan VALUES too. The maps below
  // store entity IDs in their values; without value-side cleanup they
  // would survive `pruneOrphanEntityKeys` (which only walks keys),
  // pollute the next save, and break the cross-reference invariant on
  // the NEXT load (turning a transient corruption into a permanent
  // wedge). Runs AFTER the cross-ref invariant so a partially-corrupted
  // save with mismatched-but-alive entities still throws loudly there;
  // this only handles the dead-id case where the only correct action is
  // silent cleanup.
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
