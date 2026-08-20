// Slice 10: planner-style AI helpers. The real decision loop lives in
// `createSimulationBridge.ts` as the `prototypeAi` ECS system; this file
// carries the pure helpers (plan selection, unit mixes, difficulty
// multipliers) so the bridge's system body stays readable.
//
// These helpers are intentionally deterministic and stateless — they
// consume plain data and return plain data so the bridge can drive them
// with its own side-map state. Tests can also import them directly for
// fast unit coverage without spinning up a full simulation.

import type {
  AgeType,
  BuildableBuildingType,
  EconomyResourceKind,
  PlayerResources,
  ResearchableTechnologyType,
  TrainableUnitType,
} from './types';

// Difficulty knob. Affects gather-rate multiplier (higher = more
// resources per drop-off) and decision interval (lower = more frequent
// AI ticks). Deterministic — no randomness in the mapping.
export type DifficultyLevel = 'easy' | 'standard' | 'hard';

// Ordered plan phases the AI cycles through. Opening keeps the old
// Barracks-rush behaviour alive so the baseline browser test still
// passes; the later plans open up as the AI ages up and accumulates
// resources. Defensive / retreat are reactive states.
export type AiPlan =
  | 'opening'
  | 'feudal-push'
  | 'castle-push'
  | 'imperial-push'
  | 'defend';

// The per-owner state object stored in the bridge's `aiStates` side map.
// Encoding is deliberately JSON-safe so the Slice 9 save blob can round-
// trip it without custom hydration logic.
export interface AiState {
  difficulty: DifficultyLevel;
  plan: AiPlan;
  // Desired villager count per resource. When the actual allocation
  // drifts from this map the `villagerRebalance` helper nudges the
  // gatherer components toward the target. Missing entries imply zero.
  villagerTargets: Partial<Record<EconomyResourceKind, number>>;
  // Entity ids of units currently committed to the pending push. On
  // retreat or wipe this clears and the AI rebuilds from scratch. Keeps
  // ids (not EntityRefs) so save/load can piggyback on the existing
  // entity-id-keyed side-map pattern; stale ids are filtered every loop.
  attackGroup: number[];
  lastDecisionTick: number;
  // Tick at which the AI last sighted an enemy unit near its base. Used
  // by the Watch Tower response to decide whether to place a tower.
  lastEnemySightingTick: number;
  // Position of the most recent enemy sighting near the base. Drives
  // Watch Tower placement toward the incoming direction.
  lastEnemySightingPosition: { x: number; y: number } | null;
}

export const DEFAULT_DIFFICULTY: DifficultyLevel = 'standard';

// Base decision interval in ticks. 30 ticks ≈ 3s at TPS 10 — roughly
// one decision per age-up research poll — and keeps per-tick cost low.
// Difficulty tweaks this up or down: easier AIs think slower, harder
// AIs think faster. FU4 tightened hard from 20 → 15 so a hard AI pushes
// the economy roughly twice as fast as the easy baseline.
export function decisionIntervalTicks(difficulty: DifficultyLevel): number {
  switch (difficulty) {
    case 'easy':
      return 60;
    case 'standard':
      return 30;
    case 'hard':
      return 15;
  }
}

// Multiplier applied to the amount of resource dropped off on each
// gather cycle. 1.0 is standard. Easy AIs accumulate resources more
// slowly than the player; hard AIs accumulate faster. Applied at
// drop-off time in the bridge's gather loop.
export function gatherMultiplier(difficulty: DifficultyLevel): number {
  switch (difficulty) {
    case 'easy':
      return 0.7;
    case 'standard':
      return 1.0;
    case 'hard':
      return 1.3;
  }
}

