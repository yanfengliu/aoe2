// Slice 10 AI decision helpers. Six small utility functions the
// prototypeAi system calls per decision tick — extracted here so the
// bridge file keeps only the loop-body policy / action sequencing and
// these helpers live next to each other. Same flat dep-bag factory as
// the other `bridge/` extractions.

import type { Position } from 'civ-engine';

import type {
  BuildingType,
  EconomyResourceKind,
  GathererComponent,
  UnitComponent,
  UnitType,
} from '../types';
import type { GameWorld } from './pureHelpers';

export interface AiDecisionDeps {
  world: GameWorld;
  state: import('./bridgeState').BridgeState;
  // Collaborator. The placement-anchor search lives in createWorld
  // because it reads worldOccupancy + tile passability; the factory
  // defers to it so pickWatchTowerPlacement keeps one footprint-aware
  // anchor computation site.
  findBuildPlacementNear: (
    origin: Position,
    buildingType: BuildingType,
  ) => Position | null;
  // Constant injected as a dep so future tests could tune the forward
  // step without rewiring the module-level AI constants import.
  aiWatchTowerForwardStep: number;
}

export interface AiDecisionOps {
  // Predicate: is `unitType` a trainable military unit? Used by the AI
  // to decide what counts toward the attack-group threshold and to
  // filter villagers / monks out of push targets.
  isAiMilitaryUnit(unitType: UnitType): boolean;
  // Returns the owner's military units for push-target aggregation.
  findOwnedMilitaryUnits(owner: number): Array<{ id: number; position: Position }>;
  // Returns every owned military unit's id as a set for fast membership
  // tests during attack-group pruning.
  ownedMilitaryUnitIds(owner: number): Set<number>;
  // Choose a Watch Tower placement anchor between the AI's Town Center
  // and the most recent enemy sighting. Steps the anchor one
  // AI_WATCH_TOWER_FORWARD_STEP toward the sighting so the tower sits
  // forward of the base rather than on top of it.
  pickWatchTowerPlacement(townCenter: Position, sighting: Position): Position | null;
  // Assign the owner's idle villagers to gather from the desired
  // resource, walking toward the `villagerTargets` distribution one
  // reassignment at a time per decision tick.
  villagerRebalance(
    owner: number,
    targets: Partial<Record<EconomyResourceKind, number>>,
  ): void;
}

