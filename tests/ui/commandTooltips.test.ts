// A command's tooltip, as Definitive Edition's help text has it (work 148 M2):
// a title line with DE's verb, the name and the price in brackets, then what
// the unit, building or technology DOES, then what it needs. DE's strings, read
// from the install (resources/en/strings/key-value/key-value-strings-utf8.txt):
// 26121 "Create <b>Villager<b> (<cost>)\nGathers resources. ...", 28022 "Research
// <b>Loom<b> (<cost>)\nVillagers +15 HP ...", 26344 "Build <b>House<b> (<cost>)
// \nProvides 5 population. ...", 28100 "Upgrade to <b>Crossbowman<b> ...", and
// 28101 "Advance to <b>Feudal Age<b> (<cost>; two Dark Age buildings)\n...
// Before you can advance, you must have any two Dark Age buildings: ...".
// Until M2 the tooltip gave a price and a time and said nothing of what the
// thing did ("Research Loom. Cost: 50 gold; takes 25s."), and the Feudal
// Age's named its buildings only while the player lacked them.
//
// v0.1.88 and work 125, still held: the price is the one the formatter is
// HANDED (the simulation's per-owner price from SelectionState.commandCosts),
// never a table lookup of its own; with none handed in, none is quoted.

import { describe, expect, it } from 'vitest';

import {
  formatBuildTooltip,
  formatResearchTooltip,
  formatResourceCost,
  formatTrainTooltip,
  withRefusal,
} from '../../src/ui/hud/tooltips';
import { BUILDING_HELP } from '../../src/ui/hud/helpText/buildingHelp';
import { GENERAL_TECHNOLOGY_HELP } from '../../src/ui/hud/helpText/technologyHelp';
import { UNIT_HELP } from '../../src/ui/hud/helpText/unitHelp';
import { UPGRADE_TECHNOLOGY_HELP } from '../../src/ui/hud/helpText/upgradeHelp';
import type { BuildingType, ResearchableTechnologyType, UnitType } from '../../src/game/simulation/types';

const lines = (tooltip: string): string[] => tooltip.split('\n');

describe('formatResourceCost — human-readable resource cost', () => {
  it('lists the non-zero resources in food/wood/gold/stone order', () => {
    expect(formatResourceCost({ food: 60, gold: 20 })).toBe('60 food, 20 gold');
    expect(formatResourceCost({ wood: 25, food: 35 })).toBe('35 food, 25 wood');
    expect(formatResourceCost({ stone: 125 })).toBe('125 stone');
  });

  it('says "nothing" for an empty cost (defensive)', () => {
    expect(formatResourceCost({})).toBe('nothing');
  });
});

describe('a unit: "Create", its name and price, then what it does', () => {
  it('a Villager gathers, builds and repairs', () => {
    const [title, effect, ...rest] = lines(formatTrainTooltip('villager', { food: 50 }));
    expect(title).toBe('Create Villager (50 food)');
    expect(effect).toMatch(/^Gathers resources, and builds and repairs buildings\b/);
    expect(rest).toEqual([]);
  });

  it('a soldier says what it is strong and weak against', () => {
    const [, effect] = lines(formatTrainTooltip('spearman', { food: 35, wood: 25 }));
    expect(effect).toContain('Strong vs. cavalry');
    expect(effect).toContain('Weak vs. archers');
  });

  it('quotes a discounted price as given, not the table row', () => {
    expect(lines(formatTrainTooltip('fishing-ship', { wood: 64 }))[0]).toBe('Build Fishing Ship (64 wood)');
  });

  // DE's own strings: 26381 "Build <b>Trebuchet<b>", 26100 "Build <b>Trade Cart<b>",
  // 26660 "Create <b>Petard<b>", 26727 "Create <b>War Wagon<b>".
  it('a siege weapon, a ship and a trade unit are built, everyone else created', () => {
    expect(lines(formatTrainTooltip('trebuchet', undefined))[0]).toBe('Build Trebuchet');
    expect(lines(formatTrainTooltip('trade-cart', undefined))[0]).toBe('Build Trade Cart');
    expect(lines(formatTrainTooltip('galley', undefined))[0]).toBe('Build Galley');
    expect(lines(formatTrainTooltip('petard', undefined))[0]).toBe('Create Petard');
    expect(lines(formatTrainTooltip('war-wagon', undefined))[0]).toBe('Create War Wagon');
  });

  it('quotes no price at all when none is handed in', () => {
    expect(lines(formatTrainTooltip('militia', undefined))[0]).toBe('Create Militia');
  });

  it('claims no production queue slot: this game has no queue cap (work 148 M1)', () => {
    expect(formatTrainTooltip('villager', { food: 50 })).not.toMatch(/queue/i);
  });

  // Review round 2, R2-2: a click on a far shore only sails the ship there, and
  // the unload is a click from within three cells (bridge/contextRouter.ts,
  // garrisonOps.ts); the first line told the player one click put them ashore.
  it('a Transport Ship\'s line gives the unload its two steps', () => {
    const [, effect] = lines(formatTrainTooltip('transport-ship', { wood: 125 }));
    expect(effect).toContain('sail it beside the shore, then right-click the shore');
  });
});

