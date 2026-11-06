// DE's flush buffers (work 147 M2): when a soldier leaves the build order's
// cheap claims their wood, as DE's ranged flush does at every level.
//
// DE's AI (Promisory) trains a line only while some rule sets its goal (spec
// §13.2). Inside the ranged flush, the strategy closest to this AI (plan 144),
// each soldier line's rules are skipped while the wood would not cover the
// soldier and the next claim on the wood:
// - the farm buffer: while the farms placed, complete or not, are under the
//   farm target and the wood is under the line's buffer (a farm's 60 and the
//   soldier's wood), when the army is level or ahead (superiority 0 or more)
//   with 5 or more soldiers and the seat is not ahead of the enemy's age, or
//   its food villagers and its farms are both under 7, or no farm is idle and
//   its superiority is 2 or more (units.per 9208-9219 for the Spearman,
//   9375-9386 for the Archer, 9456-9467 for the Skirmisher);
// - the Siege Workshop buffer: from the Castle Age, while no Siege Workshop is
//   placed, complete or not, and the wood is under the workshop's 200 and the
//   soldier's wood: 225 for the Spearman (9191-9199) and the Archer (9344-9363),
//   235 for the Skirmisher (9440-9448).
// The buffers are per civilization (customConstants.per: `pk-buffer-w`
// 6094-6131, `ar-buffer-w` 4375-4381, `sk-buffer-w` 6099-6130). DE's
// sn-current-age is the seat's age with a half step while the next age is
// researched, and its enemyState the target's age (init.per 3955-4089,
// 4237-4258; the scale is const.per 1338-1344).
//
// Left out, each with its reason. The flush's camp buffers (9191-9207 and
// their archer and skirmisher twins: a Lumber Camp while the wood lies more
// than 4 tiles off, a Mining Camp while the gold lies more than 5) wait with
// DE's Lumber Camp rule (spec §13.2, "AI Lumber Camp siting"). The siege
// goals' buffer (9145-9157) has nothing to hold without a Siege Workshop. DE's
// Castle-research gold buffer (9336-9343), its ram buffer beside the archer's
// workshop buffer (9344-9354) and the skirmisher's research and food buffers
// (9434-9439, 9468-9476) are not in the coordinator's decision (plan 147).
// DE's guess of the enemy's half step from the score (init.per 4260-4282) is
// not modelled: the enemy's state is its age. "The farm target" is this AI's
// own `targetFarmCount` until work 147 M3 brings DE's `maxfarms`.

import type { AgeType } from './types';

/** The lines the flush's buffers guard: DE's spearman-line, archer-line and skirmisher-line, at every tier. */
export type FlushLine = 'spear' | 'archer' | 'skirmisher';

// customConstants.per: the buffer by civilization, else everyone's.
const FARM_BUFFER: Readonly<Record<FlushLine, { readonly default: number; readonly byCivilization: Readonly<Record<string, number>> }>> = {
  spear: { default: 85, byCivilization: { Teutons: 65, Goths: 79, Byzantines: 79 } },
  archer: { default: 85, byCivilization: { Mayans: 82 } },
  skirmisher: { default: 95, byCivilization: { Teutons: 75, Byzantines: 86 } },
};
const SIEGE_WORKSHOP_BUFFER: Readonly<Record<FlushLine, number>> = { spear: 225, archer: 225, skirmisher: 235 };
const FOOD_VILLAGERS_FEW = 7;
const FARMS_FEW = 7;
const ARMY_FOR_LEVEL = 5;

/** The wood under which the farm buffer holds the line for this civilization. */
export function farmBuffer(line: FlushLine, civilization: string | undefined): number {
  const buffer = FARM_BUFFER[line];
  return buffer.byCivilization[civilization ?? ''] ?? buffer.default;
}

const AGE_INDEX: Readonly<Record<AgeType, number>> = { 'dark-age': 0, 'feudal-age': 1, 'castle-age': 2, 'imperial-age': 3 };

/** DE's age state (const.per 1338-1344): dark 0, feudal 2, castle 4, imperial 6, a half step up while the next age is researched. */
export function deAgeState(age: AgeType, nextAgeResearched: boolean): number {
  return AGE_INDEX[age] * 2 + (nextAgeResearched && age !== 'imperial-age' ? 1 : 0);
}

export interface FlushBufferSituation {
  /** The age reached (DE's current-age). */
  age: AgeType;
  /** DE's sn-current-age (`deAgeState`). */
  ageState: number;
  /** DE's enemyState: the target's age state, or 0 (DE's start value, init.per 191) with no target. */
  enemyAgeState: number;
  /** Farms placed, complete or not (building-type-count-total farm). */
  farms: number;
  /** The farm target this AI builds to (`targetFarmCount`). */
  farmTarget: number;
  /** Complete farms no villager works (idle-farm-count). */
  idleFarms: number;
  /** Villagers gathering food (villager-food). */
  foodVillagers: number;
  /** DE's military-population. */
  militaryPopulation: number;
  /** DE's sn-military-superiority (`militarySuperiority`, aiSiege.ts). */
  superiority: number;
  /** Siege Workshops placed, complete or not (building-type-count-total siege-workshop). */
  siegeWorkshops: number;
  civilization: string | undefined;
}

/** Whether DE's flush skips a soldier of `line` with `wood` left in the stockpile. */
export function flushBufferHolds(line: FlushLine, wood: number, s: FlushBufferSituation): boolean {
  if (AGE_INDEX[s.age] >= AGE_INDEX['castle-age'] && s.siegeWorkshops <= 0 && wood < SIEGE_WORKSHOP_BUFFER[line]) return true;
  if (s.farms >= s.farmTarget || wood >= farmBuffer(line, s.civilization)) return false;
  const levelArmy = s.superiority >= 0 && s.militaryPopulation >= ARMY_FOR_LEVEL && s.ageState <= s.enemyAgeState;
  const fewOnFood = s.foodVillagers < FOOD_VILLAGERS_FEW && s.farms < FARMS_FEW;
  const farmsAllWorkedAhead = s.idleFarms <= 0 && s.superiority >= 2;
  return levelArmy || fewOnFood || farmsAllWorkedAhead;
}
