# Architecture

This document describes the structural boundaries of the project. Update it only for
structural changes (new modules, shifted boundaries, new build or data pipelines). Do
not update it for UI tweaks, bug fixes, refactors, or test-only work. When it does
change, also append a row to `drift-log.md` and mention the update in the devlog.

## Repository layout

- `src/` — game code (TypeScript)
  - `app/bootstrap/` — app startup. `createApp.ts` owns the live/replay bridge
    cell, mounts the DOM HUD and replay timeline panel, binds replay hotkeys,
    and calls `replaceBridgeForLoad.ts` so save-load exits replay before
    swapping the live bridge. `installBrowserTestApi(...)` exposes the in-page
    `window.__AOE2_TEST__` test seam Playwright drives during browser tests;
    there is no separate dev HTTP server.
  - `app/AoeVoxelGameView.ts` — sole browser world host. Owns the injected
    animation-frame loop, one interactive voxel canvas, bridge replacement,
    resize/fullscreen lifecycle, and composition of renderer-neutral camera,
    pointer, selection, and presentation controllers. It owns no gameplay state.
  - `game/` — gameplay rules, scenarios, content
    - `content/` — shared content tables (e.g., building footprints)
    - `playtest/` — headless playtest infrastructure. `runPlaytest.ts`
      drives a bridge-driven recording loop (attaches `SessionRecorder`
      to `bridge.world` directly, distinct from the live-game
      `RecordingService`); `oracles.ts` hosts pure
      gameplay-correctness oracles (match-completes, no-tick-failures,
      no-perf-regression) consumed by `scripts/run-oracles.mjs` and
      delegates no-pinned-or-oscillating-units to `pinnedUnitsOracle.ts`
      (unit-lifetime intervals, drivenness gate, tight/wide confinement
      boxes, gathering-suffix exemption); `positionReplay.ts` reconstructs
      unit positions tick-by-tick from initial snapshot + diffs, including
      garrison position gaps; `fixBotPrompt.ts`
      builds the prompt for `scripts/propose-fix.mjs` (Codex / Claude
      shell-out, propose-only via `git apply --check`);
      `visualPlaytestAdapter.ts` is the civ-engine v1.3 visual-playtest
      adapter seam: it turns the aoe2 LLM snapshot/tool surface into
      engine `VisualPlaytestObservation`/control/state vocabulary for
      prompts and embeds engine `visualPlaytest` finding payloads into
      existing aoe2 agent markers without replacing the custom command-tool
      runner; `selfImprovementLoop.ts` is the recursive-loop ledger seam:
      it recovers engine `ImprovementFinding` payloads from recorded runs,
      records replay self-check evidence, classifies proposal/fix/observe
      routing, and compares before/after metrics via
      `compareMetricsResults`; `selfImprovementFindingComparison.ts`
      compares standardized finding identities across reruns, including
      oracle/tick/message evidence for deterministic oracle findings whose
      generated ids carry order-dependent suffixes;
      `oracleImprovementFindings.ts` converts
      deterministic oracle violations into the same shared finding
      contract; `fixProposalInput.ts` selects classified ledger fix
      findings for the `propose-fix --ledger` prompt path; `corpusSchema.ts`
      validates `playtest-corpus.json` for `scripts/playtest-corpus.mjs`,
      which loops the runner + oracles per row and emits
      `output/corpus/<date>/SUMMARY.md`. CI runs the corpus on PR + main
      via `.github/workflows/playtest.yml`. The playtest runner is a third
      runtime mode alongside live and replay: it constructs a normal
      `SimulationBridge` via `createSimulationBridge`, then attaches its
      own `SessionRecorder` directly to `bridge.world` — bypassing
      `RecordingService` (which is for live-human sessions only per
      ADR 3 in `RecordingService.ts`). The loop calls `bridge.step(100)`
      each tick so the bridge's internal `drainPendingCommands` flow runs
      unchanged; the recorder hooks the same diff/execution/failure
      listeners as live mode. This is why `runAgentPlaytest` is unsuitable
      here — it would replace the bridge's command-submission path with a
      `decide()` callback, but aoe2's AI lives inside `world.step` and
      pushes intentions to a side queue the bridge drains externally.
      Phase-6 follow-ups (per the thread): real `economy-progression`
      oracle via `SessionReplayer.stateAtTick`; auto-apply patches with
      green-gates check; counterfactual fix-validation via
      `SessionReplayer.forkAt`; cross-corpus regression detection; AI-vs-AI
      via opponent-selection refactor.
      See `docs/threads/done/playtest-loop/DESIGN.md`.
    - `replay/` — app-level replay orchestration. `ReplayController.ts`
      preserves and pauses the live bridge, swaps the mutable bridge cell to a
      replay bridge, coalesces drag scrubs, exposes the current replay bundle
      for UI consumers, steps cached replay worlds by submitting recorded
      commands before `world.step()`, and restores the live bridge on exit.
      `TimelinePanel.ts` renders the replay-only bottom strip, marker pins,
      hotspot pins, and scrub controls against the controller boundary.
      `ReplayHotkeys.ts` binds replay navigation keys only while replay mode is
      active.
    - `simulation/` — simulation bridge, scenario setup, command handlers.
      Top-level siblings of `createSimulationBridge.ts` include
      `worldOccupancy.ts` (the `OccupancyBinding` adapter that keeps the
      authoritative blocker/crowding contract), `selectionActivity.ts`
      (structured activity payload for the HUD selection panel), and
      `renderStore.ts` (the per-tick render-message store the projector
      writes into, including the exact immediately prior forward-tick unit and
      moving-resource positions used only for display interpolation) and
      `renderMetricsCapture.ts` (the lightweight alive-count/world-metrics HUD
      capture that deliberately avoids full-world debug serialization). Phase
      1A added two more siblings: `commands.ts` (the
      `GameCommands` type alias for the 15-command surface that drives
      every gameplay-state mutation) and `dispatcher.ts` (the
      `drainPendingCommands(world, queue)` between-step helper that
      submits AI-decision intentions via `world.submitWithResult` immediately
      before the next tick, including persisted AI monk `monk.contextAtEntity`
      task intentions). `replay/` contains the replay-world helpers:
      `createReplayWorldOnly(snapshot)` builds a replay-mode bridge world for
      `SessionReplayer.openAt`, `makeReplayBridge(world)` wraps that world in
      the full `SimulationBridge` read surface without letting scene frames
      advance replay time, and `replayWorldContext.ts` stores the accessor,
      visibility cell, match state, pending-command queue, and bridge API in a
      WeakMap keyed by replay `World`.
      - `bridge/` — helper modules factored out of `createSimulationBridge.ts`. After Phase 4 + Phase 5 of the createSimulationBridge shrink, the orchestrator is a ~500-LOC facade that delegates world construction, render projection, and command dispatch to the modules below. Side-map ownership lives in `bridgeState.ts:createBridgeState()`; `createWorld.ts` instantiates it once and threads the same references through every dep-bag factory so save/load and destroy-entity hooks see consistent state.

        Boot/orchestration tier:
        - `createWorld.ts` — entry point invoked by the facade. Builds (or deserializes) the civ-engine `World`, instantiates `BridgeState`, builds tile grids, then calls `wireBridgeOps` and `assembleBridgeApi`.
        - `wireBridgeOps.ts` — pre-seed wiring orchestrator: delegates pre-seed factory construction to `wirePreSeedOps.ts` (entity-create/destroy ops, target finding, technology, match-end, etc., including the `VisibilityCell` and the Phase 2E `visibilityFingerprints` Map shared between the bootstrap call and the per-tick visibilitySystem), makes the call into `seedFreshScenario` (skipped on save-load), and composes the AI intention-pusher closures from `aiIntentionPushers.ts` into the deps handed to `registerBridgeSystems`.
        - `wirePostSeedOps.ts` — post-seed factory wiring (visibility queries, selection input, training/market, monk tasks, AI decision, unit command).
        - `registerBridgeSystems.ts` — final glue: spreads the 10 ops factories through `registerAllSystems`; calls the Phase 2C `bootstrapFlush` that populates the four Tier-3 slots (bridgeMeta / visibility / matchState / pendingCommands) once at construction; calls `registerOutputTail` so `tier3SyncSystem` + `bridgeSnapshotSystem` run at the end of every output phase; and creates the post-register input ops (placement, save, economy state, human input).
        - `registerAllSystems.ts` — bundles all 20 ECS system registrations + the 4 Tier-1 codec accessors threaded through them. In replay mode it keeps deterministic systems real, runs replay-safe AI-decision systems with real intention emitters into the replay-only pending queue, and registers `aoe2ReplayPendingCommandDrain` before `prototypeAi` so hydrated pending snapshots do not leak while AI-decision boundary state can still be reproduced.
        - `bootstrapFlush.ts` — once-at-construction writer for `aoe2.bridgeMeta` / `aoe2.matchState` / `aoe2.visibility` / `aoe2.pendingCommands` so snapshots taken before tick 1 are complete.
        - `assembleBridgeApi.ts` — composes the `SimulationBridge` public surface from the ops + state.
        - `scenarioSeedOps.ts`, `hydrateFromSavedGame.ts`, `hydrateFromWorldState.ts` — fresh-scenario seeding, schema-1 side-map hydration, and schema-2 world-state hydration. Schema-1 hydrate treats legacy `SaveBlob.sideMaps` as authoritative, while schema-2 hydrate reads pending commands and runtime cache rebuild inputs from `worldSnapshot.state.aoe2.*`. Both paths enforce the garrison cross-ref invariant and entity-id orphan pruning before the bridge resumes; schema-2 pruning only flushes slots that actually changed so replay construction does not add absent empty Tier-1 state keys.

        State + types tier:
        - `bridgeState.ts` — single `createBridgeState()` factory that owns bridge-only runtime caches and side maps that are intentionally not Tier-1 serialized state (`movePathCache`, `monksByOwner`, `monkConvertProcessedThisTick`, `pendingCommands`). Phase 2D moved the Tier-1 codec slots, including `monkTasks` and `unitCommands`, into `world.state.aoe2.<slot>` through `BridgeStateAccessor.mutate(codec, ...)`; Phase 2F persists `pendingCommands` through `aoe2.pendingCommands` at save time so AI intentions queued between ticks survive schema-2 save/load.
        - `bridgeStateSerialize.ts` — 35 Tier-1 `SlotCodec<TNative, TJson>` pairs (`flatMapCodec`, `mapOfSetCodec`, `mapOfMapCodec` factories) + `TIER_1_CODECS` registry + `SLOT_CODECS_BY_KEY` lookup + Tier-3/save-state slot-name constants. Phase 2A/2F.
        - `bridgeStateAccessor.ts` — per-tick cache layer with lazy-bound world reference. Public surface: `get<T>(codec)` (lazy deserialize from `world.state` + decoupled clone), `mutate(codec, fn)` (read-modify-write + automatic markDirty), `markDirty(codec)`, `flush()` (atomic — pre-pass throws on unknown slots OR uncached dirty marks before any write), `reset()` (post-load cache invalidation). Phase 2A + iter-1 R2 atomicity.
        - `visibilityCell.ts` — wraps `VisibilityMap` with a dirty bit so `tier3SyncSystem` skips the visibility re-publish when no source moved. `markDirty()` is called by `syncVisibilitySources` only when an actual fingerprint change happens (Phase 2E).
        - `tier3SyncSystem.ts` — output-phase system that writes `aoe2.visibility` (gated by cell dirty bit), `aoe2.matchState` (unconditional, small/flat), and `aoe2.pendingCommands` (cloned queue snapshot). Exports `flushTier3State` and `flushPendingCommandsState` for save-time use.
        - `bridgeSnapshotSystem.ts` — output-phase system that calls `accessor.flush()`. Registered LAST in output phase via `registerOutputTail`.
        - `registerOutputTail.ts` — registration site that bundles the two output-phase systems above with their ordering invariant pinned.
        - `pendingCommandQuery.ts` — pure exhaustive-switch `hasPendingUnitCommand(queue, unitId)` predicate. autoAggression uses it to skip units aiSystem already pushed an intention for. Adding a new GameCommands variant without a case is a TS compile error here (full-review iter-1 R2-M1).
        - `sharedTypes.ts` — `UnitCommand` / `MonkTask` / `ConstructionState` / `TrebuchetPackState` shared between the facade and the helper-ops modules.
        - `bridgeConstants.ts`, `countdownTypes.ts`, `memoryTypes.ts`, `movementTypes.ts`, `createWorldResult.ts`, `wireBridgeOpsTypes.ts`, `registerAllSystemsTypes.ts`, `combatStateFactory.ts` — shared constants and type contracts.
        - `bridgeHelpers.ts` — small helper closures (`ensurePlayerScoreCounters`, `ensureAiState`, `inFlightTechSetFor`, `clearUnitCommand`, `setUnitCommand`, command-rejection queue).
        - `pureHelpers.ts` — pure helpers (clamp, grid/coordinate transforms, footprint visibility, etc.) plus `GameEvents` / `GameCommands` / `GameWorld` type aliases.

        Systems tier (`bridge/systems/*` — 20 ECS factories):
        - `aiSystem.ts`, `autoAggressionSystem.ts`, `playerCommandsSystem.ts`, `monkBehaviorSystem.ts`, `productionQueueSystem.ts`, `scoutMovementSystem.ts`, `villagerEconomySystem.ts`, `wildlifeCombatSystem.ts`, `herdableMovementSystem.ts`, `herdableOwnershipSystem.ts`, `visibilitySystem.ts`, `fogMemorySystem.ts`, `towerCombatSystem.ts`, `relicGoldSystem.ts`, `garrisonHealSystem.ts`, `wonderCountdownSystem.ts`, `relicCountdownSystem.ts`, `winConditionResolverSystem.ts`, `conquestOutcomeSystem.ts`, `scoreTimerSystem.ts`. Each factory takes a typed deps interface and registers exactly one `world.registerSystem({...})`. Execution order is driven by explicit `before`/`after` deps, not registration sequence. `aiSystem.ts` stays the single registered AI factory but delegates its per-tick decision work to sibling phase modules (`aiSystemGating.ts`, `aiSystemBuildingPhase.ts`, `aiSystemProductionPhase.ts`, `aiSystemAttackPhase.ts`, with shared context types in `aiSystemTypes.ts`).

        Helper-ops tier (factories used by either systems or the input surface):
        - `playerQueries.ts`, `aiDecisionOps.ts`, `targetFindingOps.ts`, `selectionFinders.ts` — read-side queries.
        - `entityCreateOps.ts`, `entityDestroyOps.ts`, `transformOps.ts`, `movementPlanOps.ts`, `placementOps.ts`, `trainingMarketOps.ts` — write-side entity/state mutators.
        - `humanInputOps.ts`, `selectionInputOps.ts`, `selectionStateOps.ts`, `unitCommandOps.ts`, `unitSelectionOps.ts`, `sheepCommandOps.ts` — command and selection surface.
        - `monkTaskOps.ts`, `monkAiSearchHelpers.ts`, `monkTaskAppliers.ts`, `technologyOps.ts`, `matchEndOps.ts`, `trebuchetState.ts` — system-specific helpers. `monkTaskOps.ts` exposes the AI-decision intention producer (`pushAiMonkTaskIntentions`); `aiSystem` uses it so pickup/deposit/heal task creation goes through `monk.contextAtEntity` on the next tick (the legacy direct-assignment helper `assignAiMonkTasks` was removed in full-review L4, leaving the intention path as the only AI monk-task route and keeping the KAD-0008 direct-mutation-vs-intention race closed). The actual task state is accessor-backed through `aoe2.monkTasks`, preserving snapshot/replay visibility.
        - `cellPassability.ts`, `visibilityQueries.ts`, `visibility.ts`, `fogMemoryOps.ts` — terrain/visibility queries.
        - `optionsRules.ts` — train/research/market/build option lookup.
        - `researchAvailability.ts` — shared "why is this research unavailable" reason engine (agent-affordances 2026-06-11); consumed by the queue.research validator's `cannot_research` message and by `buildingOptionsOps` so the two surfaces never disagree.
        - `buildingOptionsOps.ts` — `getAgentBuildingOptions(ownerId)`: per completed owned building type, research available/locked (with reasons) + trainable units + the villager build menu. Read-side payload for the LLM-agent snapshot, exposed on `SimulationBridge`.
        - `commandValidatorDeps.ts` — single construction site for the per-command semantic-validator dep bags (factored out of `wireBridgeOps` when the actionable-message collaborators pushed it past its line budget).
        - `renderStateOps.ts`, `debugSnapshotOps.ts`, `economyStateOps.ts`, `saveGameOps.ts` — read-side projections to the HUD/test surface. `saveGameOps.ts` now emits schema-2 blobs (`seed + worldSnapshot`) after flushing accessors, Tier-3 state, and pending commands into `world.state`.

        `createSimulationBridge.ts` imports from `bridge/` rather than re-declaring any of this. The four shared types in `sharedTypes.ts` are re-exported from the facade so external `SimulationBridge` consumers keep stable import paths.
      - `mapGeneration/` — deterministic procedural map generators and the
        spawn-list helper that enforces one-resource-per-cell. Hosts the
        default + Black Forest + Arena generators plus the shared terrain
        helpers (`paintDisc`, `createBaseTerrain`, etc.) and the starting
        offset tables (`STARTING_SHEEP`, `FOREST_PATCHES`, …).
      - `fixtures/` — per-category modules that export every vitest-driven
        fixture factory (conquest, economy basics, age progression, combat
        matchups, siege, monastery, castle defense, AI, wonder/relic,
        selection, sheep, scenario validation). The `fixtures/index.ts`
        barrel is the single place the `prototypeScenario.ts` dispatcher
        imports from.
  - `input/` — renderer-neutral hit testing, unit classification, standalone
    isometric camera control, DOM pointer normalization, drag/middle pan state,
    click selection, and context-command dispatch. Raised entity clicks consume
    AoE recipe-projected hit regions promoted only at matching presented
    epoch/revision; context loss or stale presentation fences interaction. Exact
    click history can reorder only the current target set. Input imports neither
    Three.js nor DOM/GPU renderer objects.
  - `rendering/` — pure isometric projection/interpolation/view contracts and
    AoE visual-role tables. `rendering/voxel/` owns the sole world adapter,
    procedural art, feedback parts, and Three runtime integration.
    `AoeVoxelPresentationCoordinator.ts` converts displayed bridge and
    interaction state into snapshots, accepts prior positions only from the
    exact adjacent simulation tick, and drives AoE-owned smooth root/facing
    presentation; `aoeVoxelOverlayParts.ts` emits selection,
    drag marquee, placement, authored-height health, hit, and death feedback into
    normal rigid-instance lanes;
    `AoeVoxelWorldRenderer.ts` owns direct capture, metrics, context lifecycle,
    and disposal. AoE semantics remain here rather than entering the reusable
    package.
  - `ui/` — DOM HUD controller. `ui/hud/` hosts `createHudController.ts` (top-bar + side panels), `hudTemplate.ts` (extracted HTML template), `saveLoadPanel.ts`, `selectionPanel/`, `minimap.ts`, etc. `ui/annotation/` hosts the annotation form + marker-list panel (Spec 2 v0.1.5 + replay-mode flips from v0.1.8). `ui/replay/` (NEW v0.1.12) hosts `replayLoadDialog.ts`, the unified `ReplayLoadDialog` modal that consolidates the three replay-load sources (live session, prior session, file import) under a single HUD entry point.
