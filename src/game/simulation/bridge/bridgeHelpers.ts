// Small bridge-local helpers extracted from createWorld so the main file
// stays narrow. Each helper closes over the same `state`, `world`, and a
// few collaborator functions; ownership of the side maps still lives in
// createBridgeState — these helpers are pure operations on top.

import type { EntityRef, Position } from 'civ-engine';

import type {
  GathererComponent,
  ResearchableTechnologyType,
  UnitTaskState,
} from '../types';
import { currentEntityId, type GameWorld } from './pureHelpers';
import {
  DEFAULT_DIFFICULTY,
  planForAge,
  villagerTargetsForAge,
  type AiState,
  type DifficultyLevel,
} from '../ai';
import type { UnitCommand } from './sharedTypes';
import type { BridgeState } from './bridgeState';
import {
  aiStatesCodec,
  gathererDropOffStuckSinceTickCodec,
  inFlightTechByOwnerCodec,
  playerAgesCodec,
  playerScoreCountersCodec,
} from './bridgeStateSerialize';
import { findSafeSpawnWithEgress } from '../spawn';
import { CARDINAL_NEIGHBOR_OFFSETS } from './bridgeConstants';

interface PlayerScoreCounters {
  unitsProduced: number;
  buildingsProduced: number;
  resourcesGathered: number;
  unitsKilled: number;
  wonderCompleted: boolean;
}

export interface BridgeHelpersDeps {
  world: GameWorld;
  state: BridgeState;
  // Phase 2D — accessor for migrated slots (playerAges read in ensureAiState).
  accessor: import('./bridgeStateAccessor').BridgeStateAccessor;
}

export interface BridgeHelpers {
  ensurePlayerScoreCounters(owner: number): PlayerScoreCounters;
  ensureAiState(owner: number, difficulty?: DifficultyLevel): AiState;
  inFlightTechSetFor(owner: number): Set<ResearchableTechnologyType>;
  clearUnitCommand(unitId: number): void;
  setUnitCommand(unitId: number, command: UnitCommand): void;
  getCurrentEntityId(ref: EntityRef | null): number | null;
  getEntityRef(id: number): EntityRef | null;
  getUnitTaskState(id: number, isGarrisonedUnit: (id: number) => boolean): UnitTaskState;
}

export function createBridgeHelpers(deps: BridgeHelpersDeps): BridgeHelpers {
  const { world, state, accessor } = deps;
  const {
    unitCommands,
    movePathCache,
  } = state;

  // Phase 2D: playerScoreCounters lives in world.state.aoe2.* via accessor.
  // Callers mutate the returned counters object directly (e.g.
  // `counters.unitsProduced += 1`); we mark dirty unconditionally because
  // the typical call pattern is ensure-then-mutate. Pure read-only reads
  // (e.g. matchEndOps reading at end-of-match) over-mark slightly but the
  // re-serialize cost is small and the alternative (forcing every caller
  // to wrap mutations in accessor.mutate) leaks the migration surface.
  function ensurePlayerScoreCounters(owner: number): PlayerScoreCounters {
    const map = accessor.get(playerScoreCountersCodec);
    let counters = map.get(owner);
    if (!counters) {
      counters = {
        unitsProduced: 0,
        buildingsProduced: 0,
        resourcesGathered: 0,
        unitsKilled: 0,
        wonderCompleted: false,
      };
      map.set(owner, counters);
    }
    accessor.markDirty(playerScoreCountersCodec);
    return counters;
  }

  // Phase 2D: aiStates migrated. Same ensure-then-mutate pattern as
  // ensurePlayerScoreCounters above — return the live cached value, callers
  // mutate fields in place, we mark dirty unconditionally.
  function ensureAiState(
    owner: number,
    difficulty: DifficultyLevel = DEFAULT_DIFFICULTY,
  ): AiState {
    const map = accessor.get(aiStatesCodec);
    let aiState = map.get(owner);
    if (!aiState) {
      const age = accessor.get(playerAgesCodec).get(owner) ?? 'dark-age';
      aiState = {
        difficulty,
        plan: planForAge(age),
        villagerTargets: { ...villagerTargetsForAge(age) },
        attackGroup: [],
        lastDecisionTick: -1,
        lastEnemySightingTick: -1,
        lastEnemySightingPosition: null,
      };
      map.set(owner, aiState);
    }
    accessor.markDirty(aiStatesCodec);
    return aiState;
  }

  // Phase 2D: inFlightTechByOwner migrated. Tier-2 — NOT in TIER_1_CODECS,
  // NOT flushed to worldSnapshot — rebuilt from productionQueues on
  // hydrate. The accessor is used purely as a runtime cache so all bridge
  // reads stay on the same surface; we deliberately do NOT call markDirty
  // because the accessor would throw at flush time for an unregistered slot.
  function inFlightTechSetFor(owner: number): Set<ResearchableTechnologyType> {
    const map = accessor.get(inFlightTechByOwnerCodec);
    let set = map.get(owner);
    if (!set) {
      set = new Set<ResearchableTechnologyType>();
      map.set(owner, set);
    }
    return set;
  }

  function clearUnitCommand(unitId: number): void {
    unitCommands.delete(unitId);
    movePathCache.delete(unitId);
  }

  function setUnitCommand(unitId: number, command: UnitCommand): void {
    movePathCache.delete(unitId);
    unitCommands.set(unitId, command);
  }

  function getCurrentEntityId(ref: EntityRef | null): number | null {
    return currentEntityId(world, ref);
  }

  function getEntityRef(id: number): EntityRef | null {
    return world.getEntityRef(id);
  }

  function getUnitTaskState(
    id: number,
    isGarrisonedUnit: (id: number) => boolean,
  ): UnitTaskState {
    if (isGarrisonedUnit(id)) {
      return 'garrisoned';
    }
    const command = unitCommands.get(id);
    if (command) {
      switch (command.type) {
        case 'move':
          return 'moving';
        case 'build':
          return 'building';
        case 'attack':
          return 'attacking';
      }
    }
    const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
    return gatherer?.task ?? 'idle';
  }

  return {
    ensurePlayerScoreCounters,
    ensureAiState,
    inFlightTechSetFor,
    clearUnitCommand,
    setUnitCommand,
    getCurrentEntityId,
    getEntityRef,
    getUnitTaskState,
  };
}

