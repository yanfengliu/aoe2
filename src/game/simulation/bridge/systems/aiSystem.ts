// AI planner driver. Runs once per `decisionIntervalTicks(difficulty)` for
// each AI-controlled owner. Each pass: refresh the plan + villager targets
// for the current age, react to scouted enemies, walk the build order,
// queue villager / military / monk training, kick research that's
// affordable, and dispatch the attack group when it crosses the
// age-gated threshold.

import { VisibilityMap, type EntityRef, type Position, type World } from 'civ-engine';
import type {
  BuildableBuildingType,
  BuildingComponent,
  BuildingType,
  PlayerResources,
  PopulationState,
  ResearchableTechnologyType,
  ResourceComponent,
  TrainableUnitType,
  UnitComponent,
  UnitType,
} from '../../types';
import { type GameCommands, type GameEvents, type GameWorld } from '../pureHelpers';
import {
  AI_BASE_VISION_RADIUS,
  AI_MONK_COUNT_CAP,
  ageUpResourceBuffer,
  attackGroupSize,
  decisionIntervalTicks,
  pickNextAgeResearch,
  pickNextBuildTarget,
  pickUnitMix,
  planForAge,
  shouldPursueWonder,
  villagerTargetsEqual,
  villagerTargetsForAge,
  type AiState,
} from '../../ai';
import {
  canAfford,
  constructionCost,
  researchCost,
  trainingCost,
} from '../../prototypeEconomyRules';
import type { WildlifeState } from './systemTypes';
import {
  constructionStatesCodec,
  productionQueuesCodec,
  townCenterRefsCodec,
} from '../bridgeStateSerialize';

type CivWorld = World<GameEvents, GameCommands>;

interface UnitCommandLike {
  type: 'attack' | 'move' | 'build';
  targetEntityRef?: EntityRef | null;
  targetEntityKind?: 'unit' | 'building' | 'resource' | null;
  buildingRef?: EntityRef | null;
}

