import { describe, expect, it } from 'vitest';

import {
  BERSERK_REGEN_HP_PER_TICK,
  regenPerTick,
  regenStep,
  regeneratesOnItsOwn,
} from '../../src/game/simulation/unitRegeneration';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { combatStatesCodec, researchedTechnologiesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { DEFERRED_UNIQUE_TECHNOLOGIES, uniqueTechnology } from '../../src/game/simulation/uniqueTechnologies';
import { researchCost } from '../../src/game/simulation/prototypeEconomyRules';
import { canResearchAt } from '../../src/game/simulation/prototypeBuildingRules';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';
import type { ResearchableTechnologyType } from '../../src/game/simulation/types';

// Age of Empires II gives self-healing to exactly one line, the Vikings'
// Berserk, and Berserkergang doubles it — technologies.csv, "Berserks
// regenerate 2x faster - 2 HP every 3 seconds". The technology sat on the
// deferred list with the note "no unit regenerates", so the MECHANIC was the
// work and the technology cost two lines after it.

const NONE: ReadonlySet<ResearchableTechnologyType> = new Set();
const TECHED: ReadonlySet<ResearchableTechnologyType> = new Set(['berserkergang']);

describe('which units heal themselves', () => {
  it('is the Berserk line and nothing else', () => {
    expect(regeneratesOnItsOwn('berserk')).toBe(true);
    expect(regeneratesOnItsOwn('elite-berserk')).toBe(true);
    for (const unitType of ['militia', 'knight', 'villager', 'monk', 'huskarl'] as const) {
      expect(regeneratesOnItsOwn(unitType)).toBe(false);
      expect(regenPerTick(unitType, TECHED)).toBe(0);
    }
  });

  it('heals a Berserk one hit point every three seconds, and two with the technology', () => {
    // 10 ticks per second, so three seconds is 30 ticks.
    expect(BERSERK_REGEN_HP_PER_TICK * 30).toBeCloseTo(1, 10);
    expect(regenPerTick('berserk', NONE)).toBeCloseTo(BERSERK_REGEN_HP_PER_TICK, 10);
    expect(regenPerTick('berserk', TECHED))
      .toBeCloseTo(BERSERK_REGEN_HP_PER_TICK * 2, 10);
    expect(regenPerTick('elite-berserk', TECHED) * 30).toBeCloseTo(2, 10);
  });
});

describe('the regeneration step', () => {
  it('never revives the dead', () => {
    expect(regenStep(0, 60, 1)).toBe(0);
    expect(regenStep(-5, 60, 1)).toBe(-5);
  });

  it('never over-heals the whole', () => {
    expect(regenStep(60, 60, 1)).toBe(60);
    expect(regenStep(59.5, 60, 1)).toBe(60);
  });

  it('does nothing at a zero rate, which is every other unit', () => {
    expect(regenStep(30, 60, 0)).toBe(30);
  });
});

describe('Berserkergang — the technology', () => {
  it('is a Viking Castle technology, priced from the CSV, and no longer deferred', () => {
    const technology = uniqueTechnology('berserkergang');
    expect(technology?.civilization).toBe('Vikings');
    expect(researchCost('berserkergang')).toEqual({ food: 850, gold: 400 });
    // The doubling lives with the other unique-technology effects.
    expect(technology?.regenMultiplier).toBe(2);
    expect(canResearchAt('castle', 'berserkergang')).toBe(true);
    expect([...DEFERRED_UNIQUE_TECHNOLOGIES]).not.toContain('berserkergang');
  });
});

describe('a wounded Berserk heals itself in a real match', () => {
  function healedAfter(ticks: number, researched: readonly string[]): number {
    const boot = createSimulationBridge('unit-showcase-fixture');
    const berserk = boot.getEconomyState().units.find((unit) => unit.unitType === 'berserk');
    expect(berserk, 'the showcase fixture should stand a berserk').toBeDefined();

    // Wound it through world state — there is no "take damage" command — then
    // let the match run and read the hit points back.
    const blob = asSchema2Blob(boot.saveGame());
    const combat = worldStateOf(blob)[combatStatesCodec.slot] as Array<[number, {
      currentHp: number; maxHp: number;
    }]>;
    const entry = combat.find(([id]) => id === berserk!.id)!;
    entry[1].currentHp = 10;
    if (researched.length > 0) {
      worldStateOf(blob)[researchedTechnologiesCodec.slot] = [[berserk!.owner, [...researched]]];
    }

    const bridge = createSimulationBridge('unit-showcase-fixture', { savedGame: blob });
    for (let step = 0; step < ticks; step += 1) bridge.step(100);
    const after = asSchema2Blob(bridge.saveGame());
    const state = (worldStateOf(after)[combatStatesCodec.slot] as Array<[number, {
      currentHp: number;
    }]>).find(([id]) => id === berserk!.id)!;
    return state[1].currentHp - 10;
  }

  it('heals about a hit point every three seconds', () => {
    // 300 ticks is thirty seconds: ten hit points, give or take rounding.
    const healed = healedAfter(300, []);
    expect(healed).toBeGreaterThan(8);
    expect(healed).toBeLessThan(12);
  }, 60_000);

  it('heals twice as fast with Berserkergang', () => {
    const plain = healedAfter(300, []);
    const teched = healedAfter(300, ['berserkergang']);
    expect(teched).toBeGreaterThan(plain * 1.8);
  }, 60_000);
});
