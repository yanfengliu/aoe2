# Hosted CI flakes: the boar-strike presentation wait and the live-Moebius fog test's time

Status: active
Owner: ci-flakes-1104 worker; coordinator integration owner
Created: 2026-11-04
Updated: 2026-11-04

## Problem and outcome

Two of the three hosted CI flakes the coordinator assigned on 2026-11-04 have causes outside work 137's theme; work 137 holds the third, the resource-worker walk. Both ran on commits that changed only `.md` files.

- `tests/browser/voxel-unit-attack-animation.spec.ts:36` failed once in 101 main CI runs since 2026-10-01: run 40983419097 (job 123828667041, shard 4/4) read the frozen pose's parts as `null` before two animation frames and as revision-13 parts after them.
- `tests/browser/art-style-setting.spec.ts:174` used 69% (20.8 s) and 67% (20.1 s) of its 30 s limit on shard 1/4 in runs 39383478029 and 39810774781, and `scripts/test-time-headroom.mjs` fails a test past two thirds.

Outcome: each verdict stops depending on the runner's speed, for an explained reason, with every check kept.

## Scope

The two specs, their helpers, one new gate spec and the records. Excluded: civ-engine and voxel, `scripts/ci-status.mjs`, `scripts/controlWorktree.mjs`, AGENTS.md and the CI workflow's limits. Product source only where evidence proves a product defect.

## Approach

Each failure's own Playwright trace came first; no failing run recorded a bundle, so the recorded-world instruments do not reach these questions. Live probes name that in their `// harness:` lines; they and every measurement are kept, ignored, under `tmp/ci-flakes-1104-evidence-20261104/` in the primary checkout. The hosted rates and times come from all 404 browser-shard job logs of those 101 runs. The investigation is `docs/debugging/2026-11-04-hosted-ci-flakes.md`.

## Acceptance criteria

- [x] The boar flake is explained from its trace and reproduced locally.
- [x] Its fix keeps every assertion, and a new gate fails on the old wait under forced timing.
- [x] The art-style case is cheaper, or split into cases with the same checks, under two thirds of its limit with margin, every check kept; otherwise it is reported with evidence that the test cannot reduce its own work. Met by the second branch: reported, not fixed (Outcome).
- [ ] Independent review of the exact revision, the full gate, landing on main and the hosted run.

## Implementation steps

- [x] M2, boar strikes: diagnose, fix the wait, gate it, count before and after.
- [x] M3, art-style headroom: measure where the time goes, try every check-preserving reduction found, report.
- [x] Review round 0 ([reviews/0_implementation.md](reviews/0_implementation.md)), Codex and Claude on `cae06026`: three major and eleven smaller findings, F0-F13. All were repaired, except F12, accepted as a note with no change, and the rejected parts of F6 and F11.
- [x] Review round 1 ([reviews/1_implementation.md](reviews/1_implementation.md)) on `945ec5e5`: no blocker or major finding; F10 (the evidence copy, now made and checked), F1, F2, F5, F14 and F15 repaired or written down as bounds.
- [ ] A focused round 2 on F14's repair, then gate, land and follow hosted CI.

## Investigation

2026-11-04, M2. The trace's revisions: resting parts at 3 and first strike at 5. Then `inspectVoxelUnitMotion` ran six times and twice more, and the frozen "before" read came at presented revision 13 with both parts `null`. Two animation frames later, the "after" read was at revision 13 with parts. Eight reads, eight revisions. `inspectVoxelUnitMotion` forces a view sync, and in the paused fixture the sync changes nothing visible. voxel's `render-world.ts` marks such a delta presented at once when its base was presented. So the spec's wait, `presentedRevision === acceptedRevision`, agreed immediately. But `AoeVoxelWorldRenderer` hands its pending hit state over only inside `frame()`, and until then `isInteractionReady()` is false and `inspectPresentedVoxelPartMatrix` returns null. The spec passed whenever a frame landed between its last forced sync and its read. Real input is unaffected, because the click path's hit test draws a frame whenever the hit state is behind.

