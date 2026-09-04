import { describe, expect, it } from 'vitest';

import { pickUnitMix } from '../../src/game/simulation/ai';
import { trainableInSameLine, unitLineOf } from '../../src/game/simulation/bridge/unitLines';
import { createTrainOptions } from '../../src/game/simulation/bridge/trainOptions';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { AgeType, TrainableUnitType } from '../../src/game/simulation/types';

// GATE for: "the AI reaches the Imperial age and stops training units".
//
// A producer offers the best tier its owner has RESEARCHED; `pickUnitMix` names
// the TOP of each line. An owner that reached the Imperial age without the unit
// upgrades was therefore offered Pikemen while being asked for Halberdiers, and
// the production loop's membership test failed for every entry in the mix — so
// it trained nothing, from any building, for the rest of the match.
//
// BOUND OF THIS GATE. It proves the AI trains SOMETHING from an un-upgraded
// producer, on a fixture with resources and population deliberately made
// abundant. It says nothing about whether the army is big enough, arrives in
// time, or wins — and nothing about the Castle, which trains its unique unit
// through a separate branch that never consults the mix (which is why the
// fixture has no Castle: one would hide this defect completely).
describe('the AI trains the unit tier it actually has', () => {
  it('resolves a wanted top-tier unit to the offered lower tier of the SAME line', () => {
    // The five Imperial mix entries against what an un-upgraded producer offers,
    // measured from `fortress` at 60,000 ticks.
    expect(trainableInSameLine('halberdier', ['long-swordsman', 'pikeman'])).toBe('pikeman');
    expect(trainableInSameLine('arbalest', ['crossbowman', 'elite-skirmisher', 'cavalry-archer']))
      .toBe('crossbowman');
    expect(trainableInSameLine('cavalier', ['light-cavalry', 'knight'])).toBe('knight');
    expect(trainableInSameLine('siege-ram', ['mangonel', 'scorpion', 'capped-ram']))
      .toBe('capped-ram');
    expect(trainableInSameLine('onager', ['mangonel', 'scorpion', 'capped-ram'])).toBe('mangonel');
  });

  it('prefers the wanted unit when it IS offered, so a fully upgraded owner is unchanged', () => {
    expect(trainableInSameLine('halberdier', ['champion', 'halberdier'])).toBe('halberdier');
  });

  it('never crosses to a different line', () => {
    // Scout -> Light Cavalry -> Hussar and Knight -> Cavalier -> Paladin are
    // two lines that share the Stable. Resolving across them would train the
    // wrong unit rather than none, which is a worse failure than the original.
    expect(trainableInSameLine('cavalier', ['light-cavalry'])).toBeUndefined();
    expect(unitLineOf('hussar')).not.toBe(unitLineOf('paladin'));
    // A unit with no upgrade of its own is its own line.
    expect(trainableInSameLine('onager', ['petard', 'trebuchet'])).toBeUndefined();
  });

  it('resolves every mix entry against the REAL offers, at both tech extremes', () => {
    // The class gate, and the reason it is built this way.
    //
    // An earlier version of this test asserted
    // `trainableInSameLine(unit, [unitLineOf(unit)])`, which CANNOT FAIL for
    // any input — `unitLineOf` is idempotent, so the single offer is always in
    // the line. It passed for `villager`, `trebuchet` and a made-up string.
    //
    // The real risk is DRIFT BETWEEN TWO SOURCES. `unitLineOf` reads
    // `UNIT_LINE_UPGRADES`; the tiers a building actually offers come from the
    // chains inside `trainOptions.ts`. Add a tier there without adding its
    // upgrade row and the AI silently stops training that line — the original
    // defect verbatim — while a table-only test stays green. So this builds the
    // REAL `getTrainOptions` and feeds it the real chains.
    //
    // BOUND: one civilization with a complete tech tree, because
    // `getTrainOptions` filters civ denials and a civ that lacks a whole line
    // would fail this for a legitimate reason. It checks resolution, not
    // affordability, population, or whether the unit is any good.
    const ages: AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];
    for (const age of ages) {
      for (const allResearched of [false, true]) {
        const getTrainOptions = createTrainOptions({
          getPlayerAge: () => age,
          isAtLeastAge: (_owner, minAge) => ages.indexOf(age) >= ages.indexOf(minAge),
          hasTechnology: () => allResearched,
          // Nothing researched resolves a chain to its BASE tier, everything to
          // its TOP — the two ends an owner can actually be at.
          latestResearchedInChain: (_owner, chain) => {
            const flat = chain.map((entry) => (Array.isArray(entry) ? entry[0] : entry));
            return (allResearched ? flat[flat.length - 1] : flat[0]) as TrainableUnitType;
          },
          getPlayerCivilization: () => 'Saracens',
        });
        for (const { unitType, producer } of pickUnitMix(age)) {
          const offers = getTrainOptions(1, producer);
          expect(
            trainableInSameLine(unitType, offers),
            `${age}: the mix wants ${unitType} but ${producer} offers `
            + `[${offers.join(', ')}] with allResearched=${String(allResearched)}`,
          ).toBeDefined();
        }
      }
    }
  });

  it('fields an army in the Imperial age with no unit upgrades researched', () => {
    // Asserts the SPEAR LINE specifically, not "an army". The AI has other ways
    // to produce a unit that have nothing to do with the unit mix — it builds a
    // Castle and trains a unique unit, builds a Monastery and trains Monks, or
    // researches the gold-free Onager upgrade — and an earlier version of this
    // fixture passed on Onagers, Monks and a Throwing Axeman while the defect
    // was fully present. The fixture removes each of those routes; this
    // assertion is what makes their return visible instead of silently green.
    const spearLine = ['spearman', 'pikeman', 'halberdier'];
    const bridge = createSimulationBridge('ai-imperial-military-fixture');
    let army: string[] = [];
    for (let i = 0; i < 3_000; i += 1) {
      bridge.step(100);
      army = bridge
        .getEconomyState()
        .units.filter((u) => u.owner === 2 && u.unitType !== 'villager')
        .map((u) => u.unitType);
      if (army.filter((u) => spearLine.includes(u)).length >= 2) break;
    }
    // A HALTED bridge is indistinguishable from an idle AI: `tryTick` catches
    // the engine's tick failure and every later step returns immediately, so
    // the army stays empty and this test would report a crash as the very
    // defect it is checking for. It did exactly that once during development —
    // a missing import threw inside the AI system and the run went from 2,295ms
    // to 73ms while still failing on "expected 0". Assert the run RAN.
    expect(bridge.getHudState().engineHalted).toBeFalsy();
    // Before the fix this is 0 forever: the Barracks offers a Spearman the owner
    // can afford 24 times over, the mix asks only for a Halberdier, and the
    // membership test rejects every entry.
    expect(army.filter((u) => spearLine.includes(u)).length).toBeGreaterThanOrEqual(2);
  }, 120_000);
});