describe('a technology: DE\'s verb, its name, price and time, then what it does', () => {
  it('Loom: villagers +15 hit points and +1/+2 armor, in 25 seconds', () => {
    const [title, effect, ...rest] = lines(formatResearchTooltip('loom', { gold: 50 }));
    expect(title).toBe('Research Loom (50 gold; 25s)');
    expect(effect).toBe('Villagers +15 hit points, +1 melee armor and +2 pierce armor.');
    expect(rest).toEqual([]);
  });

  it('a unit-line upgrade says "Upgrade to" and what the new unit improves', () => {
    const [title, effect] = lines(formatResearchTooltip('crossbowman-upgrade', { food: 125, gold: 75 }));
    expect(title).toBe('Upgrade to Crossbowman (125 food, 75 gold; 35s)');
    expect(effect).toMatch(/^Archers become Crossbowmen\b/);
  });

  it('quotes Spies at its live figure, with the per-villager rule on a line of its own', () => {
    const tip = formatResearchTooltip('spies', { gold: 600 });
    expect(lines(tip)[0]).toBe('Research Spies (600 gold; 1s)');
    expect(lines(tip)).toContain('Costs 200 gold per enemy villager, halved by Atheism.');
  });

  it('quotes no price at all when none is handed in, and keeps the time', () => {
    expect(lines(formatResearchTooltip('loom', undefined))[0]).toBe('Research Loom (25s)');
  });
});

describe('an age states the buildings it needs, in its title and its text, always', () => {
  it('the Feudal Age: two Dark Age buildings, named', () => {
    const [title, effect, needs] = lines(formatResearchTooltip('feudal-age', { food: 500 }));
    expect(title).toBe('Advance to Feudal Age (500 food; 130s; two Dark Age buildings)');
    expect(effect).toMatch(/new buildings/);
    expect(needs).toBe('Before you can advance, you need any two Dark Age buildings: Mill, Lumber Camp, Mining Camp, Barracks, or Dock.');
  });

  it('the Castle Age: two Feudal Age buildings, named', () => {
    const tip = formatResearchTooltip('castle-age', { food: 800, gold: 200 });
    expect(lines(tip)[0]).toBe('Advance to Castle Age (800 food, 200 gold; 160s; two Feudal Age buildings)');
    expect(lines(tip)).toContain('Before you can advance, you need any two Feudal Age buildings: Stable, Archery Range, Blacksmith, or Market.');
  });

  it('the Imperial Age: a Castle, or two Castle Age buildings', () => {
    const tip = formatResearchTooltip('imperial-age', { food: 1000, gold: 800 });
    expect(lines(tip)[0]).toBe('Advance to Imperial Age (1000 food, 800 gold; 190s; two Castle Age buildings or a Castle)');
    expect(lines(tip)).toContain('Before you can advance, you need a Castle or any two Castle Age buildings: University, Siege Workshop, or Monastery.');
  });

  // While the player lacks the buildings the simulation's refusal names them
  // too, with its count, so the tooltip says them once: the refusal's line
  // stands for the requirement's. The title's bracket says it either way.
  it('says the buildings once while the refusal of the simulation names them', () => {
    const refusal = 'Needs 2 completed Dark Age buildings (Mill, Lumber Camp, Mining Camp, Barracks, or Dock). You have 1.';
    expect(lines(formatResearchTooltip('feudal-age', { food: 500 }, refusal))).toEqual([
      'Advance to Feudal Age (500 food; 130s; two Dark Age buildings)',
      expect.stringMatching(/new buildings/),
      refusal,
    ]);
  });

  it('keeps the requirement beside a refusal that is about something else', () => {
    expect(lines(formatResearchTooltip('feudal-age', { food: 500 }, 'Not enough food.'))).toEqual([
      'Advance to Feudal Age (500 food; 130s; two Dark Age buildings)',
      expect.stringMatching(/new buildings/),
      'Before you can advance, you need any two Dark Age buildings: Mill, Lumber Camp, Mining Camp, Barracks, or Dock.',
      'Not enough food.',
    ]);
  });

  // The other refusals the simulation gives an age (bridge/researchAvailability.ts
  // `ageUpSummary`): the wrong age names no building, so the requirement stays;
  // the Imperial Age's names its three buildings and the Castle, so it stands
  // for the requirement (review round 2).
  it('keeps the requirement beside the wrong-age refusal, and lets the Imperial refusal stand for it', () => {
    const wrongAge = 'Needs the Feudal Age — you are in the Dark Age.';
    expect(lines(formatResearchTooltip('castle-age', { food: 800, gold: 200 }, wrongAge)).slice(-2)).toEqual([
      'Before you can advance, you need any two Feudal Age buildings: Stable, Archery Range, Blacksmith, or Market.',
      wrongAge,
    ]);
    const imperial = 'Needs 2 completed Castle Age buildings (University, Siege Workshop, Monastery, or Castle), or one completed Castle. You have 0.';
    const tip = lines(formatResearchTooltip('imperial-age', { food: 1000, gold: 800 }, imperial));
    expect(tip).toHaveLength(3);
    expect(tip.at(-1)).toBe(imperial);
  });
});

