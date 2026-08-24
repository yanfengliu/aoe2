// The civilization unique technologies (spec §9.2.2), as data.
//
// Nineteen of these exist in design/stats/technologies.csv, one or two per
// civilization, all researched at the Castle. Sixteen land here with real
// effects; the three that do not are listed at the bottom with the mechanic
// each is waiting on, because a technology that silently does nothing is worse
// than one that is honestly absent.
//
// The effects are DECLARED rather than coded. combatStateFactory was already a
// forty-line ladder of `if (isX(unitType) && hasTechnology(...))`, and adding
// sixteen more would have doubled it while making each one harder to read than
// the CSV line it came from. Instead each technology names which units or
// buildings it touches and what it adds, and one loop applies them all.

import { INFANTRY_UNITS } from './prototypeUnitRules/unitClassSets';
import type { BuildingType } from './types';
import type { ResearchableTechnologyType } from './technologyTypes';
import type { UnitType } from './unitTypes';

/** What a unique technology does to the combat state of the units it names. */
export interface UniqueUnitEffect {
  /** Which units it touches. */
  readonly applies: (unitType: UnitType) => boolean;
  readonly maxHp?: number;
  readonly maxHpMultiplier?: number;
  readonly attackDamage?: number;
  readonly attackRange?: number;
  readonly armor?: number;
  readonly pierceArmor?: number;
  /** Reload ticks multiplied by this — below 1 means it fires faster. */
  readonly reloadMultiplier?: number;
  /** Movement speed multiplied by this, through the movement-speed seam. */
  readonly speedMultiplier?: number;
}

/** What it does to the owner's buildings of a given type. */
export interface UniqueBuildingEffect {
  readonly applies: (buildingType: BuildingType) => boolean;
  readonly attackDamage?: number;
  readonly attackRange?: number;
  readonly maxHpMultiplier?: number;
}

export interface UniqueTechnology {
  readonly id: ResearchableTechnologyType;
  readonly name: string;
  readonly civilization: string;
  readonly age: 'castle-age' | 'imperial-age';
  readonly cost: Readonly<Partial<Record<'food' | 'wood' | 'gold' | 'stone', number>>>;
  readonly researchTicks: number;
  /** One line, shown in the research tooltip. */
  readonly summary: string;
  readonly unitEffect?: UniqueUnitEffect;
  readonly buildingEffect?: UniqueBuildingEffect;
  /** Production speed multiplier at this building (Perfusion). */
  readonly trainRate?: { readonly building: BuildingType; readonly multiplier: number };
  /** Makes a unit trainable somewhere it normally is not (Anarchy). */
  readonly unlocksTraining?: { readonly building: BuildingType; readonly unitType: UnitType };
}

const isInfantry = (unitType: UnitType) => INFANTRY_UNITS.has(unitType)
  // The infantry-class unique units are infantry for Garland Wars too.
  || unitType === 'jaguar-warrior' || unitType === 'elite-jaguar-warrior'
  || unitType === 'woad-raider' || unitType === 'elite-woad-raider'
  || unitType === 'huskarl' || unitType === 'elite-huskarl'
  || unitType === 'samurai' || unitType === 'elite-samurai'
  || unitType === 'teutonic-knight' || unitType === 'elite-teutonic-knight'
  || unitType === 'berserk' || unitType === 'elite-berserk'
  || unitType === 'throwing-axeman' || unitType === 'elite-throwing-axeman';

const SIEGE_WORKSHOP_UNITS = new Set<UnitType>([
  'mangonel', 'onager', 'scorpion', 'heavy-scorpion',
  'battering-ram', 'siege-ram', 'bombard-cannon',
]);

const MANGONEL_LINE = new Set<UnitType>(['mangonel', 'onager']);

const FOOT_ARCHERS = new Set<UnitType>([
  'archer', 'crossbowman', 'arbalest', 'skirmisher',
  'longbowman', 'elite-longbowman',
  'chu-ko-nu', 'elite-chu-ko-nu',
  'plumed-archer', 'elite-plumed-archer',
  'janissary', 'elite-janissary',
]);

const CAMELS_AND_MAMELUKES = new Set<UnitType>([
  'camel', 'heavy-camel', 'mameluke', 'elite-mameluke',
]);

const is = (...types: UnitType[]) => {
  const set = new Set(types);
  return (unitType: UnitType) => set.has(unitType);
};

