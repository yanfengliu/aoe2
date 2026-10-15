import { describe, expect, it } from 'vitest';

import { countdownChipView } from '../../src/ui/hud/countdownChip';
import { formatCountdownTicks } from '../../src/ui/hud/displayNames';

// The top bar's Wonder/Relic chip (work 132). It states the time a victory
// countdown has left as DE's timer panel does, minutes and seconds of game
// time, and the years the same ticks are (a year is 5 seconds of game time, 50
// ticks), so the two figures a player reads can never disagree. The numbers are
// worked out by hand from DE's table: 200 years are 16:40, 300 are 25:00.
//
// BOUND: the pure view the controller draws from. That the chip's slot never
// moves the bar is the existing browser spec of the top bar; this does not
// replace it, and it does not look at the pixels.

const TPS = 10;

describe('the victory countdown chip', () => {
  it('is inactive, and says nothing, when no countdown is running', () => {
    expect(countdownChipView({ wonderCountdownTicks: null, relicCountdownTicks: null }, TPS)).toEqual({ active: false });
  });

  it('opens a 200-year Wonder countdown at 16:40 and 200 years', () => {
    expect(countdownChipView({ wonderCountdownTicks: 10_000, relicCountdownTicks: null }, TPS)).toMatchObject({
      active: true,
      kind: 'wonder',
      label: 'Wonder',
      value: '16:40',
      yearsLeft: 200,
    });
  });

  it('states a 300-year Relic countdown, 25:00, as 300 years', () => {
    expect(countdownChipView({ wonderCountdownTicks: null, relicCountdownTicks: 15_000 }, TPS)).toMatchObject({
      active: true,
      kind: 'relic',
      label: 'Relic',
      value: '25:00',
      yearsLeft: 300,
    });
  });

  it('puts the Wonder first when both are running, as before', () => {
    expect(countdownChipView({ wonderCountdownTicks: 5_000, relicCountdownTicks: 7_000 }, TPS)).toMatchObject({
      kind: 'wonder',
      value: '08:20',
      yearsLeft: 100,
    });
  });

  it('keeps the years and the time in step on every tick of a countdown', () => {
    for (let ticks = 1; ticks <= 17_500; ticks += 13) {
      const view = countdownChipView({ wonderCountdownTicks: ticks, relicCountdownTicks: null }, TPS);
      if (!view.active) throw new Error(`no chip at ${String(ticks)} ticks left`);
      expect(view.value, `${String(ticks)} ticks`).toBe(formatCountdownTicks(ticks, TPS));
      // Years left is the seconds shown, over five, rounded up: the same ceiling
      // the clock applies, so the figures flip together.
      const secondsShown = Math.ceil(ticks / TPS);
      expect(view.yearsLeft, `${String(ticks)} ticks`).toBe(Math.ceil(secondsShown / 5));
    }
  });

  it('puts the years left in the tooltip, in DE\'s words', () => {
    const view = countdownChipView({ wonderCountdownTicks: 8_025, relicCountdownTicks: null }, TPS);
    if (!view.active) throw new Error('expected an active chip');
    expect(view.tooltip).toContain('161 years');
    expect(view.tooltip).toContain('13:23');
    expect(view.tooltip.toLowerCase()).toContain('wonder');
  });
});
