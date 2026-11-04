# Review 0: implementation

## Target

Repository aoe2, commit `cae06026` on branch `ci-flakes-1104`, against its parent `c783b710` (origin/main at the time). Scope: the 16 files of that commit. The test changes are `tests/browser/resource-workers.spec.ts`, `tests/browser/voxel-unit-attack-animation.spec.ts`, the new `tests/browser/voxel-presented-hit-state.spec.ts`, and `tests/browser/helpers/gameTestHelpers.ts`, `gameTestHelpers/placement.ts` and the new `gameTestHelpers/presentation.ts`. The records are the plans of works 137 and 139, two debugging docs, the defect register and its archive, `gate-proofs.md`, and the devlog. This round covers work 137's changes as well as work 139's.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, `--sandbox read-only`, codex-cli 0.163.0. The runbook's sandbox check kept the lane: 0 failed commands. It read code outside the diff and executed the extracted frame gate in memory for finding F3. It had no network, so it did not read live CI.
- Claude `claude-opus-5-5[1m]`, `--effort max`, Claude Code 2.1.308. Tools were limited to Read, Glob, Grep, Task and Bash restricted to `git diff`, `git log` and `git show`, in `dontAsk` mode with no settings and no MCP. The runbook's report check kept the lane: one result, `modelUsage` only the pin. Init showed exactly those tools. It made 77 tool calls, four of them read-only Bash. The tree's `git status --porcelain` and `git diff HEAD` were identical before and after.
- Both lanes ran from fleet's ignored `tmp/review-runs/aoe2-ci-flakes-1104-r0/` on the same prompt (SHA-256 `a5f234e4…`). The reports below are verbatim (Codex `be670900…`, Claude `762cac92…`), except that the absolute worktree path in Codex's links is shortened to the repository path.

## Reports

### Codex (gpt-6-astra)

1. **Major — [presentation.ts:29](tests/browser/helpers/gameTestHelpers/presentation.ts:29): the predicate does not establish interaction readiness.** `framesDrawn` counts renderer `frame()` calls, including calls where voxel returns immediately because its context is lost (`ThreeRenderRuntime.ts:400`). `AoeVoxelWorldRenderer.ts:324` still increments the counter, but lines 327–331 refuse hit-state promotion unless the runtime is running. Context loss preserves the revision values, so this wait can succeed while `isInteractionReady()` explicitly returns false (lines 419–428). The healthy paused path supports the diagnosis, but the helper’s broader guarantee is false. Check actual readiness, including lifecycle and epoch, rather than treating a frame-call counter as proof.

2. **Major — [voxel-presented-hit-state.spec.ts:105](tests/browser/voxel-presented-hit-state.spec.ts:105): the regression gate can pass with the old wait.** The page releases frames after one second regardless of the test worker’s progress. If the worker or protocol round trips are delayed until after release and presentation, the watermark-only mutant returns and the subsequent part read succeeds. Nothing requires that the wait remain pending while frames are held. The documented 10–30 ms local turnaround does not establish deterministic mutation sensitivity on another host; `gate-proofs.md:20` itself acknowledges the one-second bound. This retains the timing dependence the browser-specs rule rejects. Use explicit scheduling/handshaking to prove the wait cannot finish before release.

3. **Major — [resource-workers.spec.ts:171](tests/browser/resource-workers.spec.ts:171): the House assertion can still pass without a successful House order.** The new check establishes “Moving / food 1” before `clickCell`, which performs projection, mouse movement, and clicking in separate asynchronous operations (`helpers/gameTestHelpers/command.ts:6–29`). More fundamentally, the final assertion merely polls for food 0: ordinary arrival clears the move command (`playerCommandsSystem.ts:198–220`), which also removes the worker from the food count (`resourceWorkerCounts.ts:65–73`). A dropped House click can therefore pass if arrival occurs during that poll—even when the worker was moving at the new premise check. The longer walk reduces the probability; it does not prove the claimed causal effect. Require the new foundation and the worker’s construction assignment alongside the count change.

