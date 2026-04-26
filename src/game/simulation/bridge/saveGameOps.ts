// Phase 3 save-game serializer. Mirrors `SaveBlob` field-by-field from
// the side maps and match state createWorld owns, producing a single
// JSON-serializable blob the loader can round-trip back into a fresh
// bridge.
//
// Dep-bag note: this factory intentionally accepts every persisted side
// map + match state + the world + visibility as a flat deps object.
// That's the nature of a full-game serializer — no sub-shape would be
// meaningful on its own. The other `bridge/` factories stay smaller
// because they cover a subsystem; saveGame covers everything.
//
// The `seed` is passed as a closure over the owning bridge so the
// serializer does not need to thread it separately.

import type { EntityRef, Position, VisibilityMap } from 'civ-engine';

import type {
  AgeType,
  PlayerResources,
  PopulationState,
  ProductionQueueEntry,
  ResearchableTechnologyType,
  VisionSourceComponent,
} from '../types';
import type {
  MemoryEntry,
  MonkTask,
  TrebuchetPackState,
  UnitCommand,
} from '../createSimulationBridge';
import type { SaveBlob } from '../saveSchema';
import { SAVE_SCHEMA_VERSION } from '../saveSchema';
import type { GameWorld } from './pureHelpers';

// Structural mirrors of the private interfaces createWorld declares
// inline. Kept here so this module does not need to import private
// types; the runtime shapes match exactly, so the serializer produces
// byte-for-byte identical output to the pre-extraction implementation.
interface CountdownEntryLike {
  remainingTicks: number;
  totalTicks: number;
  lastCompletedTick: number | null;
}

interface ConstructionStateLike {
  isComplete: boolean;
  buildProgressTicks: number;
  totalBuildTicks: number;
  populationProvided: number;
  width: number;
  height: number;
}

interface CombatStateLike {
  currentHp: number;
  maxHp: number;
  attackDamage: number;
  attackRange: number;
  reloadTicks: number;
  cooldownTicks: number;
  armor: number;
}

interface BuildingHealthStateLike {
  currentHp: number;
  maxHp: number;
}

interface BuildingCombatStateLike {
  attackDamage: number;
  attackRange: number;
  reloadTicks: number;
  cooldownTicks: number;
}

interface WildlifeStateLike extends CombatStateLike {
  autoAggro: boolean;
  isAlive: boolean;
  corpsePersists: boolean;
  aggroRange: number;
  targetEntityRef: EntityRef | null;
}

interface PlayerScoreCountersLike {
  unitsProduced: number;
  buildingsProduced: number;
  resourcesGathered: number;
  unitsKilled: number;
  wonderCompleted: boolean;
}

interface MatchStateLike {
  outcome: 'running' | 'victory' | 'defeat' | 'draw';
  summary: string;
  winCondition: 'conquest' | 'wonder' | 'relic' | null;
  scores: Record<number, number> | null;
  wonderCountdownTicks: number | null;
  relicCountdownTicks: number | null;
}

interface AiStateLike {
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
  lastEnemySightingPosition: Position | null;
}

export interface SaveGameDeps {
  world: GameWorld;
  visibility: VisibilityMap;
  getSeed: () => string;
  matchState: MatchStateLike;
  // Side maps. createWorld owns the references; this factory only
  // reads from them. Adding a new side map to the save blob requires
  // (1) a new field on SerializedSideMaps, (2) a bridge wire-up here,
  // and (3) a schema bump.
  trackedVisibilitySources: Map<number, number>;
  playerAges: Map<number, AgeType>;
  playerCivilizations: Map<number, string>;
  researchedTechnologies: Map<number, Set<ResearchableTechnologyType>>;
  playerResources: Map<number, PlayerResources>;
  marketExchangeRates: { food: number; wood: number; stone: number };
  population: Map<number, PopulationState>;
  townCenterRefs: Map<number, EntityRef>;
  villagerOrdinals: Map<number, number>;
  unitCommands: Map<number, UnitCommand>;
  sheepMoveOrders: Map<number, Position>;
  rallyPoints: Map<number, Position>;
  monkTasks: Map<number, MonkTask>;
  conversionState: Map<number, { byOwner: number; progress: number }>;
  monkCarriedRelic: Map<number, number>;
  monkHealCounters: Map<number, number>;
  relicsInMonastery: Map<number, number>;
  wonderCountdowns: Map<number, CountdownEntryLike>;
  wonderCountdownOverrides: Map<number, number>;
  relicCountdowns: Map<number, CountdownEntryLike>;
  relicCountdownOverrides: Map<number, number>;
  playerScoreCounters: Map<number, PlayerScoreCountersLike>;
  trebuchetPackStates: Map<number, TrebuchetPackState>;
  lastSeenStatic: Map<number, Map<number, MemoryEntry>>;
  garrisonedByBuilding: Map<number, number[]>;
  garrisonedUnitToBuilding: Map<number, number>;
  garrisonedUnitVisionSources: Map<number, VisionSourceComponent>;
  productionQueues: Map<number, ProductionQueueEntry[]>;
  constructionStates: Map<number, ConstructionStateLike>;
  combatStates: Map<number, CombatStateLike>;
  buildingHealthStates: Map<number, BuildingHealthStateLike>;
  buildingCombatStates: Map<number, BuildingCombatStateLike>;
  wildlifeStates: Map<number, WildlifeStateLike>;
  aiStates: Map<number, AiStateLike>;
}

