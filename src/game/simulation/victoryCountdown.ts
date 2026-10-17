// Wonder and Relic victory countdowns, counted as Definitive Edition counts
// them (spec §4.3, work 132).
//
// DE counts a countdown in YEARS. A year is 5 seconds of game time, so DE's
// standard 200 years are 1,000 seconds: 16:40 on the game clock, 9:48 at DE's
// Normal speed of 1.7x. Until work 132 this game counted a year as one second
// and every countdown as 2,000 ticks (200 seconds), five times too short.
//
// DE sets the length by the size of the map. Its table (the Age of Empires
// Series Wiki, "Wonder (Age of Empires II)", repeated on "Relic (Age of Empires
// II)", read 2026-10-14) is: Miniature 100 years; Tiny, Small, Medium 200;
// Normal 300; Large 350; Huge, Giant, Massive 400; Enormous, Colossal,
// Incredible 450; Monstrous, Ludicrous 500. This game offers no named sizes:
// the player count picks the map (spec §5.3), so a match takes the length of
// the size DE labels for that many players. DE's own strings give the labels
// (key-value-strings-utf8.txt): Tiny 2 players, Small 3, Medium 4, Normal 6,
// Large 8.
//
// BOUND: the table is one community source's; no DE help text or patch note
// states it. If it is wrong, the one table below is the rule to correct, and
// every figure that follows (the countdown, the HUD's years, Atheism's amount
// in ticks) reads from it or from `TICKS_PER_YEAR`.

/** DE: 200 years are 16:40 of game time, so a year is five seconds of it. */
export const GAME_SECONDS_PER_YEAR = 5;

/** Ticks in a year at this game's 10 a second (`TPS`; a test holds the two). */
export const TICKS_PER_YEAR = 50;

/** Years a countdown lasts by the players seated, the size DE names for that
 *  many: 2-4 players Tiny/Small/Medium, 5-6 Normal (DE's 6-player size), 7-8
 *  Large (DE's 8-player size). */
const VICTORY_COUNTDOWN_YEARS_BY_SEATS: Readonly<Record<number, number>> = {
  2: 200,
  3: 200,
  4: 200,
  5: 300,
  6: 300,
  7: 350,
  8: 350,
};

const FEWEST_SEATS = 2;
const MOST_SEATS = 8;

/** The years a Wonder or Relic countdown lasts with this many players seated.
 *  A count outside the 2-8 ladder takes the nearest end, as the map ladder
 *  does (`standardMapSize`). */
export function victoryCountdownYears(seatedPlayers: number): number {
  // A count that is not a number would make a countdown of NaN ticks, which never
  // reaches zero: refuse it to the fewest seats rather than let a match never end.
  const count = Number.isFinite(seatedPlayers) ? Math.floor(seatedPlayers) : FEWEST_SEATS;
  const seats = Math.max(FEWEST_SEATS, Math.min(MOST_SEATS, count));
  return VICTORY_COUNTDOWN_YEARS_BY_SEATS[seats]!;
}

/** The same length in ticks. */
export function victoryCountdownTicks(seatedPlayers: number): number {
  return victoryCountdownYears(seatedPlayers) * TICKS_PER_YEAR;
}

/** Atheism (Huns) adds 100 years to Wonder and Relic victory (DE's help text:
 *  "Wonder and Relic victory takes +100 years"). */
export const ATHEISM_COUNTDOWN_EXTENSION_YEARS = 100;

/** The years a number of ticks left makes, counted as the HUD's clock counts
 *  seconds: part of a year left is a year left, so the figures flip together. */
export function countdownYearsLeft(ticksLeft: number): number {
  return Math.max(0, Math.ceil(ticksLeft / TICKS_PER_YEAR));
}