4. **Minor — [voxel-presented-hit-state.spec.ts:45](tests/browser/voxel-presented-hit-state.spec.ts:45): release breaks cancellation semantics.** Held requests return negative IDs, but `release()` discards those IDs and reschedules callbacks under unrecorded native IDs. Cancelling the original ID after release cannot cancel the callback. I confirmed this by executing the extracted gate in memory: `hold → request → release → cancel → dispatch` still invoked the cancelled callback. Both the game and HUD retain request IDs for cancellation. Preserve the mapping until execution or cancellation.

The rollover is verbatim and selects the correct entries; the retained CI logs match the reported art-style statistics. No files changed or browsers launched. Live CI status was unavailable because network access was denied.

### Claude (claude-opus-5-5[1m])

I found no blockers. There is one major finding: the change says it closes a gap in the House check, but the code doesn't. There are four minor findings and some nits. I made no edits; the only commands I ran were read-only `git` commands.

#### Findings

##### 1. Major: the "food 0 after the House order" check can still pass without the order (`tests/browser/resource-workers.spec.ts:168-174`)
- **The code path.** A move order clears the gather order and keeps the food occupation for the walk only (`src/game/simulation/bridge/unitCommandOps.ts:228-230`, `src/game/simulation/resourceWorkerCounts.ts:65-72`). When the walk ends, the count reads 0 and the activity reads "Idle" (`selectionActivity.ts:196`).
- **The poll window.** The final `toHaveText('0')` polls for 5 s; `playwright.config.ts` sets no `expect.timeout`.
- **What the new check proves.** The read at `:171-172` shows the walk had not ended *before* the placement click. It does not show that the 0 came from the order.
- **Why it can still pass on CI at 800px.** I estimated this from the docs' own CI timings:
  - The anchor is (15,7). Units move along one axis, then the other (`pureHelpers.ts:282-311`), so the path is about 9 cells, roughly 7.5 s at 1.2 cells/s.
  - The placement lands about 3.4 s after the move click (0.9 s for "Moving" to show, 2.2 s for the Build House click, plus `clickCell`).
  - So the walk ends about 4 s after the placement, inside the 5 s poll. At 800px on CI, a House order that stopped taking the walker would still pass.
  - At 1920px (about 12 cells, about 10 s) the walk ends outside the window, so that width would still catch it.
- **What overclaims it.** The spec comment at `:169-170` and plan 137's ticked criterion ("now with the worker proven still walking when the House order lands") say more than the code proves. This is not a regression: the original assertion had the same gap.
- **Fix (one line).** After the placement, poll `readOrderHud` for `{ activity: 'Building House', food: '0' }`. The builder label comes from `selectionActivity.ts:148-150` and `render.ts:230-238`, and the end of a walk cannot produce it.

##### 2. Minor: the distance check only repeats the filter's own arithmetic (`resource-workers.spec.ts:157-164`, `placement.ts:56`)
- It uses the same formula as the keep-away filter, applied to the same worker, which stands still while its task is `'gathering'`. So it can only fail if the filter is removed or broken.
- That makes it a guard on the test's own setup, which R19 calls "self-agreement". It is not independent evidence that the walk outlasts the checks.
- The register ("FIXED and gated: the spec asserts the walk's length…") and the gate-proofs entry present it as the gate. The independent check is the "still walking" read at `:171`. Its red was shown only under the long-task load model, and the docs should say so.
- Small hole: if the worker's coordinates were `NaN`, the filter would quietly accept every cell, because `NaN < d` is false. The check at `:162` would catch it, but the helper should refuse non-finite keep-away points.

