# Review 54: design

## Target

2026-10-18. Independent runtime branch for the fixed old-source Windows reproduction: aoe2 `28186cbc49ae2453f8cc05eb40d830bd84cbf551`, voxel `5d6d4c911c6d05b62a5a81ad62f05993cf44e9de`, run36863735290 attempt3/job117863550009. Preserve all14 inputs, supplemental helper, two cases/one worker/retries0, 188200/331800ms budgets and fifteen-minute job cap. [Review52](52_implementation.md) retains the RED result and complete earlier attempt accounting.

## Reviewers and coverage

`/root/font_runtime_search` independently read the frozen log, verifier, observer/call sites and exact library bytes. Coverage is runtime mechanism and a proposed measurement contract; delivery is owned by the separate independent branch. No subagent, model review, runtime experiment, capture, source edit or existing-chat message occurred. Root owns acceptance and integration.

## Reports

The frozen lock pins Playwright/core1.59.1. The cached official npm package passes that lock's SHA512 integrity. All seven inspected installed files match its extracted bytes exactly. This establishes the inspected implementation, not the missing remote launched executable/CDP identity. Owned `tmp/work135-font-runtime/runtime-source-audit.json` records hashes and line excerpts; SHA256 `b5762e6e53420a3d631cfca8112eecb26fd75749d223e76aea220afe22cfd206`. Package archive:2458529bytes, SHA256 `22304c3d9106ed8372ff58656f645a93bc3a2b17df8567f1413079a730d8d6fa`.

New source/log inference: the named wind attachment occurs after observer's main-world (line87) `document.fonts.ready` await, eleven-node collection, stable-checkpoint checks and report write. The next product operation is the first gust screenshot. Thus an earlier readiness evaluation completed on this recorded path. This does not recover the JSON, prove its families or establish the later promise's state.

The pinned [screenshot implementation](https://github.com/microsoft/playwright/blob/v1.59.1/packages/playwright-core/src/server/screenshotter.ts#L236) awaits preparation, then evaluates `document.fonts.ready` in the utility world. Evaluation rejection is caught; settlement would reach its next log marker. The retained call log ends at the preceding wait marker. This stage precedes element stability, masks and pixel capture. Its catch also awaits restoration without the progress race, so reporter overrun is not an isolated font-wait measurement. These are source mechanisms, not proof that restoration, fonts or rendering caused either failure.

The [CSS Font Loading draft, §§3.1/3.4](https://drafts.csswg.org/css-font-loading/#font-face-set-ready), permits new readiness promises after further loading and includes pending layout in environment readiness. Earlier readiness therefore does not rule out later pending readiness. The draft describes semantics; it does not establish this Chromium execution.

## Findings and disposition

Cause remains unproved. The log cannot distinguish an unresolved readiness promise from delayed utility execution/protocol completion. Actual font families alone would not settle that distinction. The fixed-camera closure also supplies no corresponding font-wait call log.

Proposed discriminator only: during a separately authorized observation of the unchanged two-case Windows workload, retain timestamps and responses for the original utility evaluation, a non-waiting read of that world's readiness-promise state, `document.fonts.status`/face statuses/document readiness, a same-target primitive evaluation and a browser-process heartbeat. Preserve original assertions, screenshots, inputs, population and deadlines; collect without forced layout, font loading or promise replacement. A pending promise with responsive target/browser narrows toward readiness; an unresponsive target with responsive browser narrows toward target execution; a fulfilled promise with an outstanding original call shifts attention to evaluation/protocol handling. Missing responses remain unknown. Record observation overhead and distinguish post-abort restoration.

This is a measurement contract, not a dispatch or delivery design. End observation with the original two-case terminal outcome or job cap; preserve RED and partial output, and send no duplicate request. If those observations cannot be collected under the fixed controls and a new grant, this route is blocked.

## Verification

Owned evidence remains in `C:/Users/38909/Documents/github/aoe2-worktrees/work135-font-runtime-1018/tmp/work135-font-runtime/`. Before/after guards compare all14 original inputs plus helper, raw log, primary policy and voxel AGENTS against their frozen hashes. They preserve 18/18 exact inputs. Raw log remains41374bytes/SHA256 `3ee1f5b99caca18aaa12adcdf642bcc3c96271d7063ab0becafe3bb4782d4df3`. Two completed offline audit executions cover source/cache examination and final guards; a failed final-audit syntax attempt is retained; administrative verification records report format and task-marker process census. No historical archive was rehashed/downloaded. All tests, browsers, servers, renderers, CI requests and repairs DID NOT RUN. Total compute and initial elapsed start were not measured; attempt record retains the preliminary parser/write failures.

## Round outcome

New bounded evidence identifies a completed earlier readiness evaluation and the later utility-evaluation boundary. It changes the next discriminator; it does not solve the runtime cause. Original two failures, missing fresh outputs and engine/art/Normal-baseline acceptance remain open. M21c18 remains RED/correction2; sole art source stays idle. Messaging permission remains pending. No commit, push, capture grant or cleanup occurred.