- `tests/` — Vitest unit/integration tests and Playwright browser tests
- `scripts/` — content and build scripts
- `design/` — game design spec, stat CSVs, implementation plan
- `generated/` — build-time content output (`generated/content/content.json`)
- `docs/` — architecture, devlog, engine feedback, learning, debugging

## Runtime layers

The runtime is layered and the boundaries are intentional.

```
civ-engine World ──► Simulation bridge ──► projected render frame ──► AoE voxel adapter ──► voxel/three ──► one world canvas
        ▲                       │                                             ▲
        │                       └──► DOM HUD/minimap                         │
        └────────────────────── commands ◄── AoeVoxelGameView input/camera ─┘

design/stats ──build──► generated/content.json ──load──► Simulation bridge
```

- `civ-engine` owns authoritative simulation state and deterministic ticking. All
  gameplay rules, combat, economy, progression, and AI policy live behind this
  boundary through ECS systems, queries, and commands.
- The simulation bridge (`src/game/simulation/`) owns repo-specific systems and
  scenario setup. It runs on top of `civ-engine` primitives and exposes a stable
  surface to the standalone voxel view and HUD. Routine render metrics count
  alive entities and read existing ECS metrics. The AoE-specific
  `getDebugSnapshot()` remains an explicit on-demand diagnostic; full
  `WorldDebugger.capture()` serialization is not constructed by this bridge or
  the per-tick render path.
