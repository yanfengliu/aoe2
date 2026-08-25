// Per-slot codecs for the 35 Tier-1 bridge state slots. Each codec pair
// converts a native (Map / Set / object) representation to a JsonValue-compatible
// serialized form (typically Array<[K, V]> for Maps, or arrays for Sets) and
// back. Maps and Sets are NOT directly storable in `world.state` — civ-engine's
// `assertJsonCompatible` rejects them — so the codec is the boundary between
// in-memory ergonomics and `world.state` persistence.
//
// Phase 2A scaffolding: registered for use by `BridgeStateAccessor`; ops
// modules migrate slot-by-slot in Phase 2D to read/mutate via the accessor
// instead of directly touching `BridgeState` Maps.

import type { EntityRef, Position } from 'civ-engine';

import type {
  AgeType,
  PlayerResources,
  PopulationState,
  ProductionQueueEntry,
  ResearchableTechnologyType,
  VisionSourceComponent,
} from '../types';
import type { AiState } from '../ai';
import type { PatrolRoute } from '../patrolRoute';
import type { MemoryEntry } from './memoryTypes';
import type {
  RelicCountdownEntry,
  WonderCountdownEntry,
} from './countdownTypes';
import type {
  BuildingCombatState,
  BuildingHealthState,
  CombatState,
  WildlifeState,
} from './systems/systemTypes';
import type {
  ConstructionState,
  MonkTask,
  TrebuchetPackState,
  UnitCommand,
} from './sharedTypes';
import {
  createEmptyProjectileSlot,
  type ProjectileSlotState,
} from './projectileTypes';
import type { UnitFormation } from '../unitFormation';
import type { UnitStance } from '../unitStance';
import { createInitialMarketRates } from './pureHelpers';
import { deriveCap } from './bridgeConstants';

// Codec type: pairs serialize/deserialize for one slot. `slot` is the world-state
// key (`'aoe2.combatStates'` etc.). Both functions are total — `deserialize` of
// `undefined` returns a fresh empty native value (Map / Set / default object) so
// that pre-migration snapshots, fresh worlds, and missing slots all hydrate
// safely without throwing.
export interface SlotCodec<TNative, TJson> {
  readonly slot: string;
  serialize(native: TNative): TJson;
  deserialize(json: TJson | undefined): TNative;
}

// ---- Helper factories --------------------------------------------------------

// A flat Map<K, V> codec where V is itself JSON-compatible (no inner Maps/Sets).
function flatMapCodec<K, V>(slot: string): SlotCodec<Map<K, V>, Array<[K, V]>> {
  return {
    slot,
    serialize: (m) => Array.from(m),
    deserialize: (j) => new Map<K, V>(j ?? []),
  };
}

// A Map<K, Set<V>> codec — Set serialized as array.
function mapOfSetCodec<K, V>(
  slot: string,
): SlotCodec<Map<K, Set<V>>, Array<[K, V[]]>> {
  return {
    slot,
    serialize: (m) =>
      Array.from(m).map(([k, set]) => [k, Array.from(set)] as [K, V[]]),
    deserialize: (j) =>
      new Map((j ?? []).map(([k, arr]) => [k, new Set(arr)] as [K, Set<V>])),
  };
}

// A Map<K, Map<K2, V>> codec — inner Map serialized as array.
function mapOfMapCodec<K, K2, V>(
  slot: string,
): SlotCodec<Map<K, Map<K2, V>>, Array<[K, Array<[K2, V]>]>> {
  return {
    slot,
    serialize: (m) =>
      Array.from(m).map(([k, inner]) => [k, Array.from(inner)] as [K, Array<[K2, V]>]),
    deserialize: (j) =>
      new Map(
        (j ?? []).map(([k, arr]) => [k, new Map<K2, V>(arr)] as [K, Map<K2, V>]),
      ),
  };
}

// ---- 35 Tier-1 codecs --------------------------------------------------------

