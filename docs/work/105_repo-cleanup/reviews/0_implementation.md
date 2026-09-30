# Review 0: repository survey

## Target

AoE2 main 79c11dab981208f03dbbd7cb21debdcfd2d5cdda, assignment 105. Task 104 operational closure is excluded. Exact compiler/reference and size inventories remain under ignored tmp/repo-cleanup-20260930. No source edits occurred during these reviews.

## Reviewers and coverage

Three independent Astra/xhigh contexts: /root/integrated_review (simulation), /root/repo_app_review (app/runtime), /root/repo_docs_tooling_review (tooling/docs). The fleet review runbook was applied. Automatic approval review rejected external Claude source submission in the preceding work because the private payload/destination lacked a specific grant; that lane abstained and was not bypassed.

Simulation surveyed all 488 modules (67929 source lines), five stats CSVs and 353 simulation/replay test files through inventories, references, resolved imports/exports and exact function-body scans. It adjudicated 329 exports without cross-file consumers. Deep inspection covered dead candidates, active types, technology effects/research menus/stats and persistence/replay boundaries, including bridgeStateSerialize.ts:113, bridge/sharedTypes.ts:10, technologyUnitSweeps.ts:111 and replay/createReplayWorldOnly.ts:14.

App surveyed all 192 scoped files (188 TypeScript, four CSS), compared 874 function bodies and checked lifecycle patterns/CSS selectors including dynamic class names. Deep inspection covered app/view startup/teardown, input/camera, renderer clocks, recording/replay and loading, audio, minimap/selection HUD and selected playtest/oracle helpers and related tests. Most procedural recipes, glyphs, templates, providers and test bodies received scans rather than full manual reading.

Tooling surveyed 42 scripts, 23 architecture files, 60 browser specs, 18 browser helpers and 692 docs. Tracked-text references and exact hashes covered the population. Deep reads covered capture/boot/selection tools, package/config/workflows, workdoc guards, canaries, both long self-play gates and current canonical docs/templates. This is a complete static survey with focused semantic inspection, not a line-by-line audit of all code, balance values, historical docs or tests. No runtime or performance measurement was made by reviewers.

## Reports

### Simulation

SIM-1: twelve unused declarations across ten files have no consumers; two aliases support only another dead declaration. Delete commandAvailability.ts:253 commandKey; losTechEffect.ts:53 applyInfantryVisionDelta and newly unused imports; queuedEntityOrderOps.ts:30 QueuedEntityOrder; buildingTechEffects.ts:63 PER_BUILDING_HP_TECHNOLOGIES; dockTechEffects.ts:29 careeningPierceArmor; fixtures/trafficContest.ts:93 trafficContestWestMouth; mapGeneration/startingOffsets.ts:17 HUMAN_PLAYER_ID; prototypeUnitRules/statTables.ts:24 UnitTintPalette; bridge/systems/systemTypes.ts:41 UnitCommandType/UnitCommand; bridge/systems/monkBehaviorSystem.ts:35 MonkTaskKind/MonkTask. Paths in the first six entries are under src/game/simulation (bridge/ where named). Preserve live command-availability calculations, outpost/building sight, serialized queued shape at bridgeStateSerialize.ts:113, PER_BUILDING_HP, armor constant/spawn and existing-ship sweep, traffic fixture/east helper, and active counterparts in prototypeScenario.ts:20, presentationTables.ts:9 and bridge/sharedTypes.ts:10/43. The obsolete command interface describes fewer kinds than the live one.

SIM-2: Tracking is retired by spec:1526, absent from research tables and checked by retiredTechs.test.ts:34, but spec:1341 still calls Tracking/Cartography researchable and :1450 promises free Slavs Tracking. Correct current comments at bridge/losTechEffect.ts:2, losTechOptions.ts:3, optionsRules.ts:201, technologyTypes.ts:115 and visionTechEffects.ts:2. civFreeTechnologies.test.ts:41 claims Tracking after a Barracks exists while merely checking opening absence; retire or accurately describe it. Preserve retiredTechs/losTechs retirement/menu/infantry-sight contracts. No new gameplay defect was established. Compatibility fields such as saveSchema.ts:192, hydration, fixture registries and browser stat tables remain live; no broad rewrite or mass export removal is supported. Small projectile/terrain-builder duplicates do not justify an abstraction.

### App/runtime

APP-C1: isoWorldPixelBounds (isoViewHelpers.ts:18) and isoViewportCellBounds (:60) are consumed only by their self-tests at tests/rendering/isoViewHelpers.test.ts:38/73. Live camera bounds come from voxelCameraController.ts:68; selection uses camera corners at AoeVoxelGameView.ts:479. Remove the two helpers, their dedicated tests and unused projection import; retain four live helpers and historical drift entries.

APP-C2: AoeVoxelWorldRenderer.frame ignores _wallNowMs (:280). AoeVoxelGameView.currentFrameTimeMs is only declared (:66), assigned (:393) and forwarded (:244/320). Remove that field/assignment/argument and update callers while preserving simulation display time, delta and animation clock. poseUnitAttackParts ignores _role (aoeVoxelUnitAttackAnimation.ts:98), with one production caller in aoeVoxelUnitAnimation.ts:428; remove it/import. voxelGameViewHelpers.ts:28 clamp and AoeVoxelGameView.ts:263 isAttackMoveArmed have no source/test/script consumers; remove them while preserving armed-order behavior.

APP-C3: styles.css:368 .hud-selection-meta has no consumer. Other unmatched selectors are dynamic and remain. Delete only that rule; existing HUD checks should remain visually unchanged.

