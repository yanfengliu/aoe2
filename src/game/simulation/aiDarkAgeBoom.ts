// The computer's villager count and Dark Age gathering split as Definitive
// Edition's AI sets them (work 144 M2), read from DE's own AI scripts
// (`resources/_common/ai/Promisory`, the 2026-10-06 install; DE is never
// launched to read them).
//
// THE STRATEGY. DE's AI picks one strategy a game, and each has a type (init.per
// 10102-10153): a Dark Age rush is `dark-war`; the scout, ranged and other
// flushes are `feudal-war`; the castle rushes `castle-war`; and its "usual"
// boom `imperial-war`. This AI plays as a `feudal-war` one: it opens with a
// Barracks and soldiers, and it clicks each age the moment it can pay for it,
// which is what DE's `feudal-war` click does (researches.per 69-81: Feudal as
// soon as it can be researched), where `usual` waits for 990 food, its villager
// count or the end of its villager training (56-96). Its Feudal army needs an
// Archery Range and gold (`pickUnitMix`), so of DE's flushes the ranged one
// (r-flush) is the closest. "usual" is also what DE's Easiest and Standard force
// every strategy to (init.per 9577-9606), a handicap the owner's "Keep current
// AI" leaves out (spec §13.1).
//
// THE VILLAGER COUNT, Dark Age (units.per 156-376). A `feudal-war` strategy
// stops its boom once it can research the Feudal Age and holds 21 villagers and
// the Feudal food, or 25 and `feudal-f2` (233-244; 470, and the Italians' 425,
// their Feudal food itself: const.per 4570-4611). The stop skips the boom rules
// through 366-376, and the base rules before it (185-206) train only under 400
// food, or below 22 villagers short of the food the stop asks, so a stopped seat
// trains none. Before that its boom rules run (328-338, the binding one): a
// villager while it has fewer than 25 (366-376), and up to `darkvills`
// (29; 32 for the Malay, not in this roster; const.per 3381-3384) while its food
// is below a threshold that falls 65 a villager: 845 plus the civilization's
// `dark-vill-buffer` (-65 for the Italians, Khmer and Ethiopians,
// customConstants.per 6349-6364), less 35 while Loom is unresearched or the
// Wheelbarrow is under way, at 25 villagers; 65 less at 26; 130 less at 27 and
// 28; never below the Feudal Age's 500 food. (The 65 DE takes off without a
// military strategy does not apply: this AI trains soldiers, `milunits yes`.)
// Feudal Age (units.per 409-415): a villager while under 18, or until the
// Castle Age's food and gold are banked. DE has no lower Feudal cap than its
// civilian population; this AI bounds it by its Castle Age cap, so a Feudal
// seat never holds more villagers than its next age allows. DE's under-400
// base rule (185-196), which trains past `darkvills`, is not modelled yet
// (plan 144, M2b).
//
// THE SPLIT, Dark Age. Below 12 villagers 75% food and 25% wood (dawn.per
// 72-78, work 141). From 12, dawn.per adds each villager to one resource in turn
// (80-385) and writes the split from those counts (391-409); for a `feudal-war`
// strategy on land that is 7 food first (93-104), 3 wood (120-129; a flush stops
// at 3), food up to 15 (310-319), wood up to 6 once 15 farm or forage (299-309),
// and food after that (310-319, 365-372). Its house villager (87-92) is this
// AI's House builder, and its drush gold rules (130-180) do not apply to a
// flush. From the Feudal click, or from 20 villagers with the Feudal food
// banked, the ranged flush's rule replaces it (gatherers.per 79-97): 33% food,
// 58% wood, 9% gold. DE keeps it until an Archery Range stands; here it ends
// when the Feudal Age arrives, where this AI's own Feudal split takes over (the
// coordinator's decision 2, 2026-11-05: the flush split scoped to the Dark Age).

import type { AgeType, EconomyResourceKind, PlayerResources } from './types';

/** `darkvills`: DE's Dark Age villager count, const.per 3381-3384. */
export const DE_DARK_AGE_VILLAGERS = 29;
/** units.per 330: under this many, a villager whatever the food. */
export const DE_DARK_AGE_UNCONDITIONAL_VILLAGERS = 25;
/** units.per 409-415: under this many Feudal villagers, a villager whatever the stockpile. */
export const DE_FEUDAL_UNCONDITIONAL_VILLAGERS = 18;
const DE_FEUDAL_FOOD = 500;
/** units.per 233-244: a `feudal-war` strategy's boom stops from 21 villagers... */
const DE_FLUSH_STOP_VILLAGERS = 21;
/** ...with the Feudal food banked, or from 25 with `feudal-f2` banked: 470 where the
 *  Feudal Age costs 500 (const.per 4572, 4611), the Italians' 425 (4591-4592). */
