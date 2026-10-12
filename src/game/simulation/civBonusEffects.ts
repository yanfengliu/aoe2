// Civilization-bonus DERIVED layer (v0.1.81). The per-civ analogue of the
// tech-effect modules (economyTechEffects, movementTechEffects,
// visionTechEffects): pure functions that take the owner's civilization (a
// string, read from playerCivilizationsCodec) plus the relevant context and
// return a multiplier/bonus applied at the use-site. No per-entity state and
// no save-format change — the civilization already lives in the persisted
// playerCivilizations map, and replay re-seeds it deterministically from tick 0.
//
// First consumer: Britons "Shepherds work 25% faster" (civilizations.csv) — a
// gather-rate multiplier that applies ONLY to villagers gathering sheep. It
// multiplies with the tech gather-rate multiplier at the villager gather-tick
// site (villagerEconomySystem). An unknown/undefined civilization is a no-op
// (multiplier 1), so non-Britons owners and un-seeded owners are byte-identical.

import type {
  AgeType,
  BuildingType,
  PlayerResources,
  ResearchableTechnologyType,
  ResourceKind,
  TrainableUnitType,
  UnitType,
} from './types';
import { constructionCost, researchCost, trainingCost } from './prototypeEconomyRules';
import { RESEARCHES_BY_BUILDING } from './buildingProductionTables';
import { civBonusesFor, GUNPOWDER_UNITS } from './civBonusTable';
import { isInfantryUnit } from './prototypeUnitRules';
import { shipwrightWoodCost } from './dockTechEffects';

// The table's values for three lines, named for the tests that pin them.
// Britons: "Shepherds work +25% faster".
export const BRITONS_SHEEP_GATHER_MULTIPLIER = 1.25;
// Aztecs: "Military Units train +15% faster", the time divided by 1.15.
export const AZTECS_MILITARY_TRAIN_TIME_MULTIPLIER = 1 / 1.15;
// Mongols: "Hunters work +40% faster", on every hunted animal.
export const MONGOLS_HUNTER_GATHER_MULTIPLIER = 1.4;
// The Franks and Mongol HP lines and the Goth infantry cost and anti-building
// lines no longer have constants: they are age ladders, in ageScaledHp.ts, the
// table and civBuildingAttackLadder below.

// Every seam below reads the declared table (civBonusTable.ts) — the if-chain
// era ended at five civilizations, and the table now carries every CSV line
// these seams can express. An unknown/undefined civilization reads neutral.

export function civGatherRateMultiplier(
  civilization: string | undefined,
  kind: ResourceKind,
): number {
  return civBonusesFor(civilization)?.gatherRate?.[kind] ?? 1;
}

// Applied to the BASE HP at combat-state creation, before flat tech bonuses
// (Bloodlines, Loom) add.
export function civUnitHpMultiplier(
  civilization: string | undefined,
  unitType: UnitType,
): number {
  for (const rule of civBonusesFor(civilization)?.unitHp ?? []) {
    if (rule.applies(unitType)) return rule.multiplier;
  }
  return 1;
}

// Train-TIME multiplier, applied to the unit's total train ticks at the single
// enqueue site (trainingMarketOps).
export function civTrainTimeMultiplier(
  civilization: string | undefined,
  unitType: UnitType,
): number {
  for (const rule of civBonusesFor(civilization)?.trainTime ?? []) {
    if (rule.applies(unitType)) return rule.multiplier;
  }
  return 1;
}

// Movement-speed multiplier, applied in the movement tech seam so it composes
// with Squires/Husbandry/Caravan exactly as a technology would. A rule is flat
// or steps with the owner's age (Celtic infantry, Berber villagers); the step
// executor reads the age every tick, so a unit speeds up the tick its owner
// advances.
export function civSpeedMultiplier(
  civilization: string | undefined,
  unitType: UnitType,
  age: AgeType,
): number {
  for (const rule of civBonusesFor(civilization)?.speed ?? []) {
    if (rule.applies(unitType)) return rule.multiplier ?? rule.multiplierByAge?.[age] ?? 1;
  }
  return 1;
}

// Flat "+N melee/+N pierce armor" (Italian Foot Archers, sourced vNEXT),
// added by the combat-state factory to the symmetric accumulator, which melee
// and pierce armor both read. It does not step with the age, so the age-up
// sweep has nothing to re-derive.
export function civArmorBonus(
  civilization: string | undefined,
  unitType: UnitType,
): number {
  let bonus = 0;
  for (const rule of civBonusesFor(civilization)?.armor ?? []) {
    if (rule.applies(unitType)) bonus += rule.bonus;
  }
  return bonus;
}

