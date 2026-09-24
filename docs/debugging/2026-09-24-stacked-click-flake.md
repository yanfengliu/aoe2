# Debugging session — the stacked-click spec that failed on CI one run in five

## Symptom
`tests/browser/game-selection-click.spec.ts:110`, "only advances an overlapping exact-click stack at the same presented hit point", failed on main's CI in runs 34041883943 (`bcdc88c3`, 2026-09-06), 35962265457 (`f92c1157`) and attempt 1 of 36019109919 (`221329b4`, 2026-09-24), the last read green by `ci:status` after a re-run. At line 271: `Expected: "Militia"`, `Received: "Sheep"`, `Timeout: 5000ms`.

## Expected vs actual
- Expected: after the fourth click at the stack point, the selection panel names the militia.
- Actual: five seconds after the fourth click, the panel still named the third click's sheep.

## Reproduction
- Instrument named first: none of the engine's tools applies. The question is how many animation frames the page gets and what the selection panel shows, which is live-page state; `replay:inspect`, `diffBundles` and `snapshotAtTick` read world state from a recording, and the world was right in every failure.
- Locally it never failed. First session: GPU 3 of 3, SwiftShader 10 of 10, SwiftShader on six workers 24 of 24, SwiftShader built against CI's pinned voxel 10 of 10, and a probe of the same search across animation phases 42 of 42. Second session: SwiftShader 20 of 20, then 20 of 20 with the browser's GPU process held to CPUs 0-3 (about two cores with hyperthreading, like CI's 4-vCPU runner). This machine has 32 logical processors.
- Holding the browser to fewer CPUs took two tries. `start /affinity` is refused in this shell. A mask set with PowerShell on the process that launches Playwright reaches the browser, renderer and utility processes, but Chrome starts its GPU process, where SwiftShader runs, on every CPU (mask 4294967295) whatever its parent's mask, so the first 20-run arm measured nothing. A scratch PowerShell runner (not kept) that walks the process tree down from its own wrapper and puts every descendant on the mask every half second did it; with it the old spec took 5.6 min for 20 runs against 2.5 min, so the limit bit. At CPUs 0-1 the spec could not finish at all (10 of 10 failed in boot or at the 30 s test timeout), which says nothing about the flake. A first version of the listing reset the mask of every `chrome-headless-shell` on the machine, which may have included another lane's browser for a few seconds; the tree-scoped runner is what should be used.
- On CI: a diagnostic branch, `stacked-click-diag`, ran only this spec 15 times on each of three browser shards. Run 36029523854: 6 failures in about 34 runs. Run 36032537612 (with an animation-frame counter, the panel text and page errors logged): 11 in about 45.

## Hypotheses
- [x] The controller walks the stack wrongly on a slow host. Ruled out: in every failure the bridge held the right selection.
- [x] A double-click is read between the clicks. Ruled out: the test API passes no input time, so no click can be half of a double-click.
- [x] The page stops drawing frames, and the panel, redrawn only in its animation-frame callback, falls behind. Confirmed by the counter on CI: 5-7 frames between the fixture click and the fourth click, and in one failure 1 frame in more than 5 seconds, against about 12 a second once it recovered; no page errors.
- [x] What starved the frames: the spec's own search. Confirmed by measurement, locally at four CPUs on one build, by a scratch probe (not kept) that ran both searches: the search by clicks drew 255 and 258 frames and held the page 10.5 and 9.8 s; reading the stack drew 1 frame in 25 and 26 ms and found the same 43 qualifying points. Locally the page drew its next frame within 57 ms of either search, so the multi-second starvation is CI's.

## Investigation log
- 2026-09-24 morning (first session) — local reproduction attempts above; the CI diagnostic runs; the frame counter.
- 2026-09-24 afternoon (second session) — the tree-scoped CPU mask; the scan-backlog probe; a scratch click-cost probe (not kept), timing the game's own pointer handling between a capture and a bubble listener on the window: at four CPUs a click's own handling has a median of 1-2 ms before and after the fix, a worst case of 452-502 ms before the fix, and after it a one-time 577 ms on the page's first pointer event (which event it was before the fix was not recorded, and neither was examined), and right-click spam at 10 a second ran at 16.8-17.9 frames a second before the fix against 19.8-20.3 after.

## Root cause
Every hit test drew a full frame, even with the snapshot it reads already on screen, and the spec's search made about 240 of them in one task, so SwiftShader on CI's runner was left with seconds of queued rendering; the selection panel updates only on an animation frame, and the spec gave it five seconds of wall clock.

## Fix
- `src/app/AoeVoxelGameView.ts`: one hit-test preamble for a click, a right click and a stack read, which draws only when the renderer is not interaction-ready: when a snapshot is waiting, or at boot, after a bridge swap, or while the context is lost or restoring. The hit result is the same with or without the extra frame: with the state ready, `presentedNowMs` already equals the animation clock, which only `present()` moves, and `present()` makes the state not ready.
- `src/input/voxelSelectionController.ts`: `entitiesAtWorldPosition`, the stack a click walks, read without selecting. `browserTestApi.ts`: `getClickStackAtWorldPosition`. `AoeVoxelWorldRenderer.ts`: `framesDrawn` in the renderer state.
- `tests/browser/game-selection-click.spec.ts`: the search reads the stack and asserts it drew at most one frame; each click is checked on the bridge, then on the panel two rendered frames later within the old five seconds. The moving-villager test's search reads the stack and clicks once.
- Gates and their proofs: `docs/learning/gate-proofs.md`, "A hit test draws only a snapshot that is waiting". CI stability: on CI 240 of 240: two runs of a branch that ran this test and the moving-villager test 20 times each on three shards (runs 36069113956 and 36069127456, 120 runs of each test, 4.5-4.8 min a shard), where the first session's diagnostic runs of the old spec had failed 17 of about 79. The fourth shard of each run played the real browser shard 3/4, where it had failed on main, and passed 53 of 53 both times.