// Spawn-finder helpers. Live here because their three callers
// (scenario seed, training/market construction, AI placement) all need
// the same egress-aware definition. They take their collaborators as
// arguments since each pre-existing factory provides a different combo.
export function createSpawnFinders(deps: {
  uniquePositions: (positions: Position[]) => Position[];
  getApproachCellsForFootprint: (
    anchor: Position,
    width: number,
    height: number,
    range?: number,
  ) => Position[];
  getNearestMoveCandidates: (target: Position) => Position[];
  isCellPassableForSpawn: (x: number, y: number) => boolean;
  buildingFootprint: (buildingType: import('../types').BuildingType) => {
    width: number;
    height: number;
  };
}): {
  findSafeSpawnPosition: (candidates: Position[]) => Position | null;
  findScenarioSpawnPosition: (origin: Position) => Position | null;
  findBuildingSpawnPosition: (
    anchor: Position,
    buildingType: import('../types').BuildingType,
  ) => Position | null;
} {
  const {
    uniquePositions,
    getApproachCellsForFootprint,
    getNearestMoveCandidates,
    isCellPassableForSpawn,
    buildingFootprint,
  } = deps;

  function findSafeSpawnPosition(candidates: Position[]): Position | null {
    return findSafeSpawnWithEgress({
      candidates: uniquePositions(candidates),
      isCellPassable: (x, y) => isCellPassableForSpawn(x, y),
      neighborOffsets: CARDINAL_NEIGHBOR_OFFSETS,
    });
  }

  function findScenarioSpawnPosition(origin: Position): Position | null {
    return findSafeSpawnPosition(getNearestMoveCandidates(origin));
  }

  function findBuildingSpawnPosition(
    anchor: Position,
    buildingType: import('../types').BuildingType,
  ): Position | null {
    const footprint = buildingFootprint(buildingType);
    return findSafeSpawnPosition(
      getApproachCellsForFootprint(anchor, footprint.width, footprint.height, 1),
    );
  }

  return {
    findSafeSpawnPosition,
    findScenarioSpawnPosition,
    findBuildingSpawnPosition,
  };
}

// Clear gatherer order. Wraps clearing the explicit-order flag, task,
// targets, and the throttle marker. Lives here because it's used by
// monkOps, unit command paths, and training/market garrison flows.
export function createGathererOrderOps(deps: {
  world: GameWorld;
  state: BridgeState;
  // Phase 2D — gathererDropOffStuckSinceTick now flows through accessor.
  accessor: import('./bridgeStateAccessor').BridgeStateAccessor;
}): { clearGathererOrder: (id: number) => void } {
  const { world, accessor } = deps;
  function clearGathererOrder(id: number): void {
    const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
    if (!gatherer) {
      return;
    }
    gatherer.hasExplicitGatherOrder = false;
    gatherer.task = 'idle';
    gatherer.targetResourceId = null;
    gatherer.dropOffBuildingId = null;
    gatherer.gatherProgressTicks = 0;
    accessor.mutate(gathererDropOffStuckSinceTickCodec, (m) => m.delete(id));
  }
  return { clearGathererOrder };
}

// Command-rejection ring buffer. Captures bridge-local commandRejectionReasons
// state so createWorld doesn't have to declare the buffer + its enqueue/consume
// pair inline.
export function createCommandRejectionQueue(maxQueue = 8): {
  enqueueRejection: (reason: string) => void;
  consumeCommandRejection: () => string | null;
} {
  const buffer: string[] = [];
  function enqueueRejection(reason: string): void {
    if (reason.length === 0) {
      return;
    }
    buffer.push(reason);
    if (buffer.length > maxQueue) {
      buffer.splice(0, buffer.length - maxQueue);
    }
  }
  function consumeCommandRejection(): string | null {
    return buffer.shift() ?? null;
  }
  return { enqueueRejection, consumeCommandRejection };
}
