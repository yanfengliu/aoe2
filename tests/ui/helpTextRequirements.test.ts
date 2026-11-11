// What a tooltip says a building or technology is "Required for", what it says
// a technology lets a building make, and whose garrison it says adds arrows,
// are what this game's own rules say, no more and no less (work 148 M2).
//
// DE says "Required for" in four help strings (the install's string table):
// the Mill "Required for Farm, Market." (26157), the Barracks "Required for
// Archery Range and Stable." (26135), the Blacksmith "Required for Siege
// Workshop." (26131) and Chemistry "Required for Gunpowder Units (...)"
// (28047). This game's rules differ (the Barracks opens five Feudal buildings,
// nothing needs a Mill or a Blacksmith), and a tooltip that repeated DE's would
// send a player to build the wrong thing, so the copy says this game's rule
// and this test derives that rule from the simulation's own option functions:
//   - a building is required for every building a villager may place, in some
//     age, with every building standing, but not without it
//     (bridge/buildOptions.ts `buildOptionsFor`, the menu the placement
//     validator reads);
//   - a technology holds behind it every (building, unit) where that building
//     of some civilization trains that unit with every technology but not
//     without it (bridge/trainOptions.ts `createTrainOptions`, building by
//     building, so Anarchy's Huskarl at the Barracks is seen though the Castle
//     trains it too), and every building a villager may place with it but not
//     without it (`buildOptionsFor`, the Bombard Tower).
//
// A line states such a relation in one of two forms, and only those are read:
// "<Producer> can build A, B and C." / "<Producer> can train A.", a producer
// with what it makes, each pair of which must be one the rules hold; and
// "Required for A, B and C.", which must name exactly what the rules hold
// behind the thing and no "can" sentence has already stated. Review round 2
// (R2-4) found the first version looking for a unit's name anywhere in the
// line, so Chemistry's "Required for" could drop the Bombard Cannon, which its
// attack sentence also names; round 3 (R3-2) found the second reading the
// product without its producer and only up to the first comma, so "The Stable
// can train Huskarls" and a Dock said to build Hand Cannoneers both passed.
//
// Bound: civilization-blind for buildings (the Khmer's exemption and a tech
// tree's holes are not modelled: DE's strings are the same for every
// civilization); units in the Imperial Age only, a line's later tiers held at
// its first (no unit-line upgrade counts as researched, so an upgrade's "the
// Archery Range trains Crossbowmen" is not a relation read here); a technology
// that waits on another technology (Architecture on Masonry) is not a
// "Required for" (the simulation's refusal says "Needs X researched here
// first."), neither is an age, and neither is the Market's "Needed to send
// tribute", an action and not something built or trained.

import { describe, expect, it } from 'vitest';

import { buildOptionsFor } from '../../src/game/simulation/bridge/buildOptions';
import { createTrainOptions } from '../../src/game/simulation/bridge/trainOptions';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { buildingArrowCount, canGarrisonAt } from '../../src/game/simulation/prototypeBuildingRules';
import { isArcherLineUnit } from '../../src/game/simulation/prototypeUnitRules';
import type {
  AgeType,
  BuildingType,
  ResearchableTechnologyType,
  UnitType,
} from '../../src/game/simulation/types';
import { formatEntityName } from '../../src/ui/hud/displayNames';
import { BUILDING_HELP } from '../../src/ui/hud/helpText/buildingHelp';
import { GENERAL_TECHNOLOGY_HELP } from '../../src/ui/hud/helpText/technologyHelp';
import { UNIT_HELP } from '../../src/ui/hud/helpText/unitHelp';
import { UPGRADE_TECHNOLOGY_HELP } from '../../src/ui/hud/helpText/upgradeHelp';

const AGES: readonly AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];
const BUILDINGS = Object.keys(BUILDING_HELP) as BuildingType[];
const UNITS = Object.keys(UNIT_HELP) as UnitType[];
const TECHNOLOGY_HELP: Readonly<Record<string, string>> = { ...GENERAL_TECHNOLOGY_HELP, ...UPGRADE_TECHNOLOGY_HELP };
const TECHNOLOGIES = Object.keys(TECHNOLOGY_HELP) as ResearchableTechnologyType[];
const BUILDING_NAMES = new Set(BUILDINGS.map((building) => formatEntityName(building)));

/** "Hand Cannoneers" is the Hand Cannoneer; a building's own name ("Barracks") is kept. */
const singular = (name: string): string => {
  const trimmed = name.trim().replace(/^the /i, '');
  return BUILDING_NAMES.has(trimmed) ? trimmed : trimmed.replace(/(?<=[a-z])s$/, '');
};
const listed = (list: string): string[] => list.split(/, (?:and |or )?| and | or /).map(singular);
const pair = (producer: string, product: string): string => `${producer} > ${product}`;