// How much longer a node of this kind lasts for this owner's gatherers
// (Mayans 1.15, Goth hunted animals 1.2; 1 for everyone else). The gather
// swing takes a full load and removes the load divided by this, and the
// node's remaining yield is its amount times this, so its last swing empties
// it.
export function civResourceDurationMultiplier(
  civilization: string | undefined,
  kind: ResourceKind,
): number {
  for (const rule of civBonusesFor(civilization)?.resourceDuration ?? []) {
    if (rule.applies(kind)) return rule.multiplier;
  }
  return 1;
}

// Flat carry bonus for a villager gathering THIS resource kind. Adds to the
// base carry BEFORE the Wheelbarrow multiplier, matching AoE2's math.
export function civCarryBonus(
  civilization: string | undefined,
  kind: ResourceKind,
): number {
  let bonus = 0;
  for (const rule of civBonusesFor(civilization)?.carryBonus ?? []) {
    if (rule.kind === undefined || rule.kind === kind) bonus += rule.bonus;
  }
  return bonus;
}

// Extra population a building of this type supports for this civilization
// (Chinese Town Centers, Inca houses). Adds to the base table at BOTH raw-
// supply sites, so the cap math never disagrees with itself.
export function civPopulationProvidedBonus(
  civilization: string | undefined,
  buildingType: string,
): number {
  return civBonusesFor(civilization)?.populationProvided?.[buildingType] ?? 0;
}

// The owner's effective BUILDING cost (Franks castles, Japanese camps,
// Teutons farms, Inca stone, Malian wood). Must be used at every construction
// charge/afford/display site so they agree — the effectiveTrainingCost rule.
export function effectiveConstructionCost(
  civilization: string | undefined,
  buildingType: BuildingType,
  /** Age-scaled rules read the OWNER's age; absent = flat rules only. */
  age?: AgeType,
): Partial<PlayerResources> {
  const base = constructionCost(buildingType);
  const rules = civBonusesFor(civilization)?.buildingCost ?? [];
  let cost: Partial<PlayerResources> | null = null;
  const writable = (): Partial<PlayerResources> => {
    if (!cost) cost = { ...base };
    return cost;
  };
  for (const rule of rules) {
    if (!rule.applies(buildingType)) continue;
    const wholeMultiplier = rule.multiplier ?? (age ? rule.multiplierByAge?.[age] : undefined);
    if (wholeMultiplier !== undefined) {
      const target = writable();
      for (const key of Object.keys(target) as (keyof PlayerResources)[]) {
        target[key] = Math.round((target[key] ?? 0) * wholeMultiplier);
      }
    }
    const woodMultiplier = rule.woodMultiplier ?? (age ? rule.woodMultiplierByAge?.[age] : undefined);
    if (woodMultiplier !== undefined) {
      const target = writable();
      if (target.wood !== undefined) target.wood = Math.round(target.wood * woodMultiplier);
    }
    if (rule.stoneMultiplier !== undefined) {
      const target = writable();
      if (target.stone !== undefined) target.stone = Math.round(target.stone * rule.stoneMultiplier);
    }
  }
  return cost ?? base;
}

// Building max-HP multiplier (Persians' Town Centers and Docks), applied at
// the building combat-state factory beside the tech HP multipliers.
export function civBuildingHpMultiplier(
  civilization: string | undefined,
  buildingType: BuildingType,
): number {
  for (const rule of civBonusesFor(civilization)?.buildingHp ?? []) {
    if (rule.applies(buildingType)) return rule.multiplier;
  }
  return 1;
}

/** Huns: population is never limited by housing. */
export function civIgnoresHousing(civilization: string | undefined): boolean {
  return civBonusesFor(civilization)?.houselessPopulation === true;
}

/** The Blacksmith's infantry armor line, which the Inca clause below extends
 *  to villagers. The age-up sweep reads it when the clause turns on. */
export const INFANTRY_ARMOR_TECHNOLOGIES: readonly ResearchableTechnologyType[] = [
  'scale-mail-armor', 'chain-mail-armor', 'plate-mail-armor',
];

