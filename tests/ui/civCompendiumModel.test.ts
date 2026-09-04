// The civilization compendium's model (spec §11.4, §11.14).
//
// BOUND: this checks the JOIN between the design text and the runtime tables,
// and the search over it. It does not check that a bonus line the CSV states is
// actually implemented — `bonusesWired` says only that `civBonusTable` has an
// entry for the civilization, not that every line in it is honoured. §11.11
// tracks that coverage.

import { describe, expect, it } from 'vitest';

import {
  buildCivCompendium,
  filterCivCompendium,
} from '../../src/ui/hud/civCompendiumModel';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { uniqueUnitsFor } from '../../src/game/simulation/uniqueUnits';
import { uniqueTechnologiesFor } from '../../src/game/simulation/uniqueTechnologies';
import { formatEntityName } from '../../src/ui/hud/displayNames/entityNames';
import { formatTechnologyName } from '../../src/ui/hud/displayNames/formatters';

describe('the civilization compendium model', () => {
  const entries = buildCivCompendium();

  it('covers every civilization the game offers', () => {
    expect(entries.map((entry) => entry.name).sort()).toEqual([...CIVILIZATION_NAMES].sort());
  });

  it('gives every civilization the text that distinguishes it', () => {
    const thin = entries.filter((entry) => (
      entry.expansion === ''
      || entry.armyType === ''
      || entry.uniqueUnits.length === 0
      || entry.teamBonuses.length === 0
      || entry.civilizationBonuses.length === 0
    )).map((entry) => entry.name);
    expect(thin).toEqual([]);
  });

  // The join is by DISPLAY NAME across two tables that share nothing else, so
  // a formatter change is exactly how it would silently break: every unit
  // would read as "not in the game" and the panel would still render.
  it('marks a unique unit live if and only if the simulation can train it', () => {
    for (const entry of entries) {
      const implemented = new Set(
        uniqueUnitsFor(entry.name).map((unit) => formatEntityName(unit.unitType)),
      );
      for (const feature of entry.uniqueUnits) {
        expect(feature.live, `${entry.name}: ${feature.name}`).toBe(implemented.has(feature.name));
      }
      // …and nothing the simulation trains for this civ is missing from the
      // design text, which would mean the CSV and the tables disagree.
      for (const name of implemented) {
        expect(
          entry.uniqueUnits.map((feature) => feature.name),
          `${entry.name} trains ${name}, which its CSV row does not name`,
        ).toContain(name);
      }
    }
  });

  it('marks a unique technology live if and only if the simulation has it', () => {
    for (const entry of entries) {
      const implemented = new Set(
        uniqueTechnologiesFor(entry.name).map((tech) => formatTechnologyName(tech.id)),
      );
      for (const feature of entry.uniqueTechnologies) {
        expect(feature.live, `${entry.name}: ${feature.name}`).toBe(implemented.has(feature.name));
      }
      for (const name of implemented) {
        expect(
          entry.uniqueTechnologies.map((feature) => feature.name),
          `${entry.name} researches ${name}, which its CSV row does not name`,
        ).toContain(name);
      }
    }
  });

  // The whole point of the panel is that it does not promise what the game
  // cannot deliver, so at least one civilization must be marked incomplete and
  // at least one complete — otherwise the flag is carrying no information and
  // would look identical if it were hard-coded.
  it('separates the civilizations this game fully implements from the rest', () => {
    const complete = entries.filter((entry) => entry.fullyImplemented).map((e) => e.name);
    const incomplete = entries.filter((entry) => !entry.fullyImplemented).map((e) => e.name);
    expect(complete.length).toBeGreaterThan(0);
    expect(incomplete.length).toBeGreaterThan(0);
    expect(complete).toContain('Britons');
    expect(incomplete).toContain('Vietnamese');
  });

  it('finds a civilization by name, and finds none for a name it does not have', () => {
    expect(filterCivCompendium(entries, 'goth').map((e) => e.name)).toEqual(['Goths']);
    expect(filterCivCompendium(entries, 'Atlanteans')).toEqual([]);
    expect(filterCivCompendium(entries, '   ')).toHaveLength(entries.length);
  });

  it('searches the bonus text, which is how "which civs do X" is asked', () => {
    const elephants = filterCivCompendium(entries, 'elephant').map((entry) => entry.name);
    expect(elephants).toContain('Persians');
    expect(elephants).toContain('Khmer');
    expect(elephants).not.toContain('Britons');

    // A team bonus is searchable too, and this one is stated ONLY there.
    expect(filterCivCompendium(entries, 'Archery Ranges work').map((e) => e.name))
      .toEqual(['Britons']);
  });
});
