// Gating + producer-selection helpers for the AI planner system. These fold the
// dispatcher's pending intentions (which won't appear in persisted queues until
// the next tick's handler runs) into the counts the decision phases use to avoid
// re-pushing/over-spending, and provide the per-owner idle-producer / available-
// villager selection closures.

import type { BuildingComponent, BuildingType, UnitComponent } from '../../types';
import type { UnitCommand } from '../sharedTypes';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { constructionStatesCodec, productionQueuesCodec } from '../bridgeStateSerialize';
import type { CivWorld } from './aiSystemTypes';

export interface PendingIntentionMaps {
  pendingTrainsByBuilding: Map<number, number>;
  pendingResearchByBuilding: Map<number, number>;
  pendingResearchKeys: Set<string>;
  pendingBuildsByOwner: Map<number, number>;
}

export interface OwnerProducerHelpers {
  claimedVillagers: Set<number>;
  findAvailableVillagerForBuild: (ownerId: number) => number | null;
  findIdleProducerLocal: (buildingType: BuildingType) => number | null;
}

// Build the pending-intention lookups aiSystem's gates consult (so it does not
// re-push an intention that is already queued). Full-review L4 correction: in
// EVERY real runtime path `pendingCommands` is EMPTY here — the bridge drains it
// via `drainPendingCommands` immediately before `world.step()`, and no pusher
// runs before `prototypeAi` (replay clears it `before: ['prototypeAi']`), so
// this returns empty maps and the actual within-tick dedup is carried by the
// incremental `.set()` calls the phases make as they push. The scan is retained
// only so the gates stay correct under a hypothetical non-draining stepper; do
// NOT rely on it folding a prior-decision-tick intention (the decision interval
// ≥15 ticks far exceeds the 1-2 tick handler delay, so that never happens).
export function buildPendingIntentionMaps(
  activeWorld: CivWorld,
  pendingCommands: Array<{ type: string; data: Record<string, unknown> }>,
): PendingIntentionMaps {
  const pendingTrainsByBuilding = new Map<number, number>();
  // Per-building research push count. The production queue mixes train +
  // research entries in one list, so the queue-length cap must count both
  // (else a TC could land at depth 3 against the intended cap of 2).
  const pendingResearchByBuilding = new Map<number, number>();
  const pendingResearchKeys = new Set<string>(); // `${owner}:${tech}`
  const pendingBuildsByOwner = new Map<number, number>();
  // Type-guarded extraction. cmd.data is typed as Record<string, unknown>
  // at this layer; push sites always produce well-formed payloads, but a
  // malformed entry should be ignored rather than corrupt the gating maps.
  for (const cmd of pendingCommands) {
    if (cmd.type === 'queue.train') {
      const buildingId = cmd.data.buildingId;
      if (typeof buildingId !== 'number') continue;
      pendingTrainsByBuilding.set(
        buildingId,
        (pendingTrainsByBuilding.get(buildingId) ?? 0) + 1,
      );
    } else if (cmd.type === 'queue.research') {
      const buildingId = cmd.data.buildingId;
      const tech = cmd.data.technologyType;
      if (typeof buildingId !== 'number' || typeof tech !== 'string') continue;
      pendingResearchByBuilding.set(
        buildingId,
        (pendingResearchByBuilding.get(buildingId) ?? 0) + 1,
      );
      const building = activeWorld.getComponent<BuildingComponent>(
        buildingId,
        'building',
      );
      if (building) {
        pendingResearchKeys.add(`${building.owner}:${tech}`);
      }
    } else if (cmd.type === 'building.placeConfirm') {
      const builderId = cmd.data.builderId;
      if (typeof builderId !== 'number') continue;
      const builder = activeWorld.getComponent<UnitComponent>(builderId, 'unit');
      if (builder) {
        pendingBuildsByOwner.set(
          builder.owner,
          (pendingBuildsByOwner.get(builder.owner) ?? 0) + 1,
        );
      }
    }
  }
  return {
    pendingTrainsByBuilding,
    pendingResearchByBuilding,
    pendingResearchKeys,
    pendingBuildsByOwner,
  };
}

