# Definitive Edition's game speeds

Status: active
Owner: de-game-speeds worker for the Claude coordinator
Created: 2026-11-06
Updated: 2026-11-06

## Problem and outcome

Plan 106's "Game speed" card: spec §4.5 offered Slow 1.0x, Normal 1.5x and Fast 2.0x, play-1014 measured the lobby's Normal at 15 ticks a second, and §4.5 called Slow the default while the lobby's row started on Normal. Definitive Edition has four speeds, Slow 1.0x, Casual 1.5x, Normal 1.7x and Fast 2.0x, and starts its creation screen on Normal.

Outcome: the game's speeds are DE's. The lobby's row offers DE's four in DE's order and starts on Normal (1.7x); `?speed=` takes the four names; the numpad's + and − (DE's `SPEED_UP` and `SPEED_DOWN`) step the same four, held at Slow and Fast; and the top bar's Time shows the speed in brackets after the clock, as DE's game-time display does. The multiplier stays presentation-side (§4.5): saves, replays and every tick-counted datum are untouched.

## DE's rules and their sources

Read from the install (`C:\Program Files (x86)\Steam\steamapps\common\AoE2DE`, never launched) where it holds them, otherwise from the community sources named.

- The four names, from the English string table (`resources/en/strings/key-value/key-value-strings-utf8.txt`) and `widgetui/stringreference.json`: Slow 13101 (`IDS_MPS_GAME_SPEED_SLOW`), Normal 13102 (`IDS_MPS_GAME_SPEED_NORMAL`), Fast 13103 (`IDS_MPS_GAME_SPEED_FAST`), and Casual 13126, added beside them for DE. Extra Fast (13127) names the replay's fourth speed (`REPLAY_SPEED_FASTER`, "Set Speed to Extra Fast", 20036), not a lobby speed.
- The multipliers, which the install's text files do not hold: Slow 1.0x, Casual 1.5x, Normal 1.7x, Fast 2.0x. Age of Empires forum t/84298 (TWest6709, 2020-06-02: Casual is 1.5x and Normal 1.7x); Steam discussion 3821912677678091112 (Quillithe, 2023-05-23: Slow is 1:1 and the others 1.5, 1.7 and 2.0 times it); forum t/267350 (HestiaAoE, 2024-12-12: "Normal (1.7)", "Casual (1.5)"); Steam discussion 4148446223173923942 (FloosWorld, moderator, 2024-01-29: "officially 2.0 is the limit"); the recorded-game parser `aoc-mgz` (`mgz/const.py` `SPEEDS`, `169: 'standard', # de`).
- The default, Normal (1.7x): the install's options text, `IDS_OPTIONS_GAMESPEED_HELP`, "Sets the game speed of any active games and the default setting in a creation screen" (`widgetui/screenoptions.json` `GameSpeedDropdown`); Steam 4148446223173923942 (FloosWorld, 2024-01-29: "DE added 1.7 as the new default"); Steam 1752394042379834076 (Furor_Teutonicus, 2019-12-04, on Normal at 1.7x: "Whoever made this new speed the default"); forum t/248526 (Tharkun221, 2024-02-06: the Options' Game Speed set to "Normal" gives 1.7).
- The keys, from `resources/_common/dat/hotkeys.json` (`node scripts/dumpDeHotkeys.mjs GAME_COMMAND_HOTKEYS`): `SPEED_UP` VK_ADD (19004, "Speed Up Game") and `SPEED_DOWN` VK_SUBTRACT (19005, "Slow Down Game"), unchanged since work 142. They step the four presets one at a time and stop at the ends: forum t/248526 (GeneralIgor, 2024-02-12: one press of + from 1.5 reaches 1.7); FloosWorld above (2.0 the official limit; faster speeds need the `DEBUGSPEEDS` launch option).
- The readout: DE's game-time display shows the elapsed time and the current speed. Steam 2567563897036440942 (grraf, 2020-06-26: F11 shows "the elapsed time and current game speed"); forum t/248526 (Tharkun221, 2024-02-06: the 1.5 beside the clock is "the game speed"); for the brackets, AoE2 HD's Steam discussion 666827316091151213 (Sir Jasper Trund, 2013-12-02: "the number in brackets", as in the original game).

## Scope

In: §4.5's presets and default, `?speed=`, the lobby's row, the numpad's speed keys, the Time chip's speed readout, their tests, spec §4.5 and the lines that cite it.

