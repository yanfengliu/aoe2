# Debugging session — resource worker movement CI

## Symptom

Run 39193369383, job 117870763684: resource-workers.spec.ts:124 at 1920px expected Moving after a real right-click, but observed Gathering food and then Idle for five seconds.

## Expected vs actual

- Expected: the selected food worker walks to a legal House anchor while its occupation remains food, then House placement clears that occupation.
- Actual: food occupation first became 1, then the move assertion failed and the final DOM showed Idle with zero food workers.

## Reproduction

First instrument: the exact retained Playwright trace observes selection, context click and timing. It contains no simulation bundle, so recorded-world tools cannot establish the click-time unit cell. The next approved live instrument is bridge.getDebugSnapshot() for coarseVsFine and unitPaths, with getEconomyState() to identify the worker. The first live instrumented control is recorded below; no product state was set.

Base 28186cbc49ae2453f8cc05eb40d830bd84cbf551. Failure artifact 12161172956 ZIP SHA256 4170ba1fd127c1cbfe451075d3f0fc90eccf990157c5c680b2443eeb897bc532. Raw evidence: tmp/work137-resource-worker-ci/. Permanent owner and acceptance record: ../work/137_resource-worker-ci/plan.md.

## Hypotheses

- [ ] The selected worker is already near or at the first legal anchor (8,6) after 3.29 seconds of gathering travel, yielding no observable moving interval. Confirm with click-time unit positions and commands.
- [ ] A raised entity intercepts the anchor click. Confirm with maintained read-only click-stack and command evidence.

## Investigation log

- 2026-10-19: The trace selects villager 2205 at (6.25,8.75), confirms selection, then gathers from sheep 2164 at (7,5). House search returns anchor (8,6). Right-click (1036.8,288) is on the world, above the HUD. Unit-cell selection miss and HUD occlusion are not supported by this trace. Screenshots lag event records and cannot settle the moving interval.
- 2026-10-19: Initial causal bounds and minimal proposed test contract handed to root before source edits. One exact-artifact retrieval complete; root controls any build and headless resource slot.

- 2026-10-19: The approved single headless control passed: one case / one invocation, 4.1 s test / 7.5 s suite. A passive pointer listener read debug/economy/HUD state in 0.1–0.3 ms per sample. The local worker was coarse (6,8), fine (6.25,8.5), at move-click tick 6. Its anchor was (7,6); a move command appeared tick 7, Moving DOM plus food workers 1 at tick 10, then House/food workers 0 at tick 17. Hosted chose (8,6), with 3.29 s between gather/move against local 0.271 s. No hosted causal claim follows from this passing control.
- 2026-10-19: Preparation passed via content build plus npm --ignore-scripts run build, avoiding sibling build hooks. The run requested SwiftShader; actual renderer string was not read. Finally cleanup closed all 13 observed owned processes and port 4287. The original test bytes were restored exactly (SHA256 ad6921d0ceb955eae10d58766a299f3bd4dddfd38a4e3a43ebae55ff7769d4c8). No product/test fix exists. Next possible discriminator is delayed real input before anchor selection; root must select any next runtime.

- 2026-10-19: Approved diagnostic 2 added a 3290 ms real-time wait after food workers 1 and retained the original controls/assertions/deadline. PASS, one case / one invocation, 6.6 s test / 9.7 s suite. It chose hosted anchor (8,6), with an empty left-click stack at tick 57 (2.1 ms read). Move click at tick 60 hit the canvas; worker fine position was (7.25,6.75). Tick 61 showed move toward (8,6), food workers 1, and the still-stale Gathering food DOM; tick 65 showed Moving, and tick 71 Building House / food workers 0. Renderer string confirmed ANGLE/Vulkan SwiftShader. This fast local control does not explain the hosted missed interval.
- 2026-10-19: Diagnostic 2 finally cleanup closed all 13 observed owned processes and port 4287; exact original test bytes restored. Both approved diagnostics are spent, behavioral repair count remains 0, and root must reassess before another runtime or edit. A four-tile minimum worker-to-anchor separation is proposed only as a stronger fixture premise, not as proven hosted causal repair.

## Root cause

Unknown. Both approved local controls passed; the delayed control used the hosted anchor and showed an accepted move with a several-tick HUD delay.

## Fix

None yet.

## Verification

ci:status ran first. Elevated read confirmed corpus green and tip CI still in progress; the failed shard is retained, not cleared by that status. The separate content/TypeScript/Vite build and two affected instrumented browser controls passed. No full gate or fixed-source regression run has occurred.

## Follow-ups

Resolve only the evidenced movement/occupation failure. No engine weakness or architecture change is established. Preserve the original control and original assertions.
