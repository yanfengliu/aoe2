// Match-end + score pipeline. The HUD reads the Wonder / Relic countdown
// ticks per tick; the win-condition resolver calls finalizeMatchEnd to
// freeze the outcome + score once a win condition fires. Conquest presence
// and the relic-holding aggregate share the same bridge side maps as the
// rest of the match-end surface, so the factory closes over them here
// instead of duplicating the side-map ownership in createWorld.

import type {
  BuildingComponent,
  MatchState,
  PlayerResources,
  ResourceComponent,
  UnitComponent,
} from '../types';
import type { GameWorld } from './pureHelpers';

interface PlayerScoreCountersLike {
  unitsProduced: number;
  buildingsProduced: number;
  resourcesGathered: number;
  unitsKilled: number;
  wonderCompleted: boolean;
}

interface WonderCountdownEntryLike {
  remainingTicks: number;
  totalTicks: number;
  lastCompletedTick: number | null;
}

interface RelicCountdownEntryLike {
  remainingTicks: number;
  totalTicks: number;
  lastCompletedTick: number | null;
}

export interface MatchEndDeps {
  world: GameWorld;
  // Target state object that `finalizeMatchEnd` mutates in place. Shared
  // with createWorld's HUD snapshot pathway so a single reference carries
  // the current outcome.
  matchState: MatchState;
  humanPlayerId: number;
  // Side maps owned by createWorld — the bridge keeps wiring save/load,
  // destroy-entity, and tick-level mutations through these same
  // references.
  playerScoreCounters: Map<number, PlayerScoreCountersLike>;
  relicsInMonastery: Map<number, number>;
  wonderCountdowns: Map<number, WonderCountdownEntryLike>;
  relicCountdowns: Map<number, RelicCountdownEntryLike>;
  monkCarriedRelic: Map<number, number>;
  playerResources: Map<number, PlayerResources>;
}

export interface MatchEndOps {
  // Deterministic score tally used by the HUD and by finalizeMatchEnd. Per
  // AGENTS.md "test the contract, not the code": the weights are stable
  // by design — changing them is a behavior change.
  computePlayerScore(owner: number): number;
  // Finalize the match state. Called once by the win-condition resolver
  // after a condition (conquest / wonder / relic) is satisfied; flips
  // `outcome`, clears the live countdowns, and stamps final per-owner
  // scores.
  finalizeMatchEnd(
    outcome: 'victory' | 'defeat',
    winCondition: 'conquest' | 'wonder' | 'relic',
    summary: string,
  ): void;
  // Aggregate who (if anyone) currently holds every relic on the map.
  // Returns null when the ownership picture is ambiguous (relics in
  // flight on a Monk, live relics on the map, no relics deposited).
  currentRelicHoldingOwner(): number | null;
  // HUD helpers. Return the minimum remaining ticks on the human's
  // Wonder countdown, or null when no countdown is active. Relic uses
  // the same shape.
  getHumanWonderCountdownTicks(): number | null;
  getHumanRelicCountdownTicks(): number | null;
  // Conquest-victory predicate. True iff `owner` has at least one living
  // unit or building.
  playerHasConquestPresence(owner: number): boolean;
}

export function createMatchEndOps(deps: MatchEndDeps): MatchEndOps {
  const {
    world,
    matchState,
    humanPlayerId,
    playerScoreCounters,
    relicsInMonastery,
    wonderCountdowns,
    relicCountdowns,
    monkCarriedRelic,
    playerResources,
  } = deps;

  function computePlayerScore(owner: number): number {
    const counters = playerScoreCounters.get(owner) ?? {
      unitsProduced: 0,
      buildingsProduced: 0,
      resourcesGathered: 0,
      unitsKilled: 0,
      wonderCompleted: false,
    };
    let relicsHeld = 0;
    for (const [monasteryId, count] of relicsInMonastery.entries()) {
      const building = world.getComponent<BuildingComponent>(monasteryId, 'building');
      if (building?.owner === owner) {
        relicsHeld += count;
      }
    }
    return Math.floor(
      counters.unitsProduced * 10
      + counters.buildingsProduced * 50
      + counters.resourcesGathered * 0.02
      + relicsHeld * 50
      + counters.unitsKilled * 20
      + (counters.wonderCompleted ? 500 : 0),
    );
  }

  function finalizeMatchEnd(
    outcome: 'victory' | 'defeat',
    winCondition: 'conquest' | 'wonder' | 'relic',
    summary: string,
  ): void {
    matchState.outcome = outcome;
    matchState.winCondition = winCondition;
    matchState.summary = summary;
    matchState.wonderCountdownTicks = null;
    matchState.relicCountdownTicks = null;
    const scores: Record<number, number> = {};
    for (const owner of playerResources.keys()) {
      scores[owner] = computePlayerScore(owner);
    }
    matchState.scores = scores;
  }

  // Snapshots the remaining ticks on the humanPlayerId's in-flight Wonder /
  // Relic countdown, or null if no countdown is active. Called every tick
  // so the HUD can render a live timer. The lowest remaining value wins
  // when there are multiple countdowns for the same player (should be at
  // most one Wonder per owner, but the helper stays defensive).
  function getHumanWonderCountdownTicks(): number | null {
    let minRemaining: number | null = null;
    for (const [buildingId, entry] of wonderCountdowns.entries()) {
      const building = world.getComponent<BuildingComponent>(buildingId, 'building');
      if (building?.owner !== humanPlayerId) {
        continue;
      }
      if (minRemaining === null || entry.remainingTicks < minRemaining) {
        minRemaining = entry.remainingTicks;
      }
    }
    return minRemaining;
  }

  function getHumanRelicCountdownTicks(): number | null {
    return relicCountdowns.get(humanPlayerId)?.remainingTicks ?? null;
  }

  function currentRelicHoldingOwner(): number | null {
    // Count live (on-map) relic entities. If any exist the "hold all"
    // condition is false for every player.
    let liveRelicCount = 0;
    for (const id of world.query('resource')) {
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      if (resource?.resourceType === 'relic') {
        liveRelicCount += 1;
      }
    }
    if (liveRelicCount > 0) {
      return null;
    }
    // Any Monk carrying a relic means it is "in flight" — not held by an
    // owner, ownership picture is ambiguous until deposited.
    if (monkCarriedRelic.size > 0) {
      return null;
    }
    // Aggregate deposited relics by owner.
    const totalByOwner = new Map<number, number>();
    let grandTotal = 0;
    for (const [monasteryId, count] of relicsInMonastery.entries()) {
      if (count <= 0) {
        continue;
      }
      const building = world.getComponent<BuildingComponent>(monasteryId, 'building');
      if (!building) {
        continue;
      }
      totalByOwner.set(building.owner, (totalByOwner.get(building.owner) ?? 0) + count);
      grandTotal += count;
    }
    if (grandTotal === 0) {
      return null;
    }
    for (const [owner, count] of totalByOwner.entries()) {
      if (count === grandTotal) {
        return owner;
      }
    }
    return null;
  }

  function playerHasConquestPresence(owner: number): boolean {
    for (const id of world.query('unit')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (unit?.owner === owner) {
        return true;
      }
    }

    for (const id of world.query('building')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (building?.owner === owner) {
        return true;
      }
    }

    return false;
  }

  return {
    computePlayerScore,
    finalizeMatchEnd,
    currentRelicHoldingOwner,
    getHumanWonderCountdownTicks,
    getHumanRelicCountdownTicks,
    playerHasConquestPresence,
  };
}
