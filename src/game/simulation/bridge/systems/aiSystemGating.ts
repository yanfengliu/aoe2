// Gating + producer-selection helpers for the AI planner system. These fold the
// dispatcher's pending intentions (which won't appear in persisted queues until
// the next tick's handler runs) into the counts the decision phases use to avoid
// re-pushing/over-spending, and provide the per-owner idle-producer / available-
// villager selection closures.

import type { BuildingComponent, BuildingType, EconomyResourceKind, GathererComponent, UnitComponent } from '../../types';
import type { UnitCommand } from '../sharedTypes';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import type { BuildSite, NearestSiteBuilder } from '../siteBuilderWalk';
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
  /**
   * The villager to send to a building site. Named a site, it is the available
   * villager with the shortest walk to it, ties by entity order (work 152 M1d,
   * siteBuilderWalk.ts), a resource's last gatherer passed over while another
   * can be sent. With no site it is the first available villager in
   * entity order: the site search asks before there is a site, to know whose
   * reach a site must be within, and that question did not change.
   */
  findAvailableVillagerForBuild: (ownerId: number, site?: BuildSite) => number | null;
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
  pendingCommands: ReadonlyArray<{ type: string; data: Record<string, unknown> }>,
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
  /** The walk that chooses among the available villagers (siteBuilderWalk.ts). */
  nearestSiteBuilder?: NearestSiteBuilder,
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
  // ON THE MAP, both passes: `garrisonUnit` strips a villager's position, and
  // the town bell shelters villagers under a raid, so without this the AI can
  // hand a foundation to a builder that is inside a building. The command is
  // accepted — the validator asks only that the builder is alive and is a unit
  // — so the site is placed, the builder is set to a `build` command it can
  // never walk to, and the concurrent-build slot is spent.
  const claimedVillagers = new Set<number>();
  // WHO IS AVAILABLE (unchanged by work 152 M1d, which changed only the choice
  // among them). A villager on the map that holds no unit command and has not
  // been sent to a site earlier in this decision; gathering is no unit command,
  // so that is every villager at work on a resource or standing idle. Only when
  // there is none: any unclaimed villager on another errand, but never one on a
  // `build` command. L3: the uncapped watch-tower push could otherwise yank the
  // SOLE builder off an in-progress foundation and leave it builderless.
  // Reassigning a gatherer or a mover is fine; abandoning a foundation is not,
  // so with nobody else the answer is null and the build is skipped.
  /** The seat's villagers that are the only one it has on a resource, counted
   *  as the rebalance counts them (`villagerRebalance`): every villager with a
   *  gatherer's role, whatever it is doing this tick. */
  const lastOnTheirResource = (ownerId: number): Set<number> => {
    const byResource = new Map<EconomyResourceKind, number[]>();
    for (const id of activeWorld.query('unit', 'gatherer')) {
      const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
      const gatherer = activeWorld.getComponent<GathererComponent>(id, 'gatherer');
      if (!gatherer || unit?.owner !== ownerId || unit.unitType !== 'villager') continue;
      const sharing = byResource.get(gatherer.desiredResource);
      if (sharing) sharing.push(id);
      else byResource.set(gatherer.desiredResource, [id]);
    }
    const last = new Set<number>();
    for (const sharing of byResource.values()) if (sharing.length === 1) last.add(sharing[0]!);
    return last;
  };
  const availableVillagers = (ownerId: number, firstOnly: boolean): number[] => {
    const isOwnVillager = (id: number): boolean => {
      const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
      return unit?.owner === ownerId && unit.unitType === 'villager' && !claimedVillagers.has(id);
    };
    const free: number[] = [];
    for (const id of activeWorld.query('unit', 'position')) {
      if (!isOwnVillager(id) || unitCommands.has(id)) continue;
      free.push(id);
      if (firstOnly) return free;
    }
    if (free.length > 0) return free;
    const onAnotherErrand: number[] = [];
    for (const id of activeWorld.query('unit', 'position')) {
      if (!isOwnVillager(id) || unitCommands.get(id)?.type === 'build') continue;
      onAnotherErrand.push(id);
      if (firstOnly) return onAnotherErrand;
    }
    return onAnotherErrand;
  };
  const findAvailableVillagerForBuild = (
    ownerId: number,
    site?: BuildSite,
  ): number | null => {
    if (site === undefined || nearestSiteBuilder === undefined) {
      return availableVillagers(ownerId, true)[0] ?? null;
    }
    // Entity order, so the first is today's choice: it stands when the flood
    // reaches nobody.
    const candidates = availableVillagers(ownerId, false);
    if (candidates.length <= 1) return candidates[0] ?? null;
    // A RESOURCE'S LAST GATHERER STAYS AT WORK while another villager can be
    // sent (this game's own policy, the coordinator's of 2026-11-11). The walk
    // alone sent the lobby match's first barracks to owner 1's only wood
    // villager, one cell nearer than a food villager: it walked and built for
    // 80 s, the seat banked no wood from 0:10 to 2:35, its second House went
    // down at 3:12 instead of 2:00, and it sat housed for 94 s (plan 152). The
    // rebalance does not make that good: it counts a villager away building
    // as a gatherer of its resource (`aiDecisionOps.ts`, plan 106's card).
    // When every available villager is the last on its resource, or the walk
    // reaches none of the others, the nearest of them all goes.
    const last = lastOnTheirResource(ownerId);
    const others = candidates.filter((id) => !last.has(id));
    const spared = others.length > 0 && others.length < candidates.length
      ? nearestSiteBuilder(others, site, activeWorld)
      : null;
    return spared ?? nearestSiteBuilder(candidates, site, activeWorld) ?? candidates[0]!;
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
