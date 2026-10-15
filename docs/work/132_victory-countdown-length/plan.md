# Wonder and relic countdowns last as long as Definitive Edition's

Status: planned
Owner: Claude coordinator (Game orchestrator todos); worker to be named
Created: 2026-10-15
Updated: 2026-10-15

## Problem and outcome

The spec says Wonder and relic countdowns use "the standard Random Map expectation of 200 in-game years", and Atheism adds 100 years. The code counts a year as one second of game time: `WONDER_COUNTDOWN_TICKS` and `RELIC_COUNTDOWN_TICKS` are 2,000 ticks (200 seconds at 10 ticks a second, `src/game/simulation/bridge/bridgeConstants.ts`), and Atheism adds 1,000 ticks. The community wiki's table for DE (found while deciding work 128's gates on 2026-10-14) gives 200 years as 16:40 of game time, which is 9:48 at DE's Normal speed of 1.7x, so about five seconds of game time a year, and it makes the number of years depend on map size, from 100 to 500. If that holds, a Wonder or a full set of relics wins here about five times sooner than in DE, which also decides self-play matches: work 128's computer wins by relics 2,000 ticks after storing its second relic.

Outcome: a Wonder or relic countdown lasts as long as DE's for the map being played, Atheism adds DE's amount, and the countdown the HUD shows in years agrees with the time it takes.

## Scope

- Included: sourcing DE's year length and the years per map size; the two countdown constants or their replacement; Atheism's addition; the HUD's countdown display; saves and replays of countdowns already running; every test and self-play gate that depends on a countdown's length; the spec lines (the "Victory countdown target" list, §11's Atheism paragraph and any other place that says 200 years or a tick count).
- Excluded: the game-speed presets (a separate card: the spec's §4.5 says Normal is 1.5x, where DE's Normal is 1.7x and its Casual is 1.5x); the victory types themselves.
- Off limits while they run: work 126 (foundation and placement files), work 128 (the AI's Monk and relic code and its self-play gates; its new Standard-rules case does not assert the victory tick, so it should not move), work 130 (rendering), work 131 (the villager economy and gather assignment).

## Approach

Source before changing: DE's in-game help or patch notes first, then well-documented community sources, naming each. Settle the year's length in game seconds and the years for each map size, and map this game's player-count map ladder (spec §12) onto DE's sizes by the stated rule, or by a reversible default stated as a bound if no rule fits. Decide what a save made mid-countdown does (keep its stored deadline, or rescale it) and say so in the spec.

## Acceptance criteria

- Cases red before the fix: a Wonder countdown and a relic countdown each last DE's time for a stated map size, Atheism adds DE's amount, and the HUD's years agree with the ticks left.
- A save made mid-countdown and loaded behaves as the spec says, and a replay stays deterministic.
- Every test and self-play gate whose result depends on a countdown's length is updated with its reason, and any self-play outcome that moves is reported with before and after numbers.
- Each new gate goes red with the old length put back, and states its bound.
- The spec states the rule and its source; a register entry, the changelog line and version at landing, and the devlog lines are written.
- `npm run verify` exits 0 with its log read through the build, `node scripts/verify-receipt.mjs check` prints OK with both suites' counts matching the log, and the change is on main.

## Implementation steps

- [ ] Source DE's countdown, fix it, gate it, record it, land it.

## Outcome

Pending. Record the verified revision, checks and limitations at closure.