export function createAiDecisionOps(deps: AiDecisionDeps): AiDecisionOps {
  const { world, findBuildPlacementNear, aiWatchTowerForwardStep } = deps;

  function isAiMilitaryUnit(unitType: UnitType): boolean {
    switch (unitType) {
      case 'militia':
      case 'champion':
      case 'spearman':
      case 'pikeman':
      case 'halberdier':
      case 'archer':
      case 'crossbowman':
      case 'arbalest':
      case 'skirmisher':
      case 'longbowman':
      case 'elite-longbowman':
      case 'knight':
      case 'cavalier':
      case 'light-cavalry':
      case 'hussar':
      case 'camel':
      case 'cavalry-archer':
      case 'heavy-cavalry-archer':
      case 'mangonel':
      case 'onager':
      case 'scorpion':
      case 'heavy-scorpion':
      case 'battering-ram':
      case 'siege-ram':
      case 'bombard-cannon':
      case 'trebuchet':
      case 'man-at-arms':
      case 'long-swordsman':
      case 'two-handed-swordsman':
      case 'paladin':
      case 'heavy-camel':
        return true;
      case 'villager':
      case 'scout':
      case 'monk':
        return false;
    }
  }

  function findOwnedMilitaryUnits(owner: number): Array<{ id: number; position: Position }> {
    const results: Array<{ id: number; position: Position }> = [];
    for (const id of world.query('position', 'unit')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      const position = world.getComponent<Position>(id, 'position');
      if (!unit || !position || unit.owner !== owner || !isAiMilitaryUnit(unit.unitType)) {
        continue;
      }
      results.push({ id, position });
    }
    return results;
  }

  function ownedMilitaryUnitIds(owner: number): Set<number> {
    const ids = new Set<number>();
    for (const id of world.query('unit')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (unit && unit.owner === owner && isAiMilitaryUnit(unit.unitType)) {
        ids.add(id);
      }
    }
    return ids;
  }

  function pickWatchTowerPlacement(townCenter: Position, sighting: Position): Position | null {
    const dx = sighting.x - townCenter.x;
    const dy = sighting.y - townCenter.y;
    const distance = Math.abs(dx) + Math.abs(dy);
    if (distance <= 0) {
      return findBuildPlacementNear(townCenter, 'watch-tower');
    }
    const step = Math.min(aiWatchTowerForwardStep, Math.max(1, Math.floor(distance / 2)));
    const toward = {
      x: Math.round(townCenter.x + (dx * step) / distance),
      y: Math.round(townCenter.y + (dy * step) / distance),
    };
    return findBuildPlacementNear(toward, 'watch-tower');
  }

  function villagerRebalance(
    owner: number,
    targets: Partial<Record<EconomyResourceKind, number>>,
  ): void {
    const desiredByKind: Record<EconomyResourceKind, number> = {
      food: targets.food ?? 0,
      wood: targets.wood ?? 0,
      gold: targets.gold ?? 0,
      stone: targets.stone ?? 0,
    };
    const actualByKind: Record<EconomyResourceKind, number> = {
      food: 0,
      wood: 0,
      gold: 0,
      stone: 0,
    };
    const villagersByKind: Record<EconomyResourceKind, number[]> = {
      food: [],
      wood: [],
      gold: [],
      stone: [],
    };
    for (const id of world.query('unit', 'gatherer')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
      if (!unit || !gatherer || unit.owner !== owner || unit.unitType !== 'villager') {
        continue;
      }
      const resource = gatherer.desiredResource;
      actualByKind[resource] += 1;
      villagersByKind[resource].push(id);
    }

    // Rebalance metric: compare actual / desired ratios. The kind
    // whose actual / desired ratio is WORST (ratio low = under-served)
    // is the deficit kind; the kind with the HIGHEST ratio (actual
    // exceeding or most-served vs desired) is the donor. Using the
    // ratio rather than the absolute gap means the rebalance fires
    // even when every kind is under its target — a common case when
    // total villagers is smaller than total desired villagers.
    //
    // Iter-2 V5-2 considered: zero-target kinds with actual > 0 are
    // skipped (continue) below. Iter-2 explored treating them as
    // POSITIVE_INFINITY donors, but that breaks the load-bearing
    // dark-age gold accumulation — `assignVillagerRole(ordinal=3)`
    // spawns the 4th villager on gold (canonical AoE2 opening), while
    // `villagerTargetsForAge('dark-age')` reports gold=0. The current
    // skip lets that villager keep gathering enough gold for the
    // feudal age-up cost. Treating the trap as "the bug" actively
    // breaks AI age progression. Revisit only if AI build plans gain
    // dynamic target flips mid-age.
    const kinds: EconomyResourceKind[] = ['food', 'wood', 'gold', 'stone'];
    let worstKind: EconomyResourceKind | null = null;
    let worstRatio = Number.POSITIVE_INFINITY;
    let bestKind: EconomyResourceKind | null = null;
    let bestRatio = Number.NEGATIVE_INFINITY;
    for (const kind of kinds) {
      const desired = desiredByKind[kind];
      if (desired <= 0) {
        continue; // Avoid divide-by-zero; zero-target kinds don't pull villagers.
      }
      const ratio = actualByKind[kind] / desired;
      if (ratio < worstRatio) {
        worstRatio = ratio;
        worstKind = kind;
      }
      if (ratio > bestRatio && villagersByKind[kind].length > 0) {
        bestRatio = ratio;
        bestKind = kind;
      }
    }

    // Only rebalance when there's a meaningful gap between the
    // best-served and worst-served kinds, and the donor kind has at
    // least one villager to spare. Otherwise skip this decision tick.
    if (
      worstKind
      && bestKind
      && worstKind !== bestKind
      && bestRatio - worstRatio > 0.01
    ) {
      const donorId = villagersByKind[bestKind][0];
      if (donorId !== undefined) {
        const gatherer = world.getComponent<GathererComponent>(donorId, 'gatherer');
        if (gatherer) {
          gatherer.desiredResource = worstKind;
          gatherer.hasExplicitGatherOrder = false;
          gatherer.task = 'idle';
          gatherer.targetResourceId = null;
          gatherer.gatherProgressTicks = 0;
        }
      }
    }
  }

  return {
    isAiMilitaryUnit,
    findOwnedMilitaryUnits,
    ownedMilitaryUnitIds,
    pickWatchTowerPlacement,
    villagerRebalance,
  };
}
