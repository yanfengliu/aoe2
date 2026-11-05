// DE's ram goal, the part work 141 M2a-2b models: when the computer wants a
// ram, so that it fields siege against buildings as DE's AI does.
//
// DE's own AI (Promisory) clears `trainram` at the start of every pass
// (units.per 17-18) and sets it from nine rules (989-1133). The first, the one
// modelled here, wants a ram while military population is 33 or more, siege is
// still needed, military superiority is 1 or more, or an attack is out; and
// while under 6 rams, or under 8 once siege is needed and the Siege Ram is
// researched or pending (989-999). Its train rule (12905-12925) comes after
// the villager's (12771), the Trebuchet's (12871) and the Bombard Cannon's
// (12904), and before the Monk's (13210) and the army lines' (mangonel 13248,
// knight 13305, militia 13368, archer 13430, spearman 13621) in the pass: a ram
// it can pay for is bought before the army spends, one a pass, and nothing is
// held for one it cannot (`aiEscrow.ts`'s first-claim list). The goal's caps
// count rams owned or queued (unit-type-count-total); the siege requirement
// and superiority below count those standing (unit-type-count).
//
// Siege is still needed (`siegereq` no, init.per 4154-4179) from the Castle Age
// at DE's siege population (190 at a limit of 200, const.per 5480), below 8
// siege units in all, 6 Bombard Cannons, 3 Trebuchets and 5 rams. DE also
// stops at its allowed army size, which caps only below a military percent of
// 100 (init.per 1231-1246) and so is one of the lower levels' handicaps this
// game does not take (spec §13.1).
//
// Military superiority (threats.per) is the army lead over the target's
// (268-273), less the target's Watch Towers, Bombard Towers, Kreposts and
// Castles while the army is small and siege-less (1274-1301), bucketed by age
// (1302-1395).
//
// Left out, each with its rule: the other eight ram rules (1036-1133: one ram
// in the Castle Age at 20 military, against walls, on a flank, at superiority 1
// to 4 for the "milunits" strategies, and against enemy towers or Castles in
// town); DE's skip of a Siege Workshop under attack (12913), which this AI
// does not track; and DE's own count of what an up-find-remote sees, which may
// be fewer than the target owns.

import type { AgeType, ResearchableTechnologyType } from './types';

/**
 * DE's `armytech` at `imperial` (init.per 3843-3872): any of these researched,
 * or the owner's elite unique unit (`my-unique-unit-upgrade`, 3847).
 */
export const IMPERIAL_ARMY_TECHNOLOGIES: ReadonlySet<ResearchableTechnologyType> = new Set<ResearchableTechnologyType>([
  'bracer', 'plate-mail-armor', 'plate-barding', 'galleon-upgrade', 'chemistry',
  'cavalier-upgrade', 'two-handed-swordsman-upgrade', 'heavy-scorpion-upgrade', 'onager-upgrade',
  'elite-longboat-upgrade', 'hussar-upgrade',
  'halberdier-upgrade', 'elite-eagle-warrior-upgrade', 'heavy-cavalry-archer-upgrade', 'heavy-camel-upgrade',
  'elite-turtle-ship-upgrade', 'arbalest-upgrade',
]);

/** Whether `researched` puts the army at DE's Imperial army technology; `eliteUnique` is the owner's elite unique-unit upgrades. */
export function imperialArmyTech(
  researched: ReadonlySet<ResearchableTechnologyType> | undefined,
  eliteUnique: ReadonlySet<ResearchableTechnologyType>,
): boolean {
  if (!researched) return false;
  for (const tech of researched) if (IMPERIAL_ARMY_TECHNOLOGIES.has(tech) || eliteUnique.has(tech)) return true;
  return false;
}

export interface RamGoalInputs {
  age: AgeType;
  /** Owned population less civilians (villagers, Trade Carts, Fishing Ships): DE's military-population. */
  militaryPopulation: number;
  /** The target enemy's, counted alike (threats.per 273: target-mpop). */
  targetMilitaryPopulation: number;
  /** The target's Watch Towers, Bombard Towers, Kreposts and Castles, each type counted to 10 (threats.per 1292-1296). */
  targetDefences: number;
  /** The target owns a building (threats.per 1287). */
  targetHasBuilding: boolean;
  population: number;
  /** DE's siege-pop for this population limit (`siegePopulation`). */
  siegePopulation: number;
  /** DE's max-civ-pop for this population limit (`maxCivilianPopulation`). */
  maxCivilianPopulation: number;
  /** DE's Imperial army technology (`imperialArmyTech`, init.per 3843-3872). */
  imperialArmyTech: boolean;
  /** The attack group is out: DE's `attacking` goal. */
  attacking: boolean;
  /** Battering Rams, Capped Rams and Siege Rams owned or queued (DE's unit-type-count-total): the goal's caps. */
  rams: number;
  /** Those standing (DE's unit-type-count): the siege requirement and superiority. */
  ramsStanding: number;
  trebuchets: number;
  bombardCannons: number;
  petards: number;
  /** The Siege Ram is researched or in flight (up-research-status ri-siege-ram >= research-pending). */
  siegeRamPending: boolean;
}

