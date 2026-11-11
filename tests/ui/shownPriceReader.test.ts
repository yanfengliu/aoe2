// The price census's readers (tests/ui/shownPrice.helpers.ts) read a quote only
// where one is made (work 148 M2; review round 2, R2-3). A command tooltip
// quotes its price in its title's bracket, as DE's help text does, and nowhere
// else: the first reader written for that shape fell back to any "Costs ..."
// in the text, so a Spies tooltip with NO price in its title read as 200 gold
// off its rule line ("Costs 200 gold per enemy villager, halved by Atheism."),
// which is the charge while one enemy villager lives, and the census's
// missing-price guard passed over it.

import { describe, expect, it } from 'vitest';

import { formatResearchTooltip, formatTrainTooltip } from '../../src/ui/hud/tooltips';
import { shownCost, shownLabelCost } from './shownPrice.helpers';

describe('the shown-price readers', () => {
  it('read a command tooltip\'s price from its title\'s bracket', () => {
    expect(shownCost(formatTrainTooltip('militia', { food: 60, gold: 20 }))).toEqual({ food: 60, gold: 20 });
    expect(shownCost(formatResearchTooltip('loom', { gold: 50 }))).toEqual({ gold: 50 });
    expect(shownCost(formatResearchTooltip('feudal-age', { food: 500 }, 'Not enough food.'))).toEqual({ food: 500 });
    expect(shownCost(formatResearchTooltip('spies', { gold: 600 }))).toEqual({ gold: 600 });
  });

  it('answer null for a title that quotes no price, whatever the lines under it say', () => {
    expect(shownCost(formatTrainTooltip('militia', undefined))).toBeNull();
    expect(shownCost(formatResearchTooltip('loom', undefined))).toBeNull();
    const spies = formatResearchTooltip('spies', undefined);
    expect(spies).toContain('Costs 200 gold per enemy villager');
    expect(shownCost(spies)).toBeNull();
  });

  it('read an accessible name\'s "Cost:", and nothing from a tooltip\'s lines', () => {
    expect(shownLabelCost('Build House. Cost: 25 wood. ready.')).toEqual({ wood: 25 });
    expect(shownLabelCost('Build House. ready.')).toBeNull();
    expect(shownLabelCost(formatResearchTooltip('spies', { gold: 600 }))).toBeNull();
  });
});
