# Debugging session — the frame rate falls through a match (work 130)

## Symptom

The play session of 2026-10-14 (v0.3.257, the lobby's defaults, real mouse and keyboard, dev build, an RTX 4090 through ANGLE D3D11 at 1600x900) measured 59.7 fps at 00:15 of game time, 48 at 02:50, 39 during a fight and about 21 at 19:30, where typical frames took 50 ms. It was the same over the player's base and over an empty corner at (55,3). The simulation kept 15 ticks a second. The page was about 45 minutes old and had loaded a save and opened a replay, so match state and page age were not separated (work 106's card queue; `docs/work/130_frame-rate-through-a-match/plan.md`).

## Expected vs actual

- Expected: a late-match frame costs about what an opening frame costs, as in DE.
- Actual: a frame's main-thread cost grows with everything the human player knows of in the world, wherever the camera looks.

## Reproduction

- Instrument, named before any probe: none of AGENTS.md's simulation tools measures a browser frame (they replay or profile the headless simulation). The instruments used were the frame-cost gate's own probe from `tests/browser/de-ground-frame-cost.spec.ts` (every animation-frame callback wrapped and timed), the runtime's own cumulative counters read through `window.__AOE2_TEST__.getWorldRendererState().metrics` (`instancePresentationMatrixWrites`, `snapshotCopiedTypedArrayBytes`, `acceptedRevision`, `instances`), Chrome's sampling CPU profiler over CDP, and the headless harness's `forceAiForOwners` switch to make saves of a late match that the HUD's own Load opens.
- Build: `npm run build` (minified) and `npx vite build --minify false --outDir tmp/dist-nomin` (names for the profiler), served by `vite preview` on port 4660; Playwright's Chromium headless shell with `--use-angle=d3d11`, 1600x900, `?seed=aoe2-prototype&civ=Britons&speed=normal` (the lobby's defaults).
- Late states: `createSimulationBridge('aoe2-prototype', { civilizationsByOwner: Britons for owner 1, forceAiForOwners: {1} })` stepped at 100 ms and saved with `saveGame()` at ticks 1,700, 6,000, 11,700, 18,000, 24,000 and 30,000 (590-640 KB each), loaded in a fresh page through game menu, Load game, Load, then Resume.
- The scratch probes lived under the worktree's ignored `tmp/probes/` and are not kept; this file holds their results.
- Machine load: 32 logical CPUs, 10 to 32 of them busy with other sessions and a game the owner was playing (`os.cpus()` deltas over each window; `typeperf` agreed at 80-95% during the worst windows). Timings below come with the load beside them; the counts do not depend on it.

## Hypotheses

- [x] Match state: what the human knows of in the world costs per frame. Confirmed below.
- [x] Page age: something left behind by time, a load or a replay (listeners, timers, DOM, animation-frame loops, GPU resources). Ruled out up to a 20.6-minute page and three replay round trips.
- [x] Simulation tick cost. Ruled out: 3.4-5.4% of the main thread at the late state.
- [x] GPU work. Ruled out: 10-11 draw calls and 23k triangles over the base, 4 draw calls and 8.8k over the corner, at the same frame cost.

## Investigation log

- 2026-10-14 22:00 — Fresh page, human idle, fast-forwarded with the test API's `stepTicks` to 11,761 ticks (page age 73 s): 58-60 fps, callbacks 13.8-16.6 ms a frame at the median (busy 20-31 CPUs), instances flat at 1,490-1,518. Time alone does nothing when the human's world does not grow.
- 22:03 — Fresh page that loads the tick-11,700 save through the HUD: 31-34 fps against 57 fps for the opening in the same page; callbacks 27.5-30.4 ms against 14.8 (busy 25-27 CPUs); instances 3,025-3,075 against 1,513. The same over the corner (55,3), where draw calls fall from 11 to 4 and triangles from 23k to 8.8k.
- 22:05-22:26 — A page kept 20.6 minutes at Normal speed with the human idle (to tick 18,085): callbacks 11.5-13.6 ms when fewer than 24 CPUs were busy and 17-18.5 ms when 30-32 were; DOM nodes 271, listeners 91, intervals 1, four animation-frame callbacks a frame, all flat. The heap rose from 128 to 342 MB (noted below, not the frame cost).
- 22:30 — Three round trips through Watch a replay, Live session, Start replay, Play for 5 s, Exit: four callbacks a frame before and after, DOM 271, intervals 1, per-frame counts unchanged; listeners 91, 90, 92, 94 (one more per round trip).
- 22:35 — Load-independent counts, opening against saves in the same page (busy 13-20 CPUs): every drawn frame accepts a new render snapshot (revisions = frames drawn) and rewrites every instance (matrix writes a frame = instances). Opening: 1,513 instances, 105 KB copied a frame, callbacks 7.9-8.4 ms. Tick 1,700: 2,341-2,512, 164-175 KB, 10.9-12.4 ms. Tick 6,000: 2,572-2,597, 178-182 KB, 12.2-13.4 ms. Tick 11,700: 2,973-3,054, 210-212 KB, 13.6-16.4 ms.
- 22:40 — CPU profiles, 5 s each, unminified build. Opening: main thread busy 59%. Tick-11,700 save: busy 95%. Of the late frame's busy time: `AoeVoxelPresentationCoordinator.syncFromBridge` 62.9%, of which `AoeVoxelWorldRenderer.present` 60.7%: `AoeVoxelAdapter.createSnapshot` 51.2% (`prepareInstanceEntities` 23.3% with recipes for resources 9.7%, units 5.8%, buildings 4.0% and their cast shadows 15.0% inside them; `makePartBatches` 19.1%; terrain detail 3.0%) and `ThreeRenderRuntime.acceptSnapshot` 8.3%. The runtime's frame 14.4%, nearly all `reconcile` and `writeBatchSlots`. The simulation tick 3.4%. Garbage collection 3.9%. The audio loop's `stackAboveBell` reads layout three times a frame, 3.5% late and 6.2% at the opening.
- 22:50 — In Node, `createSnapshot` over the tick-11,700 render state, interleaved 7 rounds of 30 frames: 13.16 ms for the whole world (2,931 instances), 3.93 ms for units plus terrain detail (1,038), 9.04 ms for everything but units (2,343). At tick 1,700: 9.85, 2.81 and 9.26 ms.
- 22:55 — Instances per entity: a visible tree 22-23 (its shadow included), a remembered tree 6, a villager 32, a Spearman 41, a Scout 38, buildings 44-62 (Town Center 62), remembered buildings 17-26; terrain detail and overlays 443-789. The AI playing the human seat reaches 3,625 instances at tick 18,000 and stays near 3,400-3,600 to 30,000, housed at 26-30 population; a player's economy is larger.

## Root cause

The presentation rebuilds and resubmits the whole known world on every drawn frame. `AoeVoxelPresentationCoordinator.syncFromBridge` presents whenever the interpolation alpha moved, which is every frame while the match runs, and each present runs every recipe (with its cast shadow) for every entity the human player sees or remembers, sorts and packs every part into new batches with a new revision, and hands the runtime a whole snapshot, which it validates, pages and writes into the instance buffers in full. The work per frame is about 4.8 µs per instance on this machine (opening: 1,513 instances, 7.3 ms of the world frame; tick 11,700: 3,020, 14.5 ms), and the instances grow with the match: trees seen while scouting stay as memories, buildings and villagers accumulate, and the line of sight widens. None of it depends on the camera, which is why the base and an empty corner cost the same. Page age plays no part.

## Fix

Not built in this session: the cause is the presentation's architecture (a whole snapshot a frame), so the options went to the coordinator first, per the work-130 brief. They are in the plan.

## Verification

Not yet; the plan names the gate's measure (instances written a frame, read from the runtime's counters, at a saved late match against the opening).

## Follow-ups

- The heap of a running page rose from 128 to 342 MB over 18,085 ticks (sampled, not garbage-collected first), with frame costs flat; not investigated.
- `stackAboveBell` in `src/audio/mountGameAudio.ts` forces a layout three times a frame (3.5-6.2% of the main thread) whatever the match holds.
- One event listener more per replay round trip (91 to 94 over three).
