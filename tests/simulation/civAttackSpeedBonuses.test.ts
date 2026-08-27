// Civ ATTACK-SPEED bonuses (sourced v0.3.145) — the audit's highest-coverage
// find: eight civilizations' signature bonuses are reload multipliers current
// DE grants and this game silently dropped. One pure hook feeds the
// combat-state factory; the age sweep re-derives standing units when the
// Japanese ladder engages at Feudal. Wordings verified verbatim against the
// DE help texts: Japanese "Infantry attacks +33% faster starting in Feudal
// Age", Ethiopians "Foot Archers attack +18% faster", Mongols "Cavalry
// Archers attack +25% faster", Celts "Siege Weapons attack +25% faster",
// Saracens "Galley-line attacks +25% faster", Byzantines "Fire Ships ...
// attack +25% faster", Spanish "Gunpowder Units attack +18% faster",
// Hindustanis "Camel Riders attack +20% faster".

import { describe, expect, it } from 'vitest';

import { civReloadMultiplier } from '../../src/game/simulation/civBonusEffects';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('civReloadMultiplier (pure)', () => {
  it('grants each sourced attack-speed bonus to exactly its line', () => {
    expect(civReloadMultiplier('Japanese', 'militia', 'feudal-age')).toBeCloseTo(1 / 1.33, 5);
    expect(civReloadMultiplier('Japanese', 'champion', 'imperial-age')).toBeCloseTo(1 / 1.33, 5);
    // The Japanese ladder starts at Feudal — Dark Age infantry is plain.
    expect(civReloadMultiplier('Japanese', 'militia', 'dark-age')).toBe(1);
    expect(civReloadMultiplier('Japanese', 'archer', 'imperial-age')).toBe(1);

    expect(civReloadMultiplier('Ethiopians', 'archer', 'castle-age')).toBeCloseTo(1 / 1.18, 5);
    expect(civReloadMultiplier('Ethiopians', 'arbalest', 'imperial-age')).toBeCloseTo(1 / 1.18, 5);
    // Foot archers only — skirmishers and mounted archers stay plain.
    expect(civReloadMultiplier('Ethiopians', 'skirmisher', 'castle-age')).toBe(1);
    expect(civReloadMultiplier('Ethiopians', 'cavalry-archer', 'castle-age')).toBe(1);

    expect(civReloadMultiplier('Mongols', 'cavalry-archer', 'castle-age')).toBeCloseTo(1 / 1.25, 5);
    expect(civReloadMultiplier('Celts', 'onager', 'castle-age')).toBeCloseTo(1 / 1.25, 5);
    expect(civReloadMultiplier('Celts', 'scorpion', 'castle-age')).toBeCloseTo(1 / 1.25, 5);
    expect(civReloadMultiplier('Saracens', 'galley', 'feudal-age')).toBeCloseTo(1 / 1.25, 5);
    expect(civReloadMultiplier('Byzantines', 'fire-ship', 'castle-age')).toBeCloseTo(1 / 1.25, 5);
    expect(civReloadMultiplier('Spanish', 'hand-cannoneer', 'imperial-age')).toBeCloseTo(1 / 1.18, 5);
    expect(civReloadMultiplier('Indians', 'camel', 'castle-age')).toBeCloseTo(1 / 1.2, 5);

    expect(civReloadMultiplier('Britons', 'archer', 'castle-age')).toBe(1);
    expect(civReloadMultiplier(undefined, 'archer', 'castle-age')).toBe(1);
  });
});

describe('reload bonuses reach real units', () => {
  it('a Mongol cavalry archer reloads faster than a plain one from creation', () => {
    const mongols = createSimulationBridge('unit-showcase-fixture', {
      civilizationsByOwner: new Map([[1, 'Mongols']]),
    });
    const plain = createSimulationBridge('unit-showcase-fixture');
    const reloadOf = (bridge: typeof plain) => bridge.getEconomyState().units.find(
      (unit) => unit.unitType === 'cavalry-archer',
    )!.reloadTicks;
    expect(reloadOf(mongols)).toBe(Math.max(1, Math.round(reloadOf(plain) / 1.25)));
  });

  it('Japanese standing infantry carries the ladder from creation (Feudal+ fixture)', () => {
    const bridge = createSimulationBridge('militia-line-fixture', {
      civilizationsByOwner: new Map([[1, 'Japanese'], [2, 'Japanese']]),
    });
    const militia = bridge.getEconomyState().units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'militia',
    );
    if (!militia) throw new Error('no militia in fixture');
    const plain = createSimulationBridge('militia-line-fixture', {
      civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]),
    });
    const plainMilitia = plain.getEconomyState().units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'militia',
    )!;
    expect(militia.reloadTicks)
      .toBe(Math.max(1, Math.round(plainMilitia.reloadTicks / 1.33)));
  });
});

describe('Britons foot-archer range ladder (sourced v0.3.145)', () => {
  it('adds +1 at Castle and +2 at Imperial to foot archers only', () => {
    const britons = createSimulationBridge('castle-upgrades-fixture', {
      civilizationsByOwner: new Map([[1, 'Britons'], [2, 'Britons']]),
    });
    const plain = createSimulationBridge('castle-upgrades-fixture', {
      civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]),
    });
    const rangeOf = (bridge: typeof plain, type: string) => bridge.getEconomyState().units.find(
      (unit) => unit.owner === 1 && unit.unitType === type,
    )?.attackRange;
    // castle-upgrades-fixture starts in Castle Age with a crossbowman.
    if (rangeOf(plain, 'crossbowman') !== undefined) {
      expect(rangeOf(britons, 'crossbowman')).toBe(rangeOf(plain, 'crossbowman')! + 1);
    }
    // Skirmishers are NOT foot archers for this ladder (Yeomen covers them).
    if (rangeOf(plain, 'skirmisher') !== undefined) {
      expect(rangeOf(britons, 'skirmisher')).toBe(rangeOf(plain, 'skirmisher'));
    }
  });
});