const DE_FEUDAL_F2_DEFAULT = 470;
const DE_FEUDAL_F2: Readonly<Record<string, number>> = { Italians: 425 };
const DE_THRESHOLD_BASE = 845;
const DE_THRESHOLD_STEP = 65;
const DE_LOOM_ALLOWANCE = 35;
const DE_DARK_VILL_BUFFER: Readonly<Record<string, number>> = { Italians: -65, Khmer: -65, Ethiopians: -65 };

/** The food under which DE's Dark Age still trains its `villagers`+1-th villager (25 to 28 held). */
export function deDarkAgeFoodThreshold(villagers: number, civilization: string | undefined, loomAllowance: boolean): number {
  const first = DE_THRESHOLD_BASE + (DE_DARK_VILL_BUFFER[civilization ?? ''] ?? 0) - (loomAllowance ? DE_LOOM_ALLOWANCE : 0);
  const steps = Math.min(Math.max(villagers - DE_DARK_AGE_UNCONDITIONAL_VILLAGERS, 0), 2);
  return Math.max(first - steps * DE_THRESHOLD_STEP, DE_FEUDAL_FOOD);
}

export interface VillagerWantInputs {
  /** Owned, queued and asked for this decision. */
  villagers: number;
  stockpile: Partial<PlayerResources> | undefined;
  civilization: string | undefined;
  /** Loom still to research, or the Wheelbarrow researched or under way: DE takes 35 off (units.per 304-309). */
  loomAllowance: boolean;
  /** The Castle Age's price to this owner. */
  castleCost: Partial<PlayerResources>;
  /** The Dark Age's buildings stand, so the Feudal Age can be researched once paid for. */
  feudalAvailable: boolean;
  /** The Feudal Age's food to this owner (DE's `feudal-food`). */
  feudalFood: number;
  /** This AI's villager bound for the age (`villagerCapForAge`, the tuning seam): DE's
   *  `darkvills` in the Dark Age; in the Feudal Age the Castle Age's, since DE's Feudal
   *  rule has no count of its own (work 144 M2, decision 6). */
  cap: number;
}

/** Whether DE's AI trains another villager in this age (units.per 233-244, 328-338 and 409-415). */
export function deWantsVillager(age: AgeType, inputs: VillagerWantInputs): boolean {
  const { villagers, stockpile } = inputs;
  if (age === 'dark-age') {
    const food = stockpile?.food ?? 0;
    if (villagers >= inputs.cap) return false;
    const feudalF2 = DE_FEUDAL_F2[inputs.civilization ?? ''] ?? DE_FEUDAL_F2_DEFAULT;
    const banked = food >= feudalF2
      && (villagers >= DE_DARK_AGE_UNCONDITIONAL_VILLAGERS || food >= inputs.feudalFood);
    // Stopped, it holds at least 425 food, so the base rules (185-206, under 400) do not train either.
    if (inputs.feudalAvailable && villagers >= DE_FLUSH_STOP_VILLAGERS && banked) return false;
    if (villagers < DE_DARK_AGE_UNCONDITIONAL_VILLAGERS) return true;
    return food < deDarkAgeFoodThreshold(villagers, inputs.civilization, inputs.loomAllowance);
  }
  if (age === 'feudal-age') {
    if (villagers >= inputs.cap) return false;
    if (villagers < DE_FEUDAL_UNCONDITIONAL_VILLAGERS) return true;
    return (stockpile?.food ?? 0) < (inputs.castleCost.food ?? 0) || (stockpile?.gold ?? 0) < (inputs.castleCost.gold ?? 0);
  }
  return false;
}

/** dawn.per's food and wood villagers for a `feudal-war` strategy on land, from 12 villagers. */
export function deDarkAgeVillagerCounts(villagers: number): { food: number; wood: number } {
  let food = 0;
  let wood = 0;
  for (let i = 0; i < villagers; i += 1) {
    if (food < 7) food += 1;
    else if (wood < 3) wood += 1;
    else if (wood < 6 && food >= 15) wood += 1;
    else food += 1;
  }
  return { food, wood };
}

/** The ranged flush's split from its Feudal click to the Feudal Age (gatherers.per 79-97; DE keeps it until an Archery Range stands). */
export const DE_RANGED_FLUSH_SPLIT: Readonly<Partial<Record<EconomyResourceKind, number>>> = {
  food: 33, wood: 58, gold: 9, stone: 0,
};