// Player-keyed primitives.
export const playerAgesCodec = flatMapCodec<number, AgeType>('aoe2.playerAges');
export const playerCivilizationsCodec = flatMapCodec<number, string>('aoe2.playerCivilizations');
// Owner -> team. An owner with no entry is its own team, so a free-for-all
// stores nothing at all and a save written before teams existed loads as one.
export const playerTeamsCodec = flatMapCodec<number, number>('aoe2.playerTeams');
export const playerResourcesCodec = flatMapCodec<number, PlayerResources>('aoe2.playerResources');
// Population is a bespoke (non-flatMap) codec because PopulationState gained
// `rawSupply` (the honest unclamped housing sum) in v0.1.37 and the load path
// must MIGRATE: a pre-v0.1.37 save stores only `{current, cap}`, so on
// deserialize `rawSupply` defaults to the stored `cap`, GRANDFATHERING the
// legacy cap (behavior-preserving — `deriveCap(cap) === cap` for a reachable
// cap <= 200; a legacy cap > 200 pulls to 200). Exact when the old don't-evict
// floor never fired; for a rare floored save it preserves the old (inflated)
// cap rather than reconstructing true supply from buildings, which would
// surprise by dropping a loaded cap (Codex review MEDIUM; deferred). This
// covers schema-2 loads AND replay-world hydration in one place. The migration
// is additive JSON (new `rawSupply` key), so no schema-version bump is needed
// (saveSchema.ts: "absent in older blobs is tolerated").
interface SerializedPopulationEntry {
  current: number;
  cap: number;
  rawSupply?: number;
}
export const populationCodec: SlotCodec<
  Map<number, PopulationState>,
  Array<[number, SerializedPopulationEntry]>
> = {
  slot: 'aoe2.population',
  serialize: (m) =>
    Array.from(m).map(([owner, p]) => [
      owner,
      { current: p.current, cap: p.cap, rawSupply: p.rawSupply },
    ] as [number, SerializedPopulationEntry]),
  deserialize: (j) =>
    new Map(
      (j ?? []).map(([owner, p]) => {
        const rawSupply = p.rawSupply ?? p.cap;
        return [owner, { current: p.current, cap: deriveCap(rawSupply), rawSupply }] as [
          number,
          PopulationState,
        ];
      }),
    ),
};
export const trackedVisibilitySourcesCodec = flatMapCodec<number, number>('aoe2.trackedVisibilitySources');
export const villagerOrdinalsCodec = flatMapCodec<number, number>('aoe2.villagerOrdinals');

// researchedTechnologies: Map<ownerId, Set<tech>>.
export const researchedTechnologiesCodec = mapOfSetCodec<number, ResearchableTechnologyType>(
  'aoe2.researchedTechnologies',
);

// inFlightTechByOwner: Map<ownerId, Set<tech>>. Tier-2 per DESIGN §3 —
// derivable from `productionQueues` on hydrate, so excluded from
// `TIER_1_CODECS`. The codec definition is exported anyway because callers
// outside the accessor flush path occasionally want to round-trip the slot
// directly (e.g., debug snapshots, dev-mode replay tooling).
export const inFlightTechByOwnerCodec = mapOfSetCodec<number, ResearchableTechnologyType>(
  'aoe2.inFlightTechByOwner',
);

// marketExchangeRates: plain JSON object — already JsonValue-compatible.
export const marketExchangeRatesCodec: SlotCodec<
  { food: number; wood: number; stone: number },
  { food: number; wood: number; stone: number }
> = {
  slot: 'aoe2.marketExchangeRates',
  serialize: (o) => ({ food: o.food, wood: o.wood, stone: o.stone }),
  deserialize: (j) => (j === undefined ? createInitialMarketRates() : { food: j.food, wood: j.wood, stone: j.stone }),
};

// matchSettings: per-match victory configuration (spec §4.3/§4.6), chosen at
// setup and PERSISTED — a match started conquest-only must stay conquest-only
// through a save. Absent (every older save) means the standard defaults, so no
// migration.
export interface MatchSettings {
  /** True disables Wonder and Relic victories for the whole match. */
  conquestOnly?: boolean;
  /** §4.6 population cap for the match (absent = the standard 200). */
  popCap?: number;
  /** §5.4 Nomad: players open without a Town Center and may place their
   *  FIRST one in any age. Absent (every other map and older save) = off. */
  nomadStart?: boolean;
}
export const matchSettingsCodec: SlotCodec<MatchSettings, MatchSettings> = {
  slot: 'aoe2.matchSettings',
  serialize: (o) => ({
    ...(o.conquestOnly ? { conquestOnly: true } : {}),
    ...(o.popCap !== undefined ? { popCap: o.popCap } : {}),
    ...(o.nomadStart ? { nomadStart: true } : {}),
  }),
  deserialize: (j) => (j === undefined ? {} : {
    ...(j.conquestOnly ? { conquestOnly: true } : {}),
    ...(j.popCap !== undefined ? { popCap: j.popCap } : {}),
    ...(j.nomadStart ? { nomadStart: true } : {}),
  }),
};