/** The names a copy line's "Required for ..." sentence lists, singular. */
function namedAsRequiredFor(copy: string): string[] {
  const sentence = /\bRequired for ([^.]+)\./.exec(copy)?.[1];
  return sentence ? listed(sentence) : [];
}

/** Every "<Producer> can build|train <list>." of a line, as producer > product
 *  pairs. The sentence's start is looked back at, not consumed: a pattern that
 *  consumed the full stop before it skipped every second of two such sentences
 *  in a row (review round 4, R4-7). */
function statedAsMade(copy: string): string[] {
  const pairs: string[] = [];
  for (const [, producer, list] of copy.matchAll(/(?<=^|\. )((?:The )?[A-Z][A-Za-z ]*?) can (?:build|train) ([^.]+)\./g)) {
    for (const product of listed(list!)) pairs.push(pair(singular(producer!), product));
  }
  return pairs;
}

function placeable(age: AgeType, missingBuilding: BuildingType | null, missingTechnology: ResearchableTechnologyType | null): Set<string> {
  return new Set(buildOptionsFor(
    1,
    'villager',
    () => age,
    (_owner, buildingType) => buildingType !== missingBuilding,
    () => false,
    (_owner, technology) => technology !== missingTechnology,
  ));
}

function buildingRequiredFor(building: BuildingType): string[] {
  const needs = new Set<string>();
  for (const age of AGES) {
    const without = placeable(age, building, null);
    for (const other of placeable(age, null, null)) {
      if (!without.has(other)) needs.add(formatEntityName(other as BuildingType));
    }
  }
  return [...needs].sort();
}

/** Every producer > product the rules hold behind a technology. */
function heldBehind(technology: ResearchableTechnologyType): string[] {
  const held = new Set<string>();
  const trainOptions = (civilization: string, missing: ResearchableTechnologyType | null) => createTrainOptions({
    getPlayerAge: () => 'imperial-age',
    isAtLeastAge: () => true,
    hasTechnology: (_owner, candidate) => candidate !== missing && !candidate.endsWith('-upgrade'),
    latestResearchedInChain: (_owner, chain) => chain[0],
    getPlayerCivilization: () => civilization,
  });
  for (const civilization of CIVILIZATION_NAMES) {
    const withIt = trainOptions(civilization, null);
    const withoutIt = trainOptions(civilization, technology);
    for (const building of BUILDINGS) {
      const still = new Set(withoutIt(1, building));
      for (const unit of withIt(1, building)) {
        if (!still.has(unit)) held.add(pair(formatEntityName(building), formatEntityName(unit)));
      }
    }
  }
  for (const age of AGES) {
    const without = placeable(age, null, technology);
    for (const building of placeable(age, null, null)) {
      if (!without.has(building)) held.add(pair('Villager', formatEntityName(building as BuildingType)));
    }
  }
  return [...held].sort();
}