2026-11-04, M2 fix. `waitForPresentedHitState` (`tests/browser/helpers/gameTestHelpers/presentation.ts`) waits for a world frame drawn after it began, with the runtime running and the accepted epoch and revision presented, which is `isInteractionReady()` read from outside. The boar spec uses it at all five of its waits, changes no assertion, and adds one: its frozen pose's parts must be non-null before they are compared, because null before and after would also be equal. `tests/browser/voxel-presented-hit-state.spec.ts` is the gate. It holds frames with a gate on `requestAnimationFrame`, forces two syncs, and checks a round trip later that the window is open: no frame drawn, the watermark moved by 2, no part. It then starts the wait and lets frames through only after seeing the wait read the renderer's state four times without returning, and requires the wait to be pending at that point and the part, at the presented revision, after it. The first version released frames on a 1 s timer; review round 0 (F1) showed a slow enough host could let the old wait pass it.

2026-11-04, M2 counts, SwiftShader on this machine, unchanged spec against fixed spec in three interleaved rounds of 20: unchanged 9 of 60 failed (3 per round, every one CI's diff), fixed 0 of 60, and after review round 0's repairs 0 of 60 again in three more rounds of 20. A first batch of the unchanged spec failed 2 of 20 the same way. The handshake gate passed 5 of 5. It failed 10 of 10 with the wait's frame requirement removed, and 10 of 10 with the spec's original wait put back verbatim, each at the check that the wait is still pending after polling with frames held, which read "returned"; the helper was restored byte-identical each time.

2026-11-04, M3, CI. Over 51 runs since the case was split out on 2026-10-14 it took 8.6-20.8 s, median 14.2 s, and its neighbours moved with it: 138 (Natural only) 3.1-6.9 s, 146 (the live switch) 7.3-16.9 s, 185 (boot in Moebius) 7.5-14.6 s.

2026-11-04, M3, where the time goes. Measured on SwiftShader with the browser and its processes pinned to 4 logical CPUs, a model of CI's 4 vCPUs. It reproduces CI's ratio of this case to case 138 (3.2, against 2.4-3.5 on CI), though not case 185's (1.4, against 2.1-2.6). The case took 4.9-5.5 s as the first test in a worker, and 5.7-7.6 s after another one. Its steps: boot 0.56 s; the switch about 0.25 s; the sample 3.2-3.7 s, of which the world capture was 3.1-3.5 s. Back-to-back captures put that capture's cost in the first Moebius draw: unpinned, the first Moebius capture took 1.24-1.26 s and the next one 0.20-0.21 s. Process CPU sampling shows the GPU process (SwiftShader) keeping about 2 of the 4 CPUs busy for as long as a paused Moebius page is open. The live loop redraws the unchanged frame. After the page closes the GPU process still works for up to about 2 s, and that is the cost a following test inherits: a 3 s idle gap after case 146 brought case 174 back to its first-in-worker time.

2026-11-04, M3, candidates measured on that model and rejected:
- Reading the live canvas in a frame callback instead of capturing. Its pixels are byte-identical to the capture's in both styles, but it is no faster: first read 3.1-3.5 s either way; warm, 2.0-2.5 s against the capture's 1.7-1.8 s.
- Holding the live loop's frames during the read. Four interleaved pairs: 4.96-5.29 s as it stands, 4.98-5.35 s held.
- Running case 138 between cases 146 and 174. Four interleaved pairs: case 174's mean went from 6.94 s to 6.66 s, inside both arms' 6.26-7.65 s spread.
- Splitting the case. Every part would repeat the boot, the switch and the first Moebius draw.
- A smaller viewport, another zoom or another order of switch and zoom. Each changes the cells and camera the bound names.

The levers that remain are outside the test. The game redraws an unchanged paused frame every animation frame. `getWorldCapture` draws twice per capture, `renderer.frame` and then `runtime.capture`'s `renderCurrent`, and the annotation feature uses it too. And the limit itself, which the owner's contract keeps out of a worker's hands.

## Outcome

2026-11-04: M2 is fixed and gated in the spec and its new helper; landing and the hosted run are recorded here as they happen. M3 is not fixed. The test has no cheaper path to the same checks: its time is the first Moebius draw at zoom 0.7 and the GPU work the live loop keeps queuing, as measured above. It is reported to the coordinator with this evidence and an OPEN defect-register entry. The limit is unchanged.

Bounds: M2's gate releases frames only after it has seen the wait poll without returning, so its verdict does not depend on the host's speed; a host so slow that the wait's own 5 s budget runs out while frames are held fails it, and says the wait threw. It covers one fixture, one forced-sync source and one part, and context loss is read from the code, not forced. The before and after counts come from one Windows machine on SwiftShader. Hosted runs have not been repeated.
