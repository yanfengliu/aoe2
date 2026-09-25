# Debugging session — the attack warning after leaving a replay

## Symptom
The independent review of v0.3.235 read it and filed it OPEN (defect register 2026-09-24, "Coming back from a replay of a later session silences the live attack warning"). Its example: play to tick 30,000, load a save at 5,000, watch the prior session in the replay viewer to 29,000, and exit. It had not been reproduced.

## Expected vs actual
- Expected: the first raid in the live match after leaving the replay viewer sounds the horn, says "You are under attack!", marks the minimap, and gives Space a target.
- Actual (reproduced): none of it, for every blow up to the replay's last tick.

## Reproduction
- Instrument: none of the engine's replay tools answers this. The question is what the page's audio controller remembers across a switch between the live match and the replay viewer. That memory is closure state in `gameAudioController.ts`, not world state, so `replay:inspect`, `snapshotAtTick` and `SessionReplayer` re-simulate a world that holds none of it. The page itself, driven through its real menus, answers it.
- On `main` at `1ea83922`, `npm run dev` from this worktree, `?seed=aoe2-prototype`, in the app's browser pane at 1024x768:
  1. Advance to tick 100 and save through the menu (Save game).
  2. Advance to the first raid. The toast named hit tick 1444; villager 2205 went 25 -> 21 by tick 1450. Continue to about 1780.
  3. Load the tick-100 save through the menu (Load game, From browser storage, Restore). The live match was back at tick 108.
  4. Menu, Watch a replay, Prior session tab, the row "0-1781". Scrub to 1440 and play: the replay announced its raid (toast in replay mode, hit tick 1444) and marked the minimap. Scrub on to 1780.
  5. Exit replay mode. The live match was at tick 158.
  6. Advance the live match to 1400 in 100-tick steps, then to 1760 in 10-tick steps with frames rendered between.
- Result: villager 2205 went 25 -> 21 by tick 1450 and 13 by 1760. In 36 samples from 1410 to 1760, the minimap's `data-attack-warning-cell` was never set, and no alert toast was raised in live mode.
- No temporary instrumentation in the game: a `MutationObserver` on the toast container, run in the page from the browser tool, recorded each alert toast with the replay mode and its `data-hud-toast-hit-tick`.

## Hypotheses
- [x] The controller keeps the replayed world's `lastSeenAttackTick` after the exit, and every live blow at or below it is filtered out as already seen. Confirmed by reading `pollHorn` and by the samples: no mark at all, where a throttled horn alone would still have left the mark.
- [x] Nothing tells the audio mount that the replay was left. Confirmed by reading `exitReplay` in `ReplayController.ts`: it restores the live bridge and emits a mode change, which nothing in the audio mount listens to.

## Investigation log
- 2026-09-24 21:15 — Reproduced as above, before any code change.
- 2026-09-24 21:33 — `tests/browser/attack-warning-replay-exit.spec.ts` written on `raid-warning-fixture`. Red on the unchanged build: "the live raid between ticks 3 and 123 left 0 screen pixels of mark on the minimap" and "came with no words", after a replay that announced a blow at tick 224.
- 2026-09-24 21:50 — After the fix, the same real-map flow on the dev server: the live toast named hit tick 1444, and the mark was up in 22 of 36 samples, from tick 1450 to 1660, which is 200 ticks past the raid's last blow.

## Root cause
The audio controller forgot the old world only on a load, and entering or leaving the replay viewer is a switch of world too.

## Fix
`mountGameAudio` subscribes to the replay controller's `onModeChange` and resets the controller on every mode change, entering and leaving. Steps, scrubs, marker jumps and fog-owner switches change no mode and keep the memory. The rejected signals and the reset's cost are in `docs/architecture/decisions.md`. The gates are `tests/browser/attack-warning-replay-exit.spec.ts`, `tests/ui/gameAudioMount.test.ts` and, for the replay controller's side of the contract, `tests/replay/replayModeChanges.test.ts`. Their mutations are in `docs/learning/gate-proofs.md`.

## Verification
- Unit: `tests/ui/gameAudioMount.test.ts` (6 cases) and `tests/replay/replayModeChanges.test.ts` (2 cases), beside the existing `tests/ui/gameAudio.test.ts` and `tests/ui/raidWarning.test.ts`.
- Browser, named spec files only (never the full suite) on `PREVIEW_PORT=4655`. `attack-warning-replay-exit.spec.ts` was red twice on the unchanged build. On the swing feed it then passed 5 of 5 on the GPU and 3 of 3 on SwiftShader. After the rebase onto v0.3.235 it passed on the hit feed with the same numbers: the replay announced a blow at tick 224, the words named the first live blow, and the mark drew 141 screen pixels. `attack-warning-replay.spec.ts` raised one toast over its 40 steps, 3 of 3 on SwiftShader. `attack-warning.spec.ts`, `attack-warning-sustained.spec.ts` and `attack-warning-buildings.spec.ts` passed on the rebased tree.
- Mutations: five of the mount and three of the replay controller, each restored byte for byte, recorded in `docs/learning/gate-proofs.md`. The mount's no-subscription mutant was run again on the hit feed, and was red in both gates.
- The full gate, `npm run verify`, ran on the final tree, and its result is in the commit message.

## Follow-ups
- No engine gap: the replay controller already announced its mode changes.
- The gates carry their reasoning in their headers, and the rejected signals are in `docs/architecture/decisions.md`.
