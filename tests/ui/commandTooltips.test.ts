// v0.1.88: the command-button tooltips (already surfaced by createTooltipController
// on hover) now name the CONCRETE resource cost instead of a vague "requires the
// unit's cost". These assert the format functions include the real numbers from
// the cost tables + the research time, so a player can see what a button costs
// before clicking.

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

describe('formatTrainTooltip — includes the unit cost', () => {
  it('names the Militia cost (60 food, 20 gold)', () => {
    const tip = formatTrainTooltip('militia', 'Militia');
    expect(tip).toContain('Militia');
    expect(tip).toContain('60 food, 20 gold');
  });
});

describe('formatResearchTooltip — includes the cost and research time', () => {
  it('names the Loom cost (50 gold) and its 25-second research time', () => {
    const tip = formatResearchTooltip('loom', 'Loom');
    expect(tip).toContain('Loom');
    expect(tip).toContain('50 gold');
    expect(tip).toContain('25s'); // 250 ticks / 10 TPS
  });
});

describe('formatBuildTooltip — includes the building cost', () => {
  it('names the Barracks cost (175 wood)', () => {
    const tip = formatBuildTooltip('barracks', 'Barracks');
    expect(tip).toContain('Barracks');
    expect(tip).toContain('175 wood');
  });
});
