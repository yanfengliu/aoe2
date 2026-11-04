# Restore resource-worker movement CI

Status: active
Owner: ci-flakes-1104 worker (took over 2026-11-04); coordinator integration owner
Created: 2026-10-19
Updated: 2026-11-04

## Problem and outcome

Restore main's failed real-input resource-worker flow without weakening its movement or occupation checks. The original full-art task remains outside this bounded assignment.

## Scope

Base: 28186cbc49ae2453f8cc05eb40d830bd84cbf551. Assigned worktree: work135-main-ci-red-1018. Inspect only run 39193369383's current failure, then repair the supported test or product defect. No civ-engine, voxel, parked UI, owner-chat, workflow rerun or unrelated edits. Root owns integration and final gates.

## Approach

The retained Playwright trace is the first debugging instrument. It observes real controls but contains no recorded authoritative world state at the failing click. If a live control is needed, read bridge.getDebugSnapshot() for unit cells and paths; do not bypass input, pause or step the simulation. Initial diagnosis must reach root before implementation.

## Acceptance criteria

- [x] Explain the retained failure with evidence and a meaningful regression contract (2026-11-04, Investigation below).
- [x] Real right-click movement keeps the food occupation at 1, then real House placement changes it to 0 at all three original viewport widths (now with the worker proven still walking when the House order lands).
- [x] Preserve the Moving assertion, real controls and timeout; no direct state or command shortcut.
- [ ] Pass affected headless checks, independent exact-revision review, integrated full verify and remote gates before completion.
- [ ] Root merges and pushes main; task-owned processes and unneeded temporary resources are cleaned safely.

## Implementation steps

- [x] Run ci:status first and inspect required repository records.
- [x] Retrieve only the exact failed artifact and verify its uploaded ZIP digest.
- [x] Hand initial trace facts, candidate mechanism and proposed control contract to root.
- [x] Run the approved bounded instrumented original-contract control; it passed, so the hosted cause remains open.
- [x] Take over (2026-11-04): read the third failure's trace (run 40960398985) and count every hosted run since 2026-10-01.
- [x] Repair the spec: force CI's geometry on every host, keep the walk long by construction and assert that premise; prove the premise check red with the old anchor.
- [ ] Review, full gate, landing and hosted CI (the integration steps above).

## Investigation

2026-10-19: ci:status first returned UNKNOWN under blocked sandbox networking, then the elevated read reported tip CI still in progress and corpus green. This does not clear the already-failed browser shard. Job 117870763684 on run 39193369383 failed resource-workers.spec.ts:124 at 1920px: Moving expected, Gathering food then Idle observed. It reported 64 passes, one skip and one failure among 66 cases.

2026-10-19: Retrieved artifact 12161172956 once. It is 1,364,947 bytes with SHA256 4170ba1fd127c1cbfe451075d3f0fc90eccf990157c5c680b2443eeb897bc532, matching the upload log. Task-owned raw evidence lives under tmp/work137-resource-worker-ci/; no raw evidence enters Git. Source: https://github.com/yanfengliu/aoe2/actions/runs/39193369383/artifacts/12161172956.

2026-10-19: Trace selects villager 2205 at (6.25,8.75), confirms its identity, and right-clicks sheep 2164 at (7,5). Food workers becomes 1. House-anchor search later returns (8,6), and the test right-clicks its projected point (1036.8,288), above the HUD. It does not require distance from the selected moving worker. The gather-to-move input interval is 3.29 seconds; screenshots lag the trace's input events and do not establish the worker's authoritative click-time position. A short or zero-length move is a candidate, not a proven cause. Raised context interception remains another candidate. No evidence implicates font work, voxel art studies or unit selection.

2026-10-19: Proposed narrow contract is a legal, mouse-reachable House anchor separated from the worker, with original real-input Moving, food=1 and House food=0 assertions retained. Awaiting root's serial resource slot for one unchanged-test reproduction with read-only state observation. No browser, server or product/test edit exists yet. Exact allocation registry was copied unchanged from root; SHA256 6ff29891ce9db7c6b1acb3d1a2641cef0439d191cca6dbf95e9bf6ff5f0270e9.