/** DE's Dark Age split for this AI: weights the villager allocation reads. */
export function deDarkAgeSplit(
  villagers: number,
  options: {
    feudalClicked: boolean;
    foodBanked: boolean;
    /** The farms, while only farms feed the seat (dawn.per 413-430); otherwise null. */
    farmsOnly?: number | null;
    underTwelve: Partial<Record<EconomyResourceKind, number>>;
  },
): Partial<Record<EconomyResourceKind, number>> {
  if (options.feudalClicked || (villagers >= 20 && options.foodBanked)) return { ...DE_RANGED_FLUSH_SPLIT };
  if (options.farmsOnly !== null && options.farmsOnly !== undefined) return farmsOnlySplit(villagers, options.farmsOnly);
  if (villagers < 12) return { ...options.underTwelve };
  const { food, wood } = deDarkAgeVillagerCounts(villagers);
  return { food, wood, gold: 0, stone: 0 };
}

// THE FARM TRANSITION, Dark Age (buildings.per 4216-4260 and init.per 1660-1740).
// DE farms in the Dark Age while no farm stands idle, it owns fewer than 3 sheep
// and a wood drop site stands (4216-4223), once it holds 7 villagers, has wood to
// spare (`farmmb-cost`; the Teutons' 215 here, below) or fewer than 9 villagers on food, and is short of
// the Feudal food, under 7 farms (4224-4234); and only as many as the food
// villagers natural food does not employ (`maxfarms`: the food target less the
// villagers on sheep, forage, hunt and fish, 1660-1671). While only farms feed
// it, its food villagers are the farms and one more, the rest cutting wood
// (dawn.per 413-430).

/** Up to 6 Dark Age farms. DE builds one while fewer than 7 stand or are placed
 *  (buildings.per 4234, whose own comment keeps an older 6), so up to 7. Measured
 *  at 7 against 6 in work 144 M2 (castle configuration, five maps by five seeds),
 *  the seventh moved 10 of 25 matches and lost five seat-Ages for six gained
 *  (coastal#2's owner 1 its Castle and Imperial Ages), and four Castles fewer were
 *  held (31 against 35); so it waits, with DE's farm count, for plan 106's farm card. */
const DE_DARK_AGE_FARM_LIMIT = 6;
/** buildings.per 4226: `farmmb-cost`, the wood to spare. 215 is the Teutons' value
 *  (const.per 4269), applied here to every civilization and measured that way in
 *  work 144 M2; DE's is 209 for the Malians and 235 for everyone else (const.per
 *  4265-4293). DE's own value per civilization is plan 106's farm card. */
const DE_FARM_SPARE_WOOD = 215;

export interface DarkAgeFoodSituation {
  villagers: number;
  /** The seat's own sheep with food left. */
  ownSheep: number;
  farms: number;
  /** Farms no villager is working. */
  idleFarms: number;
  /** Villagers gathering food of any kind, and of them those on sheep, forage, hunt or fish. */
  foodGatherers: number;
  naturalFoodGatherers: number;
  /** Sheep, forage or hunt with food left within the AI's hunting reach of its Town Center. */
  naturalFoodNearby: boolean;
  hasWoodDropSite: boolean;
}

/** DE's Dark Age farm count for this seat: how many farms it wants standing. */
export function deDarkAgeFarmsWanted(
  situation: DarkAgeFoodSituation,
  stockpile: Partial<PlayerResources> | undefined,
  feudalFood: number,
): number {
  if (situation.idleFarms > 0 || situation.ownSheep >= 3 || !situation.hasWoodDropSite) return 0;
  const foodTarget = darkAgeFoodVillagers(situation.villagers);
  const maxFarms = Math.min(DE_DARK_AGE_FARM_LIMIT, Math.max(0, foodTarget - situation.naturalFoodGatherers));
  const goal = situation.villagers >= 7
    && ((stockpile?.wood ?? 0) >= DE_FARM_SPARE_WOOD || situation.foodGatherers < 9)
    && (stockpile?.food ?? 0) < feudalFood;
  return goal ? maxFarms : 0;
}

/** dawn.per 413-430: with only farms to feed it, the farms and one more on food. */
export function farmsOnlySplit(villagers: number, farms: number): Partial<Record<EconomyResourceKind, number>> {
  const food = Math.min(farms + 1, darkAgeFoodVillagers(villagers), villagers);
  return { food, wood: Math.max(villagers - food, 0), gold: 0, stone: 0 };
}

function darkAgeFoodVillagers(villagers: number): number {
  return villagers < 12 ? Math.round(villagers * 0.75) : deDarkAgeVillagerCounts(villagers).food;
}