// Baseline villager allocation target for a given age. FU4 rebalanced
// these toward a Dark-Age food-first opening (match canonical AoE2
// early-game), a Feudal lean on food + wood for military production,
// a Castle Age gold + stone pivot so age-up funds can actually
// accumulate, and an Imperial Age tilt toward gold for the unit mix.
// These targets were picked to reach Castle Age within roughly 5000
// ticks on the `ai-planner-fixture` (see `tests/simulation/aiPlayer.test.ts`).
// Feudal keeps at least two villagers on gold so military production
// (archer / skirmisher cost gold) doesn't stall waiting on a single
// gold villager.
export function villagerTargetsForAge(age: AgeType): Partial<Record<EconomyResourceKind, number>> {
  switch (age) {
    case 'dark-age':
      return { food: 4, wood: 3, gold: 0, stone: 0 };
    case 'feudal-age':
      // Food-dominant: the Castle age-up costs 800 food : 200 gold (4:1).
      // Grounded 2026-07-04 by replaying the default-seed corpus — the old
      // {food:5,gold:2} split mined gold the AI never spent (hoarded to ~1551)
      // while food stayed pinned at ~20-76 and it never banked the 800 food to
      // leave Feudal. Weighting food 7 : gold 1 makes food income outpace spend
      // so the age-up reserve can accumulate; gold 1 still supplies the Feudal
      // gold sink (only archers cost gold, 45 each) + the Castle's 200-gold half
      // comfortably — the old weight-2 split over-mined gold ~8x over.
      return { food: 7, wood: 4, gold: 1, stone: 0 };
    case 'castle-age':
      return { food: 4, wood: 4, gold: 3, stone: 1 };
    case 'imperial-age':
      return { food: 4, wood: 3, gold: 5, stone: 1 };
  }
}

// Total villager count the AI grows its economy to in each age (the HARD cap on
// TC villager production; the per-resource `villagerTargetsForAge` distribution
// then spreads them proportionally). The previous inline caps (Dark 6 / Feudal
// + Castle 14 / Imperial 50) starved the AI's economy: with ~14 villagers
// through Castle Age it could not fund a real army or age up efficiently and
// plateaued (found by AI-vs-AI grounding). These scale toward AoE2-realistic
// counts — still conservative (military trains BEFORE villagers each decision
// tick and from a reserve above the age-up cost, so a higher cap grows the
// economy without starving military or age-up). Monotonic increasing across
// ages. Food supply from natural resources bounds this in very long games until
// the AI builds farms (a separate follow-up).
export function villagerCapForAge(age: AgeType): number {
  switch (age) {
    case 'dark-age':
      return 10;
    case 'feudal-age':
      return 22;
    case 'castle-age':
      return 40;
    case 'imperial-age':
      return 60;
  }
}

// Deterministic unit-mix for each age. The AI walks through the list in
// order; whichever unit it cannot afford is skipped that decision tick.
// Kept intentionally simple — mixes ignore civ-uniques and pick only
// units with a canonical training building.
export interface UnitMixEntry {
  unitType: TrainableUnitType;
  producer: BuildableBuildingType;
}

export function pickUnitMix(age: AgeType): UnitMixEntry[] {
  switch (age) {
    case 'dark-age':
      return [{ unitType: 'militia', producer: 'barracks' }];
    case 'feudal-age':
      return [
        { unitType: 'spearman', producer: 'barracks' },
        { unitType: 'archer', producer: 'archery-range' },
        { unitType: 'skirmisher', producer: 'archery-range' },
        { unitType: 'scout', producer: 'stable' },
      ];
    case 'castle-age':
      return [
        { unitType: 'pikeman', producer: 'barracks' },
        { unitType: 'crossbowman', producer: 'archery-range' },
        { unitType: 'knight', producer: 'stable' },
        // The AI has built a Siege Workshop since FU4 and trained NOTHING from
        // it, which meant it could not break a wall, a tower, or a Castle — it
        // would batter a stone wall with knights until they died. A ram opens
        // the buildings and a mangonel answers a massed line.
        { unitType: 'battering-ram', producer: 'siege-workshop' },
        { unitType: 'mangonel', producer: 'siege-workshop' },
      ];
    case 'imperial-age':
      return [
        { unitType: 'halberdier', producer: 'barracks' },
        { unitType: 'arbalest', producer: 'archery-range' },
        { unitType: 'cavalier', producer: 'stable' },
        { unitType: 'siege-ram', producer: 'siege-workshop' },
        { unitType: 'onager', producer: 'siege-workshop' },
      ];
  }
}