2026-10-19: Runtime attempt 1 used the original controls/assertions/deadlines at 1920px with a passive pointer listener added temporarily. This was an instrumented original contract, not unchanged test text. Each input's read-only debug/economy/HUD sample cost 0.1–0.3 ms; timer samples at 0/100/300/750/1500/3000/5000 ms added diagnostic work. The run passed (one test, 4.1 s test / 7.5 s suite). It chose anchor (7,6), unlike hosted (8,6). Move click at tick 6 saw villager 2205 at coarse (6,8), fine (6.25,8.5); tick 7 had move toward (7,6), tick 10 had Moving in the DOM with food workers 1, and tick 17 had Building House with food workers 0. Gather-to-move input interval was 0.271 s locally, versus 3.29 s hosted. These observations support a timing-sensitive anchor premise but do not prove the hosted cause. No second runtime is selected yet.

2026-10-19: Separate preparation passed: node scripts/build-content.mjs and npm --ignore-scripts run build. Ignoring hooks avoided any voxel/civ-engine rebuild; no dependency repair was attempted. The run requested SwiftShader and recorded its exact Chromium launch flags; the actual WebGL renderer string was not queried. Windows local timing and backend are not substitutes for the Ubuntu hosted run.

2026-10-19: Playwright root PID 25840, browser PID 26652, profile playwright_chromiumdev_profile-Kn1zIj, hidden preview 4287. The finally path observed 13 owned processes, closed all, and confirmed zero remaining and port 4287 closed. Original resource-workers.spec.ts was restored byte-for-byte with SHA256 ad6921d0ceb955eae10d58766a299f3bd4dddfd38a4e3a43ebae55ff7769d4c8; git reports no test/source changes. Raw logs, passing trace and exact process receipts remain under tmp/work137-resource-worker-ci/ for this unresolved issue. Diagnostic runtime attempts: 1; behavioral repair attempts: 0. Total calls/compute: unknown; one browser case, one browser invocation.

2026-10-19: Runtime attempt 2 retained the original 1920px controls, assertions and 60-second deadline, with one explicit 3290 ms wait after food workers 1. Passive input samples and one maintained click-stack read were added; this is a changed-timing diagnostic, not unchanged test text. It passed (one case / one invocation, 6.6 s test / 9.7 s suite). The gather-to-move input interval was 3.814 s. The anchor was the hosted (8,6), its left-click stack was empty (2.1 ms read), and the pointer hit the canvas. At move-click tick 60 villager 2205 was coarse (7,6), fine (7.25,6.75), gathering. Tick 61 had move toward (8,6), task moving, food workers 1, while the DOM still said Gathering food. Tick 65 showed Moving and food workers 1; tick 71 showed Building House and food workers 0. Actual WebGL rasteriser named ANGLE/Vulkan SwiftShader. This excludes a persistent blocked move or visible interception on this local control; it does not prove the hosted cause.

2026-10-19: Diagnostic 2 root PID 27904 and its 13 observed owned processes were closed in finally; port 4287 was closed and original test bytes restored to the same SHA256. Its trace/log/process receipts remain under diagnostic2-results and diagnostic2.* in the task evidence folder. Both approved diagnostic attempts are spent; behavioral repair attempts remain 0. Root received the result and must reassess before any next runtime or source fix. Minimal proposed fixture improvement is a legal canvas-reachable anchor at least four tiles from the current worker, retaining every original assertion; the measured walking interval at the hosted anchor is short, but the hosted causal mechanism remains unknown.

2026-11-04: Taken over by the ci-flakes-1104 worker in its own worktree, from main 61758598 and later c783b710. The full account, with every instrument and probe, is `docs/debugging/2026-11-04-hosted-ci-flakes.md`.

2026-11-04: Hosted rate. Of 101 main CI runs since 2026-10-01 (404 browser-shard job logs), the 1920px case failed 3 times: runs 38675522945 (2026-10-15), 39193369383 (2026-10-19) and 40960398985 (2026-10-29). All three came after work 123 cut the case from about 32 s to 9-16 s on 2026-10-14, about 49 runs, and none before. The 800px and 1280px cases never failed.

2026-11-04: Third failure, run 40960398985. Same villager 2205, sheep 2164 at (7,5), anchor (8,6), gather-to-move 3.37 s. After the move click, Playwright read "Gathering food" at +24, +27, +130 and +387 ms and "Moving" at +891 ms; the DOM snapshot at +900 ms holds "Moving" with food 1, and the first food poll at +949 ms read 0, then "Idle". So the walk ended about 0.9 s after the click, and the HUD showed it once.

