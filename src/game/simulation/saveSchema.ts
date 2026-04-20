// Slice 9: Save / Load schema. A `SaveBlob` is a JSON-serializable
// snapshot of the entire in-flight game (world, side maps, visibility,
// match state). The loader (`createSimulationBridge(seed, { savedGame })`)
// requires `schema === SAVE_SCHEMA_VERSION` exactly; the project does not
// support cross-version migration, so any schema bump is breaking.
//
// `WorldSnapshot` and `VisibilityMapState` come straight from
// `civ-engine`; their internal shape is engine-owned and they are passed
// through as opaque JSON values. The repo's responsibility is the side
// maps that live in the `createWorld` closure outside any ECS component.
//
// All `Map<K, V>` side maps serialize as `[[k, v], ...]` arrays so a
// single `new Map(arr)` call rehydrates them. Inner `Set`s serialize as
// arrays. Nested `Map<K1, Map<K2, V>>` (e.g. `lastSeenStatic`) serialize
// as `[[k1, [[k2, v], ...]]]`.

import type { VisibilityMapState, WorldSnapshot } from 'civ-engine';

// Bumping this number breaks every existing save file. The loader
// rejects any blob whose `schema` does not match this constant.
export const SAVE_SCHEMA_VERSION = 1;

// Serialized form of a `Map<K, V>`. Equivalent to `Array.from(map.entries())`
// and rehydrated via `new Map<K, V>(serializedMap)`.
export type SerializedMap<K, V> = Array<[K, V]>;

// Serialized form of a `Set<T>`. Equivalent to `Array.from(set)` and
// rehydrated via `new Set<T>(serializedSet)`.
export type SerializedSet<T> = T[];

// `EntityRef` already serializes natively (id + generation) — kept as a
// type alias so call sites read clearly. Plain `EntityId`s are
// serialized as `number` directly.
export interface SerializedEntityRef {
  id: number;
  generation: number;
}

// Side maps with `EntityRef` values. The save path lifts `.id` /
// `.generation` straight into JSON; the load path reconstructs the ref
// via `world.getEntityRef(id)` (the deserialized world preserves both
// id and generation, so the new ref equals the old one).
export type SerializedEntityRefSideMap = SerializedMap<number, SerializedEntityRef>;

// Generic side map keyed by entity id with arbitrary serializable
// payload. Used for combat states, monk tasks, queue entries, etc.
// Payload shapes are mirrored from the bridge interfaces.
export type SerializedEntityKeyedSideMap<V> = SerializedMap<number, V>;

// Serialized payload for `unitCommands`. `targetEntityRef` and
// `buildingRef` (if present) preserve `EntityRef` shape so the load
// path can reconstruct them via `world.getEntityRef`.
export interface SerializedUnitCommand {
  type: 'move' | 'build' | 'attack';
  target: { x: number; y: number };
  buildingRef?: SerializedEntityRef;
  targetEntityRef?: SerializedEntityRef;
  targetEntityKind?: 'unit' | 'building' | 'resource';
}

// Serialized payload for `monkTasks`.
export interface SerializedMonkTask {
  kind: 'heal' | 'convert' | 'pickup' | 'deposit';
  targetEntityRef: SerializedEntityRef;
}

// Serialized payload for production queues. Mirrors `ProductionQueueEntry`
// from the bridge but is duplicated here so the schema file stays
// independent of the bridge's internal type imports.
export interface SerializedProductionQueueEntry {
  kind: 'unit' | 'technology';
  label: string;
  unitType?: string;
  technologyType?: string;
  remainingTicks: number;
  totalTicks: number;
  isBlocked: boolean;
}

// Serialized payload for `wildlifeStates`. `targetEntityRef` may be null.
export interface SerializedWildlifeState {
  currentHp: number;
  maxHp: number;
  attackDamage: number;
  attackRange: number;
  reloadTicks: number;
  cooldownTicks: number;
  armor: number;
  autoAggro: boolean;
  isAlive: boolean;
  corpsePersists: boolean;
  aggroRange: number;
  targetEntityRef: SerializedEntityRef | null;
}