// Priority-ordered build targets the AI should pursue. The bridge walks
// this list, finds the first one it is missing, and sends an idle
// villager to place it. Order encodes the AoE2 "Barracks rush" opening
// — Barracks goes up FIRST so the AI has a military presence before
// committing wood to drop-off camps. Rush fixtures with no resources
// nearby still lay down a Barracks and train Militia, which the
// baseline AI-rush browser test depends on. After the Barracks, gather
// drop-offs and the Feudal / Castle prerequisites go up in the usual
// order. The bridge filters by age / research gate before picking.
//
// Once the AI has advanced past Dark Age, the remaining Dark-Age drop-
// off builds (lumber / mining camp) are skipped — they aren't Feudal
// prerequisites and their absence shouldn't delay the Castle-Age gate.
// Feudal-prereq buildings (Blacksmith / Archery Range / Stable / Market)
// are always a priority for age-up gating.
/**
 * How many farms an AI of this age should be keeping, given its villager count.
 *
 * Berries, sheep, and boar are FINITE. Without farms the AI's food income falls
 * to zero the moment its opening patch is eaten, and it can then never afford
 * the 800 food for Castle Age — which is exactly where every observed match
 * stalled: Feudal Age, food 14, forever, with a Barracks it could not use.
 *
 * Roughly a third of the villager force on farms is the AoE2 shape, floored so
 * that a small early economy still puts two down and capped so the AI does not
 * spend its whole wood income on soil.
 */
export function targetFarmCount(age: AgeType, villagerCount: number): number {
  if (age === 'dark-age') return 0;
  return Math.max(2, Math.min(8, Math.floor(villagerCount / 3)));
}

export function pickNextBuildTarget(
  age: AgeType,
  missing: (buildingType: BuildableBuildingType) => boolean,
  populationBlocked: boolean,
  farms: { owned: number; villagerCount: number } | null = null,
): BuildableBuildingType | null {
  // Pop block pre-empts everything: no production of any kind can
  // resume until the AI has headroom. A fresh House is the fastest fix.
  if (populationBlocked) {
    return missing('house') ? 'house' : null;
  }

  // Dark-Age priority: barracks first (rush), then mill so the AI has
  // two Dark-Age prereqs for Feudal age-up. Lumber / mining camps are
  // OPTIONAL nice-to-haves only while still in Dark Age — in Feudal
  // and beyond the AI no longer blocks age-up on them.
  if (missing('barracks')) {
    return 'barracks';
  }
  if (missing('mill')) {
    return 'mill';
  }
  if (age === 'dark-age') {
    if (missing('lumber-camp')) return 'lumber-camp';
    if (missing('mining-camp')) return 'mining-camp';
    return null;
  }

  // Farms come BEFORE the age-up prerequisite buildings: those cost wood and
  // the age-up itself costs food, so an AI that puts up an Archery Range while
  // its food income is dead has spent wood to get no closer to Castle Age.
  if (farms && farms.owned < targetFarmCount(age, farms.villagerCount)) {
    return 'farm';
  }

  const feudalOrder: BuildableBuildingType[] = [
    'blacksmith',
    'archery-range',
    'stable',
    'market',
  ];
  for (const target of feudalOrder) {
    if (missing(target)) {
      return target;
    }
  }

  if (age === 'feudal-age') {
    return null;
  }

  // FU4: Monastery slotted between Siege Workshop and Castle so the
  // Castle-Age AI can train Monks (heal + collect relics) without
  // waiting on the 650-stone Castle to clear the build queue first
  // (Castle is the most expensive non-Wonder build and frequently
  // blocks for tens of decision ticks while stone accumulates).
  const castleOrder: BuildableBuildingType[] = ['siege-workshop', 'monastery', 'castle'];
  for (const target of castleOrder) {
    if (missing(target)) {
      return target;
    }
  }

  return null;
}