2026-11-04: Geometry. A per-frame probe shows the worker walking from (6.25,8.75) and gathering at (7.25,6.75) from tick 41. Ordered once it gathers, the move to (8,6) is 1.06 cells (1.27 to the cell's centre) and showed "Moving" with food 1 for 720-760 ms, 10-13 SwiftShader frames. CPU throttling at 4x produced that geometry on its own (gather-to-move 3.05-3.71 s, anchor (8,6)). Unthrottled, the worker is still 2.6 cells away at 0.34 s and the anchor is (7,6), which is why every local control passed.

2026-11-04: Root cause. The spec asserted states that last only as long as the walk: "Moving", the walking food occupation, and the House order's effect. Its anchor, the first valid cell near the Town Center, sits beside the sheep, so a worker that had reached the sheep, as on CI, walked about one cell, and on CI's slow frames the walk ended between Playwright's polls. The old assertions never failed locally under four slow-host models (0 of 24 runs). Under the slowest model, with 100-600 ms long tasks per frame, the one-cell walk ended before the House order in 6 of 6 runs. So on slow hosts the old House check passed without the order having caused it.

2026-11-04: Fix, in `tests/browser/resource-workers.spec.ts`. Every host orders the move once the worker is gathering at the sheep. The anchor is the first valid, mouse-reachable cell at least 8 cells from the worker, through a new keep-away option of `findValidPlacementNearTownCenter`. The spec asserts that distance before the click. It reads "Moving" and food 1 together in one evaluate, and asserts both again just before the House order. Every original assertion stays, and so do the real controls and the 60 s limit. At Normal speed a walk of 8 cells lasts at least 6.7 s, since the game runs at most 1.5 game seconds per wall second. The anchors chosen were (15,7) at 800px, (14,10) at 1280px and (13,12) at 1920px, 8.16-8.49 cells away.

2026-11-04: Red proof and counts. Reverting the anchor to the old first-ring choice turns the premise assertion red at all three widths ("Received: 1.2747548783981963", expected >= 8); the file was restored byte-identical. A one-cell walk (`MIN_WALK_CELLS = 1`) failed "still walking as the House is placed" in 6 of 6 runs with 100-600 ms long tasks per frame; the 8-cell walk passed 9 of 9 under the same model. On this machine the fixed order cases passed 3 of 3 widths on SwiftShader and on the GPU, and the whole spec 12 of 12 on both.

## Outcome

2026-11-04: The cause is explained and fixed in the spec, with the premise gated (see above). Review, the full gate, landing and the hosted run are recorded below as they happen. Bound: the fix makes the walk outlast the checks by construction; it does not show the hosted rate is zero. One hosted run cannot show that, and the old failure did not reproduce locally at a measurable rate.

Earlier status, kept as history: "Pending. Root cause, fix, runtime checks, review and integration remain open. The artifact proves the observed failure, not its causal mechanism. No product or test fix has been made. One forensic retrieval and two bounded diagnostic browser cases were completed."

2026-10-19 current priority: deferred under the human’s “I just want the art to be good” and “What are you even verifying” steering. The original authored investigation remains above; both local diagnostic cases passed, behavioral repair attempts remain 0, the hosted cause is unproved, and no product or test fix exists. Root retains ownership of the unchanged CI worktree and ignored evidence. Original tmp/ plus this plan and debugging record are copied byte-for-byte to primary tmp/work137-deferred-retained-20261019/ with source/destination bytes and digests; no cleanup or next runtime is selected.

2026-10-20 custody update: the original CI checkout and branch were safely retired using controlWorktree, exit0, after retaining83files/9,193,416bytes under primary tmp/work137-cleanup-20261020/manifest.json SHA256 a534fef8a9ffe3f2ca09f4d5c2be7264b44406590d7c1737ba5baf2cf7ad701b. Original71-file custody remains exact; source/build/ignored evidence and authored dirty bytes remain recoverable. Root owns retained custody and any future reassessment; no active CI worker, next runtime, source fix or causal clearance is selected. Protected policy/voxel instructions and parked UI content were unchanged;19other worktrees including active art documentation/review trees remained registered at that cleanup.