Out: the AI (work 147), the HUD panels beyond the speed readout (work 148), DE's replay speeds, DE's Options setting that remembers the speed, F11's show and hide of the game time (findings below), civ-engine, voxel, `AGENTS.md`.

## Approach

One table, `GAME_SPEEDS` in `src/game/simulation/matchOptions.ts`, holds DE's four with their names, in DE's order, and `stepGameSpeed` steps it; the lobby's row, `?speed=`, the numpad's keys and the readout all read it, where the view kept its own copy of the ladder before. The frame's simulation delta is one pure function, `frameSimulationDelta`, which the view calls and the determinism test drives.

The lobby starts on Normal. A URL without `?speed=` stays at Slow, 1.0x: every test, harness and probe boots with parameters, and the data is defined at 1.0x, while a player reaches a match through the lobby, which writes its speed. The lobby writes `speed=` for every choice but Slow, as before.

## Acceptance criteria

- [x] The lobby offers Slow (1.0x), Casual (1.5x), Normal (1.7x) and Fast (2.0x), in that order, and starts on Normal; Start Match boots at the chosen multiplier (real-click browser test).
- [x] The numpad's + and − step Slow, Casual, Normal and Fast and hold at the ends; the main row's keys do not; the Time chip shows the speed in brackets (browser test through the real keys).
- [x] `?speed=` takes the four names; anything else warns and runs at 1.0x (unit test).
- [x] A match stepped through real frames at each speed advances DE's multiplier of ticks per real second, and is the same deterministic match at every speed (unit tests).
- [x] Each new test goes red with the defect put back (the "same match" case after the coordinator's finding, below).
- [x] Spec §4.5 and the lines citing it say the same; the live check and the frame-cost measurement are recorded below.

## Implementation steps

- [x] Tests first, each proved red.
- [x] `GAME_SPEEDS`, `stepGameSpeed`, `frameSimulationDelta`, the lobby's row, `?speed=`, the view and the readout.
- [x] Spec §4.5, §9.4 and §14.2, §14.5's raid line, and the attack-warning comments.
- [x] Live check at each speed through the real Start Match; frame cost at Normal and Fast against today's.
- [x] `npm run verify`, the receipt check, the independent review; then the handoff.

## Outcome

**Phase 1 handoff (2026-11-06).** Reviewed revision 73e5ed78 (on main 4bd1978b). `npm run verify` on its clean tree exited 0 and `node scripts/verify-receipt.mjs check` printed OK: tree cb899466950f, vitest 5,470 passed and 3 skipped, Playwright 339 passed and 2 skipped. One Codex review round ([reviews/0_implementation.md](reviews/0_implementation.md)): no blocker or major finding; of two minor ones, the empty `?speed=` was settled in §4.5's wording and the readout's visibility and replay cases are noted below. The docs-only commit after it holds the review record and those words.

M1, phase 1 (2026-11-06): implemented on branch `de-game-speeds-1106`; landing waits on the coordinator.

**Reproduced first** on main's build (72f7266e) through the real lobby, 1600x900, Chromium headless on the GPU (ANGLE D3D11): the row offered Slow (1.0x), Normal (1.5x) and Fast (2.0x) and started on Normal; the lobby's default match ran at 15.0 ticks a real second, Slow at 10.0 and Fast at 20.0 (three 5-second windows each, 60 fps); nothing on screen showed the speed.

**Live check** on this branch, the same way, one lobby match at each speed through the real Start Match: the row offers Slow (1.0x), Casual (1.5x), Normal (1.7x) and Fast (2.0x) and starts on Normal; the default match boots with `speed=normal` and runs at 17.00 ticks a real second, Slow at 10.00, Casual at 15.00 and Fast at 20.00, in every 5-second window at 60 fps, which is 10 ticks a second times DE's multiplier; the Time chip read `(1.7)`, `(1.0)`, `(1.5)` and `(2.0)`.

**Frame cost on a long match** (for the map lane, work 150): the lobby's default map, `aoe2-prototype`, 60x36 tiles, two seats, the human idle; the page booted, then advanced to tick 18,000 (30:00 of game time; 50 units and 28 buildings on the map) and run live at 1600x900 on the GPU, three rounds of 10-second windows alternating the speeds by the numpad's keys. Every window held 60 fps (frame p95 16.7-16.8 ms) and exactly 10 ticks a second times the multiplier. The main thread's time in each frame's callbacks (the ticks, camera, sync and draw calls): main's build, today's Normal 1.5x mean 5.00-5.17 ms (p95 8.7-9.2) and Fast 2.0x 5.06-5.32 (p95 8.5-8.9); this branch, 1.5x 3.40-4.66 (p95 5.6-8.5), DE's Normal 1.7x 3.79-3.99 (p95 7.2-7.6) and Fast 3.77-4.16 (p95 6.6-7.9). Within one page the speed moves the mean by under 0.5 ms, against a 16.7 ms frame; the two builds' gap is between runs, not the change, which adds no per-frame work. At tick 24,000 the computer had already conquered the idle human, so 30:00 is as late as this setup runs. Probe: `tmp/probes/speedLiveCheck.mts` in the worktree (not committed).

**Tests and their red proofs.** New: `tests/simulation/gameSpeeds.test.ts` (9 cases), `tests/simulation/gameSpeedPace.test.ts` (2), `tests/browser/game-speed.spec.ts` (2). With main's three speeds put back (Normal 1.5x, no Casual), 7 of the 9 table cases, the pace case (Normal gave 150 ticks, not 170) and both browser cases went red; the two that stayed green test what did not change (a URL without `?speed=` runs at 1.0x; the lobby's query round-trips). The "same match" case, as first reviewed (73e5ed78), was not red with the one mutant tried, draining the computer's queued commands once a frame instead of once a tick in `bridge.step`: the frame delta drives `AoeVoxelGameView.frame`, then `frameSimulationDelta`, then `bridge.step`, which, for every 100 ms its accumulator holds, submits the computer's queued purchases and placements (`aiIntentionPushers` into `pendingCommands`, drained by `drainPendingCommands`) and then runs `world.step()`. That drain submits only six commands in the boot map's first 1,200 ticks, before ticks 1 (a placement and a Villager), 31, 271, 511 and 781 (counted on the real bridge), and the case's frames were mostly short, so the ticks those commands came on ran one to a frame, where a per-frame and a per-tick drain are the same, and it compared only the last tick. After the coordinator's finding the case compares the whole save at every tick a frame lands on, under frames that run most ticks several to a frame; the same mutant now turns it red (Slow differed from the tick-by-tick match at 142 landing ticks, from tick 2), and it is green on the real code. Looking for a mutant also found a real case outside the window (plan 106's findings): a step keeps ticking after the match ends inside it.