describe('a building: "Build", its name and price, then what it does', () => {
  it('a House supports five population', () => {
    const [title, effect] = lines(formatBuildTooltip('house', { wood: 25 }));
    expect(title).toBe('Build House (25 wood)');
    expect(effect).toMatch(/^Supports 5 population\./);
  });

  it('quotes no price at all when none is handed in', () => {
    expect(lines(formatBuildTooltip('barracks', undefined))[0]).toBe('Build Barracks');
  });
});

describe('a refusal is a line of its own after what the control does', () => {
  it('appends the simulation\'s reason, and nothing without one', () => {
    expect(withRefusal('Build House (25 wood)\nSupports 5 population.', 'Not enough wood.'))
      .toBe('Build House (25 wood)\nSupports 5 population.\nNot enough wood.');
    expect(withRefusal('Build House (25 wood)', undefined)).toBe('Build House (25 wood)');
  });
});

// Every unit, building and technology has a line, and each line can sit in an
// HTML attribute and on one line of its own: no markup, no line break, a
// sentence's full stop, and DE's terse length.
describe('every unit, building and technology says what it does', () => {
  const tables: Array<[string, Readonly<Record<string, string>>]> = [
    ['unit', UNIT_HELP],
    ['building', BUILDING_HELP],
    ['technology', { ...GENERAL_TECHNOLOGY_HELP, ...UPGRADE_TECHNOLOGY_HELP }],
  ];

  it.each(tables)('each %s line is one plain sentence or more, at most 200 characters', (_kind, table) => {
    for (const [id, copy] of Object.entries(table)) {
      expect(copy.trim(), id).toBe(copy);
      expect(copy, id).toMatch(/\.$/);
      expect(copy, id).not.toMatch(/[\n"<>&]|<b>|<i>/);
      expect(copy.length, id).toBeGreaterThan(10);
      expect(copy.length, id).toBeLessThanOrEqual(200);
    }
  });

  it('draws a second line for every one of them', () => {
    for (const unitType of Object.keys(UNIT_HELP) as UnitType[]) {
      expect(lines(formatTrainTooltip(unitType, { food: 1 })).length, unitType).toBe(2);
    }
    for (const buildingType of Object.keys(BUILDING_HELP) as BuildingType[]) {
      expect(lines(formatBuildTooltip(buildingType, { wood: 1 })).length, buildingType).toBe(2);
    }
    const technologies = Object.keys({ ...GENERAL_TECHNOLOGY_HELP, ...UPGRADE_TECHNOLOGY_HELP }) as ResearchableTechnologyType[];
    for (const technologyType of technologies) {
      expect(lines(formatResearchTooltip(technologyType, { gold: 1 })).length, technologyType).toBeGreaterThanOrEqual(2);
    }
  });
});
