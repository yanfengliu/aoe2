# Debugging session — the sustained-raid spec read 199 against its 200-tick floor

## Symptom

`tests/browser/attack-warning-sustained.spec.ts:86` failed "the words came faster than the horn is throttled", `Expected: >= 200`, `Received: 199`, on attempt 1 of main's CI runs 36064573424 (`5a6ce866`) and 36073613836 (`eda31608`), browser shard 1/4. Attempt 2 of each passed, and `npm run ci:status` read main GREEN ONLY ON A RE-RUN and exited 1.

## Expected vs actual

- Expected: two alert toasts at least 200 ticks apart, because the horn and its words are throttled to one per 200 ticks.
- Actual: the spec measured 199 between them, about one run in five.

## Reproduction

- The instrument that answers this is the failing spec's own record. It samples every frame (tick, wall time, minimap pixels, the House's health), and CI uploads its trace on failure (artifact `playwright-failures-<run>-1-shard-1`). No engine debug tool reads it: the question is the tick the page had reached when it drew each toast, which is presentation state of the running page. A replay re-simulates the world, not the page's frames.
- Locally: `npm run build`, then `PREVIEW_PORT=4621 BROWSER_RASTERISER=swiftshader npx playwright test tests/browser/attack-warning-sustained.spec.ts --repeat-each=20`.
- Temporary instrumentation: an annotation in the spec with the toast stamps and the frames around them. It was removed before the commit.

## Hypotheses

- [x] The instrument. The spec stamps each toast with `getHudState().tick`, read in a MutationObserver when the node is added. That is the tick at the end of the frame that drew the toast, not the tick of the blow the horn answered. Confirmed; see the log.
- [x] The game mis-times the horn, so it fires under 200 ticks after the last one on the throttle's own clock. Ruled out; see the log.

## Investigation log

- 2026-09-24 — Decoded both CI traces. In both, the first blow landed in a frame that stepped ticks 4 and 5: the House read 900 at tick 3 and 896 at tick 5, and the first toast was stamped 5. The second toast was stamped 204 by a frame that stepped only tick 204. The raiders strike on fixed cycles: one Militia on ticks 4, 14, 24 and so on, the other on 13, 23 and so on. So the House lost health in frames that stepped exactly one of those ticks.
- 2026-09-24 — The traces alone pin down the horn's blows. The frame that stepped 202-203 (blow at 203) raised no horn, so the first blow was later than tick 3. The frame that stepped only 204 raised one, so it was no later than 4. The first blow was therefore tick 4, and the horn answered blows 4 and 204, exactly 200 apart. That is right by the throttle `hit.tick - lastHornTick < 200`. The game did not mis-time anything.
- 2026-09-24 — Reproduced locally on SwiftShader with the unchanged spec: 4 of 20 runs failed. Every failure had stamps 5 and 204, and every failure was a run where the frame that stepped the first blow also stepped tick 5. The 16 passing runs had stamps 4 and 204.
- 2026-09-24 — A first attempt at checking the new stamp read the raiders' drawn swings (`attackAnimation`, which carries each blow's tick) from the render state. Every run failed that check with an empty list. A probe of the live page found why: in this fixture the House gives no sight (`ownedSpawn` without `vision`, and `buildingVisionRadius('house')` is null), so the raiders are never drawn for the human. The check now uses the House's own health, read once a frame. The wider gap (only seven building types give any sight, against `structures.csv`'s `line_of_sight` for all of them) was flagged as a separate task.

## Root cause

The spec measured the page's clock, not the game's. The horn is throttled on the ticks of the blows (spec §14.5). The page draws the words up to a frame of ticks after the blow, and this fixture's blows fall exactly 200 ticks apart, so the check had no margin. Any run where the frame that stepped the first blow also stepped the next tick read 199.

## Fix

- `gameAudioController` passes the blow's tick to `announce`.
- The alert toast carries it as `data-hud-toast-hit-tick` (`toast.ts`, wired in `createApp.ts`).
- The spec spaces the words on that tick, with the same 200-tick floor and no tolerance. It first checks that each named tick is no later than the tick the page drew it at, and that it lies in a frame across which the House lost health.

## Verification

In the devlog entry of the same date and in `docs/learning/gate-proofs.md`: the unit and browser mutations, the local stability runs, and the CI runs.

## Follow-ups

- The gate's reasoning is in the spec's header (BOUNDS) and in `tests/ui/raidWarning.test.ts`, whose long-frame case holds the words to the blow's own tick.
- Buildings other than docks, outposts, Town Centres, towers, Castles and Wonders give no line of sight. This was flagged as its own task; it is not fixed here.
