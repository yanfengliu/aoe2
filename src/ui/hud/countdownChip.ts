// The top bar's Wonder/Relic countdown chip, as a pure view (work 132).
//
// The chip states the time the running victory countdown has left the way DE's
// timer panel does, minutes and seconds of game time, and the years the same
// ticks are, so the two figures a player reads can never disagree: the years
// are the seconds shown, over the five seconds of a year, rounded up
// (`countdownYearsLeft`). The controller draws this view; it adds no rule.

import { countdownYearsLeft } from '../../game/simulation/victoryCountdown';
import { formatCountdownTicks } from './displayNames';

export interface CountdownChipInput {
  wonderCountdownTicks: number | null;
  relicCountdownTicks: number | null;
}

export type CountdownChipView =
  | { active: false }
  | {
    active: true;
    kind: 'wonder' | 'relic';
    /** The chip's label. */
    label: string;
    /** The time left, MM:SS of game time. */
    value: string;
    /** The years those ticks make. */
    yearsLeft: number;
    /** The chip's tooltip: the rule, with the years and the time in it. */
    tooltip: string;
  };

/** Wonder takes precedence when both are running (rare; the first countdown to
 *  start wins per the deterministic tie-break rule). */
export function countdownChipView(match: CountdownChipInput, ticksPerSecond: number): CountdownChipView {
  const kind: 'wonder' | 'relic' | null = match.wonderCountdownTicks !== null
    ? 'wonder'
    : match.relicCountdownTicks !== null ? 'relic' : null;
  if (kind === null) return { active: false };
  const ticks = kind === 'wonder' ? match.wonderCountdownTicks! : match.relicCountdownTicks!;
  const label = kind === 'wonder' ? 'Wonder' : 'Relic';
  const value = formatCountdownTicks(ticks, ticksPerSecond);
  const yearsLeft = countdownYearsLeft(ticks);
  const years = yearsLeft === 1 ? '1 year' : `${String(yearsLeft)} years`;
  return {
    active: true,
    kind,
    label,
    value,
    yearsLeft,
    tooltip: `${label} victory in ${years} (${value} of game time). If it finishes without interruption the holder wins.`,
  };
}
