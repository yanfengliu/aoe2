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

import type { VisibilityMap } from 'civ-engine';

import type { SaveBlob } from '../saveSchema';
import { SAVE_SCHEMA_VERSION } from '../saveSchema';
import type { GameWorld } from './pureHelpers';
import type { BridgeState } from './bridgeState';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { VisibilityCell } from './visibilityCell';
import { flushTier3State } from './tier3SyncSystem';
import {
  gathererDropOffStuckSinceTickCodec,
  marketExchangeRatesCodec,
  monkHealCountersCodec,
  playerScoreCountersCodec,
  rallyPointsCodec,
  trackedVisibilitySourcesCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  relicCountdownOverridesCodec,
  villagerOrdinalsCodec,
  wonderCountdownOverridesCodec,
} from './bridgeStateSerialize';

interface MatchStateLike {
  outcome: 'running' | 'victory' | 'defeat' | 'draw';
  summary: string;
  winCondition: 'conquest' | 'wonder' | 'relic' | null;
  scores: Record<number, number> | null;
  wonderCountdownTicks: number | null;
  relicCountdownTicks: number | null;
}

export interface SaveGameDeps {
  world: GameWorld;
  visibility: VisibilityMap;
  getSeed: () => string;
  matchState: MatchStateLike;
  state: BridgeState;
  // Phase 2D — slots that have moved to `world.state.aoe2.*` are read
  // through the accessor at save time.
  accessor: BridgeStateAccessor;
  // Phase 2E + full-review iter-1 R2-C2: Tier-3 (visibility/matchState)
  // flushing into world.state.aoe2.* must also happen at save time so
  // schema-2 saves backed by `world.serialize()` see current values.
  visibilityCell: VisibilityCell;
}

export interface SaveGameOps {
  saveGame(): SaveBlob;
}

export function createSaveGameOps(deps: SaveGameDeps): SaveGameOps {
  const { world, visibility, getSeed, matchState, state, accessor, visibilityCell } = deps;
  // Phase 2D + 2E — flush BOTH Tier-1 (accessor) AND Tier-3 (visibility +
  // matchState) into world.state.aoe2.* before serialize. Without this,
  // full-review iter-1 R2-C2 (Codex MAJOR) bites Phase 2F's schema-2
  // path: saving mid-tick (or between input + update phases) would
  // capture a stale snapshot — Tier-1 mutations made this tick wouldn't
  // be in world.state yet (per-tick `bridgeSnapshotSystem` runs at
  // output phase), and `aoe2.visibility` / `aoe2.matchState` would
  // similarly lag the per-tick `tier3SyncSystem`.
  function flushBeforeSerialize(): void {
    accessor.flush();
    flushTier3State(world, visibilityCell, matchState);
  }
  const {
    researchedTechnologies,
    playerResources,
    population,
    townCenterRefs,
    unitCommands,
    sheepMoveOrders,
    monkTasks,
    conversionState,
    monkCarriedRelic,
    relicsInMonastery,
    wonderCountdowns,
    relicCountdowns,
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
  } = state;

  function saveGame(): SaveBlob {
    flushBeforeSerialize();
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
        trackedVisibilitySources: [...accessor.get(trackedVisibilitySourcesCodec).entries()],
        playerAges: [...accessor.get(playerAgesCodec).entries()],
        playerCivilizations: [...accessor.get(playerCivilizationsCodec).entries()],
        researchedTechnologies: [...researchedTechnologies.entries()].map(
          ([owner, set]) => [owner, [...set]],
        ),
        playerResources: [...playerResources.entries()].map(([owner, res]) => [
          owner,
          { ...res },
        ]),
        marketExchangeRates: { ...accessor.get(marketExchangeRatesCodec) },
        population: [...population.entries()].map(([owner, pop]) => [owner, { ...pop }]),
        townCenterRefs: [...townCenterRefs.entries()].map(([owner, ref]) => [
          owner,
          { id: ref.id, generation: ref.generation },
        ]),
        // Phase 2D — villagerOrdinals reads via the accessor.
        villagerOrdinals: [...accessor.get(villagerOrdinalsCodec).entries()],
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
        rallyPoints: [...accessor.get(rallyPointsCodec).entries()].map(([id, pos]) => [
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
        monkHealCounters: [...accessor.get(monkHealCountersCodec).entries()],
        relicsInMonastery: [...relicsInMonastery.entries()],
        wonderCountdowns: [...wonderCountdowns.entries()].map(([id, entry]) => [
          id,
          {
            remainingTicks: entry.remainingTicks,
            totalTicks: entry.totalTicks,
            lastCompletedTick: entry.lastCompletedTick,
          },
        ]),
        wonderCountdownOverrides: [...accessor.get(wonderCountdownOverridesCodec).entries()],
        relicCountdowns: [...relicCountdowns.entries()].map(([id, entry]) => [
          id,
          {
            remainingTicks: entry.remainingTicks,
            totalTicks: entry.totalTicks,
            lastCompletedTick: entry.lastCompletedTick,
          },
        ]),
        relicCountdownOverrides: [...accessor.get(relicCountdownOverridesCodec).entries()],
        playerScoreCounters: [...accessor.get(playerScoreCountersCodec).entries()].map(([owner, counters]) => [
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
        // Phase 2D — gathererDropOffStuckSinceTick reads via accessor.
        gathererDropOffStuckSinceTick: [
          ...accessor.get(gathererDropOffStuckSinceTickCodec).entries(),
        ],
      },
    };
  }

  return {
    saveGame,
  };
}