**Existing tests changed.** `tests/browser/de-global-keys.spec.ts`: the second NumpadAdd reaches 1.7, DE's Normal, where it reached 2. `tests/simulation/setupScreen.test.ts`: `?speed=normal` is 1.7. `tests/ui/raidWarning.test.ts`: the sustained raid runs at all four presets through `GAME_SPEED_LADDER`, reading `.multiplier`. Comments only: `tests/browser/attack-warning-sustained.spec.ts` (its `?speed=normal` is now 1.7x).

**Gate, first run.** The full suite caught the Time chip reusing the resource chips' `.hud-resource-readout` class, which `tests/browser/resource-workers.spec.ts` reads as a resource chip (12 cases red); the chip got its own class, `.hud-time-readout`, with the same layout, and the capture below stayed byte-identical.

**Visual check.** `captureMapScreenshot.mjs` of the default view at 800x600 on main's build and this one, then `diffMapScreenshots.mjs`: 966 of 480,000 pixels changed (0.20%), all within x 561-609, y 28-64, the Time chip, where `(1.0)` now sits under `00:00` in the row the resource chips use for their workers; the chip keeps its width, so nothing else moved.

**Not checked.** Other viewport sizes for the readout; a replay with the readout hidden (the replay-mode hide is wired, not driven), and the readout's visibility, since the browser cases read its text, which a hidden element also has (review 0, minor); the speed keys during a replay; Firefox and WebKit; a played (not idle-human) long match for the frame cost.

**Unsourced, with the default taken** (also in plan 106's "Owner decisions waiting"): the multipliers come from DE's players, not its files, which hold only the names; whether + past Fast and − past Slow do anything (here they hold); the readout's form and place, the speed in brackets under the clock (HD's and the original game's brackets; DE's own layout not seen).