/** Incas: "Villagers affected by Blacksmith upgrades" — the infantry ARMOR
 *  line reaches villagers (the melee ATTACK line already reaches every civ's
 *  villagers, matching AoE2, because villagers are melee units). It is read
 *  at research, at creation and at the Castle advance, where it turns on. */
export function civVillagersTakeInfantryArmor(
  civilization: string | undefined,
  /** DE (sourced v0.3.149): the Inca clause starts in the CASTLE Age. */
  age?: AgeType,
): boolean {
  if (age === 'dark-age' || age === 'feudal-age') return false;
  return civVillagersTakeInfantryArmorUngated(civilization);
}

function civVillagersTakeInfantryArmorUngated(civilization: string | undefined): boolean {
  return civilization === 'Incas';
}

/** Goths: "+10 to population limit in Imperial Age" — raises the HARD cap. */
export function civImperialPopulationBonus(
  civilization: string | undefined,
  age: AgeType,
): number {
  if (age !== 'imperial-age') return 0;
  return civBonusesFor(civilization)?.imperialPopulationBonus ?? 0;
}

/**
 * Koreans: "Towers (except bombard towers) have +1 range in Castle Age /
 * +2 in Imperial Age" — derived at the tower's fire site like the tech ladder.
 */
export function koreanTowerRangeBonus(
  civilization: string | undefined,
  buildingType: BuildingType,
  age: AgeType,
): number {
  if (civilization !== 'Koreans' || buildingType !== 'watch-tower') return 0;
  if (age === 'imperial-age') return 2;
  if (age === 'castle-age') return 1;
  return 0;
}

/**
 * Japanese: "Fishing Ships work +5% faster in Dark Age / +10% in Feudal Age /
 * +15% in Castle Age / +20% in Imperial Age" — the ship's gather multiplier.
 * Villagers shore-fishing are NOT Fishing Ships and read 1.
 */
export function civFishingShipRateMultiplier(
  civilization: string | undefined,
  unitType: UnitType,
  age: AgeType,
): number {
  if (civilization !== 'Japanese' || unitType !== 'fishing-ship') return 1;
  return { 'dark-age': 1.05, 'feudal-age': 1.1, 'castle-age': 1.15, 'imperial-age': 1.2 }[age];
}

/**
 * Ethiopians: "+100 gold and +100 food when advancing to the next age" —
 * paid into the stockpile when an age advance completes. Null for everyone
 * else so the age cases skip the mutation entirely.
 */
export function civAgeAdvanceGrant(
  civilization: string | undefined,
): Readonly<Partial<Record<'food' | 'wood' | 'gold' | 'stone', number>>> | null {
  return civBonusesFor(civilization)?.ageAdvanceResourceGrant ?? null;
}

// The owner's effective training cost for a unit, after civ cost bonuses and
// the Shipwright discount. Returns a NEW object when discounted (the base
// table is never mutated), and the shared base reference otherwise. This MUST
// be used at every training-cost site — the charge AND every affordability or
// validation check — so they agree.
export function effectiveTrainingCost(
  civilization: string | undefined,
  age: AgeType,
  unitType: TrainableUnitType,
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): Partial<PlayerResources> {
  // Shipwright discounts a ship's wood 20%. It is a TECHNOLOGY rather than a
  // civilization bonus, but every site that charges or checks a training cost
  // comes through here, so it belongs at this seam.
  const base = shipwrightWoodCost(researchedTechnologies, unitType, trainingCost(unitType));
  const rules = civBonusesFor(civilization)?.cost ?? [];
  let cost: Partial<PlayerResources> | null = null;
  const writable = (): Partial<PlayerResources> => {
    if (!cost) cost = { ...base };
    return cost;
  };
  for (const rule of rules) {
    if (!rule.applies(unitType)) continue;
    const multiplier = rule.multiplier ?? rule.multiplierByAge?.[age];
    if (multiplier !== undefined && multiplier !== 1) {
      const target = writable();
      for (const key of Object.keys(target) as (keyof PlayerResources)[]) {
        target[key] = Math.round((target[key] ?? 0) * multiplier);
      }
    }
    if (rule.goldMultiplier !== undefined) {
      const target = writable();
      if (target.gold !== undefined) {
        target.gold = Math.round(target.gold * rule.goldMultiplier);
      }
    }
    if (rule.woodMultiplier !== undefined) {
      const target = writable();
      if (target.wood !== undefined) {
        target.wood = Math.round(target.wood * rule.woodMultiplier);
      }
    }
    const foodMultiplier = rule.foodMultiplierByAge?.[age];
    if (foodMultiplier !== undefined && foodMultiplier !== 1) {
      const target = writable();
      if (target.food !== undefined) {
        target.food = Math.round(target.food * foodMultiplier);
      }
    }
  }
  return cost ?? base;
}