##### 3. Minor: "by construction" overclaims, and there is a new failure path (`resource-workers.spec.ts:9-20`, gate-proofs title)
- **The click now always races the walk.** Only the walk's length is fixed by construction. Every host now clicks Build House while the worker walks, and the selection panel rebuilds whenever any part of the selection state changes (`selectionPanel.ts:218-229`). That state carries `x`, `y`, `tileX` and `tileY` (`types.ts:335-338`), so Playwright retries the click; the docs record 2.2 s with two retries on CI.
- **The new failure mode.** If a slow runner needs more than about 5.8 s (6.7 s minus 0.9 s), `:171` goes red. That is a new flake path that "by construction" denies, though the Bound line admits "not yet timed there".
- **The 6.7 s derivation.** The reason "(the frame delta is capped)" is backwards. The bound holds because `min(250, elapsed) × 1.5 ≤ 1.5 × elapsed` (`visibleSimulationTiming.ts:1-6`, `AoeVoxelGameView.ts:389`); the cap only slows the game down.
- **An unpinned input.** The bound needs Normal speed to be 1.5× (`matchOptions.ts:19-23`). `startMatchFromLobby` checks the map, players and civ, but not the speed (`playOpening.ts:34-45`).

##### 4. Minor: `waitForPresentedHitState` stands in for `isInteractionReady()` but is not the same check (`presentation.ts:24-37`)
- It does not check `metrics.state === 'running'` or that the epochs match (`AoeVoxelWorldRenderer.ts:419-429`).
- `framesDrawn` counts every `frame()` call, including ones that draw nothing while the context is lost (`:89-92`, `:319-324`, `ThreeRenderRuntime.ts:400`) and ones that hand nothing over (`:326-331`).
- It is sufficient in every case the boar spec hits:
  - There is no bridge swap.
  - The HUD, idle-bell and audio loops never sync the view.
  - The game loop syncs and draws in one callback (`AoeVoxelGameView.ts:395-398`).