- `AoeVoxelGameView` is the sole renderer host. It advances the live bridge,
  updates renderer-neutral camera/input controllers, presents the AoE-owned
  voxel snapshot, and frames one Three canvas. Fog, selection, drag marquee,
  placement, health, hit, and death feedback are snapshot data, not a second
  paint layer.
  The view owns no gameplay state.
- The sibling `voxel` package owns only reusable render contracts, validation,
  chunk meshing, bounded injected-time rigid-instance playback, Three resource
  presentation, capture, metrics, and disposal.
  AoE concepts and authoritative state never cross that package boundary.
- The DOM HUD is a pure consumer of render frames and selection state. It emits
  commands through the same seam as right-click orders from the scene.
- Content flows one-way: design CSVs under `design/stats/*.csv` are normalized at
  build time into `generated/content/content.json`, which the simulation loads.
  The generated file is not committed.

## Determinism contract

- Seeds are reproducible from `?seed=<name>` URL parameters for fixtures.
- Commands and fixed-step ticks are the only sources of state change.
- Render interpolation is a display concern; it does not feed back into simulation
  state. It consumes only the exact immediately preceding forward-tick projection;
  gaps, rewinds, and generation changes snap instead of extrapolating across
  unrelated state. Click hit-testing prefers the displayed entity so the player's
  perceived target matches the authoritative target.

## Test boundaries

- Vitest (`npx vitest run`) covers simulation, content normalization, and scenario
  behavior. These tests drive simulation directly; they do not start a browser renderer.
- Playwright (`npm run test:browser`) drives the built preview app and asserts
  render-state and command flow end-to-end. Fixture seeds keep runs deterministic.
- `npx tsc --noEmit` and `npx vite build` gate type and build health.

## Where new work belongs

- A new gameplay rule, unit behavior, or AI change → simulation bridge or
  `civ-engine` (flag an engine gap in `docs/engine-feedback/current.md` if the
  engine lacks the primitive).
- A new AoE render treatment → `src/rendering/voxel/` as snapshot data/recipes;
  a new world input control → `src/input/` plus `AoeVoxelGameView`. Add a
  renderer-neutral diagnostic and visible browser evidence where needed.
- A new HUD element → `src/ui/` consuming render frames and selection state.
- New content → `design/stats/*.csv` plus any normalizer work in `scripts/`.
