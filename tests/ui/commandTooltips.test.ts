// v0.1.88: the command-button tooltips (already surfaced by createTooltipController
// on hover) name the CONCRETE resource cost instead of a vague "requires the
// unit's cost", so a player can see what a button costs before clicking.
//
// Work 125: the figure is the one the formatter is HANDED — the simulation's
// per-owner price from SelectionState.commandCosts — never a table lookup of
// its own. A tooltip that looked up the base table quoted an Italian Fishing
// Ship at 75 wood while the Dock charged 64. With no price handed in, the
// tooltip quotes none rather than a figure the click would not charge.

import { describe, expect, it } from 'vitest';

import {
  formatBuildTooltip,
  formatResearchTooltip,
  formatResourceCost,
  formatTrainTooltip,
} from '../../src/ui/hud/tooltips';

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

describe('formatTrainTooltip — quotes the price it is handed', () => {
  it('names the Militia cost it is given (50 food, 20 gold)', () => {
    const tip = formatTrainTooltip('Militia', { food: 50, gold: 20 });
    expect(tip).toContain('Militia');
    expect(tip).toContain('Cost: 50 food, 20 gold.');
  });

  it('quotes a discounted price as given, not the table row', () => {
    expect(formatTrainTooltip('Fishing Ship', { wood: 64 })).toContain('Cost: 64 wood.');
  });

  it('quotes no price at all when none is handed in', () => {
    expect(formatTrainTooltip('Militia', undefined)).not.toMatch(/cost/i);
  });
});

describe('formatResearchTooltip — quotes the price it is handed and the research time', () => {
  it('names the Loom cost it is given (50 gold) and its 25-second research time', () => {
    const tip = formatResearchTooltip('loom', 'Loom', { gold: 50 });
    expect(tip).toContain('Loom');
    expect(tip).toContain('Cost: 50 gold;');
    expect(tip).toContain('25s'); // 250 ticks / 10 TPS
  });

  it('quotes Spies at its live figure, with the per-villager rule beside it', () => {
    const tip = formatResearchTooltip('spies', 'Spies', { gold: 600 });
    expect(tip).toContain('Cost: 600 gold (200 per enemy villager, halved by Atheism);');
  });

  it('quotes no price at all when none is handed in, and keeps the time', () => {
    const tip = formatResearchTooltip('loom', 'Loom', undefined);
    expect(tip).not.toMatch(/cost/i);
    expect(tip).toContain('25s');
  });
});

describe('formatBuildTooltip — quotes the price it is handed', () => {
  it('names the Barracks cost it is given (175 wood)', () => {
    const tip = formatBuildTooltip('Barracks', { wood: 175 });
    expect(tip).toContain('Barracks');
    expect(tip).toContain('(cost: 175 wood)');
  });

  it('quotes no price at all when none is handed in', () => {
    expect(formatBuildTooltip('Barracks', undefined)).not.toMatch(/cost/i);
  });
});