- Its doc comment still claims the general property.
- If the hit state stays behind, the frozen-pose check `toEqual` at `voxel-unit-attack-animation.spec.ts:198` passes with null equal to null; nothing requires `frozenPresentationBefore.parts` to be non-null.
- **Suggestion.** Add `state === 'running'` and matching epochs to the poll, and assert the frozen parts are non-null before `:198`. That turns the flake's own symptom into a hard failure.
- **Alternative (outside plan 139's scope).** `present()` could hand the pending hit state over when the runtime reports it presented on acceptance. That would close the window for every reader.

##### 5. Minor: the gate's "no frame drawn" control can never fail (`voxel-presented-hit-state.spec.ts:82-104`)
- `framesDrawn: 0` is measured inside one synchronous evaluate, so it reads 0 whether frames are held or not.
- Nothing in the run shows that the window stays open across a round trip, which is what makes the old wait fail. That rests on the separate 10/10 mutation run.
- The mutant fails only if its three round trips finish within the 1 s release; gate-proofs says "one more round trip".
- On the new wait, the gate passes deterministically, and it breaks no rule: there is no `waitForTimeout`, and the verdict doesn't depend on elapsed time.
- **Suggestion.** Add one more evaluate that asserts no frame and a null part. Or release frames from the test once the wait has been seen polling, which makes the old wait fail on any host.
- The frame gate itself is sound:
  - Callbacks requested before `hold` all run in the next frame, so `held() > 0` means none are left.
  - Negative ids are handled on cancel.
  - The HUD, idle-bell, audio and tooltip rAF users are held too, and none of them draws the world or forces a sync.
  - Release re-requests each queued callback once.

##### 6. Nits
- `resource-workers.spec.ts:14` says "food 0 45 ms later"; the docs give +900 to +949 ms (49 ms) or +891 ms (58 ms).
- The resource case has "about 49" runs since 2026-10-14, but the art-style case has "51" runs since the same date.
- The 2026-10-19 debugging doc says "confirmed … in all three hosted failures". Only two runs were traced; the first is inferred from its log.
- Plan 139's third acceptance box is unchecked, but its Outcome says the "reported with evidence" alternative is met.
- The permanent docs cite `tmp/evidence/snapshotHud.cjs`, `tmp/pin-tree.ps1` and `tmp/probes/`. These are ignored files that the worktree cleanup will delete.
- The comment at `placement.ts:54-55` says only the projection forces a sync, but `getPlacementPreviewAt` does too (`browserTestApi.ts:325-334`). The helper now takes five positional arguments (`'house', 1, [], {…}`), which reads awkwardly.
- The farther anchors make it more likely that a tall entity covers the right-click point. Neither the search nor the spec reads the click stack there, but such a failure would be loud and repeatable.
- The devlog says "Reviewer findings. Pending."; fill it in before landing.

#### Claims I checked and found correct
- **Boar diagnosis.**
  - `inspectVoxelUnitMotion` forces a sync (`browserTestApi.ts:299-302`).
  - AoE's runtime draws its own frames and has no worker pipeline: the standalone `frame()` would throw for an embedded host (`ThreeRenderRuntime.ts:386-391`), and no `voxelWorkers` option is passed (`runtimeInitialization.ts:199-200`). So automatic presentation is not deferred (`runtimeIngest.ts:190-192`).
  - A delta with no visual change on a presented base is marked presented at once (`voxel/src/core/render-world.ts:735-750`).
  - Byte-identical batches are dropped from the delta (`aoeVoxelSnapshotDelta.ts:61-63`).
  - The trace arithmetic matches `browserTestTicks.ts:80-85`: 3 → 5 through `advanceTicks`' two syncs, then 8 forced syncs → 13.
  - All five waits were replaced, the new condition includes the old one, and no assertion changed.
- **Resource workers.**
  - `'gathering'` is set only on arrival (`toResourceStep.ts:204-206`, `bridgeHelpers.ts:156-178`), so that wait means something.
  - Every original assertion is kept; the combined "Moving" + food read is stricter.
  - Clicks target the cell centre (`voxelCameraController.ts:187-195`), the same point the distance is measured to.
  - The chosen anchors are 9-12 cells away by axis-by-axis path.
- **Rollover.** Git's moved-line detection marks both archived entries as byte-identical. They are the bottom-most closed entries of the oldest date that can be archived, and 12 closed entries remain. The gate test checks only counts and markers (`defectRegisterRollover.test.ts:45-58`), so I checked order and content by hand.
- **Other claims.** The `voxel-wildlife-feedback` claim holds (`:35-70`). `getWorldCapture` does draw twice (`AoeVoxelGameView.ts:245-249`). The art-style limit is unchanged and its OPEN status marker parses as open.

**Files read**, beyond the diff: `AGENTS.md`, both rule files, `AoeVoxelWorldRenderer.ts`, `AoeVoxelGameView.ts`, `AoeVoxelPresentationCoordinator.ts`, `browserTestApi.ts`, `browserTestTicks.ts`, `aoeVoxelSnapshotDelta.ts`, voxel's `render-world.ts`, `runtimeIngest.ts` and `ThreeRenderRuntime.ts`, `resourceWorkerCounts.ts`, `selectionActivity.ts`, `render.ts`, `selectionPanel.ts`, `pureHelpers.ts`, `transformOps.ts`, `movementTechEffects.ts`, `unitCommandOps.ts`, `createHudController.ts`, `playwright.config.ts`, `art-style-setting.spec.ts`, `voxel-wildlife-feedback.spec.ts`, and `defectRegisterRollover.test.ts`.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | `waitForPresentedHitState` counts frame calls but not readiness: frames drawn during a context loss count, and nothing checks the runtime's state or the epochs (Codex 1, major; Claude 4, minor). Claude 4 adds that the frozen-pose comparison passes with null equal to null. | Accepted. The boar spec's own path was sufficient, both agree, but the helper claimed more than it checked. | The poll also requires `metrics.state === 'running'` and equal accepted and presented epochs; the doc says why that matches `isInteractionReady()`. The boar spec now asserts its frozen pose's parts are non-null before comparing them. |
| F1 | The gate released frames on a 1 s page timer, so a slow enough host could let the old wait pass (Codex 2, major). Its "no frame drawn" control was read inside one synchronous evaluate and could never fail (Claude 5, minor). | Accepted. | The test now releases frames only after it has seen the wait read the renderer's state four times without returning, and it asserts the wait is still pending at that point. The window control moved to its own evaluate, a round trip after the syncs. Red proofs: removing the wait's frame requirement failed 10 of 10, and so did the original wait put back verbatim, each at "the wait returned while frames were held". |
| F2 | The House check can pass without the House order: a walk that ends inside the final 5 s poll also reads food 0 (Codex 3, major; Claude 1, major, worked out for 800px on CI). | Accepted; the old spec had the same gap. | After the House click the spec polls for "Building House" with food 0. Only a build order produces that label, and a walk that ends reads "Idle". Red proof: a two-cell walk with the House click removed failed it at all three widths, while the old food-0 check alone passed all three. |
| F3 | The frame gate's release dropped held ids, so cancelling one after the release did not cancel it (Codex 4, minor). | Accepted. | Released callbacks keep their held id mapped to the native one until they run, and cancel honours both. |
| F4 | The distance assertion repeats the keep-away filter's arithmetic, so it guards the setup rather than evidencing the timing; a NaN point would make the filter keep every cell (Claude 2, minor). | Accepted. | The spec and the records call it a setup guard and name the "still walking" and "Building House" checks as the timing and causal evidence. The helper throws on a non-finite keep-away point. |
| F5 | "By construction" overclaims: every host now clicks Build House during the walk, a slow enough host fails the "still walking" check, the comment's reason for the 1.5x bound is backwards, and Normal speed is assumed, not pinned (Claude 3, minor). | Accepted. | The spec asserts the match started with `speed=normal`. The comment derives the bound from each frame advancing at most 1.5 times its wall time. The records say the walk's length is fixed while the checks' time is not, and that a host too slow fails the timing check rather than passing. |
| F6 | The spec's "45 ms later" disagrees with the docs' +900 and +949 ms (Claude 6). | Partly accepted. 45 ms is right: the Moving read at 156391 and the food read at 156436. The docs' +949 ms was measured from a different origin. | The docs now give +936 ms, from the click's end like every other offset. |
| F7 | "About 49" runs for the resource case against "51" for the art case over the same period (Claude 6). | Accepted. A recount found 51 runs since 2026-10-14 with 3 failures, and 50 before with none. | Corrected everywhere. |
| F8 | The 2026-10-19 doc said the walk ended inside the polls "in all three hosted failures", but only two were traced (Claude 6). | Accepted. | It now says two were traced, and that the first shows the same symptom in its log only. |
| F9 | Plan 139's third acceptance box is unticked while its Outcome meets the "otherwise reported" branch (Claude 6). | Accepted. | Ticked, naming that branch. |
| F10 | The records cite ignored scratch files that the worktree's removal deletes (Claude 6). | Accepted. | The probes, measurements and CI-log analysis are copied to `tmp/ci-flakes-1104-evidence-20261104/` in the primary checkout with a SHA-256 manifest, and the records point there. |
| F11 | `placement.ts`'s comment says only the projection forces a sync, but `getPlacementPreviewAt` does too; the helper now takes five positional arguments (Claude 6). | Comment accepted. The signature is kept: changing it would touch 16 callers for no behaviour. | The comment names both syncs. |
| F12 | Farther anchors are likelier to sit under a tall entity that would take the right-click (Claude 6). | Accepted as a note, no change. Anchors are deterministic for the seed, and a covered anchor turns the order into a gather order, which fails the "Moving" check loudly and repeatably. | None. |
| F13 | The devlog's "Reviewer findings" says "Pending" (Claude 6). | Accepted. | Filled in from this round. |

Both reports also confirmed claims: the boar diagnosis down to the revision arithmetic, every original assertion kept, the defect-register rollover verbatim and correctly ordered, and the art-style statistics against the retained CI logs.

## Verification

The repairs were checked on `cae06026` plus the working-tree changes that round 1 reviews: `tsc --noEmit` and ESLint on the changed files exit 0. On SwiftShader the gate and the boar spec passed 5 of 5 each, the boar spec 60 of 60 in three more rounds of 20, and the order cases passed 6 of 6, and 6 of 6 again with 100-600 ms long tasks per frame. The red proofs are named against each finding. Every mutant was restored byte-identical (SHA-256 checked). The full gate runs on the final revision, after round 1.

## Round outcome

No blockers. The three major findings (F0, F1, F2) and every minor one were repaired, with two parts rejected for the reasons given (F6's 45 ms, F11's signature). The repairs change test code, so round 1 re-reviews them.
