# Architecture

This document describes the structural boundaries of the project. Update it only for
structural changes (new modules, shifted boundaries, new build or data pipelines). Do
not update it for UI tweaks, bug fixes, refactors, or test-only work. When it does
change, also append a row to `drift-log.md` and mention the update in the devlog.

## Repository layout

- `src/` — game code (TypeScript)
  - `app/bootstrap/` — app startup. `installBrowserTestApi(...)` exposes the
    in-page `window.__AOE2_TEST__` test seam Playwright drives during browser
    tests; there is no separate dev HTTP server.
  - `game/` — gameplay rules, scenarios, content
    - `content/` — shared content tables (e.g., building footprints)
    - `simulation/` — simulation bridge, scenario setup, command handlers.
      Top-level siblings of `createSimulationBridge.ts` include
      `worldOccupancy.ts` (the `OccupancyBinding` adapter that keeps the
      authoritative blocker/crowding contract), `selectionActivity.ts`
      (structured activity payload for the HUD selection panel), and
      `renderStore.ts` (the per-tick render-message store the projector
      writes into).
      - `bridge/` — helper modules factored out of `createSimulationBridge.ts`. The orchestrator is a thin facade (~385 LOC) that delegates world construction, render projection, and command dispatch to the modules below. Side-map ownership lives in `bridgeState.ts:createBridgeState()`; `createWorld.ts` instantiates it once and threads the same references through every dep-bag factory so save/load and destroy-entity hooks see consistent state.

        Boot/orchestration tier:
        - `createWorld.ts` — entry point invoked by the facade. Builds (or deserializes) the civ-engine `World`, instantiates `BridgeState`, builds tile grids, then calls `wireBridgeOps` and `assembleBridgeApi`.
        - `wireBridgeOps.ts` — pre-seed factory wiring (entity-create/destroy ops, target finding, technology, match-end, etc.), `registerCommandHandlers` registration, the output-tail registration, the bootstrap accessor flush, and the call into `seedFreshScenario` (skipped on save-load).
        - `wirePostSeedOps.ts` — post-seed factory wiring (visibility queries, selection input, training/market, monk tasks, AI decision, unit command).
        - `registerBridgeSystems.ts` — final glue: spreads the 10 ops factories through `registerAllSystems` and creates the post-register input ops (placement, save, economy state, human input).
        - `registerAllSystems.ts` — bundles all 18 ECS system registrations.
        - `registerCommandHandlers.ts` — registers Phase 1B command validators + handlers (the recorded command surface routed through `world.submitWithResult`).
        - `registerOutputTail.ts` — registers the two output-phase systems (`tier3SyncSystem`, `bridgeSnapshotSystem`) that flush the bridge-state accessor and write Tier-3 slots back into `world.state.aoe2.*` for snapshot/recorder visibility.
        - `bootstrapFlush.ts` — populates `aoe2.bridgeMeta` / `aoe2.matchState` / `aoe2.visibility` once at construction so snapshots taken before tick 1 are complete.
        - `assembleBridgeApi.ts` — composes the `SimulationBridge` public surface from the ops + state.
        - `scenarioSeedOps.ts`, `hydrateFromSavedGame.ts` — fresh-scenario seeding and save-blob hydration (separated so the facade can pick the right path).
        - `tickHaltGuard.ts` — wraps `world.step()` with `createTickHaltState` + `tryTick`; catches `WorldTickFailureError`, captures `EngineHaltDetails` for the HUD, and halts further ticks for the session.

        State + types tier:
        - `bridgeState.ts` — single `createBridgeState()` factory that owns every side map still living in the bridge (`unitCommands`, `monkTasks`, `garrisonedByBuilding`, `productionQueues`, `combatStates`, `aiStates`, `pendingCommands`, `monksByOwner`, etc.). Phase 2D has begun migrating individual slots (`villagerOrdinals`, `gathererDropOffStuckSinceTick`, `monkHealCounters`, `playerAges`, `playerCivilizations`, `wonderCountdownOverrides`, `relicCountdownOverrides`) out of `BridgeState` into `world.state.aoe2.*` via the accessor + codec; remaining Tier-1 slots will follow.
        - `bridgeStateAccessor.ts` — per-tick cache layer over `world.state.aoe2.*` with `get` / `mutate` / `markDirty` / `flush` / `reset`. Migrated slots route reads/writes through it; the cache is flushed by `bridgeSnapshotSystem` in the output phase.
        - `bridgeStateSerialize.ts` — Tier-1 `SlotCodec` registry (`serialize: native → JsonValue` + `deserialize: JsonValue → native`) used by the accessor and the save/load path.
        - `bridgeSnapshotSystem.ts` + `tier3SyncSystem.ts` — output-phase systems registered in the order pinned by `registerOutputTail`. `tier3SyncSystem` writes Tier-3 slots (visibility, matchState) back to `world.state` only when the corresponding cell is dirty; `bridgeSnapshotSystem` runs last and calls `accessor.flush()`.
        - `visibilityCell.ts` — `VisibilityCell` wrapper around `VisibilityMap` that adds a dirty flag for the Tier-3 sync-skip optimization plus a `replace(next)` method so the cell identity stays stable across map swaps.
        - `sharedTypes.ts` — `UnitCommand` / `MonkTask` / `ConstructionState` / `TrebuchetPackState` shared between the facade and the helper-ops modules.
        - `bridgeConstants.ts`, `countdownTypes.ts`, `memoryTypes.ts`, `movementTypes.ts`, `createWorldResult.ts`, `wireBridgeOpsTypes.ts`, `registerAllSystemsTypes.ts`, `combatStateFactory.ts` — shared constants and type contracts.
        - `bridgeHelpers.ts` — small helper closures (`ensurePlayerScoreCounters`, `ensureAiState`, `inFlightTechSetFor`, `clearUnitCommand`, `setUnitCommand`, command-rejection queue).
        - `pureHelpers.ts` — pure helpers (clamp, grid/coordinate transforms, footprint visibility, etc.) plus `GameEvents` / `GameCommands` / `GameWorld` type aliases.

        Systems tier (`bridge/systems/*` — 18 ECS factories):
        - `aiSystem.ts`, `autoAggressionSystem.ts`, `playerCommandsSystem.ts`, `monkBehaviorSystem.ts`, `productionQueueSystem.ts`, `scoutMovementSystem.ts`, `villagerEconomySystem.ts`, `wildlifeCombatSystem.ts`, `herdableMovementSystem.ts`, `herdableOwnershipSystem.ts`, `visibilitySystem.ts`, `fogMemorySystem.ts`, `towerCombatSystem.ts`, `relicGoldSystem.ts`, `wonderCountdownSystem.ts`, `relicCountdownSystem.ts`, `winConditionResolverSystem.ts`, `conquestOutcomeSystem.ts`. Each factory takes a typed deps interface and registers exactly one `world.registerSystem({...})`. Execution order is driven by explicit `before`/`after` deps, not registration sequence.

        Helper-ops tier (factories used by either systems or the input surface):
        - `playerQueries.ts`, `aiDecisionOps.ts`, `targetFindingOps.ts`, `selectionFinders.ts` — read-side queries.
        - `entityCreateOps.ts`, `entityDestroyOps.ts`, `transformOps.ts`, `movementPlanOps.ts`, `placementOps.ts`, `trainingMarketOps.ts` — write-side entity/state mutators.
        - `humanInputOps.ts`, `selectionInputOps.ts`, `selectionStateOps.ts`, `unitCommandOps.ts` — command surface.
        - `monkTaskOps.ts`, `monkAiSearchHelpers.ts`, `monkTaskAppliers.ts`, `technologyOps.ts`, `matchEndOps.ts`, `trebuchetState.ts` — system-specific helpers.
        - `cellPassability.ts`, `visibilityQueries.ts`, `visibility.ts`, `fogMemoryOps.ts` — terrain/visibility queries.
        - `optionsRules.ts` — train/research/market/build option lookup.
        - `renderStateOps.ts`, `debugSnapshotOps.ts`, `economyStateOps.ts`, `saveGameOps.ts` — read-side projections to the HUD/test surface.

        `createSimulationBridge.ts` imports from `bridge/` rather than re-declaring any of this. The four shared types in `sharedTypes.ts` are re-exported from the facade so external `SimulationBridge` consumers keep stable import paths. `dispatcher.ts` (sibling of the facade) hosts the between-tick `drainPendingCommands` that submits AI-decision intentions to handlers via `world.submitWithResult`.
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
  - `phaser/` — Phaser-specific scenes and render projection. Hosts `scenes/GameScene.ts` (scene class wiring lifecycle, input, and projection-driven render orchestration), `scenes/entityHitTest.ts` + `scenes/interpolateProjectedEntities.ts`, plus a `scenes/gameScene/` subdirectory for the dep-bag renderer factories factored out of the scene file: `debugOverlay.ts` (world-space debug-mode overlays), `worldLayers.ts` (health-bar + fog-of-war paints), `selectionLayers.ts` (selection ring + placement preview + marquee paints), `cameraController.ts` (per-frame update, middle-drag pan, edge-pan, zoom/scroll clamp, HUD-facing camera queries), `buildingRenderer.ts` (the per-building rendering primitives — anchor sprite, footprint outline, construction overlay), and `unitTypeMap.ts` (the `ALL_UNIT_TYPES` table + `isUnitType` predicate).
  - `game/control/` — input-side control primitives: `PauseControl` (manual pause flag distinct from engine halt) and `HotkeyRegistry` (Spec 2 v0.1.5 Alt+M / Alt+L hotkey routing).
  - `game/recording/` — Spec 2 annotation pipeline: `RecordingService` binds a `SessionRecorder` to the live world, `IndexedDBMirror` (write-only mirror over `MemorySink({ allowSidecar: true })`) persists session bundles for crash recovery, `AnnotationController` resolves selections to `MarkerRefs` and emits markers.
  - `game/annotations/` — annotation schema + helpers: `markerSchema.ts` types, `selectionToRefs.ts` resolver, `captureScreenshot.ts` helper.
  - `ui/` — DOM HUD controller. `ui/hud/` hosts the orchestrator + selection / debug / minimap / save-load / toast / tooltip helpers; `ui/annotation/` hosts the Spec 2 `AnnotationForm` + `MarkerListPanel`.
  - `shims/` — Vite aliases for Node-only modules (`crypto`, `fs`, `path`) so civ-engine code that conditionally imports them can build for the browser.