// townCenterRefs: Map<ownerId, EntityRef>. EntityRef is `{id, generation}` — JSON-compatible.
export const townCenterRefsCodec = flatMapCodec<number, EntityRef>('aoe2.townCenterRefs');

// playerScoreCounters: Map<ownerId, PlayerScoreCounters object>.
interface PlayerScoreCountersLike {
  unitsProduced: number;
  buildingsProduced: number;
  resourcesGathered: number;
  unitsKilled: number;
  wonderCompleted: boolean;
}
export const playerScoreCountersCodec = flatMapCodec<number, PlayerScoreCountersLike>(
  'aoe2.playerScoreCounters',
);

// aiStates: Map<ownerId, AiState>. AiState is JSON-compatible (per AiState shape).
export const aiStatesCodec = flatMapCodec<number, AiState>('aoe2.aiStates');

// Unit-keyed.
export const unitCommandsCodec = flatMapCodec<number, UnitCommand>('aoe2.unitCommands');
// M6 control: per-unit stance. Only units whose stance DIFFERS from their
// type's default are stored, so an untouched match serializes nothing extra.
export const unitStancesCodec = flatMapCodec<number, UnitStance>('aoe2.unitStances');
// M6 control: per-unit formation, same only-if-non-default storage as stance.
export const unitFormationsCodec = flatMapCodec<number, UnitFormation>('aoe2.unitFormations');
// M6 control: a standing patrol route, `a` <-> `b`. A patrol is NOT a command
// — it outlives the walk it issues, which is the whole difference from an
// attack-move: auto-aggression takes a unit off its walk to fight, and an
// attack-move is gone at that point while a patrol resumes. Only patrolling
// units appear here.
export const patrolRoutesCodec = flatMapCodec<number, PatrolRoute>('aoe2.patrolRoutes');
export const sheepMoveOrdersCodec = flatMapCodec<number, Position>('aoe2.sheepMoveOrders');
export const monkTasksCodec = flatMapCodec<number, MonkTask>('aoe2.monkTasks');
export const monkCarriedRelicCodec = flatMapCodec<number, number>('aoe2.monkCarriedRelic');
export const monkHealCountersCodec = flatMapCodec<number, number>('aoe2.monkHealCounters');
// Monk FAITH, monkId -> current faith. ABSENT means full: a monk at full faith
// has no entry, so the map is empty in the common case and a save written
// before v0.3.50 loads as every monk rested rather than needing a migration.
export const monkFaithCodec = flatMapCodec<number, number>('aoe2.monkFaith');
export const conversionStateCodec = flatMapCodec<number, { byOwner: number; progress: number }>(
  'aoe2.conversionState',
);
export const trebuchetPackStatesCodec = flatMapCodec<number, TrebuchetPackState>(
  'aoe2.trebuchetPackStates',
);
export const garrisonedUnitToBuildingCodec = flatMapCodec<number, number>(
  'aoe2.garrisonedUnitToBuilding',
);
export const garrisonedUnitVisionSourcesCodec = flatMapCodec<number, VisionSourceComponent>(
  'aoe2.garrisonedUnitVisionSources',
);
export const gathererDropOffStuckSinceTickCodec = flatMapCodec<number, number>(
  'aoe2.gathererDropOffStuckSinceTick',
);

// Building-keyed.
export const rallyPointsCodec = flatMapCodec<number, Position>('aoe2.rallyPoints');
export const relicsInMonasteryCodec = flatMapCodec<number, number>('aoe2.relicsInMonastery');
export const productionQueuesCodec = flatMapCodec<number, ProductionQueueEntry[]>(
  'aoe2.productionQueues',
);
export const constructionStatesCodec = flatMapCodec<number, ConstructionState>(
  'aoe2.constructionStates',
);
export const buildingHealthStatesCodec = flatMapCodec<number, BuildingHealthState>(
  'aoe2.buildingHealthStates',
);
export const buildingCombatStatesCodec = flatMapCodec<number, BuildingCombatState>(
  'aoe2.buildingCombatStates',
);
export const wonderCountdownsCodec = flatMapCodec<number, WonderCountdownEntry>(
  'aoe2.wonderCountdowns',
);
export const wonderCountdownOverridesCodec = flatMapCodec<number, number>(
  'aoe2.wonderCountdownOverrides',
);
export const relicCountdownsCodec = flatMapCodec<number, RelicCountdownEntry>(
  'aoe2.relicCountdowns',
);
export const relicCountdownOverridesCodec = flatMapCodec<number, number>(
  'aoe2.relicCountdownOverrides',
);
// garrisonedByBuilding: Map<buildingId, unitId[]>.
export const garrisonedByBuildingCodec = flatMapCodec<number, number[]>(
  'aoe2.garrisonedByBuilding',
);

