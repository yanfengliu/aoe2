# The frame rate holds through a match

Status: active
Owner: Claude coordinator (Game orchestrator todos); worker frame-rate (worktree `aoe2-worktrees/frame-rate`, branch `frame-rate`)
Created: 2026-10-15
Updated: 2026-10-15

## Problem and outcome

The play session of 2026-10-14 (v0.3.257, the lobby's defaults, real mouse and keyboard, dev build, an RTX 4090 through ANGLE D3D11 at 1600x900) measured the frame rate falling through a match: 59.7 fps at 00:15 of game time, 48 at 02:50, 39 during a fight, then about 21 at 19:30, where typical frames took 50 ms and the worst 67 to 100 ms. It was the same over the player's base and over an empty corner at (55,3), so what is on screen does not explain it. The simulation kept its 15 ticks a second and the heap read 109 MB. The page was about 45 minutes old and had loaded a save and opened a replay, so match state and page age were not separated. The record is in work 106's card queue.

A player in DE does not watch the game slow down as a match goes on. Outcome: the frame rate late in a match stays close to the opening's, on this machine and on the CI rasteriser, and a gate holds that with a measure that does not depend on how busy the machine is.

## Scope

- Included: finding what grows with match time or page age and costs frame time, fixing it, and the gate.
- Excluded: simulation tick cost unless the measurements put the cause there; art changes.
- Off limits while they run: work 126 (foundation claims, foundation start, placement and construction-start files), work 128 (the AI's Monk and relic code, occupancy for carried relics), and the self-play gates work 128 re-derives.

## Approach

Separate the two candidate causes before anything else: a fresh page that loads a save of a late match, against one page kept open for the whole match, and a page kept open with nothing happening. Name the instrument first (AGENTS.md, Debugging): the existing frame-cost gate `tests/browser/de-ground-frame-cost.spec.ts`, Chrome's own tracing and heap snapshots through Playwright, and counts read from the renderer (draw calls, instances, meshes, textures, listeners, timers) sampled over the match. Prefer a count that grows with the defect over a timing, because timings on this shared machine swing with foreign load (local rules, "A feature's cost is its own share of tick time"); give any timing with its spread and the machine's load.

## Acceptance criteria

- The cause is named with evidence: which quantity grows, from which code, at what rate, and whether match state or page age drives it.
- After the fix, a late-match frame (about 20 minutes of game time, or its saved state) costs close to an opening frame on this machine, with numbers before and after and their spread.
- A gate that goes red with the defect put back, preferably on a count rather than a timing, and its bound stated in its header.
- Visual output is unchanged where the fix is not meant to change it: before and after captures with a pixel diff, per the repo's visual rule.
- A register entry, a changelog line and version at landing, the devlog lines, and the spec if it states a performance target.
- `npm run verify` exits 0 with its log read through the build, `node scripts/verify-receipt.mjs check` prints OK, and the change is on main.

## Implementation steps

- [x] Separate state from age (2026-10-15): match state drives it, page age does not. A fresh page that loads a save of a late match is slow at once (31-34 fps against 57 for the opening in the same page); a page kept 20.6 minutes at Normal speed with an idle human, and three replay round trips, leave the frame cost and every leak count flat.
- [x] Find the growing quantity (2026-10-15): the voxel instances the presentation rebuilds and resubmits on every drawn frame, one per part of everything the human sees or remembers. 1,513 at the opening, about 2,450 at tick 1,700, 3,000 at 11,700 and 3,625 at 18,000 in a match where the AI plays the human seat, at about 4.8 µs each per frame on this machine. Evidence, profiles and counts: `docs/debugging/2026-10-15-frame-rate-through-a-match.md`.
- [x] Fix, M1 (2026-10-15): the coordinator chose option A. A still entity keeps its parts while its projected view is equal field by field, the ground's detail is kept while the visible ground is unchanged, and the opaque surfaces come in terrain, still and moving lanes that keep their revision while unchanged, so the runtime keeps them; the shadow and memory lanes stay one batch each (below). The HUD writes a value only when it differs, which was the cost the audio loop's rect reads showed. Folded in: the Natural ground packs once per frame object. Branch `frame-rate`, no version bump.
- [x] Gate and record (2026-10-15): `tests/rendering/presentationFrameWork.test.ts`, `tests/browser/presentation-keeps-still-world.spec.ts`, `tests/rendering/aoeVoxelLaneEquivalence.test.ts` and `tests/browser/hud-frame-dom-writes.spec.ts`, each red with its defect put back (`docs/learning/gate-proofs.md`); the register entry of 2026-10-14 (OPEN for the part below), the spec's §14.5 rule, the changelog under Unreleased, the devlog, `ARCHITECTURE.md`, the drift log and `decisions.md`. `captureMapScreenshot.mjs` gained `LOAD=<save.json>` for the late-state captures.
- [ ] M1 review and landing (phase 2 on the coordinator's word).
- [ ] M2, only on the coordinator's word: the shadow trade below, and B if the full-snapshot validation still counts.

## Diagnosis and options (2026-10-15, for the coordinator)

What happens: `AoeVoxelPresentationCoordinator.syncFromBridge` presents whenever the interpolation alpha moved, which is every frame while the match runs. Each present runs every entity's recipe and cast shadow (`AoeVoxelAdapter.createSnapshot`), sorts and packs every part into new batches with a new revision (`makePartBatches`), and hands `ThreeRenderRuntime` a whole snapshot, which it validates, pages and writes into the instance buffers in full. Counted through the runtime's own metrics: one new revision per drawn frame, and instance matrices written per frame equal to all instances. Of a late frame's main-thread time, the snapshot build is 51%, the runtime's ingest and buffer writes 19%, and the simulation 3.4%. Nothing depends on the camera, which is why the base and an empty corner cost the same.

Options, largest gain first:

- A. Incremental presentation (recommended). Keep each entity's parts and cast shadow while its projected view is unchanged, build the static batches (buildings, resources, remembered entities, terrain detail) only when one of their entities changed and keep their revision otherwise, so the runtime reuses them (it already skips a batch whose version is unchanged and writes only changed pages), and rebuild units, projectiles and per-frame overlays every frame in batches of their own. Gain: in Node the adapter's late frame falls from 13.2 ms to 3.9 ms; static content is about half of the late frame's main thread, so a late frame would cost about what an opening frame costs today. Risks: the shadow lane resolves every caster's level in one pass (`resolveShadowLevels`), so split lanes need a rule that keeps overlapping unit and tree shadows blending once, or those pixels change; the descriptor's 9-batch limit rises; the hit state stays per presented revision; `aoeVoxelAdapter.ts` (471 lines) has to split. Size: one or two milestones of several hundred lines in `src/rendering/voxel/`, with unit tests that every field of the projected view invalidates the cache, and pixel diffs at several framings in both styles.
- B. A with runtime deltas: frames between ticks go through `acceptDelta` with `patch-batch-instances`, so even validation scales with what moved. Larger, and the delta contract is new to this repo; worth it only if A leaves the whole-snapshot validation significant.
- C. A recipe cache alone: reuse an entity's parts while its projected view is equal field by field. Under 100 lines and pixel-identical by construction, but it saves only the static recipes (about 14% of a late frame); batching, ingest and buffer writes stay proportional to the whole world, so the slowdown remains at a gentler slope.
- D. Present only what is near the camera, with a margin for tall buildings and shadows. On this 60x36 map at the opening zoom the view and a 3-tile margin hold 46% of the cells, and over the base it kept 94 of 122 non-tile entities at tick 11,700: it fixes the empty corner, not the base. Test-API picks outside the view would find nothing.

Independent of the choice: the audio loop's `stackAboveBell` forces layout three times a frame (3.5-6.2% of the main thread at any match state).

The gate for A, B or C: instances written per drawn frame between ticks (`instancePresentationMatrixWrites` over `framesDrawn`, from `getWorldRendererState()`), at a saved late match against the opening in the same page. Today it reads 1,513 at the opening and about 3,000 at tick 11,700, and it does not move with machine load. Its fixture is a late save (590 KB, over the 256 KiB promotion threshold, so it needs a stated reason) or a state the test builds; a Node test over the adapter at tick 1,700 (6 s to simulate) is the cheap half.

## M1 result (2026-10-15)

The shadow lane could not be split without changing pixels. Overlapping shadows blend once only because the lane draws its highest pieces first inside one batch; three.js orders separate translucent batches by the depth of each one's bounding-sphere centre, the voxel runtime gives aoe2 no render order, and voxel's order-independent single-layer transparency is internal to the package. The same holds for the memory lane (fog ghosts, then the behind-building silhouettes). So both stay one batch each, rebuilt from kept parts on any frame a unit moves, and M1 changes no pixel there.

Picture: the new adapter and the old one draw the same instances (`tests/rendering/aoeVoxelLaneEquivalence.test.ts`). Captures on SwiftShader at 1280x800, before and after, Natural and Moebius, the opening and a loaded tick-11,700 save, zoom 1.2 and 2.4: 0 changed pixels in 6 of 8 framings, 1 pixel in the two late zoomed ones; the same build captured twice differs by 0 in all 8. On the GPU, the late default view: Natural 2 edge pixels, Moebius 0. The instances being equal, the differing pixels are depth ties between opaque surfaces in different lanes, which the draw order decides.

Cost, in the browser, interleaved against the base build (4 rounds; 26-32 of 32 CPUs busy with other work and the GPU shared with a game, so the timings are inflated for both arms):

| | base 976c7c3f | M1 |
|---|---|---|
| Opening, frame callbacks p50 | 14.6 ms (14.0-14.8) | 7.2 ms (7.1-7.2) |
| Opening, fps | 56.7 (53.1-58.2) | 58.9 (55.7-58.9) |
| Tick-11,700 save, callbacks p50 | 27.3 ms (25.5-30.1) | 12.5 ms (11.6-13.7) |
| Tick-11,700 save, callbacks p90 | 37.9 ms | 18.8 ms |
| Tick-11,700 save, fps | 32.6 (24.5-36.4) | 58.7 (51.4-59.7) |
| Matrix writes per drawn frame, opening / late | 1,513 / about 3,010 | 876 / about 2,070 |

A late frame now costs less than the base build's opening frame, but still 1.7 times M1's opening frame: the shadow lane (43% of instances at tick 11,700, 1,260 of 2,931) and the memory lane are rewritten on every frame a unit moves, and the units themselves are posed every frame. The acceptance criterion "a late-match frame costs close to an opening frame" is met only in that weaker sense.

The trade for M2, the coordinator's to make:

- (b) A voxel change that exposes single-layer transparency as a public material option. Static and moving shadows then go in separate batches; pixels are expected to be identical except possibly where the shadow depth prepass, which draws before all translucent objects, now precedes the memory lane, to be measured. A cross-repo change with its own gates and review.
- (c) A look change: unit shadows in a band above every still shadow, drawn first. Blending stays exactly once; unit shadows float 0.04-0.1 world units, a few pixels at the closest zoom. Still one batch rebuilt per frame, so it gains less than (b).
- B, the runtime's deltas between ticks, would also stop each frame validating and comparing the kept batches in full (the runtime parses every snapshot twice).

## Outcome

Pending. Record the verified revision, checks and limitations at closure.
