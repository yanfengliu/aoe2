# Pin the installed engine and preserve consumer checks

Status: active
Owner: Codex
Created: 2026-11-08
Updated: 2026-11-08

## Problem and outcome

Install the verified retained civ-engine 2.9.0 archive consistently in development, tests, browser builds and hosted CI, replacing a mutable sibling/rolling-archive boundary. Preserve gameplay, voxel revision and existing internal-helper/browser/provenance checks.

## Scope

Owner explicitly approved scoped engine-related AoE2 work and private dependencies on2026-11-07, overriding the retained Claude-only ownership and shared-worktree install restrictions for this task. This is an authorized task exception, not an edit to permanent policy. Root owns integration; existing peer worktrees remain untouched. Selected rendering and paused-save/replay adoption follow separately.

## Approach

Controller-created engine-pin-1107 at base41740d58, branchcodex/engine-pin-1107. Detached only its new node_modules junction after checking the shared target. A private staging install under tmp/install/aoe2 uses the unchanged relative voxel topology with pinned voxel08398b573ad54bcb5c764ad0c2ef3cedc3cce33f under tmp/install/voxel; move only its task-owned node_modules into the worktree afterward, retaining the private voxel target. No shared producer build, installation or source/dist mutation.

Engine producer c78a3b3162a3674b8e42204fed66cbabcdabf5ac passed CI42430952599 on Node20/22/24 and published retained asset722423931. Downloaded archive667840 bytes, SHA2569d9fce7970e9ddebbef0edd13b9ea68accf685229f3fe349c2e417dcb8e5a483, package/runtime2.9.0. The earlier 2.8.2 staging install was superseded before review/delivery. Npm lock integrity verifies bytes; the runtime guard verifies pin/lock/private resolution and both compiled entry versions. CI keeps pinned voxel setup, matrices, shards, budgets and historical fetches, and removes only the three rolling engine downloads.

## Acceptance criteria

- [x] Clean private installed engine matches exact archive/lock/runtime; old link and drift contracts fail.
- [x] Preserve internal-helper tripwires, browser graph controls, voxel retry policy and actual installed-engine fingerprinting.
- [x] Corrected full local verify and both audits pass; exact independent review closes material findings.
- [ ] Final clean-commit verify receipt is accepted before landing.
- [ ] Hold the integration lock from final refresh through push, follow CI and corpus to terminal, retire only task-owned worktree/processes through the controller.

## Implementation steps

- [x] Owner approved concrete scope and isolation; controller/work allocation completed.
- [x] Tests-first installation/workflow changes and smallest necessary inherited development-tool audit repair.
- [ ] Independent review, full verification, delivery and cleanup.

## Outcome

Pending. Session-start ci:status reports current CI42410265310 and corpus42410265445 green, exit2 solely for four foreign idle worktrees, including uncommitted work. Preserve those trees; no liveness or ownership is inferred from age. The pinned voxel source archive downloaded for this task has SHA2568b0efae6868df09ac01430da4e9d904a65ccd4aa0be8ead1acbb6febe95ba540.

## Local implementation evidence

Installation/workflow contracts first failed in 14 cases (7 existing controls passed), then all37 installation/workflow/internal-helper/browser contracts passed. Existing verify/CI contracts passed34 cases and provenance/headroom contracts passed52. The final 2.9.0 clean private install and full verify remain separately checked before delivery. Both engine entry versions and the physical private voxel root were inspected after installation.

The copied baseline audit reported3 high,2 critical and9 moderate findings. Vite6.4.3 to6.4.5 and Vitest3.2.6 to4.1.12 remove inherited high/critical tooling advisories; other lock changes are bounded patches. The Vitest4 upgrade required replacing obsolete poolOptions with the equivalent threads/maxWorkers50% configuration and exact callable mock types in five existing suites. Assertions, timeouts, reporters and test discovery are preserved.

After two incomplete narrowing repairs, the hard-problem search froze a reproduction and disqualifiers in ignored tmp/engine-pin/mock-type-search.md. Independent read-only routes compared deriving mock types from real public contracts against factory inference. The selected public-contract route removes all27 bare vi.fn declarations in those five files without product changes or new unsafe casts. Factory inference was rejected because it infers never arrays, zero-argument tuples and narrow null/rejected Promise shapes, requiring annotations plus runtime fixture churn. The third repair passed full typecheck and all58 existing cases in the five suites. TypeScript emitted-token comparison against base41740d58 proves identical runtime code for every affected fixture; hashes are retained in tmp/engine-pin/mock-runtime-proof.json. The corrected full gate and independent review pass; clean-commit certification and hosted acceptance remain pending.

## Independent review and complete local gate

Round0 reviewed exact tree8ed3c8f6e2ebf642e6f4a90c5baeedb1b3c3b67c and found A1: the copied CLI guard could silently skip verification through a checkout junction. The existing whole-suite run-directly census independently caught the same defect. First full unit run completed5501 passes,1 failure and3 skips; later verify stages were not reached and no landing receipt existed. The temporary process-cleanup wrapper also included its own PID through an overly broad creation-time tolerance, ending before its separate process receipt; the wrapper now excludes its own PID and uses an exact start boundary. That harness failure does not turn the red gate into a pass.

Use the existing runDirectly helper, add the checker to its complete census and actual junction probe, and preserve all existing scripts. The first new probe assumed which missing required file would be reported; after correcting that fixture expectation, valid RED had2 failures/7 passes (including empty junction output). GREEN has22 checks; the actual physical CLI reports2.9.0. Round1 accepted exact repair treefe56d8f3ffd953e38664d01cd1c518e5d2aab1de with no new material findings. Full authored reports are retained in reviews/. Same-class fixes are separately tracked in Farm, City, idle-life and civ-sim-web.

Corrected npm run verify completed with native exit0: content validation,695 unit files (5503 passes/3 existing skips), typecheck,347 browser cases (345 passes/2 existing skips), lint and final production build. Browser suite took9.3 minutes; the whole command ran2026-11-08 01:11:54–01:26:48 UTC. Node24.22.1, root npm11.6.2 and nested PATH npm11.7.0 are recorded explicitly. Both audit gates passed:7 moderate development findings, zero production findings. The owned-process record tracked380 processes with no forced terminations or leftovers; port4317 was task-owned/headless. Existing bundle-size warnings remain unchanged.

The pre-commit receipt contains complete passing suite reports but is deliberately refused for landing because the candidate was uncommitted at both endpoints. Root will commit the reviewed candidate, rerun the exact complete gate on clean HEAD, inspect verify-receipt check, and only then land. Evidence: tmp/engine-pin/verify-corrected.{stdout.log,stderr.log,receipt.json,process.json}, direct-cli-{red-valid,green}.log and audit-final-{full,production}.json.

A separate fresh public-API probe confirmed E03 remains open under engine2.9.0: a selected villager accepted a move, pausing refused advancement at tick0, the save persisted an empty pendingCommands array, and after20 ticks the continued game position differed from the loaded game. This probe is preparation evidence only, not a persistence fix or new-format authorization.