// const.per's POPULATION-CAP blocks, by limit: [siege-pop, max-civ-pop].
const POPULATION_BLOCKS: ReadonlyArray<readonly [number, number, number]> = [
  [25, 20, 22], [50, 45, 44], [75, 70, 65], [100, 93, 90], [125, 115, 112], [150, 140, 137], [175, 165, 162],
  [200, 190, 186], [225, 215, 210], [250, 240, 225], [275, 265, 245], [300, 288, 265], [325, 313, 285],
  [350, 336, 305], [375, 360, 325], [400, 382, 345], [425, 405, 365], [450, 430, 385], [475, 455, 405],
  [500, 480, 425],
];

/** The block for a limit: the one at or below it, as DE defines blocks only every 25. */
function populationBlock(limit: number): readonly [number, number, number] {
  let block = POPULATION_BLOCKS[0];
  for (const candidate of POPULATION_BLOCKS) if (candidate[0] <= limit) block = candidate;
  return block;
}

/** DE's siege-pop: the population from which siege counts as needed (const.per 5311-5787; 198 for the Goths at 200). */
export function siegePopulation(populationLimit: number, gothic: boolean): number {
  const block = populationBlock(populationLimit);
  return gothic && block[0] === 200 ? 198 : block[1];
}

/** DE's max-civ-pop (const.per 5308-5784; 194 for the Goths at 200). */
export function maxCivilianPopulation(populationLimit: number, gothic: boolean): number {
  const block = populationBlock(populationLimit);
  return gothic && block[0] === 200 ? 194 : block[2];
}

const castleTier = (age: AgeType): boolean => age === 'castle-age' || age === 'imperial-age';

// threats.per's buckets, highest first: [lowest lead for the level, level].
const BUCKETS_BEFORE_CASTLE: ReadonlyArray<readonly [number, number]> = [[28, 4], [20, 3], [12, 2], [6, 1], [-3, 0], [-10, -1], [-18, -2]];
const BUCKETS_FROM_CASTLE: ReadonlyArray<readonly [number, number]> = [[34, 4], [23, 3], [15, 2], [7, 1], [-6, 0], [-14, -1], [-22, -2]];

/** DE's sn-military-superiority, from -3 to 4. */
export function militarySuperiority(inputs: RamGoalInputs): number {
  let lead = inputs.militaryPopulation - inputs.targetMilitaryPopulation;
  const hasSiege = inputs.ramsStanding + inputs.trebuchets + inputs.bombardCannons + inputs.petards > 0;
  const smallArmy = !inputs.imperialArmyTech
    && inputs.militaryPopulation < 25
    && inputs.population < inputs.maxCivilianPopulation
    && !hasSiege;
  if (smallArmy && lead >= 1 && inputs.targetHasBuilding) lead = Math.max(0, lead - inputs.targetDefences);
  for (const [floor, level] of castleTier(inputs.age) ? BUCKETS_FROM_CASTLE : BUCKETS_BEFORE_CASTLE) {
    if (lead >= floor) return level;
  }
  return -3;
}

/** DE's `siegereq` no: siege is still needed (init.per 4154-4179). */
export function siegeNeeded(inputs: RamGoalInputs): boolean {
  const total = inputs.trebuchets + inputs.ramsStanding + inputs.bombardCannons + inputs.petards;
  return castleTier(inputs.age)
    && inputs.population >= inputs.siegePopulation
    && total < 8
    && inputs.bombardCannons < 6
    && inputs.trebuchets < 3
    && inputs.ramsStanding < 5;
}

/** DE's `trainram` goal from units.per 989-999. */
export function ramWanted(inputs: RamGoalInputs): boolean {
  const needed = siegeNeeded(inputs);
  const reason = inputs.militaryPopulation >= 33 || needed || militarySuperiority(inputs) >= 1 || inputs.attacking;
  return reason && ((needed && inputs.siegeRamPending) || inputs.rams < 6) && inputs.rams < 8;
}

/** The ram line, trained at the tier the owner has (DE's battering-ram-line). */
export type RamLineUnit = 'battering-ram' | 'capped-ram' | 'siege-ram';
export const RAM_LINE: readonly RamLineUnit[] = ['battering-ram', 'capped-ram', 'siege-ram'];
