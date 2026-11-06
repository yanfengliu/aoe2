// DE's Dark Age boom as this AI models it (work 144 M2, `aiDarkAgeBoom.ts`),
// checked against the installed Promisory scripts' own numbers, one rule a case.
// Pure functions on hand-made inputs; the self-play gates measure the matches.

import { describe, expect, it } from 'vitest';

import {
  DE_DARK_AGE_VILLAGERS,
  deDarkAgeFarmsWanted,
  deDarkAgeFoodThreshold,
  deDarkAgeSplit,
  deDarkAgeVillagerCounts,
  deWantsVillager,
  farmsOnlySplit,
  type DarkAgeFoodSituation,
  type VillagerWantInputs,
} from '../../src/game/simulation/aiDarkAgeBoom';

const UNDER_TWELVE = { food: 3, wood: 1, gold: 0, stone: 0 };

function wants(villagers: number, food: number, overrides: Partial<VillagerWantInputs> = {}): VillagerWantInputs {
  return {
    villagers,
    stockpile: { food, wood: 0, gold: 0, stone: 0 },
    civilization: 'Britons',
    loomAllowance: true,
    castleCost: { food: 800, gold: 200 },
    cap: 29,
    feudalAvailable: false,
    feudalFood: 500,
    ...overrides,
  };
}

describe('the villager count (units.per 156-415)', () => {
  it('trains to 25 whatever the food, then while the food is under a threshold falling 65 a villager, to 29', () => {
    expect(DE_DARK_AGE_VILLAGERS).toBe(29);
    expect(deWantsVillager('dark-age', wants(24, 5000))).toBe(true);
    // 845 less 35 while Loom is still to research: 810 at 25, 745 at 26, 680 at 27 and 28.
    expect(deDarkAgeFoodThreshold(25, 'Britons', true)).toBe(810);
    expect(deDarkAgeFoodThreshold(26, 'Britons', true)).toBe(745);
    expect(deDarkAgeFoodThreshold(27, 'Britons', true)).toBe(680);
    expect(deDarkAgeFoodThreshold(28, 'Britons', true)).toBe(680);
    expect(deDarkAgeFoodThreshold(25, 'Britons', false)).toBe(845);
    expect(deDarkAgeFoodThreshold(25, 'Italians', true)).toBe(745);
    expect(deWantsVillager('dark-age', wants(25, 809))).toBe(true);
    expect(deWantsVillager('dark-age', wants(25, 810))).toBe(false);
    expect(deWantsVillager('dark-age', wants(28, 679))).toBe(true);
    expect(deWantsVillager('dark-age', wants(29, 0))).toBe(false);
  });

  it('stops a flush\'s boom from 21 villagers once it can research the Feudal Age and holds its food (233-244)', () => {
    const ready = { feudalAvailable: true };
    expect(deWantsVillager('dark-age', wants(20, 600, ready))).toBe(true);
    expect(deWantsVillager('dark-age', wants(21, 500, ready))).toBe(false);
    expect(deWantsVillager('dark-age', wants(21, 499, ready))).toBe(true);
    // From 25 DE's `feudal-f2`, 470, is enough to stop.
    expect(deWantsVillager('dark-age', wants(25, 470, ready))).toBe(false);
    expect(deWantsVillager('dark-age', wants(25, 469, ready))).toBe(true);
    expect(deWantsVillager('dark-age', wants(24, 470, ready))).toBe(true);
    // Without the Dark Age's buildings the boom runs on.
    expect(deWantsVillager('dark-age', wants(21, 600))).toBe(true);
  });

  it('stops the Italians at their own `feudal-f2`, 425, their Feudal food itself (const.per 4591-4592)', () => {
    const italians = { feudalAvailable: true, civilization: 'Italians', feudalFood: 425 };
    expect(deWantsVillager('dark-age', wants(21, 425, italians))).toBe(false);
    expect(deWantsVillager('dark-age', wants(21, 424, italians))).toBe(true);
    expect(deWantsVillager('dark-age', wants(25, 425, italians))).toBe(false);
    // Not 30 under their Feudal food: at 410 the boom runs on, under its 745 threshold.
    expect(deWantsVillager('dark-age', wants(25, 410, italians))).toBe(true);
  });

  it('trains in the Feudal Age while under 18, or until the Castle Age is paid for, under the Castle cap (409-415)', () => {
    const feudal = (food: number, gold: number) => ({ cap: 40, stockpile: { food, wood: 0, gold, stone: 0 } });
    expect(deWantsVillager('feudal-age', wants(17, 0, feudal(5000, 5000)))).toBe(true);
    expect(deWantsVillager('feudal-age', wants(30, 0, feudal(800, 199)))).toBe(true);
    expect(deWantsVillager('feudal-age', wants(30, 0, feudal(800, 200)))).toBe(false);
    expect(deWantsVillager('feudal-age', wants(39, 0, feudal(0, 0)))).toBe(true);
    expect(deWantsVillager('feudal-age', wants(40, 0, feudal(0, 0)))).toBe(false);
  });

  it('stops at the bound it is handed, the tuning seam (`villagerCapForAge`), in both ages', () => {
    expect(deWantsVillager('dark-age', wants(16, 0, { cap: 17 }))).toBe(true);
    expect(deWantsVillager('dark-age', wants(17, 0, { cap: 17 }))).toBe(false);
    expect(deWantsVillager('dark-age', wants(28, 0))).toBe(true);
    expect(deWantsVillager('dark-age', wants(29, 0))).toBe(false);
    expect(deWantsVillager('feudal-age', wants(10, 0, { cap: 10 }))).toBe(false);
  });
});