// Serialized side maps. One field per side map declared at the top of
// `createWorld`. Adding a new side map requires:
//  1. A new field here.
//  2. Bridge code that populates it on save.
//  3. Bridge code that hydrates it on load.
//  4. A schema-version bump unless the new field tolerates being absent
//     in older blobs.
export interface SerializedSideMaps {
  trackedVisibilitySources: SerializedMap<number, number>;
  playerAges: SerializedMap<number, string>;
  playerCivilizations: SerializedMap<number, string>;
  researchedTechnologies: SerializedMap<number, SerializedSet<string>>;
  playerResources: SerializedMap<number, { food: number; wood: number; gold: number; stone: number }>;
  marketExchangeRates: { food: number; wood: number; stone: number };
  population: SerializedMap<number, { current: number; cap: number }>;
  townCenterRefs: SerializedEntityRefSideMap;
  villagerOrdinals: SerializedMap<number, number>;
  unitCommands: SerializedEntityKeyedSideMap<SerializedUnitCommand>;
  sheepMoveOrders: SerializedEntityKeyedSideMap<{ x: number; y: number }>;
  rallyPoints: SerializedEntityKeyedSideMap<{ x: number; y: number }>;
  monkTasks: SerializedEntityKeyedSideMap<SerializedMonkTask>;
  conversionState: SerializedEntityKeyedSideMap<{ byOwner: number; progress: number }>;
  monkCarriedRelic: SerializedEntityKeyedSideMap<number>;
  monkHealCounters: SerializedEntityKeyedSideMap<number>;
  relicsInMonastery: SerializedEntityKeyedSideMap<number>;
  wonderCountdowns: SerializedEntityKeyedSideMap<{
    remainingTicks: number;
    totalTicks: number;
    // FU7: optional for backward compatibility with saves written before
    // this field existed. Absent means "mid-flight, no completion tick".
    lastCompletedTick?: number | null;
  }>;
  wonderCountdownOverrides: SerializedMap<number, number>;
  relicCountdowns: SerializedMap<number, {
    remainingTicks: number;
    totalTicks: number;
    lastCompletedTick?: number | null;
  }>;
  relicCountdownOverrides: SerializedMap<number, number>;
  playerScoreCounters: SerializedMap<
    number,
    {
      unitsProduced: number;
      buildingsProduced: number;
      resourcesGathered: number;
      unitsKilled: number;
      wonderCompleted: boolean;
    }
  >;
  // FU7: Trebuchet pack/unpack state per unit id.
  trebuchetPackStates: SerializedEntityKeyedSideMap<{
    packed: boolean;
    transitionTicksRemaining: number;
  }>;
  // `lastSeenStatic` is `Map<playerId, Map<entityId, MemoryEntry>>`.
  // The inner map is serialized as `[[k, v], ...]` and the outer map
  // wraps that array as its value.
  lastSeenStatic: SerializedMap<
    number,
    SerializedMap<
      number,
      {
        kind: 'building' | 'resource';
        entityType: string;
        position: { x: number; y: number };
        footprintWidth: number;
        footprintHeight: number;
        tint: number;
        owner: number | null;
        size: number;
        visualVariant: string;
        lastSeenTick: number;
      }
    >
  >;
  garrisonedByBuilding: SerializedEntityKeyedSideMap<number[]>;
  garrisonedUnitToBuilding: SerializedEntityKeyedSideMap<number>;
  garrisonedUnitVisionSources: SerializedEntityKeyedSideMap<{ playerId: number; radius: number }>;
  productionQueues: SerializedEntityKeyedSideMap<SerializedProductionQueueEntry[]>;
  constructionStates: SerializedEntityKeyedSideMap<{
    isComplete: boolean;
    buildProgressTicks: number;
    totalBuildTicks: number;
    populationProvided: number;
    width: number;
    height: number;
  }>;
  combatStates: SerializedEntityKeyedSideMap<{
    currentHp: number;
    maxHp: number;
    attackDamage: number;
    attackRange: number;
    reloadTicks: number;
    cooldownTicks: number;
    armor: number;
  }>;
  buildingHealthStates: SerializedEntityKeyedSideMap<{ currentHp: number; maxHp: number }>;
  buildingCombatStates: SerializedEntityKeyedSideMap<{
    attackDamage: number;
    attackRange: number;
    reloadTicks: number;
    cooldownTicks: number;
  }>;
  wildlifeStates: SerializedEntityKeyedSideMap<SerializedWildlifeState>;
  // Slice 10: per-owner AI state. Keyed by player id. `attackGroup` is
  // serialized as a plain number array (entity ids, not refs — stale
  // ids are filtered on the next decision tick, so generation tracking
  // is unnecessary here). `lastEnemySightingPosition` is JSON-safe
  // because it's either null or `{x, y}`.
  aiStates: SerializedMap<
    number,
    {
      difficulty: 'easy' | 'standard' | 'hard';
      plan: 'opening' | 'feudal-push' | 'castle-push' | 'imperial-push' | 'defend';
      villagerTargets: {
        food?: number;
        wood?: number;
        gold?: number;
        stone?: number;
      };
      attackGroup: number[];
      lastDecisionTick: number;
      lastEnemySightingTick: number;
      lastEnemySightingPosition: { x: number; y: number } | null;
    }
  >;
}

// Serialized match state. Mirrors `MatchState` but is duplicated here
// so the schema file does not import bridge-internal types.
export interface SerializedMatchState {
  outcome: 'running' | 'victory' | 'defeat';
  summary: string;
  winCondition: 'conquest' | 'wonder' | 'relic' | null;
  scores: Record<number, number> | null;
  wonderCountdownTicks: number | null;
  relicCountdownTicks: number | null;
}

export interface SaveBlob {
  schema: typeof SAVE_SCHEMA_VERSION;
  seed: string;
  // `WorldSnapshot` is the engine-owned ECS snapshot from
  // `world.serialize()`. It carries entity ids, generations, all
  // registered components, the tick counter, the rng state, and any
  // resource / state / tag / metadata stores.
  worldSnapshot: WorldSnapshot;
  // `VisibilityMapState` from `visibility.getState()`. The loader
  // restores the per-player vision sources and the explored bitmap.
  visibility: VisibilityMapState;
  matchState: SerializedMatchState;
  sideMaps: SerializedSideMaps;
}