// Civ ATTACK-SPEED bonuses (sourced v0.3.145): reload multiplier per
// (civilization, unit, age). "+N% faster" divides the reload interval.
// Wordings verified verbatim against the current-DE help texts.
const FOOT_ARCHER_RELOAD_LINE = new Set<UnitType>(['archer', 'crossbowman', 'arbalest', 'longbowman', 'elite-longbowman']);
const CA_LINE = new Set<UnitType>(['cavalry-archer', 'heavy-cavalry-archer']);
const SIEGE_RELOAD_LINE = new Set<UnitType>(['battering-ram', 'capped-ram', 'siege-ram', 'mangonel', 'onager', 'siege-onager', 'scorpion', 'heavy-scorpion', 'bombard-cannon', 'trebuchet']);
const GALLEY_RELOAD_LINE = new Set<UnitType>(['galley', 'war-galley', 'galleon']);

export function civReloadMultiplier(
  civilization: string | undefined,
  unitType: UnitType,
  age: AgeType,
): number {
  switch (civilization) {
    case 'Japanese':
      // "Infantry attacks +33% faster starting in Feudal Age".
      return isInfantryUnit(unitType) && age !== 'dark-age' ? 1 / 1.33 : 1;
    case 'Ethiopians':
      return FOOT_ARCHER_RELOAD_LINE.has(unitType) ? 1 / 1.18 : 1;
    case 'Mongols':
      return CA_LINE.has(unitType) ? 1 / 1.25 : 1;
    case 'Celts':
      return SIEGE_RELOAD_LINE.has(unitType) ? 1 / 1.25 : 1;
    case 'Saracens':
      return GALLEY_RELOAD_LINE.has(unitType) ? 1 / 1.25 : 1;
    case 'Byzantines':
      return unitType === 'fire-ship' || unitType === 'fast-fire-ship' ? 1 / 1.25 : 1;
    case 'Spanish':
      // "Gunpowder Units attack +18% faster": every gunner, the Conquistador
      // included (sourced vNEXT; the Hand Cannoneer, Bombard Cannon and
      // Cannon Galleon line alone until then).
      return GUNPOWDER_UNITS.has(unitType) ? 1 / 1.18 : 1;
    case 'Indians':
      return unitType === 'camel' || unitType === 'heavy-camel' ? 1 / 1.2 : 1;
    default:
      return 1;
  }
}

// Britons (sourced v0.3.145): "Foot Archers +1/+2 range in Castle/Imperial
// Age" — the archer line only; Yeomen covers the Skirmisher line separately.
export function civAttackRangeBonus(
  civilization: string | undefined,
  unitType: UnitType,
  age: AgeType,
): number {
  if (civilization !== 'Britons' || !FOOT_ARCHER_RELOAD_LINE.has(unitType)) return 0;
  if (age === 'imperial-age') return 2;
  if (age === 'castle-age') return 1;
  return 0;
}

// Civ RESEARCH-COST bonuses (sourced v0.3.147). Scopes derive from the
// HOSTING table where DE names a building ("Dock and University
// technologies", "Blacksmith upgrades"), so a hosting change moves the
// discount with it and no second list exists.
const GUNPOWDER_TECHS: ReadonlySet<ResearchableTechnologyType> = new Set([
  'chemistry', 'cannon-galleon-unlock', 'elite-cannon-galleon-upgrade', 'bombard-tower-unlock',
] as ResearchableTechnologyType[]);
const ECONOMY_TECHS: ReadonlySet<ResearchableTechnologyType> = new Set([
  'double-bit-axe', 'bow-saw', 'two-man-saw', 'horse-collar', 'heavy-plow', 'crop-rotation',
  'gold-mining', 'gold-shaft-mining', 'stone-mining', 'stone-shaft-mining',
  'wheelbarrow', 'hand-cart', 'loom',
] as ResearchableTechnologyType[]);
const AGE_TECHS: ReadonlySet<ResearchableTechnologyType> = new Set([
  'feudal-age', 'castle-age', 'imperial-age',
] as ResearchableTechnologyType[]);