describe('the Dark Age split (dawn.per, gatherers.per)', () => {
  it('adds each villager to food or wood in dawn.per\'s order for a flush on land', () => {
    expect(deDarkAgeVillagerCounts(7)).toEqual({ food: 7, wood: 0 });
    expect(deDarkAgeVillagerCounts(10)).toEqual({ food: 7, wood: 3 });
    expect(deDarkAgeVillagerCounts(18)).toEqual({ food: 15, wood: 3 });
    expect(deDarkAgeVillagerCounts(21)).toEqual({ food: 15, wood: 6 });
    expect(deDarkAgeVillagerCounts(29)).toEqual({ food: 23, wood: 6 });
  });

  it('keeps 75/25 under 12, takes the ranged flush\'s split from the click, and the farms and one more while only farms feed it', () => {
    const base = { feudalClicked: false, foodBanked: false, underTwelve: UNDER_TWELVE };
    expect(deDarkAgeSplit(11, base)).toEqual(UNDER_TWELVE);
    expect(deDarkAgeSplit(15, base)).toEqual({ food: 12, wood: 3, gold: 0, stone: 0 });
    expect(deDarkAgeSplit(15, { ...base, feudalClicked: true })).toEqual({ food: 33, wood: 58, gold: 9, stone: 0 });
    expect(deDarkAgeSplit(20, { ...base, foodBanked: true })).toEqual({ food: 33, wood: 58, gold: 9, stone: 0 });
    expect(deDarkAgeSplit(19, { ...base, foodBanked: true })).toEqual({ food: 15, wood: 4, gold: 0, stone: 0 });
    expect(deDarkAgeSplit(20, { ...base, farmsOnly: 3 })).toEqual(farmsOnlySplit(20, 3));
    expect(farmsOnlySplit(20, 3)).toEqual({ food: 4, wood: 16, gold: 0, stone: 0 });
  });
});

describe('the Dark Age farm transition (buildings.per 4216-4260, init.per 1660-1740)', () => {
  const situation = (overrides: Partial<DarkAgeFoodSituation> = {}): DarkAgeFoodSituation => ({
    villagers: 20, ownSheep: 0, farms: 0, idleFarms: 0, foodGatherers: 6, naturalFoodGatherers: 6,
    naturalFoodNearby: true, hasWoodDropSite: true, ...overrides,
  });
  const stock = (food: number, wood: number) => ({ food, wood, gold: 0, stone: 0 });

  it('wants the farms the food villagers natural food does not employ, up to 6 (DE: 7, buildings.per 4234)', () => {
    // 20 villagers want 15 on food; 6 on natural food leave 9, so 6 farms, the limit (DE's 7 waits on plan 106).
    expect(deDarkAgeFarmsWanted(situation(), stock(100, 0), 500)).toBe(6);
    // 10 villagers want 8 on food (75% under 12); 4 on natural food leave 4.
    expect(deDarkAgeFarmsWanted(situation({ villagers: 10, foodGatherers: 4, naturalFoodGatherers: 4 }), stock(100, 0), 500)).toBe(4);
    expect(deDarkAgeFarmsWanted(situation({ naturalFoodGatherers: 12, foodGatherers: 8 }), stock(100, 0), 500)).toBe(3);
  });

  it('waits while a farm stands idle, 3 sheep are left or no wood drop site stands', () => {
    expect(deDarkAgeFarmsWanted(situation({ idleFarms: 1 }), stock(100, 0), 500)).toBe(0);
    expect(deDarkAgeFarmsWanted(situation({ ownSheep: 3 }), stock(100, 0), 500)).toBe(0);
    expect(deDarkAgeFarmsWanted(situation({ ownSheep: 2 }), stock(100, 0), 500)).toBe(6);
    expect(deDarkAgeFarmsWanted(situation({ hasWoodDropSite: false }), stock(100, 0), 500)).toBe(0);
  });

  it('farms from 7 villagers, short of the Feudal food, with wood to spare or few on food', () => {
    expect(deDarkAgeFarmsWanted(situation({ villagers: 6 }), stock(100, 0), 500)).toBe(0);
    expect(deDarkAgeFarmsWanted(situation(), stock(500, 0), 500)).toBe(0);
    expect(deDarkAgeFarmsWanted(situation({ foodGatherers: 9 }), stock(100, 0), 500)).toBe(0);
    expect(deDarkAgeFarmsWanted(situation({ foodGatherers: 9 }), stock(100, 215), 500)).toBe(6);
  });
});
