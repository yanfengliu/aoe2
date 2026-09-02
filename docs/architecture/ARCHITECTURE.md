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
      garrison position gaps;
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
      contract; `ledgerOracleViolation.ts` renders a ledger finding in the
      repo's `OracleViolation` shape for the canary drill; `corpusSchema.ts`
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
      commands before `world.step()`, bounds one animation-frame catch-up with
      the shared visible-simulation timing policy, and restores the live bridge on exit.
      Initial and resumed playback callbacks establish their timestamp with zero
      delta, so the checkpoint is displayed before later elapsed time advances it.
      `TimelinePanel.ts` renders the replay-only bottom strip, marker pins,
      hotspot pins, and scrub controls against the controller boundary.
      `ReplayHotkeys.ts` binds replay navigation keys only while replay mode is
      active.
    - `simulation/` — simulation bridge, scenario setup, command handlers.
      Top-level siblings of `createSimulationBridge.ts` include
      `worldOccupancy.ts` (the `OccupancyBinding` adapter that keeps the
      authoritative blocker/crowding contract, and the `structuralRevision`
      counter reachability caches key on — bumped by every claim or release
      and by `notePassabilityChange()` when a gate finishing changes who may
      pass without changing what is claimed), `spawnPassabilityMemo.ts` (the
      per-revision cache for the simulation's hottest predicate, and the
      argument for why the revision counter is a sufficient invalidation
      signal for it), `selectionActivity.ts`
      (structured activity payload for the HUD selection panel), and
      `renderStore.ts` (the per-tick render-message store the projector
      writes into, including the exact immediately prior forward-tick unit and
      moving-resource positions used only for display interpolation plus
      indexed reconciliation of transient attack overlays),
      `attackAnimationTypes.ts` (the projected successful-hit contract), and
      `renderMetricsCapture.ts` (the lightweight alive-count/world-metrics HUD
      capture that deliberately avoids full-world debug serialization).
      `src/game/visibleSimulationTiming.ts` is the shared live/replay elapsed-time bound,
      preventing either host from consuming an unbounded hidden interval in one
      visible callback. Phase
      1A added two more siblings: `commands.ts` (the
      `GameCommands` type alias for the 15-command surface that drives
      every gameplay-state mutation) and `dispatcher.ts` (the
      `drainPendingCommands(world, queue)` between-step helper that
      submits AI-decision intentions via `world.submitWithResult` immediately
      before the next tick, including persisted AI monk `monk.contextAtEntity`
      task intentions). `replay/` contains the replay-world helpers:
      `createReplayWorldOnly(snapshot)` builds a replay-mode bridge world for
      `SessionReplayer.openAt`, `makeReplayBridge(world)` wraps that world in
      the full `SimulationBridge` read surface without letting host/view frames
      advance replay time, and `replayWorldContext.ts` stores the accessor,
      visibility cell, match state, pending-command queue, and bridge API in a
      WeakMap keyed by replay `World`.
      - `bridge/` — helper modules factored out of `createSimulationBridge.ts`. After Phase 4 + Phase 5 of the createSimulationBridge shrink, the orchestrator is a ~500-LOC facade that delegates world construction, render projection, and command dispatch to the modules below. Side-map ownership lives in `bridgeState.ts:createBridgeState()`; `createWorld.ts` instantiates it once and threads the same references through every dep-bag factory so save/load and destroy-entity hooks see consistent state.

        Boot/orchestration tier:
        - `createWorld.ts` — entry point invoked by the facade. Builds (or deserializes) the civ-engine `World`, instantiates `BridgeState`, builds tile grids, then calls `wireBridgeOps` and `assembleBridgeApi`.
        - `wireBridgeOps.ts` — pre-seed wiring orchestrator: delegates pre-seed factory construction to `wirePreSeedOps.ts` (entity-create/destroy ops, target finding, technology, match-end, etc., including the `VisibilityCell` and the Phase 2E `visibilityFingerprints` Map shared between the bootstrap call and the per-tick visibilitySystem), makes the call into `seedFreshScenario` (skipped on save-load), and composes the AI intention-pusher closures from `aiIntentionPushers.ts` into the deps handed to `registerBridgeSystems`.
        - `wirePostSeedOps.ts` — post-seed factory wiring (visibility queries, selection input, training/market, monk tasks, AI decision, unit command).
        - `registerBridgeSystems.ts` — final glue: spreads the 10 ops factories through `registerAllSystems`; calls the Phase 2C `bootstrapFlush` that populates the four legacy Tier-3 slots (bridgeMeta / visibility / matchState / pendingCommands) plus the recorder attack slot for live and new-format replay worlds; calls `registerOutputTail` so `tier3SyncSystem` + `bridgeSnapshotSystem` run at the end of every output phase; and creates the post-register input ops (placement, save, economy state, human input).
        - `registerAllSystems.ts` — bundles all 20 ECS system registrations + the 4 Tier-1 codec accessors threaded through them. In replay mode it keeps deterministic systems real, runs replay-safe AI-decision systems with real intention emitters into the replay-only pending queue, and registers `aoe2ReplayPendingCommandDrain` before `prototypeAi` so hydrated pending snapshots do not leak while AI-decision boundary state can still be reproduced.
        - `bootstrapFlush.ts` — once-at-construction writer for `aoe2.bridgeMeta` / `aoe2.matchState` / `aoe2.visibility` / `aoe2.pendingCommands` and, for live or already-new-format replay worlds, `aoe2.replayUnitAttacks`, so fresh recording snapshots taken before tick 1 are complete without changing legacy replay snapshot key sets.
        - `assembleBridgeApi.ts` — composes the `SimulationBridge` public surface from the ops + state.
        - `scenarioSeedOps.ts`, `hydrateFromSavedGame.ts`, `hydrateFromWorldState.ts` — fresh-scenario seeding, schema-1 side-map hydration, and schema-2 world-state hydration. Schema-1 hydrate treats legacy `SaveBlob.sideMaps` as authoritative, while schema-2 hydrate reads pending commands and runtime cache rebuild inputs from `worldSnapshot.state.aoe2.*`. Both paths enforce the garrison cross-ref invariant and entity-id orphan pruning before the bridge resumes; schema-2 pruning only flushes slots that actually changed so replay construction does not add absent empty Tier-1 state keys.

        State + types tier:
        - `bridgeState.ts` — single `createBridgeState()` factory that owns bridge-only runtime caches and side maps that are intentionally not Tier-1 serialized state (`movePathCache`, `monksByOwner`, `monkConvertProcessedThisTick`, `pendingCommands`, `unitAttackFeed`). Phase 2D moved the Tier-1 codec slots, including `monkTasks` and `unitCommands`, into `world.state.aoe2.<slot>` through `BridgeStateAccessor.mutate(codec, ...)`; Phase 2F persists `pendingCommands` through `aoe2.pendingCommands` at save time so AI intentions queued between ticks survive schema-2 save/load. The bounded attack feed is mirrored into `aoe2.replayUnitAttacks` only for recorder checkpoint fidelity and is stripped from ordinary user-save snapshots; hydration inspects only the final 1,024 candidates, validates and canonicalizes fresh in-bounds records, and retains only the latest record per attacker identity.
        - `bridgeStateSerialize.ts` — 35 Tier-1 `SlotCodec<TNative, TJson>` pairs (`flatMapCodec`, `mapOfSetCodec`, `mapOfMapCodec` factories) + `TIER_1_CODECS` registry + `SLOT_CODECS_BY_KEY` lookup + Tier-3/save-state slot-name constants. Phase 2A/2F.
        - `bridgeStateAccessor.ts` — per-tick cache layer with lazy-bound world reference. Public surface: `get<T>(codec)` (lazy deserialize from `world.state` + decoupled clone), `mutate(codec, fn)` (read-modify-write + automatic markDirty), `markDirty(codec)`, `flush()` (atomic — pre-pass throws on unknown slots OR uncached dirty marks before any write), `reset()` (post-load cache invalidation). Phase 2A + iter-1 R2 atomicity.
        - `visibilityCell.ts` — wraps `VisibilityMap` with a dirty bit so `tier3SyncSystem` skips the visibility re-publish when no source moved. `markDirty()` is called by `syncVisibilitySources` only when an actual fingerprint change happens (Phase 2E).
        - `tier3SyncSystem.ts` — output-phase system that writes `aoe2.visibility` (gated by cell dirty bit), `aoe2.matchState` (unconditional, small/flat), `aoe2.pendingCommands` (cloned queue snapshot), and the pruned `aoe2.replayUnitAttacks` checkpoint feed when that format is enabled. The attack slot is forced at bootstrap, then published only on add, change, or expiry; quiet output ticks do not dirty recorder state. Legacy replay worlds preserve the absent slot across construction and stepping. Exports focused flush helpers for construction, recording, and save-time use.
        - `bridgeSnapshotSystem.ts` — output-phase system that calls `accessor.flush()`. Registered LAST in output phase via `registerOutputTail`.
        - `registerOutputTail.ts` — registration site that bundles the two output-phase systems above with their ordering invariant pinned.
        - `pendingCommandQuery.ts` — pure exhaustive-switch `hasPendingUnitCommand(queue, unitId)` predicate. autoAggression uses it to skip units aiSystem already pushed an intention for. Adding a new GameCommands variant without a case is a TS compile error here (full-review iter-1 R2-M1).
        - `sharedTypes.ts` — `UnitCommand` / `MonkTask` / `ConstructionState` / `TrebuchetPackState` shared between the facade and the helper-ops modules.
        - `bridgeConstants.ts`, `countdownTypes.ts`, `memoryTypes.ts`, `movementTypes.ts`, `createWorldResult.ts`, `wireBridgeOpsTypes.ts`, `registerAllSystemsTypes.ts`, `combatStateFactory.ts` — shared constants and type contracts.
        - `bridgeHelpers.ts` — small helper closures (`ensurePlayerScoreCounters`, `ensureAiState`, `inFlightTechSetFor`, `clearUnitCommand`, `setUnitCommand`, command-rejection queue).
        - `pureHelpers.ts` — pure helpers (clamp, grid/coordinate transforms, footprint visibility, etc.) plus `GameEvents` / `GameCommands` / `GameWorld` type aliases.

        Systems tier (`bridge/systems/*` — 20 ECS factories):
        - `aiSystem.ts`, `autoAggressionSystem.ts`, `playerCommandsSystem.ts`, `monkBehaviorSystem.ts`, `productionQueueSystem.ts`, `scoutMovementSystem.ts`, `villagerEconomySystem.ts` (with `dropOffStep.ts` and `idleGatherAssignment.ts` — the latter owning what a gatherer with no workable target does next: the resource-kind fallback and the reachability retry cadence), `wildlifeCombatSystem.ts`, `herdableMovementSystem.ts`, `herdableOwnershipSystem.ts`, `visibilitySystem.ts`, `fogMemorySystem.ts`, `towerCombatSystem.ts`, `relicGoldSystem.ts`, `garrisonHealSystem.ts`, `wonderCountdownSystem.ts`, `relicCountdownSystem.ts`, `winConditionResolverSystem.ts`, `conquestOutcomeSystem.ts`, `scoreTimerSystem.ts`. Each factory takes a typed deps interface and registers exactly one `world.registerSystem({...})`. Execution order is driven by explicit `before`/`after` deps, not registration sequence. `aiSystem.ts` stays the single registered AI factory but delegates its per-tick decision work to sibling phase modules (`aiSystemGating.ts`, `aiSystemBuildingPhase.ts`, `aiSystemProductionPhase.ts`, `aiSystemAttackPhase.ts`, with shared context types in `aiSystemTypes.ts`).

        Helper-ops tier (factories used by either systems or the input surface):
        - `playerQueries.ts`, `aiDecisionOps.ts`, `targetFindingOps.ts`, `selectionFinders.ts` — read-side queries.
        - `entityCreateOps.ts`, `entityDestroyOps.ts`, `transformOps.ts`, `movementPlanOps.ts`, `movementTrafficOps.ts`, `placementOps.ts`, `trainingMarketOps.ts` — write-side entity/state mutators. Fine-grid movement in `transformOps.ts` publishes replacement `unitTransform` components through the ECS API on every fixed step and targets the occupancy grid's allocated slot; the component persists that numeric assignment or an explicit overflow marker so live-load and replay occupancy rebuilds preserve continuation. `movementPersistenceTypes.ts` isolates the additive movement-authority fields from the cap-pressured core component catalog. `movementTrafficOps.ts` — with the election itself, the starvation threshold and the one clock rule (`trafficProgressClock`) in `movementTrafficElection.ts` — sits between route planning and the step executor: permanent topology remains the global A* authority, while commanded/task movers in a straight or turning one-cell passage use a tick-local owner-scoped origin reservation, centered lane, and directed occupied-cell dependency closure. Four additive `UnitTransformComponent` provenance fields retain the last actual traffic leg, matching intent identity, and attempt tick so save/load can reproduce cycle decisions without serializing or consulting `movePathCache`; stale, multi-occupied, and noncalling branches fail closed. The dependency closure ELECTS one caller — the stable lowest id, unless a member's starvation clock (continuous contested waiting, restarted by a cell change or by a gap in attempting, and read from the same tick-start snapshot as every other input) has passed the threshold — and that decision is final — the per-cell cross-flow and same-flow rules are not consulted for an elected caller, because a narrower rule that vetoes the winner deadlocks the jam it was meant to arbitrate (see `docs/architecture/decisions.md`). Transient per-tick state (attempted directions, origin reservations) lives in the ops closure and never in a component: writing `unitTransform` during arbitration disturbs the per-tick snapshot the arbiter reads from it. Direct in-place mutation would bypass render dirty tracking.
        - `humanInputOps.ts`, `selectionInputOps.ts`, `selectionStateOps.ts`, `unitCommandOps.ts`, `unitSelectionOps.ts`, `sheepCommandOps.ts` — command and selection surface.
        - `monkTaskOps.ts`, `monkAiSearchHelpers.ts`, `monkTaskAppliers.ts`, `technologyOps.ts`, `matchEndOps.ts`, `trebuchetState.ts` — system-specific helpers. `monkTaskOps.ts` exposes the AI-decision intention producer (`pushAiMonkTaskIntentions`); `aiSystem` uses it so pickup/deposit/heal task creation goes through `monk.contextAtEntity` on the next tick (the legacy direct-assignment helper `assignAiMonkTasks` was removed in full-review L4, leaving the intention path as the only AI monk-task route and keeping the KAD-0008 direct-mutation-vs-intention race closed). The actual task state is accessor-backed through `aoe2.monkTasks`, preserving snapshot/replay visibility.
        - `cellPassability.ts`, `visibilityQueries.ts`, `visibility.ts`, `fogMemoryOps.ts` — terrain/visibility queries, raw live-entity projection, and fog-memory production. Raw projection retains stationary entities while hidden so a later LOS change can reveal them without an ECS mutation; `renderStateOps.ts` owns the final perspective boundary.
        - `unitAttackAnimationFeed.ts`, `unitAttackVisibilitySuppression.ts`, `playerCommandVisibilityRevision.ts` — bounded, generation-aware successful-hit recording, per-perspective hide-once replay state, and a command-local visibility-current gate. The first successful impact each tick and every later impact after a player-command LOS fingerprint mutation synchronize visibility sources; unchanged same-tick impacts and fine-only movement reuse the proven-current snapshot, while source fingerprints prevent unnecessary `VisibilityMap` recomputation. Recursive building destruction compares the actual source fingerprints of the building plus its bounded garrison IDs, and construction invalidates only when completion actually adds a source. Every witness, including the attacker's owner, must see at least one cell of the attacker footprint and at least one cell of the target footprint at that impact; when no perspective qualifies, no event or coordinates are recorded. The feed captures the source and target roots, indexes one latest event per attacker for projection, records `cancelTick` on the first actual root movement, and persists `suppressedFor` when an attacker later leaves a witness's current view so a fresh recorder-checkpoint bridge cannot resurrect that cue. Tower targeting keeps the pass-start visibility snapshot immutable for every building, then one final visibility refresh runs after a successful pass if any unit died and before output suppression and checkpoint publication. The feed prunes quiet expired events and hydrates only a validated, canonical tail of the recorder checkpoint slot; it has no damage, command, movement, or user-save authority.
        - `optionsRules.ts` — train/research/market/build option lookup.
        - `researchAvailability.ts` — shared "why is this research unavailable" reason engine (agent-affordances 2026-06-11); consumed by the queue.research validator's `cannot_research` message and by `buildingOptionsOps` so the two surfaces never disagree.
        - `buildingOptionsOps.ts` — `getAgentBuildingOptions(ownerId)`: per completed owned building type, research available/locked (with reasons) + trainable units + the villager build menu. Read-side payload for the LLM-agent snapshot, exposed on `SimulationBridge`.
        - `commandValidatorDeps.ts` — single construction site for the per-command semantic-validator dep bags (factored out of `wireBridgeOps` when the actionable-message collaborators pushed it past its line budget).
        - `renderStateOps.ts`, `debugSnapshotOps.ts`, `economyStateOps.ts`, `saveGameOps.ts` — read-side projections to the HUD/test surface. `renderStateOps.ts` applies the final current-player visibility predicate to the raw store, reconciles active attack overlays even when a stationary attacker has no ordinary ECS diff, and exposes only prior positions that were visible in the prior frame and remain current visible identities. Recorder checkpoints persist per-perspective cue suppression before snapshot publication, while `RenderStore` keeps a renderer-local tombstone as defense in depth; live and replay `visibleEntities` surfaces consume the filtered state, while `entityCount` deliberately remains an all-world alive debug/performance metric. `saveGameOps.ts` emits schema-2 blobs (`seed + worldSnapshot`) after flushing accessors, Tier-3 state, and pending commands into `world.state`, then removes recorder-only attack cues from the detached user-save snapshot.

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
    AoE visual-role tables. `artStyles.ts` and `artStylePreference.ts` own the
    display-only art-style layer: which resolve tuning each style applies to
    the sibling `voxel` package's `StylizedResolvePass`, and where the choice
    is remembered. The pass itself is engine-owned because it reads only depth,
    normals, and luminance; AoE owns the tuning, and every constant records the
    frame measurement it was chosen against. Style is never world state and
    never enters a save. `rendering/voxel/` owns the sole world adapter,
    procedural art, feedback parts, and Three runtime integration.
    `AoeVoxelPresentationCoordinator.ts` converts displayed bridge and
    interaction state into snapshots, accepts prior positions only from the
    exact adjacent simulation tick, and drives AoE-owned smooth root/facing
    presentation; `aoeVoxelBuildingDetails.ts` owns the exhaustive concrete-type
    facade/prop layer appended to completed role recipes, keeping construction
    generic and using the same prepared parts for drawing and silhouette hits;
    `aoeVoxelUnitRecipeContext.ts` centralizes scaled procedural part authorship;
    `aoeVoxelUnitVisualProfiles.ts` exhaustively selects armor, headgear, shield,
    mount, weapon, tier, and signature identity for all 34 concrete unit types;
    and the humanoid, mounted, siege, and monk recipe modules build those profiles
    through bounded shared family grammars. Exhaustive per-`UnitType` descriptors
    in `aoeVoxelUnitAttackRigs.ts` own controlled parts, pivots, pose style, and
    bounded melee reach; `aoeVoxelUnitAttackPoseStyles.ts` transforms each visible
    weapon compound, while `aoeVoxelUnitAttackGeometry.ts` owns the shared rigid
    math. `aoeVoxelUnitAttackSampling.ts` maps an authoritative hit to the authored
    impact keyframe and smooth recovery, and `aoeVoxelUnitAmbientAnimation.ts`
    suppresses competing transforms on attack-controlled parts. Prepared unit
    recipes remain the single source for both presented matrices and silhouette
    hits; `aoeVoxelOverlayParts.ts` emits selection,
    drag marquee, placement, authored-height health, hit, and death feedback into
    normal rigid-instance lanes;
    `AoeVoxelWorldRenderer.ts` owns direct capture, metrics, context lifecycle,
    disposal, and the monotonic animation clock supplied to both Voxel harmonic
    presentation and AoE hit geometry. It advances only on positive simulation
    display deltas, freezes on pause, and rebases without decrement on a bridge
    swap or replay rewind. AoE semantics remain here rather than entering the
    reusable package.
  - `ui/` — DOM HUD controller. `ui/hud/` hosts `createHudController.ts` (top-bar + side panels), `hudTemplate.ts` (extracted HTML template), `saveLoadPanel.ts`, `selectionPanel/` (render helpers, command buttons, and — v0.3.187 — `buildPages.ts`/`buildPalette.ts` for DE's two-page command card), `minimap.ts`, etc. `ui/annotation/` hosts the annotation form + marker-list panel (Spec 2 v0.1.5 + replay-mode flips from v0.1.8). `ui/replay/` (NEW v0.1.12) hosts `replayLoadDialog.ts`, the unified `ReplayLoadDialog` modal that consolidates the three replay-load sources (live session, prior session, file import) under a single HUD entry point.
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
  surface to the standalone voxel view and HUD. Successful unit hits also enter
  a bounded, fog-witnessed presentation feed whose event tick is the visible
  impact keyframe; the first actual root change records a one-tick cancellation
  handoff. Recording snapshots preserve that disposable feed across replay
  checkpoint starts, while ordinary saves remove it. The raw render store is
  filtered at this bridge boundary so hidden entities, prior positions, attack
  cues, and visible-entity HUD surfaces do not escape the selected fog perspective. Routine render metrics deliberately count all alive entities and read existing ECS metrics. The AoE-specific
  `getDebugSnapshot()` remains an explicit on-demand diagnostic; full
  `WorldDebugger.capture()` serialization is not constructed by this bridge or
  the per-tick render path.
- `AoeVoxelGameView` is the sole renderer host. It advances the live bridge,
  updates renderer-neutral camera/input controllers, presents the AoE-owned
  voxel snapshot, and frames one Three canvas. Fog, selection, drag marquee,
  placement, health, hit, attack-pose, and death feedback are snapshot data, not a second
  paint layer.
  The view owns no gameplay state.
- The sibling `voxel` package owns only reusable render contracts, validation,
  chunk meshing, bounded injected-time rigid-instance playback, Three resource
  presentation, capture, metrics, and disposal.
  AoE concepts and authoritative state never cross that package boundary.
- AoE keeps mixed terrain in opaque palette chunks and layers deterministic low-profile detail through its own rigid-instance recipes. Water owns a dedicated low-roughness standard-material surface with static and animated batches; the static lane is the budget-overflow fallback, and neither lane enters entity hit state or changes ground-plane terrain picking.
- The DOM HUD is a pure consumer of render frames and selection state. It emits
  commands through the same seam as right-click orders from the voxel view.
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
- Units belong to a **domain** (`src/game/simulation/unitDomain.ts`): land or water, and the two are complementary — no cell admits both, and water admits only ships. Terrain passability, pathing, trained-unit spawn placement, and scenario spawn validation all read the domain rather than testing for specific unit types. A new water unit needs no naval branch anywhere; it needs an entry in `WATER_UNITS`.
- Randomness is **counter-based, never a stored stream.** The only chance in the simulation is the projectile to-hit roll (spec §10.4), and it is a pure hash of the shot's identity — launch tick, attacker id, target id, projectile id. There is no seeded RNG object and no RNG state in saves. Any future chance mechanic must follow the same rule: derive it from already-serialized facts, because a stateful stream desynchronises replays the moment the number or order of draws changes.
- Fine-grid transforms remain authoritative simulation components. Systems must publish replacements through `World.setComponent`; modifying a retrieved component object in place is outside the diff/render/replay contract and is prohibited.

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
- A new art style → an entry in `src/rendering/artStyles.ts`; the menu row, the
  persisted preference, and the renderer all read that list, so none of them
  needs touching. A new *capability* the styles need (a further colour or edge
  control) belongs in `voxel`'s `StylizedResolvePass`, not here.
- A new AoE render treatment → `src/rendering/voxel/` as snapshot data/recipes;
  a new world input control → `src/input/` plus `AoeVoxelGameView`. Add a
  renderer-neutral diagnostic and visible browser evidence where needed.
- A new HUD element → `src/ui/` consuming render frames and selection state.
- New content → `design/stats/*.csv` plus any normalizer work in `scripts/`.