export const UNIQUE_TECHNOLOGIES: readonly UniqueTechnology[] = [
  {
    id: 'el-dorado',
    name: 'El Dorado',
    civilization: 'Mayans',
    age: 'imperial-age',
    cost: { food: 750, gold: 450 },
    researchTicks: 500,
    summary: 'Eagle Warriors +40 hit points.',
    unitEffect: { applies: is('eagle-warrior', 'elite-eagle-warrior'), maxHp: 40 },
  },
  {
    id: 'garland-wars',
    name: 'Garland Wars',
    civilization: 'Aztecs',
    age: 'imperial-age',
    cost: { food: 450, gold: 750 },
    researchTicks: 600,
    summary: 'Infantry +4 attack.',
    unitEffect: { applies: isInfantry, attackDamage: 4 },
  },
  {
    id: 'yeomen',
    name: 'Yeomen',
    civilization: 'Britons',
    age: 'imperial-age',
    cost: { food: 750, gold: 450 },
    researchTicks: 600,
    summary: 'Foot archers +1 range; towers +2 attack.',
    unitEffect: { applies: (unitType) => FOOT_ARCHERS.has(unitType), attackRange: 1 },
    buildingEffect: { applies: (building) => building === 'watch-tower', attackDamage: 2 },
  },
  {
    id: 'logistica',
    name: 'Logistica',
    civilization: 'Byzantines',
    age: 'imperial-age',
    cost: { food: 1000, gold: 600 },
    researchTicks: 500,
    summary: 'Cataphracts +6 attack.',
    // The CSV also gives it +0.5 blast radius; trample damage is a separate
    // mechanic from the mangonel-line blast and is not wired.
    unitEffect: { applies: is('cataphract', 'elite-cataphract'), attackDamage: 6 },
  },
  {
    id: 'furor-celtica',
    name: 'Furor Celtica',
    civilization: 'Celts',
    age: 'imperial-age',
    cost: { food: 750, gold: 450 },
    researchTicks: 500,
    summary: 'Siege Workshop units +50% hit points.',
    unitEffect: {
      applies: (unitType) => SIEGE_WORKSHOP_UNITS.has(unitType),
      maxHpMultiplier: 1.5,
    },
  },
  {
    id: 'rocketry',
    name: 'Rocketry',
    civilization: 'Chinese',
    age: 'imperial-age',
    cost: { food: 600, gold: 600 },
    researchTicks: 600,
    summary: 'Chu Ko Nu +2 attack, Scorpions +4.',
    // Two different amounts, so it is two entries in the applier rather than
    // one — see `extraUnitEffects` below.
    unitEffect: { applies: is('chu-ko-nu', 'elite-chu-ko-nu'), attackDamage: 2 },
  },
  {
    id: 'bearded-axe',
    name: 'Bearded Axe',
    civilization: 'Franks',
    age: 'imperial-age',
    cost: { food: 400, gold: 400 },
    researchTicks: 600,
    summary: 'Throwing Axemen +1 range.',
    unitEffect: {
      applies: is('throwing-axeman', 'elite-throwing-axeman'),
      attackRange: 1,
    },
  },
  {
    id: 'anarchy',
    name: 'Anarchy',
    civilization: 'Goths',
    age: 'castle-age',
    cost: { food: 450, gold: 250 },
    researchTicks: 600,
    summary: 'Huskarls can be trained at the Barracks.',
    unlocksTraining: { building: 'barracks', unitType: 'huskarl' },
  },
  {
    id: 'perfusion',
    name: 'Perfusion',
    civilization: 'Goths',
    age: 'imperial-age',
    cost: { food: 400, gold: 600 },
    researchTicks: 400,
    summary: 'Barracks train twice as fast.',
    trainRate: { building: 'barracks', multiplier: 2 },
  },
  {
    id: 'kataparuto',
    name: 'Kataparuto',
    civilization: 'Japanese',
    age: 'imperial-age',
    cost: { food: 750, gold: 400 },
    researchTicks: 600,
    summary: 'Trebuchets reload 25% faster.',
    unitEffect: { applies: is('trebuchet'), reloadMultiplier: 0.75 },
  },
  {
    id: 'shinkichon',
    name: 'Shinkichon',
    civilization: 'Koreans',
    age: 'imperial-age',
    cost: { food: 800, gold: 500 },
    researchTicks: 600,
    summary: 'Mangonel line +1 range.',
    unitEffect: { applies: (unitType) => MANGONEL_LINE.has(unitType), attackRange: 1 },
  },
  {
    id: 'drill',
    name: 'Drill',
    civilization: 'Mongols',
    age: 'imperial-age',
    cost: { food: 500, gold: 450 },
    researchTicks: 600,
    summary: 'Siege Workshop units move 50% faster.',
    unitEffect: {
      applies: (unitType) => SIEGE_WORKSHOP_UNITS.has(unitType),
      speedMultiplier: 1.5,
    },
  },
  {
    id: 'mahouts',
    name: 'Mahouts',
    civilization: 'Persians',
    age: 'imperial-age',
    cost: { food: 300, gold: 300 },
    researchTicks: 500,
    summary: 'War Elephants move 30% faster.',
    unitEffect: {
      applies: is('war-elephant', 'elite-war-elephant'),
      speedMultiplier: 1.3,
    },
  },
  {
    id: 'zealotry',
    name: 'Zealotry',
    civilization: 'Saracens',
    age: 'imperial-age',
    cost: { food: 750, gold: 800 },
    researchTicks: 500,
    summary: 'Mamelukes and camels +30 hit points.',
    unitEffect: {
      applies: (unitType) => CAMELS_AND_MAMELUKES.has(unitType),
      maxHp: 30,
    },
  },
  {
    id: 'supremacy',
    name: 'Supremacy',
    civilization: 'Spanish',
    age: 'imperial-age',
    cost: { food: 400, gold: 250 },
    researchTicks: 600,
    summary: 'Villagers +6 attack, +40 hit points, +2/+2 armour.',
    unitEffect: {
      applies: is('villager'),
      attackDamage: 6,
      maxHp: 40,
      armor: 2,
      pierceArmor: 2,
    },
  },
  {
    id: 'crenellations',
    name: 'Crenellations',
    civilization: 'Teutons',
    age: 'imperial-age',
    cost: { food: 600, gold: 400 },
    researchTicks: 600,
    summary: 'Castles +3 range.',
    // The CSV's other half — garrisoned infantry firing arrows of their own —
    // needs a garrison-derived arrow count that buildingArrowCount does not
    // model, and is not wired.
    buildingEffect: { applies: (building) => building === 'castle', attackRange: 3 },
  },
  {
    id: 'artillery',
    name: 'Artillery',
    civilization: 'Turks',
    age: 'imperial-age',
    cost: { food: 500, gold: 450 },
    researchTicks: 400,
    summary: 'Bombard units +2 range.',
    unitEffect: { applies: is('bombard-cannon'), attackRange: 2 },
  },
];

