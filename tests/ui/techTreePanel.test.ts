// The technology-tree viewer's MODEL (spec §11.3, v0.3.157): denied content
// is shown as unavailable rather than hidden, other civs' uniques do not
// appear, and your own uniques do — all derived from the same hosting tables
// and civDenies the validators play by.

import { describe, expect, it } from 'vitest';

import { buildTechTreeModel } from '../../src/ui/hud/techTreePanel';

function section(civ: string, building: string) {
  const model = buildTechTreeModel(civ);
  const found = model.find((s) => s.building === building);
  if (!found) throw new Error(`no ${building} section for ${civ}`);
  return found;
}

describe('buildTechTreeModel', () => {
  it('marks Frankish holes denied instead of hiding them', () => {
    const smith = section('Franks', 'blacksmith');
    const bracer = smith.technologies.find((t) => t.id === 'bracer');
    expect(bracer?.denied).toBe(true);
    const fletching = smith.technologies.find((t) => t.id === 'fletching');
    expect(fletching?.denied).toBe(false);
  });

  it('shows only the civilization\'s own unique units at the Castle', () => {
    const britonCastle = section('Britons', 'castle');
    expect(britonCastle.units.some((u) => u.id === 'longbowman')).toBe(true);
    expect(britonCastle.units.some((u) => u.id === 'mangudai')).toBe(false);
    const mongolCastle = section('Mongols', 'castle');
    expect(mongolCastle.units.some((u) => u.id === 'mangudai')).toBe(true);
    expect(mongolCastle.units.some((u) => u.id === 'longbowman')).toBe(false);
  });

  it('keeps the meso stable ABSENT-of-units but marks the building holes on the card', () => {
    // Aztecs: every stable unit is denied — the section still lists them,
    // dimmed, so the player can SEE the hole (the §11.3 rule).
    const stable = section('Aztecs', 'stable');
    expect(stable.units.length).toBeGreaterThan(0);
    expect(stable.units.every((u) => u.denied)).toBe(true);
    // A cavalry civ reads the same list mostly available.
    const frankStable = section('Franks', 'stable');
    expect(frankStable.units.some((u) => u.id === 'knight' && !u.denied)).toBe(true);
  });

  it('never lists another civilization\'s unique technology', () => {
    const britonCastleTechs = section('Britons', 'castle').technologies.map((t) => t.id);
    expect(britonCastleTechs).toContain('yeomen');
    expect(britonCastleTechs).not.toContain('atheism');
  });
});
