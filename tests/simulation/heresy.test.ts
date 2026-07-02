import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { convertedUnitDies } from '../../src/game/simulation/monasteryTechEffects';
import {
  researchCost,
  researchTimeTicks,
} from '../../src/game/simulation/prototypeEconomyRules';
import { canResearchAt } from '../../src/game/simulation/prototypeBuildingRules';
import type { ResearchableTechnologyType } from '../../src/game/simulation/types';
import { selectOwnedUnitDirect } from './createSimulationBridge.helpers';

// Heresy (v0.1.71): a Castle-Age Monastery tech (technologies.csv:66, 1000 gold,
// "Converted units die"). When an enemy monk would convert a unit whose OWNER
// has Heresy, the unit DIES instead of switching sides — denying it to the
// converter. DERIVED at the conversion flip site (applyMonkConvert): the target
// owner's researched set already read there for Faith; if it has 'heresy', the
// target is destroyed rather than flipped. No fixture gives Heresy by default,
// so all existing conversions flip normally (byte-identical).

type Bridge = ReturnType<typeof createSimulationBridge>;

const NO_TECHS: ReadonlySet<ResearchableTechnologyType> = new Set();
const HERESY_ONLY: ReadonlySet<ResearchableTechnologyType> = new Set([
  'heresy',
] as ResearchableTechnologyType[]);

function findUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

function findUnitById(bridge: Bridge, id: number) {
  return bridge.getEconomyState().units.find((unit) => unit.id === id);
}

describe('Heresy — pure predicate + cost/gating', () => {
  it('convertedUnitDies is true only when the target owner has Heresy', () => {
    expect(convertedUnitDies(HERESY_ONLY)).toBe(true);
    expect(convertedUnitDies(NO_TECHS)).toBe(false);
  });

  it('costs 1000 gold and takes 600 ticks, researchable only at the Monastery', () => {
    expect(researchCost('heresy')).toEqual({ gold: 1000 });
    expect(researchTimeTicks('heresy')).toBe(600);
    expect(canResearchAt('monastery', 'heresy')).toBe(true);
    expect(canResearchAt('town-center', 'heresy')).toBe(false);
    expect(canResearchAt('barracks', 'heresy')).toBe(false);
  });
});

describe('Heresy — converted units die instead of flipping', () => {
  function startConvert(bridge: Bridge, militiaId: number): void {
    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(militiaId)).toBe(true);
  }

  it('WITHOUT Heresy: the enemy monk converts the militia (it flips owner) — baseline unchanged', () => {
    const bridge = createSimulationBridge('monk-convert-fixture');
    const militia = findUnit(bridge, 2, 'militia');
    expect(militia).toBeDefined();
    const militiaId = militia!.id;

    startConvert(bridge, militiaId);
    for (let i = 0; i < 120; i += 1) bridge.step(100);

    const after = findUnitById(bridge, militiaId);
    expect(after).toBeDefined();
    expect(after!.owner).toBe(1); // flipped to the monk's owner
  }, 30_000);

  it('WITH Heresy on the target owner: the militia DIES instead of flipping', () => {
    const bridge = createSimulationBridge('monk-convert-heresy-fixture');
    const militia = findUnit(bridge, 2, 'militia');
    expect(militia).toBeDefined();
    const militiaId = militia!.id;

    startConvert(bridge, militiaId);
    for (let i = 0; i < 120; i += 1) bridge.step(100);

    // The militia is gone entirely — not owned by the monk's owner, not by
    // anyone. (Contrast the baseline above where it flips to owner 1.)
    expect(findUnitById(bridge, militiaId)).toBeUndefined();
    expect(findUnit(bridge, 1, 'militia')).toBeUndefined();
  }, 30_000);
});