describe('"Required for" says what this game\'s rules need, no more and no less', () => {
  it('a building names every building that needs it standing, and only those', () => {
    const wrong: string[] = [];
    for (const building of BUILDINGS) {
      const needed = buildingRequiredFor(building);
      const said = namedAsRequiredFor(BUILDING_HELP[building]).sort();
      if (JSON.stringify(needed) !== JSON.stringify(said)) {
        wrong.push(`${building}: the rules need it for [${needed.join(', ')}], the tooltip says [${said.join(', ')}]`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('the Barracks is the building this game\'s Feudal buildings wait on (the derivation sees it)', () => {
    expect(buildingRequiredFor('barracks')).toEqual(['Archery Range', 'Blacksmith', 'Market', 'Stable', 'Watch Tower']);
    expect(buildingRequiredFor('mill')).toEqual([]);
  });

  it('a technology states exactly what the rules hold behind it: who makes what, or what it is required for', () => {
    const wrong: string[] = [];
    for (const technology of TECHNOLOGIES) {
      const held = heldBehind(technology);
      const copy = TECHNOLOGY_HELP[technology]!;
      const made = statedAsMade(copy);
      const falseClaims = made.filter((stated) => !held.includes(stated));
      const leftForRequired = [...new Set(held.filter((rule) => !made.includes(rule)).map((rule) => rule.split(' > ')[1]!))].sort();
      const required = namedAsRequiredFor(copy).sort();
      if (falseClaims.length > 0 || JSON.stringify(leftForRequired) !== JSON.stringify(required)) {
        wrong.push(`${technology}: the rules hold [${held.join('; ')}]; the tooltip states [${made.join('; ')}] and Required for [${required.join(', ')}]`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('the derivation sees each kind of wait: a unit, a unit at one building, a building', () => {
    expect(heldBehind('chemistry')).toEqual(['Archery Range > Hand Cannoneer', 'Siege Workshop > Bombard Cannon']);
    expect(heldBehind('anarchy')).toEqual(['Barracks > Huskarl']);
    expect(heldBehind('cannon-galleon-unlock')).toEqual(['Dock > Cannon Galleon']);
    expect(heldBehind('bombard-tower-unlock')).toEqual(['Villager > Bombard Tower']);
    expect(heldBehind('loom')).toEqual([]);
  });

  it('reads a relation whole, and only where the line states one', () => {
    // Chemistry's attack sentence names the Bombard Cannon too; only its
    // "Required for" sentence is the relation.
    const chemistry = TECHNOLOGY_HELP.chemistry!;
    expect(chemistry).toMatch(/Bombard Cannons \+1 attack/);
    expect(namedAsRequiredFor(chemistry).sort()).toEqual(['Bombard Cannon', 'Hand Cannoneer']);
    expect(namedAsRequiredFor(chemistry.replace(' and Bombard Cannons.', '.'))).toEqual(['Hand Cannoneer']);
    // The producer is part of the claim, and so is every name of its list.
    expect(statedAsMade('The Barracks can train Huskarls.')).toEqual(['Barracks > Huskarl']);
    expect(statedAsMade('The Stable can train Huskarls.')).toEqual(['Stable > Huskarl']);
    expect(statedAsMade('The Dock can build Cannon Galleons, Hand Cannoneers and Bombard Cannons.'))
      .toEqual(['Dock > Cannon Galleon', 'Dock > Hand Cannoneer', 'Dock > Bombard Cannon']);
    expect(statedAsMade('Villagers can build Bombard Towers.')).toEqual(['Villager > Bombard Tower']);
    // Two such sentences in a row are two claims, and one after another sentence is one.
    expect(statedAsMade('The Barracks can train Huskarls. The Stable can train Huskarls.'))
      .toEqual(['Barracks > Huskarl', 'Stable > Huskarl']);
    expect(statedAsMade('Infantry move faster. The Barracks can train Huskarls.')).toEqual(['Barracks > Huskarl']);
    expect(statedAsMade('Towers and Castles can shoot enemies standing right next to them.')).toEqual([]);
  });
});

// Whose garrison adds arrows: a building's shot counts ARCHER_LINE_UNITS inside
// it, and a tower its Villagers too (bridge/systems/towerCombatSystem.ts feeds
// `buildingArrowCount` those two counts), and a unit is inside only where
// `canGarrisonAt` lets it in. Review round 2 (R2-1) found the copy saying
// "archers inside add arrows", which a Chu Ko Nu or a Plumed Archer does not;
// round 3 (R3-1) found the repaired tower line naming the Cavalry Archer line,
// which no tower admits. So the set is derived from both rules here, and the
// lines name its unit lines.
function addsAnArrowInside(building: BuildingType): UnitType[] {
  const empty = buildingArrowCount(building, 0, 0, 0);
  return UNITS.filter((unit) => canGarrisonAt(building, unit)
    && buildingArrowCount(building, 1, isArcherLineUnit(unit) ? 1 : 0, unit === 'villager' ? 1 : 0) > empty).sort();
}

describe('a line that says whose garrison adds arrows names the units both rules give', () => {
  it('a Watch Tower: its Villagers, the Archer line and Longbowmen, and no Cavalry Archer, which it does not admit', () => {
    expect(addsAnArrowInside('watch-tower')).toEqual(['arbalest', 'archer', 'crossbowman', 'elite-longbowman', 'longbowman', 'villager']);
    expect(BUILDING_HELP['watch-tower']).toContain('Villagers, the Archer line and Longbowmen garrisoned inside add arrows.');
  });

  it('a Castle: the Archer and Cavalry Archer lines and Longbowmen, and no Villager', () => {
    expect(addsAnArrowInside('castle')).toEqual([
      'arbalest', 'archer', 'cavalry-archer', 'crossbowman', 'elite-longbowman', 'heavy-cavalry-archer', 'longbowman',
    ]);
    expect(BUILDING_HELP.castle).toContain('the Archer and Cavalry Archer lines and Longbowmen garrisoned inside add more.');
  });

  it('a Town Center: every unit it admits, as its line says; a Bombard Tower: none', () => {
    const admitted = UNITS.filter((unit) => canGarrisonAt('town-center', unit)).sort();
    expect(admitted.length).toBeGreaterThan(10);
    expect(addsAnArrowInside('town-center')).toEqual(admitted);
    expect(BUILDING_HELP['town-center']).toContain('one more for each unit garrisoned inside, up to 10');
    expect(addsAnArrowInside('bombard-tower')).toEqual([]);
  });

  it('no line says archers at large add arrows', () => {
    for (const [building, copy] of Object.entries(BUILDING_HELP)) {
      expect(copy, building).not.toMatch(/\b[Aa]rchers (?:and Villagers )?(?:garrisoned |inside )/);
    }
  });
});