export interface AiSystemDeps {
  world: GameWorld;
  humanPlayerId: number;
  visibility: VisibilityMap;
  // Phase 2D: townCenterRefs migrated to world.state.aoe2.* via accessor.
  // Per-tick reads happen via accessor.get(townCenterRefsCodec).
  accessor: import('../bridgeStateAccessor').BridgeStateAccessor;
  aiStates: Map<number, AiState>;
  population: Map<number, PopulationState>;
  playerResources: Map<number, PlayerResources>;
  unitCommands: Map<number, UnitCommandLike>;
  wildlifeStates: Map<number, WildlifeState>;
  monksByOwner: Map<number, Set<number>>;
  currentEntityId: (activeWorld: CivWorld, ref: EntityRef | null | undefined) => number | null;
  getPlayerAge: (owner: number) => import('../../types').AgeType;
  villagerRebalance: (owner: number, targets: AiState['villagerTargets']) => void;
  findOwnedBuilding: (owner: number, buildingType: BuildingType) => number | null;
  findOwnedUnit: (owner: number, unitType: UnitType) => number | null;
  ownedMilitaryUnitIds: (owner: number) => Set<number>;
  findOwnedMilitaryUnits: (owner: number) => Array<{ id: number }>;
  hasOwnedWonder: (owner: number) => boolean;
  isConstructingBuilding: (owner: number, buildingType: BuildingType) => boolean;
  pickWatchTowerPlacement: (
    townCenterPosition: Position,
    enemyPosition: Position,
  ) => Position | null;
  // Phase 1C — AI-decision intention push (DESIGN v17 §6.5/§6.6). The
  // dispatcher's `drainPendingCommands` between ticks submits each via
  // `world.submitWithResult`; the corresponding handler runs at the start
  // of the NEXT tick's `processCommands`. Pre-1B `startConstruction` lives
  // on as `startConstructionDirect` for the handler delegate path.
  pushBuildingPlaceConfirmIntention: (
    builderId: number,
    buildingType: BuildableBuildingType,
    anchor: Position,
  ) => void;
  findBuildPlacementNear: (
    nearby: Position,
    buildingType: BuildingType,
  ) => Position | null;
  countOwnedUnits: (owner: number, unitType: UnitType) => number;
  countQueuedUnits: (buildingId: number, unitType: TrainableUnitType) => number;
  canAdvanceToFeudalAge: (owner: number) => boolean;
  canAdvanceToCastleAge: (owner: number) => boolean;
  canAdvanceToImperialAge: (owner: number) => boolean;
  pushQueueResearchIntention: (
    buildingId: number,
    technologyType: ResearchableTechnologyType,
  ) => void;
  pushQueueTrainIntention: (buildingId: number, unitType: TrainableUnitType) => void;
  // Phase 1C — read-only handle to the dispatcher's pending intention
  // queue. aiSystem inspects it each decision tick to compute "effective"
  // queue / in-flight counts: an intention pushed this tick won't appear in
  // `productionQueues` / `inFlightTechByOwner` until the handler runs at
  // the NEXT tick, so without this gate aiSystem would re-push every
  // decision tick and over-spend across the silent-no-op B2 surface.
  pendingCommands: Array<
    { type: string; data: Record<string, unknown> }
  >;
  getTrainOptions: (owner: number, buildingType: BuildingType) => TrainableUnitType[];
  getResearchOptions: (
    owner: number,
    buildingType: BuildingType,
  ) => ResearchableTechnologyType[];
  assignAiMonkTasks: (owner: number) => void;
  findPreferredVisibleEnemyUnit: (owner: number, position: Position) => number | null;
  findPreferredVisibleEnemyBuilding: (owner: number, position: Position) => number | null;
  // Phase 1C: AI-decision systems push intentions; the dispatcher submits
  // between ticks. These are NOT synchronous facades — return value is
  // always true (queued; handler runs at next tick). Renamed from
  // `issueUnit*Command` per full-review iter-1 R2-M2/R2-D4 to match the
  // contract: pre-1B's facade returned false on stale targets and the
  // fallback chain depended on that; post-1C the chain semantics changed
  // and the misleading name caused R2-M2's silent dead-fallback bug.
  submitUnitAttackIntention: (
    attackerId: number,
    targetId: number,
    targetKind: 'unit' | 'building' | 'resource',
  ) => boolean;
  submitUnitMoveIntention: (unitId: number, target: Position) => boolean;
}