function hostedAt(building: 'dock' | 'university' | 'blacksmith', tech: ResearchableTechnologyType): boolean {
  return RESEARCHES_BY_BUILDING.get(building)?.includes(tech) ?? false;
}

export function effectiveResearchCost(
  civilization: string | undefined,
  age: AgeType,
  technologyType: ResearchableTechnologyType,
): Partial<PlayerResources> {
  const base = researchCost(technologyType);
  let multiplier = 1;
  let zeroGold = false;
  let zeroWood = false;
  switch (civilization) {
    case 'Chinese': {
      // "-5/10/15% in Feudal/Castle/Imperial Age" — by the OWNER's age.
      const byAge = { 'feudal-age': 0.95, 'castle-age': 0.9, 'imperial-age': 0.85 } as const;
      multiplier = (byAge as Record<string, number>)[age] ?? 1;
      break;
    }
    case 'Italians':
      if (AGE_TECHS.has(technologyType)) multiplier = 0.85;
      else if (hostedAt('dock', technologyType) || hostedAt('university', technologyType)) multiplier = 0.75;
      break;
    case 'Byzantines':
      if (technologyType === 'imperial-age') multiplier = 0.67;
      break;
    case 'Turks':
      if (GUNPOWDER_TECHS.has(technologyType)) multiplier = 0.5;
      break;
    case 'Spanish':
      zeroGold = hostedAt('blacksmith', technologyType);
      break;
    case 'Vietnamese':
      zeroWood = ECONOMY_TECHS.has(technologyType);
      break;
    default:
      break;
  }
  if (multiplier === 1 && !zeroGold && !zeroWood) return base;
  const cost: Partial<PlayerResources> = { ...base };
  for (const key of Object.keys(cost) as (keyof PlayerResources)[]) {
    cost[key] = Math.round((cost[key] ?? 0) * multiplier);
  }
  if (zeroGold) delete cost.gold;
  if (zeroWood) delete cost.wood;
  return cost;
}

// Per-age ARMOR ladders (sourced v0.3.152), factory-applied and re-derived
// by delta in the age-up sweep like the range ladder.
const BARRACKS_UNITS = new Set<UnitType>([
  'militia', 'man-at-arms', 'long-swordsman', 'two-handed-swordsman', 'champion',
  'spearman', 'pikeman', 'halberdier', 'eagle-warrior', 'elite-eagle-warrior',
]);
const STABLE_UNITS_ARMOR = new Set<UnitType>([
  'scout', 'light-cavalry', 'hussar', 'knight', 'cavalier', 'paladin', 'camel', 'heavy-camel',
]);

/** Malians: "Barracks Units +1/+2/+3 pierce armor in Feudal/Castle/Imperial". */
export function civPierceArmorBonus(
  civilization: string | undefined,
  unitType: UnitType,
  age: AgeType,
): number {
  if (civilization !== 'Malians' || !BARRACKS_UNITS.has(unitType)) return 0;
  if (age === 'imperial-age') return 3;
  if (age === 'castle-age') return 2;
  if (age === 'feudal-age') return 1;
  return 0;
}

/** Teutons: "Barracks and Stable Units +1/+2 melee armor in Castle/Imperial". */
export function civMeleeArmorBonus(
  civilization: string | undefined,
  unitType: UnitType,
  age: AgeType,
): number {
  if (civilization !== 'Teutons') return 0;
  if (!BARRACKS_UNITS.has(unitType) && !STABLE_UNITS_ARMOR.has(unitType)) return 0;
  if (age === 'imperial-age') return 2;
  if (age === 'castle-age') return 1;
  return 0;
}

// Goths (sourced v0.3.152): the +1 became "+1/+2/+3 attack vs. buildings in
// Feudal/Castle/Imperial" — the flat table entry stays as the Feudal rung's
// source of truth for tests that predate ages here; this ladder REPLACES it
// at the delivery site.
export function civBuildingAttackLadder(
  civilization: string | undefined,
  unitType: UnitType,
  age: AgeType,
): number {
  if (civilization !== 'Goths' || !isInfantryUnit(unitType)) return 0;
  if (age === 'imperial-age') return 3;
  if (age === 'castle-age') return 2;
  if (age === 'feudal-age') return 1;
  return 0;
}