export function createOwnerProducerHelpers(
  activeWorld: CivWorld,
  accessor: BridgeStateAccessor,
  owner: number,
  unitCommands: Map<number, UnitCommand>,
  pendingTrainsByBuilding: Map<number, number>,
  pendingResearchByBuilding: Map<number, number>,
): OwnerProducerHelpers {
  // V5-8: precompute the owner's buildings grouped by type once per
  // decision tick (was 10–14 full `world.query('building')` scans per
  // tick via the closure-form findIdleProducer). findIdleProducerLocal
  // preserves the V3-24 load-balanced, id-tiebroken selection.
  const ownerBuildingsByType = new Map<BuildingType, number[]>();
  for (const id of activeWorld.query('building')) {
    const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
    if (!building || building.owner !== owner) continue;
    const list = ownerBuildingsByType.get(building.buildingType);
    if (list) {
      list.push(id);
    } else {
      ownerBuildingsByType.set(building.buildingType, [id]);
    }
  }

  // Per-tick claimed-villagers tracker. Post-1C, building.placeConfirm
  // intentions update unitCommands only next tick, so one decision tick
  // pushing watch-tower AND wonder/nextBuild could dispatch the SAME
  // villager to two foundations (the second overwrites the first, leaving
  // foundation A builderless). Track claimed villagers locally + exclude.
  const claimedVillagers = new Set<number>();
  const findAvailableVillagerForBuild = (
    ownerId: number,
  ): number | null => {
    for (const id of activeWorld.query('unit')) {
      const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
      if (
        unit?.owner === ownerId
        && unit.unitType === 'villager'
        && !unitCommands.has(id)
        && !claimedVillagers.has(id)
      ) {
        return id;
      }
    }
    // Fallback: any owned villager not yet claimed AND not currently building
    // (mirrors the owned-villager fallback the original helper had). L3: the
    // first loop already skips busy villagers via `!unitCommands.has(id)`; this
    // fallback must still never return a villager on a `build` command, or the
    // uncapped watch-tower push could yank the SOLE builder off an in-progress
    // foundation and leave it builderless. Reassigning a gatherer/mover is fine;
    // abandoning a foundation is not — return null instead (skip the build).
    for (const id of activeWorld.query('unit')) {
      const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
      if (
        unit?.owner === ownerId
        && unit.unitType === 'villager'
        && !claimedVillagers.has(id)
        && unitCommands.get(id)?.type !== 'build'
      ) {
        return id;
      }
    }
    return null;
  };
  const findIdleProducerLocal = (buildingType: BuildingType): number | null => {
    const candidates = ownerBuildingsByType.get(buildingType);
    if (!candidates) return null;
    let bestId: number | null = null;
    let bestQueueLength = Number.POSITIVE_INFINITY;
    for (const id of candidates) {
      const construction = accessor.get(constructionStatesCodec).get(id);
      if (construction && !construction.isComplete) continue;
      // Phase 1C: include pending queue.train AND queue.research
      // intentions for this building. productionQueues mixes train
      // and research entries in a single list, so the queue-length
      // cap that gates new pushes must account for both.
      const persistedLength = accessor.get(productionQueuesCodec).get(id)?.length ?? 0;
      const pendingTrainLength = pendingTrainsByBuilding.get(id) ?? 0;
      const pendingResearchLength = pendingResearchByBuilding.get(id) ?? 0;
      const queueLength =
        persistedLength + pendingTrainLength + pendingResearchLength;
      if (queueLength >= 2) continue;
      if (
        queueLength < bestQueueLength
        || (queueLength === bestQueueLength && bestId !== null && id < bestId)
      ) {
        bestId = id;
        bestQueueLength = queueLength;
      }
    }
    return bestId;
  };
  return { claimedVillagers, findAvailableVillagerForBuild, findIdleProducerLocal };
}