/**
 * Second effects for technologies whose CSV line gives two different amounts to
 * two different unit groups. Rocketry is the only one so far (+2 to the Chu Ko
 * Nu, +4 to the Scorpion line), and it is a separate list rather than an array
 * on the entry so the common single-effect case stays a plain object.
 */
export const EXTRA_UNIT_EFFECTS: Readonly<
  Partial<Record<ResearchableTechnologyType, UniqueUnitEffect>>
> = {
  rocketry: { applies: is('scorpion', 'heavy-scorpion'), attackDamage: 4 },
};

/**
 * The unique technologies not wired, and what each is waiting on. Listed here
 * rather than omitted so the gap is visible next to what did land.
 *
 * - Berserkergang (Vikings): doubles Berserk regeneration; no unit regenerates.
 *   (El Dorado was here until v0.3.57, deferred because the Eagle line did not
 *   exist. It shipped in v0.3.48, so the deferral had simply gone stale — worth
 *   re-reading this list whenever the roster grows.)
 * - Atheism (Huns): +100 years to Wonder/Relic victory timers, and halves the
 *   cost of Spies/Treason, neither of which exists.
 */
export const DEFERRED_UNIQUE_TECHNOLOGIES = ['berserkergang', 'atheism'] as const;

const BY_CIVILIZATION = new Map<string, UniqueTechnology[]>();
for (const technology of UNIQUE_TECHNOLOGIES) {
  const list = BY_CIVILIZATION.get(technology.civilization) ?? [];
  list.push(technology);
  BY_CIVILIZATION.set(technology.civilization, list);
}

const BY_ID = new Map<ResearchableTechnologyType, UniqueTechnology>(
  UNIQUE_TECHNOLOGIES.map((technology) => [technology.id, technology]),
);

/** The unique technologies this civilization can research, in roster order. */
export function uniqueTechnologiesFor(civilization: string): readonly UniqueTechnology[] {
  return BY_CIVILIZATION.get(civilization) ?? [];
}

export function uniqueTechnology(
  id: ResearchableTechnologyType,
): UniqueTechnology | undefined {
  return BY_ID.get(id);
}

/** Every unit effect a researched technology carries, including the extras. */
export function unitEffectsOf(id: ResearchableTechnologyType): UniqueUnitEffect[] {
  const effects: UniqueUnitEffect[] = [];
  const primary = BY_ID.get(id)?.unitEffect;
  if (primary) effects.push(primary);
  const extra = EXTRA_UNIT_EFFECTS[id];
  if (extra) effects.push(extra);
  return effects;
}

/** The attack and range a unique technology adds to this building type. */
export function uniqueBuildingBonus(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  buildingType: BuildingType,
): { attackDamage: number; attackRange: number } {
  let attackDamage = 0;
  let attackRange = 0;
  for (const technology of UNIQUE_TECHNOLOGIES) {
    const effect = technology.buildingEffect;
    if (!effect || !effect.applies(buildingType)) continue;
    if (!researchedTechnologies.has(technology.id)) continue;
    attackDamage += effect.attackDamage ?? 0;
    attackRange += effect.attackRange ?? 0;
  }
  return { attackDamage, attackRange };
}