// Given the owner's age + player resources + research prerequisite
// check, return the next age-up research the AI should queue — or null
// if the AI is already in Imperial Age or lacks prerequisites /
// resources. The bridge separately verifies that the Town Center is
// idle before calling queueResearch.
export function pickNextAgeResearch(
  age: AgeType,
  canAdvance: (tech: ResearchableTechnologyType) => boolean,
  canAfford: (tech: ResearchableTechnologyType) => boolean,
): ResearchableTechnologyType | null {
  const next: ResearchableTechnologyType | null =
    age === 'dark-age' ? 'feudal-age'
    : age === 'feudal-age' ? 'castle-age'
    : age === 'castle-age' ? 'imperial-age'
    : null;

  if (next === null) {
    return null;
  }

  if (!canAdvance(next) || !canAfford(next)) {
    return null;
  }

  return next;
}

// Map the owner's current age to the plan label stored on AiState.
// The bridge swaps plan any time the age changes. Keeps the plan
// vocabulary aligned with age names so tests reading AiState can match
// against a deterministic string.
export function planForAge(age: AgeType): AiPlan {
  switch (age) {
    case 'dark-age':
      return 'opening';
    case 'feudal-age':
      return 'feudal-push';
    case 'castle-age':
      return 'castle-push';
    case 'imperial-age':
      return 'imperial-push';
  }
}

// Shallow-equal check used by the bridge when deciding whether to
// rewrite the stored villagerTargets entry on this tick. Avoids an
// otherwise-constant re-allocation churn during long simulations.
export function villagerTargetsEqual(
  a: Partial<Record<EconomyResourceKind, number>>,
  b: Partial<Record<EconomyResourceKind, number>>,
): boolean {
  const kinds: EconomyResourceKind[] = ['food', 'wood', 'gold', 'stone'];
  for (const kind of kinds) {
    if ((a[kind] ?? 0) !== (b[kind] ?? 0)) {
      return false;
    }
  }
  return true;
}

// Attack-group size threshold by age. The AI accumulates at least this
// many military units before committing to a push. Dark Age is 1 so
// the opening Barracks + Militia rush triggers as soon as the first
// Militia leaves the queue (the baseline rush browser test depends on
// this). Later ages wait for a full attack group before committing to
// the push so a single lost unit doesn't force a full base walk.
export function attackGroupSize(age: AgeType): number {
  switch (age) {
    case 'dark-age':
      return 1;
    case 'feudal-age':
      return 5;
    case 'castle-age':
      return 7;
    case 'imperial-age':
      return 9;
  }
}

// Pause AI military GROWTH when it is stuck short of the next age, so pop room
// (and therefore wood) frees up for the prerequisite building it otherwise can't
// afford. Grounded 2026-07-04 by replaying the default-seed corpus (LABELED
// dump + gather-state --detail): the Feudal AI over-produced military (~21
// units) to its ~40 pop cap, forcing a House-build treadmill that drained the
// wood needed for a 2nd Feudal-prerequisite building (stable/archery-range/
// market) — leaving it at 1/2 Castle prereqs, unable to advance. Wood GATHERING
// is healthy (not gridlocked); the blocker is the pop-cap treadmill. Fires ONLY
// in Feudal, ONLY when the AI cannot yet advance, and ONLY at/above
// attackGroupSize — so the FU4 "5+ military" guard (it stays defended) holds,
// and it resumes the moment the 2nd prereq lands (qualifiesForNextAge → true).
// This SUPERSEDES the v0.1.79 "no military suppression" note for the narrow
// building-prerequisite stall (that note guarded a food age-up, a different
// case); the guard it protected is preserved here. KNOWN LIMIT (future PvP
// tuning, per v0.1.92 review): vs a human who denies the 2nd-prereq building
// (raids the builder), a paused AI holds at the floor and won't grow to break
// the pressure — benign in AI-vs-AI (no denial) and the existing push guard
// still commits the standing group, but revisit when tuning against humans.
export function militaryGrowthPausedForAgeUp(
  age: AgeType,
  qualifiesForNextAge: boolean,
  militaryCount: number,
): boolean {
  return age === 'feudal-age' && !qualifiesForNextAge && militaryCount >= attackGroupSize(age);
}