export function registerAiSystem(deps: AiSystemDeps): void {
  const {
    world,
    humanPlayerId,
    visibility,
    accessor,
    aiStates,
    population,
    playerResources,
    unitCommands,
    wildlifeStates,
    monksByOwner,
    currentEntityId,
    getPlayerAge,
    villagerRebalance,
    findOwnedBuilding,
    findOwnedUnit,
    ownedMilitaryUnitIds,
    findOwnedMilitaryUnits,
    hasOwnedWonder,
    isConstructingBuilding,
    pickWatchTowerPlacement,
    pushBuildingPlaceConfirmIntention,
    findBuildPlacementNear,
    countOwnedUnits,
    countQueuedUnits,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    pushQueueResearchIntention,
    pushQueueTrainIntention,
    pendingCommands,
    getTrainOptions,
    getResearchOptions,
    assignAiMonkTasks,
    findPreferredVisibleEnemyUnit,
    findPreferredVisibleEnemyBuilding,
    submitUnitAttackIntention,
    submitUnitMoveIntention,
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

      // Phase 1C — fold pending intentions into the gates aiSystem uses
      // to decide whether to push more. Without this, an intention pushed
      // last decision tick (handler hasn't run yet) is invisible to
      // `productionQueues.length` / `inFlightTechByOwner.has(...)` /
      // `unitCommands.entries()` and the AI re-pushes every tick.
      // Build the lookups once per tick (O(N) where N = queue length;
      // typically <30 entries during AI macro).
      const pendingTrainsByBuilding = new Map<number, number>();
      // Per-building research push count. Production queues mix train and
      // research entries (`productionQueues[buildingId]` is a single list),
      // so the queue-length cap that gates new pushes must include
      // pending research pushes alongside pending trains. Without this,
      // a TC with one queued villager could accept (a) age-up research
      // push and (b) another villager push in the same tick, producing
      // an actual queue of length 3 against the AI's intended cap of 2.
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

      for (const [owner, state] of aiStates.entries()) {
        const interval = decisionIntervalTicks(state.difficulty);
        if (state.lastDecisionTick >= 0 && currentTick - state.lastDecisionTick < interval) {
          continue;
        }
        state.lastDecisionTick = currentTick;

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

        // Phase 1C: gates use the raw stockpile directly. DESIGN v17 §6.4
        // B1/B2 specify validators are best-effort and handlers do the
        // authoritative spend with silent-no-op fallback on stale state, so
        // over-acceptance within a single decision tick is intentional —
        // the handler picks the affordable subset. The pending-queue-length
        // / pendingResearchKeys / pendingBuildsByOwner gates above already
        // prevent legit duplicate spam (re-pushing the same intention while
        // an earlier copy is still in `pendingCommands`).
        const stockpile = playerResources.get(owner);

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

        const populationState = population.get(owner);
        const populationBlocked = Boolean(
          populationState && populationState.current >= populationState.cap,
        );

        // V5-8: precompute the owner's buildings grouped by type once
        // per decision tick. Pre-fix the AI called the closure-form
        // findIdleProducer 10–14 times per decision tick (one per unit
        // type in pickUnitMix + one per building type for research +
        // monastery), each doing a full world.query('building') scan.
        // This reduces it to one scan per decision tick. The local
        // findIdleProducerLocal preserves the V3-24 load-balanced
        // selection (least-loaded, id-tiebreak for save/load determinism).
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
        // intentions don't immediately update unitCommands — the handler
        // runs at the start of next tick. So a single AI decision tick
        // that pushes both watch-tower AND wonder/nextBuild intentions can
        // see the same villager as "available" in all three
        // findAvailableVillagerForBuild calls, dispatching the same unit
        // to two foundations. Handler 1 builds at site A; Handler 2
        // overwrites the unitCommand and builds at site B; the foundation
        // at A is stranded with no builder. Track claimed villagers
        // locally and exclude them.
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
          // Fallback: any owned villager not yet claimed (mirrors the
          // owned-villager fallback that the original helper had).
          for (const id of activeWorld.query('unit')) {
            const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
            if (
              unit?.owner === ownerId
              && unit.unitType === 'villager'
              && !claimedVillagers.has(id)
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

        if (ownerTownCenterPosition) {
          const sightingFresh =
            state.lastEnemySightingTick >= 0
            && currentTick - state.lastEnemySightingTick <= interval * 2;
          if (
            sightingFresh
            && state.lastEnemySightingPosition
            && !findOwnedBuilding(owner, 'watch-tower')
          ) {
            const builderId = findAvailableVillagerForBuild(owner);
            const anchor = pickWatchTowerPlacement(
              ownerTownCenterPosition,
              state.lastEnemySightingPosition,
            );
            // Phase 1C: gate on raw stockpile affordability (symmetry with
            // wonder/nextBuild paths below).
            const watchTowerCost = constructionCost('watch-tower');
            if (
              builderId !== null
              && anchor
              && stockpile
              && canAfford(stockpile, watchTowerCost)
            ) {
              pushBuildingPlaceConfirmIntention(builderId, 'watch-tower', anchor);
              claimedVillagers.add(builderId);
              // Phase 1C: watch tower push happens BEFORE the ongoingBuilds
              // calculation below, so we must update pendingBuildsByOwner so
              // the calculation reflects this tick's push.
              pendingBuildsByOwner.set(
                owner,
                (pendingBuildsByOwner.get(owner) ?? 0) + 1,
              );
            }
          }

          const missing = (buildingType: BuildableBuildingType): boolean => {
            if (buildingType === 'house') {
              if (populationBlocked) {
                return !isConstructingBuilding(owner, 'house');
              }
              return false;
            }
            return !findOwnedBuilding(owner, buildingType);
          };

          let ongoingBuilds = 0;
          for (const [, cmd] of unitCommands.entries()) {
            if (cmd.type !== 'build') continue;
            const buildingRef = cmd.buildingRef;
            if (!buildingRef) continue;
            const bid = currentEntityId(activeWorld, buildingRef);
            if (bid === null) continue;
            const b = activeWorld.getComponent<BuildingComponent>(bid, 'building');
            if (b && b.owner === owner) ongoingBuilds += 1;
          }
          // Phase 1C: include pending building.placeConfirm intentions —
          // unitCommands.build only flips after the handler runs.
          ongoingBuilds += pendingBuildsByOwner.get(owner) ?? 0;
          const totalVillagers = countOwnedUnits(owner, 'villager');
          const maxConcurrentBuilds = Math.max(1, totalVillagers - 1);

          const aiResources = playerResources.get(owner);
          const wonderPursuit =
            ownerTownCenterPosition !== null
            && aiResources !== undefined
            && shouldPursueWonder(
              currentAge,
              hasOwnedWonder(owner),
              countOwnedUnits(owner, 'villager'),
              aiResources,
            );
          if (wonderPursuit && ongoingBuilds < maxConcurrentBuilds) {
            const builderId = findAvailableVillagerForBuild(owner);
            const anchor = findBuildPlacementNear(ownerTownCenterPosition, 'wonder');
            const wonderCost = constructionCost('wonder');
            if (
              builderId !== null
              && anchor
              && stockpile
              && canAfford(stockpile, wonderCost)
            ) {
              pushBuildingPlaceConfirmIntention(builderId, 'wonder', anchor);
              claimedVillagers.add(builderId);
              ongoingBuilds += 1;
            }
          }

          const nextBuild = pickNextBuildTarget(currentAge, missing, populationBlocked);
          if (nextBuild && ongoingBuilds < maxConcurrentBuilds && !wonderPursuit) {
            const builderId = findAvailableVillagerForBuild(owner);
            const anchor = findBuildPlacementNear(ownerTownCenterPosition, nextBuild);
            const buildCost = constructionCost(nextBuild);
            if (
              builderId !== null
              && anchor
              && stockpile
              && canAfford(stockpile, buildCost)
            ) {
              pushBuildingPlaceConfirmIntention(builderId, nextBuild, anchor);
              claimedVillagers.add(builderId);
              ongoingBuilds += 1;
            }
          }
        }

        const nextAgeTech: ResearchableTechnologyType | null =
          currentAge === 'dark-age' ? 'feudal-age'
          : currentAge === 'feudal-age' ? 'castle-age'
          : currentAge === 'castle-age' ? 'imperial-age'
          : null;
        const savingForAgeUp = ((): boolean => {
          if (!nextAgeTech) return false;
          const s = playerResources.get(owner);
          if (!s) return false;
          const cost = researchCost(nextAgeTech);
          const foodTarget = cost.food ?? 0;
          const goldTarget = cost.gold ?? 0;
          const foodProgress = foodTarget > 0 ? s.food / foodTarget : 1;
          const goldProgress = goldTarget > 0 ? s.gold / goldTarget : 1;
          const minProgress = Math.min(foodProgress, goldProgress);
          return minProgress >= 0.6 && !canAfford(s, cost);
        })();

        // Phase 1C: pickUnitMix BEFORE villager training. Pre-1B accidentally
        // trained military at the rare tick where tcQueue was full (villager
        // gate blocked) AND barracks just completed. Post-1C, the +1-tick
        // handler delay shifts that corner case out of alignment, so a
        // barracks-rush AI never trains militia. The structural fix is to
        // make military priority explicit: push military first, then age-up
        // research, then villager. When food is tight enough that only one
        // can train, the FIFO-ordered handler picks military.
        const mix = pickUnitMix(currentAge);
        if (!savingForAgeUp) {
          for (const { unitType, producer } of mix) {
            const producerId = findIdleProducerLocal(producer);
            if (producerId === null) continue;
            if (!stockpile) continue;
            const cost = trainingCost(unitType);
            if (!canAfford(stockpile, cost)) continue;
            if (!getTrainOptions(owner, producer).includes(unitType)) continue;
            pushQueueTrainIntention(producerId, unitType);
            // Phase 1C — increment so subsequent same-producer pushes (feudal+
            // pickUnitMix returns multiple unit types per producer) see this
            // push in their findIdleProducerLocal queue-length gate. Without
            // this, both archer and skirmisher would funnel into the same
            // archery-range in one tick, then the second handler would
            // silent-no-op on queue-full (per Gemini iter-1 F2).
            pendingTrainsByBuilding.set(
              producerId,
              (pendingTrainsByBuilding.get(producerId) ?? 0) + 1,
            );
          }
        }

        if (ownerTownCenterId !== null) {
          const tcConstruction = accessor.get(constructionStatesCodec).get(ownerTownCenterId);
          if (!tcConstruction || tcConstruction.isComplete) {
            const bufferCost = ageUpResourceBuffer(currentAge);
            const hasBuffer = stockpile ? canAfford(stockpile, bufferCost) : false;
            const nextAge = pickNextAgeResearch(
              currentAge,
              (tech) => {
                if (tech === 'feudal-age') return canAdvanceToFeudalAge(owner);
                if (tech === 'castle-age') return canAdvanceToCastleAge(owner);
                if (tech === 'imperial-age') return canAdvanceToImperialAge(owner);
                return false;
              },
              (tech) => {
                return stockpile ? canAfford(stockpile, researchCost(tech)) : false;
              },
            );
            // Compute the TC's effective queue length BEFORE the age-up
            // research gate. productionQueues mixes train and research
            // entries in a single list; without this gate, a TC already
            // at the cap of 2 would still accept age-up research and
            // land at length 3 (handler has no queue-cap recheck).
            const tcPersistedQueueLength = accessor.get(productionQueuesCodec).get(ownerTownCenterId)?.length ?? 0;
            // The AI only ever pushes villagers to TC, so every pending TC
            // queue.train counts as a pending villager. If a future change
            // adds a non-villager TC train (e.g., a king or a fishing-boat),
            // this currentVillagers calculation would over-count and the
            // villagerCap gate would block real villager training prematurely
            // — narrow this lookup to villager-typed pending trains then.
            const tcPendingTrains = pendingTrainsByBuilding.get(ownerTownCenterId) ?? 0;
            let tcPendingResearch = pendingResearchByBuilding.get(ownerTownCenterId) ?? 0;
            // Mixed-queue cap: trains + research share the productionQueue.
            const tcEffectiveQueueLengthBeforeAgeUp =
              tcPersistedQueueLength + tcPendingTrains + tcPendingResearch;

            // Phase 1C: skip if a queue.research for the same age tech is
            // already pending (handler hasn't yet flipped inFlightTechByOwner).
            // Also gate on tcEffectiveQueueLength so we don't push age-up
            // research onto a full queue.
            if (
              nextAge
              && hasBuffer
              && !pendingResearchKeys.has(`${owner}:${nextAge}`)
              && tcEffectiveQueueLengthBeforeAgeUp < 2
            ) {
              pushQueueResearchIntention(ownerTownCenterId, nextAge);
              tcPendingResearch += 1;
              pendingResearchByBuilding.set(ownerTownCenterId, tcPendingResearch);
              pendingResearchKeys.add(`${owner}:${nextAge}`);
            }

            // Recompute the queue length post-age-up push so the villager
            // gate below sees the freshly-pushed age-up entry.
            const tcEffectiveQueueLength =
              tcPersistedQueueLength + tcPendingTrains + tcPendingResearch;
            const villagerCap =
              currentAge === 'dark-age' ? 6
              : currentAge === 'imperial-age' ? 50
              : 14;
            const currentVillagers =
              countOwnedUnits(owner, 'villager') + countQueuedUnits(ownerTownCenterId, 'villager') + tcPendingTrains;
            const villagerCost = trainingCost('villager');
            if (
              !populationBlocked
              && !savingForAgeUp
              && currentVillagers < villagerCap
              && tcEffectiveQueueLength < 2
              && stockpile
              && canAfford(stockpile, villagerCost)
            ) {
              pushQueueTrainIntention(ownerTownCenterId, 'villager');
              // Iter-1 Gemini MINOR: mirror the military / research push
              // pattern at line 555-558. Today the TC is evaluated exactly
              // once per decision tick so the increment doesn't matter,
              // but a future multi-TC or multi-pass change would re-enter
              // here and over-commit without this. Keep the invariant.
              pendingTrainsByBuilding.set(
                ownerTownCenterId,
                (pendingTrainsByBuilding.get(ownerTownCenterId) ?? 0) + 1,
              );
            }
          }
        }

        if (!savingForAgeUp) {
          for (const buildingType of [
            'blacksmith',
            'archery-range',
            'barracks',
            'stable',
            'siege-workshop',
            'castle',
          ] as const) {
            const buildingId = findIdleProducerLocal(buildingType);
            if (buildingId === null) continue;
            const options = getResearchOptions(owner, buildingType);
            if (options.length === 0) continue;
            if (!stockpile) continue;
            for (const tech of options) {
              // Phase 1C: skip techs whose queue.research intention is
              // already pending (handler hasn't flipped inFlightTechByOwner).
              if (pendingResearchKeys.has(`${owner}:${tech}`)) continue;
              const cost = researchCost(tech);
              if (canAfford(stockpile, cost)) {
                pushQueueResearchIntention(buildingId, tech);
                // Update per-tick gating maps so subsequent same-tick
                // findIdleProducerLocal calls see this slot consumed.
                pendingResearchByBuilding.set(
                  buildingId,
                  (pendingResearchByBuilding.get(buildingId) ?? 0) + 1,
                );
                pendingResearchKeys.add(`${owner}:${tech}`);
                break;
              }
            }
          }
        }

        if (
          !savingForAgeUp
          && (currentAge === 'castle-age' || currentAge === 'imperial-age')
        ) {
          const monasteryId = findIdleProducerLocal('monastery');
          if (monasteryId !== null) {
            // V5-1: O(1) monk count via monksByOwner side map.
            const ownedMonks =
              (monksByOwner.get(owner)?.size ?? 0) + countQueuedUnits(monasteryId, 'monk');
            if (
              ownedMonks < AI_MONK_COUNT_CAP
              && stockpile
              && canAfford(stockpile, trainingCost('monk'))
              && getTrainOptions(owner, 'monastery').includes('monk')
            ) {
              pushQueueTrainIntention(monasteryId, 'monk');
            }
          }
        }

        // V5-1: O(1) skip-guard via monksByOwner side map. Iter-1 V4-12
        // used countOwnedUnits(owner, 'monk') for this gate, but
        // countOwnedUnits walks world.query('unit') — same cost as
        // assignAiMonkTasks itself, doubling the steady-state cost when
        // an AI has Monks. The side map is maintained in entityCreateOps,
        // entityDestroyOps, and monkTaskAppliers.flipConvertedUnit; rebuilt
        // on save-load.
        if ((monksByOwner.get(owner)?.size ?? 0) > 0) {
          assignAiMonkTasks(owner);
        }

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
                && wildlifeStates.get(targetId)?.isAlive
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
          const humanVillagerId = findOwnedUnit(humanPlayerId, 'villager');
          if (shouldPush && humanVillagerId !== null) {
            submitUnitAttackIntention(id, humanVillagerId, 'unit');
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
            if (humanTownCenterId !== null) {
              submitUnitAttackIntention(id, humanTownCenterId, 'building');
              continue;
            }

            if (humanTownCenterPosition) {
              submitUnitMoveIntention(id, humanTownCenterPosition);
            }
          }
        }
      }
    },
  });
}