- `tests/` — Vitest unit/integration tests and Playwright browser tests
- `scripts/` — content and build scripts
- `design/` — game design spec, stat CSVs, implementation plan
- `generated/` — build-time content output (`generated/content/content.json`)
- `docs/` — architecture, devlog, engine feedback, learning, debugging

## Runtime layers

The runtime is layered and the boundaries are intentional.

```
DOM HUD  ─────► Phaser scene (render + input) ─────► Simulation bridge ─────► civ-engine World
                                                       │
                                                       └── content tables (design/stats → generated/content.json)
```

- `civ-engine` owns authoritative simulation state and deterministic ticking. All
  gameplay rules, combat, economy, progression, and AI policy live behind this
  boundary through ECS systems, queries, and commands.
- The simulation bridge (`src/game/simulation/`) owns repo-specific systems and
  scenario setup. It runs on top of `civ-engine` primitives and exposes a stable
  surface to the Phaser scene and HUD.
- Phaser is view and input only. It consumes render frames projected through
  `civ-engine`'s `RenderAdapter` and issues commands back into the simulation. No
  gameplay state lives in Phaser scenes.
- The DOM HUD is a pure consumer of render frames and selection state. It emits
  commands through the same seam as right-click orders from the scene.
- Content flows one-way: design CSVs under `design/stats/*.csv` are normalized at
  build time into `generated/content/content.json`, which the simulation loads.
  The generated file is not committed.