// Entity-keyed combat / wildlife.
export const combatStatesCodec = flatMapCodec<number, CombatState>('aoe2.combatStates');
export const wildlifeStatesCodec = flatMapCodec<number, WildlifeState>('aoe2.wildlifeStates');

// Nested map-of-map: lastSeenStatic[playerId][entityId] = MemoryEntry.
export const lastSeenStaticCodec = mapOfMapCodec<number, number, MemoryEntry>(
  'aoe2.lastSeenStatic',
);

// In-flight projectiles (spec §10.4). Already a plain object of plain arrays,
// so the codec only has to defend the empty/missing case: a save written
// before projectiles existed hydrates to an empty sky rather than throwing.
export const projectilesCodec: SlotCodec<ProjectileSlotState, ProjectileSlotState> = {
  slot: 'aoe2.projectiles',
  serialize: (native) => ({ nextId: native.nextId, inFlight: [...native.inFlight] }),
  deserialize: (json) => (json
    ? { nextId: json.nextId, inFlight: [...json.inFlight] }
    : createEmptyProjectileSlot()),
};

// ---- Codec registry ---------------------------------------------------------

// Authoritative list of all 37 Tier-1 codecs (DESIGN §3 inventory). Used by
// `BridgeStateAccessor.flush` to look up codecs by slot key, and by the
// equivalence test (Phase 2G) to iterate every slot for round-trip verification.
//
// `inFlightTechByOwnerCodec` is Tier-2 (re-derived from `productionQueues` on
// hydrate per the DESIGN inventory), so it is NOT part of this list — but the
// codec itself is still exported for any caller that wants to round-trip it
// via JSON without going through the accessor flush path.
export const TIER_1_CODECS: ReadonlyArray<SlotCodec<unknown, unknown>> = [
  playerAgesCodec,
  playerCivilizationsCodec,
  playerTeamsCodec,
  playerResourcesCodec,
  populationCodec,
  trackedVisibilitySourcesCodec,
  villagerOrdinalsCodec,
  researchedTechnologiesCodec,
  marketExchangeRatesCodec,
  matchSettingsCodec,
  townCenterRefsCodec,
  playerScoreCountersCodec,
  aiStatesCodec,
  unitCommandsCodec,
  unitStancesCodec,
  unitFormationsCodec,
  patrolRoutesCodec,
  sheepMoveOrdersCodec,
  monkTasksCodec,
  monkCarriedRelicCodec,
  monkHealCountersCodec,
  monkFaithCodec,
  conversionStateCodec,
  trebuchetPackStatesCodec,
  garrisonedUnitToBuildingCodec,
  garrisonedUnitVisionSourcesCodec,
  gathererDropOffStuckSinceTickCodec,
  rallyPointsCodec,
  relicsInMonasteryCodec,
  productionQueuesCodec,
  constructionStatesCodec,
  buildingHealthStatesCodec,
  buildingCombatStatesCodec,
  wonderCountdownsCodec,
  wonderCountdownOverridesCodec,
  relicCountdownsCodec,
  relicCountdownOverridesCodec,
  garrisonedByBuildingCodec,
  combatStatesCodec,
  wildlifeStatesCodec,
  lastSeenStaticCodec,
  projectilesCodec,
] as Array<SlotCodec<unknown, unknown>>;

// Lookup table for `BridgeStateAccessor.flush()` to find a codec by slot key.
export const SLOT_CODECS_BY_KEY: ReadonlyMap<string, SlotCodec<unknown, unknown>> = new Map(
  TIER_1_CODECS.map((c) => [c.slot, c]),
);

// ---- Tier-3 slot keys (synced via `tier3SyncSystem` in Phase 2B) ------------

// Tier-3 slots are not BridgeState fields — they live in external mutable
// state (`VisibilityMap`, `MatchState`, dimensions). The slot keys are
// declared here so all writers go through one source of truth.
export const TIER_3_SLOTS = {
  visibility: 'aoe2.visibility',
  matchState: 'aoe2.matchState',
  bridgeMeta: 'aoe2.bridgeMeta',
  pendingCommands: 'aoe2.pendingCommands',
  replayUnitAttacks: 'aoe2.replayUnitAttacks',
} as const;
