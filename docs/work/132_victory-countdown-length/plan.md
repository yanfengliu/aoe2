# Wonder and relic countdowns last as long as Definitive Edition's

Status: active
Owner: branch completion coordinator; recovery worker in worktree `countdowns`
Created: 2026-10-15
Updated: 2026-10-17

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

- [x] Source DE's countdown, implement it, gate the rule and record phase 1.
- [x] Recover the checkpoint, audit the countdown/save/replay/HUD mechanism and run focused checks.
- [ ] Review and verify the integrated revision, merge/push main and retire the worktree.

## Recovered implementation and evidence (2026-10-17)

Recovered clean at `595df917`, based on `ea11292a`. The detailed devlog's [work 132 entry](../../devlog/detailed/2026-10-13_2026-10-13.md#2026-10-15--work-132-a-wonder-or-relic-victory-takes-definitive-editions-time) contains the completed phase-1 handoff that this plan had failed to reflect. No version was taken; the changelog remains under "Unreleased — work 132". That entry records the wiki table, the installed DE lobby-size and Atheism strings, the old-length and nine other mutations, the exact visual comparison bounds and three 45,000-tick all-AI seeds whose before/after outputs were byte-identical. These are retained historical results, not fresh final-integration evidence.

The rule is now one seat-count table in `victoryCountdown.ts`: 50 ticks per year; 2-4 seats 10,000 ticks, 5-6 seats 15,000, 7-8 seats 17,500. `countdownLengths.ts` reads the world's population rows, preserving the original seat count after elimination, so a replay or a loaded match can derive a newly opened countdown without live bridge options. Both completed-Wonder and all-relics creation sites read it. Scenario overrides remain explicit. Atheism's extension is derived from 100 years, 5,000 ticks. The existing countdown save fields and deadlines are retained unchanged; no migration or new persisted field was added. The HUD view derives both the MM:SS and tooltip years from remaining ticks, and its tooltip observer follows changed copy while ignoring identical rewrites.

The recovery audit found no further code defect in that bounded length contract. The community table remains a stated single-source bound; larger named maps and speed presets remain excluded. DE update 185872's newer Atheism targeting and stacking still differ from the existing global-once behavior, as already stated in the spec and OPEN register entry; this length change does not claim to close that separate rule.

Fresh focused verification, one worker per run: `victoryCountdownLength` 18/18, `victoryCountdownReplay` 2/2, `countdownChip` 6/6, `tooltipFollowsCopy` 5/5 and `spiesAndAtheism` 7/7, together 38/38 in 7.14 seconds. The replay cases called `SessionReplayer.selfCheck()`, required a nonzero checked-segment count and no skipped segments, then compared live/replayed countdown state. Save cases include schema 1, schema 2 and deadlines made at the former 2,000-tick length. Focused ESLint passed on the countdown rule, opening logic, fixtures, HUD view/observer and all new countdown test files. No code changes, browser, GUI, server or scratch probe were needed by this recovery worker.

Required `ci:status` ran first with a process-local safe-directory override; GitHub was unavailable from that sandbox, so it reported UNKNOWN rather than red. The integration owner independently checked main's remote gates. The integration owner also owns the combined `writeData`/`countdownChipView` HUD merge, fresh full gate and receipt, real-control browser/visual checks, exact-revision independent persistence review, shared version/register/devlog closure and main merge/push. The three-seed phase-1 result cannot establish the final combined AI outcome after work 128 and work 131.

## Outcome

Pending. Record the verified revision, checks and limitations at closure.