APP-F1 (P2 candidate): RecordingService.stop (:273-318) disconnects/flushes/finalizes without calling IndexedDBMirror.close (:156). Repeated save loads dispose/create recording stacks at createApp.ts:169/186/257, retaining old database connections. Test a focused close after finalization, including failure paths, and preserve lazy reopen/prior-session export. Existing lifecycle tests assert state rather than connection release.

APP-F2 (P2 candidate): openReplayAt creates an incoming bridge at ReplayController.ts:186 and replaces without failure cleanup; enterReplay creates one at :412 but replacement catch :435 restores pause without disposing it. setFogOwner already disposes failed incoming bridges at :164. Apply consistent ownership to all failed incoming swaps, retaining outgoing ownership. Existing rollback stubs omit disposal; extend their assertions.

APP-F3 (P3 candidate): RecordingServiceConfig.snapshotInterval (:51) documents null as disabling snapshots, but :256 converts null to 1000 through ??. Default only undefined; reproduce with service-level snapshot coverage. Current production callers use the default, so this is internal configuration behavior.

Declined: small isRecord/SVG/part-adder duplication does not warrant shared abstractions. Replay/timeline bounds differ in start-tick floor and need a behavior decision before combining. Minimap move handlers on canvas and window may duplicate normal bubbling (minimapInput.ts:129/131), but this needs a real bubbling-event test; teardown tests currently expect both. No change is approved on that suspicion.

### Tooling/documentation

Documentation occupies 15169326 bytes including 68 images totaling 7735489 bytes. Sixty-six images lack exact filename references, but some prose uses prefixes; this is not proof of safe deletion. Preserve all 429 bound imports, authored reviews, three active legacy objectives and the intentional current/historical lumber-camp DESIGN duplicate.

DT-01: debugging/template.md:18 recommends incompatible path-queue/occupancy probes; AGENTS explains why they cannot attach and names bridge.getDebugSnapshot coarseVsFine/unitPaths instead. Its :42 calls Vitest/typecheck/build the full gate, omitting required stages. Correct the current template/catalogue pointer and name npm run verify; preserve historical investigations.

DT-02: pinned-units.patch:9 expects UNIT_SUBGRID_STEP_PER_TICK = 2; pureHelpers.ts:75 is 0.32, and manifest repeats 2 -> 0. Refresh current patch/note without weakening the zero-motion mutant. Applicability alone is not sensitivity: use isolated baseline/mutant evidence, report inherited baseline oracle failures honestly.

DT-03: aiReachesCastleAge.test.ts:159-224 and villagersAvoidEnemyDefencesSelfPlay.test.ts:117-200 run the same gameplay inputs/horizon (aoe2-prototype, both AI, 100ms, 45000 ticks, resolution stop), but Castle uses on-read projection and defence default every-tick. Sharing requires immutable census preserving per-tick death-feed/dedup/geometry, 25-tick task attribution, 250-tick AND resolution progression, both owners/winner/content floors, horizon-or-conquest guard, thresholds/timeouts. Existing projection equivalence proves only one 2000-tick fixture. A cross-file cache still duplicates per worker. This is unmeasured; owner declines it in this cleanup rather than weaken contracts or expand optimization scope.

DT-04: dragSelectCells at browser helpers/gameTestHelpers/selection.ts:90-105 has only a barrel reference at helpers/gameTestHelpers.ts:50. Delete function/import/export, including its sole getScreenPointForCell use; retain used dragSelectWorldRect. Existing marquee/typecheck/lint coverage is sufficient, no new mechanical test.

DT-05: excluded _captureSelectionPanel.spec.ts references nonexistent scripts/captureSelectionPanel; _*.spec.ts contributes no normal gate coverage. Maintained captureMapScreenshot.mjs:303-305 supports SELECT=box/SEED/viewport. Confirm useful mixed-selection framing there, then retire the orphan without rewriting historical devlogs.

DT-06: roadmap.md:9 incorrectly calls current naval/2-8-seat game land-only 1v1; spec:149 has 2-8 participants. Correct summary, preserve rosterCoverage numbers. README.md:81 labels the historical Phaser plan as unqualified Implementation plan; label historical or point current architecture. playwright.config.ts:11-12 says no workflow runs browsers; ci.yml:170 onward does.

DT-07: spec:2036 universally forbids harness patches/Git while retaining playtest:canary, whose script:108-120 creates/applies/restores/deletes a branch. decisions.md:529-532 explicitly retains that drill. Clarify the supervised exception without changing Git lifecycle. Lifecycle redesign would require separate isolated failure-path evidence.

Optional capture consolidation is unapproved: UniqueUnits/HudSelection overlap maintained controls and bypass freshness/rasterizer/pause checks, but useful recipes must be preserved first. Fishing/formation/projectile strips have distinct staging, so a filename scan does not justify deleting them.

## Findings and disposition

Owner accepts SIM-1/2, APP-C1/2/3 and DT-01/04/05/06 as bounded cleanup. APP-F1/2/3 require focused TDD reproduction before repair. DT-02 requires applicability/control evidence and DT-07 a truthful supervised-drill clarification. DT-03 and optional capture/lifecycle suspicions are explicitly excluded as unproved optimizations, not claimed fixed. No mass historical-doc/image deletion is supported. Final code review remains separate.

## Verification

Static inventories/references/hashes, current link checks, AST/body scans and source-contract comparisons only. No reviewer tests/builds/gates/browsers/servers/installations or persistent processes. Child ci:status could not resolve Git under its sandbox; root's per-process safe.directory status succeeded, with corpus green and CI running. Root retains remote acceptance ownership.

## Round outcome

Proceed with one serialized cleanup writer after consolidation CI finishes. Review candidates have concrete consumers/active replacements and coverage bounds. Implementation, focused checks, final integrated review/gate and remote verification are pending; this survey is not a bug-free verdict.