export interface SaveGameOps {
  saveGame(): SaveBlob;
}

export function createSaveGameOps(deps: SaveGameDeps): SaveGameOps {
  const {
    world,
    visibility,
    getSeed,
    matchState,
    trackedVisibilitySources,
    playerAges,
    playerCivilizations,
    researchedTechnologies,
    playerResources,
    marketExchangeRates,
    population,
    townCenterRefs,
    villagerOrdinals,
    unitCommands,
    sheepMoveOrders,
    rallyPoints,
    monkTasks,
    conversionState,
    monkCarriedRelic,
    monkHealCounters,
    relicsInMonastery,
    wonderCountdowns,
    wonderCountdownOverrides,
    relicCountdowns,
    relicCountdownOverrides,
    playerScoreCounters,
    trebuchetPackStates,
    lastSeenStatic,
    garrisonedByBuilding,
    garrisonedUnitToBuilding,
    garrisonedUnitVisionSources,
    productionQueues,
    constructionStates,
    combatStates,
    buildingHealthStates,
    buildingCombatStates,
    wildlifeStates,
    aiStates,
  } = deps;

  function saveGame(): SaveBlob {
    return {
      schema: SAVE_SCHEMA_VERSION,
      seed: getSeed(),
      worldSnapshot: world.serialize(),
      visibility: visibility.getState(),
      matchState: {
        outcome: matchState.outcome,
        summary: matchState.summary,
        winCondition: matchState.winCondition,
        scores: matchState.scores ? { ...matchState.scores } : null,
        wonderCountdownTicks: matchState.wonderCountdownTicks,
        relicCountdownTicks: matchState.relicCountdownTicks,
      },
      sideMaps: {
        trackedVisibilitySources: [...trackedVisibilitySources.entries()],
        playerAges: [...playerAges.entries()],
        playerCivilizations: [...playerCivilizations.entries()],
        researchedTechnologies: [...researchedTechnologies.entries()].map(
          ([owner, set]) => [owner, [...set]],
        ),
        playerResources: [...playerResources.entries()].map(([owner, res]) => [
          owner,
          { ...res },
        ]),
        marketExchangeRates: { ...marketExchangeRates },
        population: [...population.entries()].map(([owner, pop]) => [owner, { ...pop }]),
        townCenterRefs: [...townCenterRefs.entries()].map(([owner, ref]) => [
          owner,
          { id: ref.id, generation: ref.generation },
        ]),
        villagerOrdinals: [...villagerOrdinals.entries()],
        unitCommands: [...unitCommands.entries()].map(([id, cmd]) => [
          id,
          {
            type: cmd.type,
            target: { x: cmd.target.x, y: cmd.target.y },
            ...(cmd.buildingRef
              ? {
                  buildingRef: { id: cmd.buildingRef.id, generation: cmd.buildingRef.generation },
                }
              : {}),
            ...(cmd.targetEntityRef
              ? {
                  targetEntityRef: {
                    id: cmd.targetEntityRef.id,
                    generation: cmd.targetEntityRef.generation,
                  },
                }
              : {}),
            ...(cmd.targetEntityKind ? { targetEntityKind: cmd.targetEntityKind } : {}),
          },
        ]),
        sheepMoveOrders: [...sheepMoveOrders.entries()].map(([id, pos]) => [
          id,
          { x: pos.x, y: pos.y },
        ]),
        rallyPoints: [...rallyPoints.entries()].map(([id, pos]) => [
          id,
          { x: pos.x, y: pos.y },
        ]),
        monkTasks: [...monkTasks.entries()].map(([id, task]) => [
          id,
          {
            kind: task.kind,
            targetEntityRef: {
              id: task.targetEntityRef.id,
              generation: task.targetEntityRef.generation,
            },
          },
        ]),
        conversionState: [...conversionState.entries()].map(([id, state]) => [
          id,
          { byOwner: state.byOwner, progress: state.progress },
        ]),
        monkCarriedRelic: [...monkCarriedRelic.entries()],
        monkHealCounters: [...monkHealCounters.entries()],
        relicsInMonastery: [...relicsInMonastery.entries()],
        wonderCountdowns: [...wonderCountdowns.entries()].map(([id, entry]) => [
          id,
          {
            remainingTicks: entry.remainingTicks,
            totalTicks: entry.totalTicks,
            lastCompletedTick: entry.lastCompletedTick,
          },
        ]),
        wonderCountdownOverrides: [...wonderCountdownOverrides.entries()],
        relicCountdowns: [...relicCountdowns.entries()].map(([id, entry]) => [
          id,
          {
            remainingTicks: entry.remainingTicks,
            totalTicks: entry.totalTicks,
            lastCompletedTick: entry.lastCompletedTick,
          },
        ]),
        relicCountdownOverrides: [...relicCountdownOverrides.entries()],
        playerScoreCounters: [...playerScoreCounters.entries()].map(([owner, counters]) => [
          owner,
          { ...counters },
        ]),
        // FU7: persist Trebuchet pack/unpack state so a Trebuchet mid-
        // transition when the player saves resumes mid-transition on
        // load instead of quietly resetting to "packed".
        trebuchetPackStates: [...trebuchetPackStates.entries()].map(([id, state]) => [
          id,
          { packed: state.packed, transitionTicksRemaining: state.transitionTicksRemaining },
        ]),
        lastSeenStatic: [...lastSeenStatic.entries()].map(([playerId, innerMap]) => [
          playerId,
          [...innerMap.entries()].map(([entityId, entry]) => [
            entityId,
            {
              kind: entry.kind,
              entityType: entry.entityType,
              position: { x: entry.position.x, y: entry.position.y },
              footprintWidth: entry.footprintWidth,
              footprintHeight: entry.footprintHeight,
              tint: entry.tint,
              owner: entry.owner,
              size: entry.size,
              visualVariant: entry.visualVariant,
              lastSeenTick: entry.lastSeenTick,
            },
          ]),
        ]),
        garrisonedByBuilding: [...garrisonedByBuilding.entries()].map(([id, list]) => [
          id,
          [...list],
        ]),
        garrisonedUnitToBuilding: [...garrisonedUnitToBuilding.entries()],
        garrisonedUnitVisionSources: [...garrisonedUnitVisionSources.entries()].map(
          ([id, src]) => [id, { playerId: src.playerId, radius: src.radius }],
        ),
        productionQueues: [...productionQueues.entries()].map(([id, queue]) => [
          id,
          queue.map((entry) => ({
            kind: entry.kind,
            label: entry.label,
            ...(entry.unitType !== undefined ? { unitType: entry.unitType } : {}),
            ...(entry.technologyType !== undefined
              ? { technologyType: entry.technologyType }
              : {}),
            remainingTicks: entry.remainingTicks,
            totalTicks: entry.totalTicks,
            isBlocked: entry.isBlocked,
          })),
        ]),
        constructionStates: [...constructionStates.entries()].map(([id, state]) => [
          id,
          { ...state },
        ]),
        combatStates: [...combatStates.entries()].map(([id, state]) => [id, { ...state }]),
        buildingHealthStates: [...buildingHealthStates.entries()].map(([id, state]) => [
          id,
          { ...state },
        ]),
        buildingCombatStates: [...buildingCombatStates.entries()].map(([id, state]) => [
          id,
          { ...state },
        ]),
        wildlifeStates: [...wildlifeStates.entries()].map(([id, state]) => [
          id,
          {
            currentHp: state.currentHp,
            maxHp: state.maxHp,
            attackDamage: state.attackDamage,
            attackRange: state.attackRange,
            reloadTicks: state.reloadTicks,
            cooldownTicks: state.cooldownTicks,
            armor: state.armor,
            autoAggro: state.autoAggro,
            isAlive: state.isAlive,
            corpsePersists: state.corpsePersists,
            aggroRange: state.aggroRange,
            targetEntityRef: state.targetEntityRef
              ? {
                  id: state.targetEntityRef.id,
                  generation: state.targetEntityRef.generation,
                }
              : null,
          },
        ]),
        aiStates: [...aiStates.entries()].map(([owner, state]) => [
          owner,
          {
            difficulty: state.difficulty,
            plan: state.plan,
            villagerTargets: { ...state.villagerTargets },
            attackGroup: [...state.attackGroup],
            lastDecisionTick: state.lastDecisionTick,
            lastEnemySightingTick: state.lastEnemySightingTick,
            lastEnemySightingPosition: state.lastEnemySightingPosition
              ? { x: state.lastEnemySightingPosition.x, y: state.lastEnemySightingPosition.y }
              : null,
          },
        ]),
      },
    };
  }

  return {
    saveGame,
  };
}