## Determinism contract

- Seeds are reproducible from `?seed=<name>` URL parameters for fixtures.
- Commands and fixed-step ticks are the only sources of state change.
- Render interpolation is a display concern; it does not feed back into simulation
  state. Click hit-testing prefers the displayed entity so the player's perceived
  target matches the authoritative target.

## Test boundaries

- Vitest (`npx vitest run`) covers simulation, content normalization, and scenario
  behavior. These tests drive simulation directly; they do not start Phaser.
- Playwright (`npm run test:browser`) drives the built preview app and asserts
  render-state and command flow end-to-end. Fixture seeds keep runs deterministic.
- `npx tsc --noEmit` and `npx vite build` gate type and build health.

## Where new work belongs

- A new gameplay rule, unit behavior, or AI change → simulation bridge or
  `civ-engine` (flag an engine gap in `docs/engine-feedback/current.md` if the
  engine lacks the primitive).
- A new render treatment or input control → Phaser scene with a render-state seam
  so browser tests can assert on the rendered output.
- A new HUD element → `src/ui/` consuming render frames and selection state.
- New content → `design/stats/*.csv` plus any normalizer work in `scripts/`.

## Drift Log

Structural drift detected during doc audits but deferred (out of scope for the audit pass that found it). The append-only `drift-log.md` (sibling) records changes that were applied to ARCHITECTURE.md; this section records drift that was noticed but not yet structurally addressed.

- 2026-05-02 — `docs/devlog/summary.md` is 107 lines (each line very long, ~1.5–3 KB). AGENTS.md hard-caps the summary at 50 lines; compaction is deferred until an owner can decide which 2026-04-25 → 2026-05-01 entries to fold or drop. Current audit only refreshed structural references that were stale.
- 2026-05-02 — Several detailed devlogs exceed the 500-line ceiling enumerated in AGENTS.md: `docs/devlog/detailed/2026-04-23_2026-04-23.md` (501), `2026-04-24_2026-04-26.md` (585), `2026-04-26_2026-05-01.md` (891). Standard remediation is `git mv` to update each filename's `END_DATE` and start a new active file; deferred because re-dating filenames is a structural rename outside this audit's scope.
- 2026-05-02 — `docs/learning/lessons.md` pointers reference `src/game/simulation/createSimulationBridge.ts` for helpers that have moved (`computeUnitActivity` → `selectionActivity.ts`; `updateSheepOwnership` / `syncSheepVisionSource` → `bridge/visibility.ts`; `clearUnitCommand` / `setUnitCommand` / `movePathCache` / `resolveMovePlanFromCache` → `bridge/bridgeHelpers.ts` + `bridge/registerAllSystems.ts`). Lessons file pointers have been refreshed in this audit.