// The age-up reserve lives in ./aiResourceReserve (extracted for the 500-LOC
// budget); re-exported so existing `from './ai'` imports keep working.
export {
  ageUpReserveCost,
  ageUpResourceBuffer,
  canAffordWithReserve,
} from './aiResourceReserve';

// Vision radius the AI considers as "near base" for scouting-response
// logic. If an enemy unit is visible within this radius of the AI's
// Town Center the AI is in sighting range and can commit to a Watch
// Tower build toward the threat.
export const AI_BASE_VISION_RADIUS = 12;

// Minimum separation (in Manhattan distance) between the freshly-placed
// Watch Tower and the base so the AI does not try to plant the tower
// directly on top of the Town Center. Also bounds how far toward the
// enemy the tower is placed.
export const AI_WATCH_TOWER_FORWARD_STEP = 4;

// FU4: AI Monk count cap. Once a Castle-Age AI owns this many Monks it
// stops training more from the Monastery so the gold spend doesn't
// crowd out cavalry / archer production. Two-to-three Monks is enough
// to heal a pushing army and ferry every relic on the map back to the
// Monastery without monopolising the gold stockpile.
export const AI_MONK_COUNT_CAP = 3;

// FU4: HP-fraction threshold below which an owned military unit is
// considered "wounded" and worth the AI's Monk attention. Healing past
// 70% of max-hp is a wash — the heal rate (1 HP every 10 ticks) makes
// 100% restoration too slow to be worthwhile mid-push, so the Monk
// re-targets the next wounded unit once a target crosses this bar.
export const AI_MONK_HEAL_HP_FRACTION = 0.7;

// FU4: AI Wonder pursuit thresholds. The Imperial-Age AI commits to a
// Wonder build once it has enough villagers to keep the economy
// running through the long Wonder-countdown AND enough banked
// resources to actually pay the 1000/1000/1000/1000 Wonder cost
// without bottoming out food production. These thresholds match the
// spec language; the AI's Imperial villager cap is bumped above 40 so
// the villager count gate is reachable in a deterministic fixture.
export interface AiWonderPursuitThresholds {
  minVillagers: number;
  minFood: number;
  minWood: number;
  minStone: number;
  minGold: number;
}
export const AI_WONDER_PURSUIT_THRESHOLDS: AiWonderPursuitThresholds = {
  minVillagers: 40,
  minFood: 500,
  minWood: 500,
  minStone: 1000,
  minGold: 1000,
};

// FU4: pure helper. Returns true when the Imperial-Age AI has the
// economy + villager surplus needed to commit to a Wonder build. The
// bridge calls this each decision tick; the moment all five thresholds
// clear, the AI's next idle villager places the Wonder. After the
// Wonder is up the AI continues producing military to defend it (the
// Wonder-countdown system handles the win condition).
export function shouldPursueWonder(
  age: AgeType,
  hasOwnedWonder: boolean,
  villagerCount: number,
  resources: PlayerResources,
  thresholds: AiWonderPursuitThresholds = AI_WONDER_PURSUIT_THRESHOLDS,
): boolean {
  if (age !== 'imperial-age') return false;
  if (hasOwnedWonder) return false;
  if (villagerCount < thresholds.minVillagers) return false;
  if (resources.food < thresholds.minFood) return false;
  if (resources.wood < thresholds.minWood) return false;
  if (resources.stone < thresholds.minStone) return false;
  if (resources.gold < thresholds.minGold) return false;
  return true;
}
