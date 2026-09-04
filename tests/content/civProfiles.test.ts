// Civ-profile gate (v0.3.194): design/stats/civilizations.csv is the spec of
// record for what each civilization IS (spec §11.4), and the in-game
// Civilizations compendium (§11.14) reads it at runtime through an EMBEDDED
// copy, because the browser build cannot open design/stats. Two ways that
// could lie to a player, both gated here:
//
//   1. the embedded copy drifting from the file — guarded byte-for-byte;
//   2. this module's parser reading the same bytes DIFFERENTLY from the
//      content pipeline's own parser (scripts/content-lib.mjs) — guarded by
//      deep-equality against what the build itself extracts, so a quoting or
//      splitting divergence fails by name instead of silently showing the
//      player one thing while the build believes another.
//
// Bound: this proves the TEXT is faithful to the CSV, not that the simulation
// implements every bonus line the CSV states — §11.11 tracks that coverage,
// and the compendium marks per-civ what is live via the runtime tables.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildContentBundle } from '../../scripts/content-lib.mjs';
import {
  CIV_PROFILES,
  EMBEDDED_CIVILIZATIONS_CSV,
  civProfileFor,
} from '../../src/game/simulation/civProfiles';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';

const normalize = (raw: string): string => raw
  .replace(/\r/g, '')
  .split('\n')
  .filter((line) => line.trim() && !line.trim().startsWith('#'))
  .join('\n')
  .trim();

describe('the embedded civilization table', () => {
  it('matches the CSV line for line (minus comment lines)', () => {
    const csv = normalize(readFileSync('design/stats/civilizations.csv', 'utf-8'));
    expect(normalize(EMBEDDED_CIVILIZATIONS_CSV)).toBe(csv);
  });

  it('parses to exactly what the content pipeline reads from the same file', () => {
    // `content-lib.mjs` is untyped on purpose (the build reads it too), so the
    // shape this test relies on is named here rather than inferred as `any`.
    interface PipelineCiv {
      name: string;
      expansion: string;
      armyType: string;
      uniqueUnits: string[];
      uniqueTechs: string[];
      teamBonuses: string[];
      civilizationBonuses: string[];
    }
    const civilizations = buildContentBundle().civilizations as PipelineCiv[];
    const fromPipeline = civilizations.map((civ) => ({
      name: civ.name,
      expansion: civ.expansion,
      armyType: civ.armyType,
      uniqueUnits: civ.uniqueUnits,
      uniqueTechnologies: civ.uniqueTechs,
      teamBonuses: civ.teamBonuses,
      civilizationBonuses: civ.civilizationBonuses,
    }));
    const fromRuntime = CIV_PROFILES.map((profile) => ({
      name: profile.name,
      expansion: profile.expansion,
      armyType: profile.armyType,
      uniqueUnits: [...profile.uniqueUnits],
      uniqueTechnologies: [...profile.uniqueTechnologies],
      teamBonuses: [...profile.teamBonuses],
      civilizationBonuses: [...profile.civilizationBonuses],
    }));
    expect(fromRuntime).toEqual(fromPipeline);
  });

  it('covers every roster civilization, and names no civilization the roster lacks', () => {
    const profiled = CIV_PROFILES.map((profile) => profile.name).sort();
    expect(profiled).toEqual([...CIVILIZATION_NAMES].sort());
  });

  it('gives every civilization an army type, a team bonus, and civ bonuses', () => {
    const thin = CIV_PROFILES.filter((profile) => (
      profile.expansion === ''
      || profile.armyType === ''
      || profile.teamBonuses.length === 0
      || profile.civilizationBonuses.length === 0
    )).map((profile) => profile.name);
    expect(thin).toEqual([]);
  });

  it('keeps a comma-bearing quoted bonus as ONE line, not several', () => {
    // The Indians' villager-cost line is quoted BECAUSE it contains commas;
    // a naive comma split would shatter it into four half-sentences.
    const indians = civProfileFor('Indians');
    expect(indians?.civilizationBonuses[0]).toBe(
      'Villagers cost -8% Dark, -13% Feudal, -18% Castle, -23% Imperial',
    );
    // ...and the two unquoted lines that follow it survive the same cell.
    expect(indians?.civilizationBonuses).toHaveLength(3);
  });

  it('splits multi-valued unique columns (Goths have two unique technologies)', () => {
    expect(civProfileFor('Goths')?.uniqueTechnologies).toEqual(['Anarchy', 'Perfusion']);
    expect(civProfileFor('Koreans')?.uniqueUnits).toEqual(['War Wagon', 'Turtle Ship']);
  });

  it('returns undefined for a civilization that does not exist', () => {
    expect(civProfileFor('Atlanteans')).toBeUndefined();
  });
});
