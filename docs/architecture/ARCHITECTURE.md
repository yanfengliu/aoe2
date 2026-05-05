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
      writes into). Phase 1A added two more siblings: `commands.ts` (the
      `GameCommands` type alias for the 15-command surface that drives
      every gameplay-state mutation) and `dispatcher.ts` (the
      `drainPendingCommands(world, queue)` between-step helper that
      submits AI-decision intentions via `world.submitWithResult` immediately
      before the next tick, including persisted AI monk `monk.contextAtEntity`
      task intentions).
      - `bridge/` — helper modules factored out of `createSimulationBridge.ts`. After Phase 4 + Phase 5 of the createSimulationBridge shrink, the orchestrator is a 332-LOC facade that delegates world construction, render projection, and command dispatch to the modules below. Side-map ownership lives in `bridgeState.ts:createBridgeState()`; `createWorld.ts` instantiates it once and threads the same references through every dep-bag factory so save/load and destroy-entity hooks see consistent state.

        Boot/orchestration tier:
        - `createWorld.ts` — entry point invoked by the facade. Builds (or deserializes) the civ-engine `World`, instantiates `BridgeState`, builds tile grids, then calls `wireBridgeOps` and `assembleBridgeApi`.
        - `wireBridgeOps.ts` — pre-seed factory wiring (entity-create/destroy ops, target finding, technology, match-end, etc.) and the call into `seedFreshScenario` (skipped on save-load). Constructs the Phase 2A `BridgeStateAccessor` + `VisibilityCell` near the top so all downstream factories can consume them, and the Phase 2E `visibilityFingerprints` Map shared between the bootstrap call and the per-tick visibilitySystem.
        - `wirePostSeedOps.ts` — post-seed factory wiring (visibility queries, selection input, training/market, monk tasks, AI decision, unit command).
        - `registerBridgeSystems.ts` — final glue: spreads the 10 ops factories through `registerAllSystems`; calls the Phase 2C `bootstrapFlush` that populates the three Tier-3 slots once at construction; calls `registerOutputTail` so `tier3SyncSystem` + `bridgeSnapshotSystem` run at the end of every output phase; and creates the post-register input ops (placement, save, economy state, human input).
        - `registerAllSystems.ts` — bundles all 18 ECS system registrations + the 4 Tier-1 codec accessors threaded through them.
        - `bootstrapFlush.ts` — once-at-construction writer for `aoe2.bridgeMeta` / `aoe2.matchState` / `aoe2.visibility` so snapshots taken before tick 1 are complete.
        - `assembleBridgeApi.ts` — composes the `SimulationBridge` public surface from the ops + state.
        - `scenarioSeedOps.ts`, `hydrateFromSavedGame.ts` — fresh-scenario seeding and save-blob hydration (separated so the facade can pick the right path). Hydrate runs the cross-ref garrison invariant FIRST, then key-side `pruneOrphanEntityKeys`, then value-side dead-id pruning for entity-id-typed values (Gemini full-review iter-1 R2-G1).

        State + types tier:
        - `bridgeState.ts` — single `createBridgeState()` factory that owns bridge-only runtime caches and side maps that are intentionally not Tier-1 serialized state (`movePathCache`, `monksByOwner`, `monkConvertProcessedThisTick`, `pendingCommands`). Phase 2D moved the Tier-1 codec slots, including `monkTasks` and `unitCommands`, into `world.state.aoe2.<slot>` through `BridgeStateAccessor.mutate(codec, ...)`.
        - `bridgeStateSerialize.ts` — 35 Tier-1 `SlotCodec<TNative, TJson>` pairs (`flatMapCodec`, `mapOfSetCodec`, `mapOfMapCodec` factories) + `TIER_1_CODECS` registry + `SLOT_CODECS_BY_KEY` lookup + the three Tier-3 slot-name constants. Phase 2A.
        - `bridgeStateAccessor.ts` — per-tick cache layer with lazy-bound world reference. Public surface: `get<T>(codec)` (lazy deserialize from `world.state` + decoupled clone), `mutate(codec, fn)` (read-modify-write + automatic markDirty), `markDirty(codec)`, `flush()` (atomic — pre-pass throws on unknown slots OR uncached dirty marks before any write), `reset()` (post-load cache invalidation). Phase 2A + iter-1 R2 atomicity.
        - `visibilityCell.ts` — wraps `VisibilityMap` with a dirty bit so `tier3SyncSystem` skips the visibility re-publish when no source moved. `markDirty()` is called by `syncVisibilitySources` only when an actual fingerprint change happens (Phase 2E).
        - `tier3SyncSystem.ts` — output-phase system that writes `aoe2.visibility` (gated by cell dirty bit) + `aoe2.matchState` (unconditional, small/flat). Exports `flushTier3State` for save-time use (full-review iter-1 R2-C2).
        - `bridgeSnapshotSystem.ts` — output-phase system that calls `accessor.flush()`. Registered LAST in output phase via `registerOutputTail`.
        - `registerOutputTail.ts` — registration site that bundles the two output-phase systems above with their ordering invariant pinned.
        - `pendingCommandQuery.ts` — pure exhaustive-switch `hasPendingUnitCommand(queue, unitId)` predicate. autoAggression uses it to skip units aiSystem already pushed an intention for. Adding a new GameCommands variant without a case is a TS compile error here (full-review iter-1 R2-M1).
        - `sharedTypes.ts` — `UnitCommand` / `MonkTask` / `ConstructionState` / `TrebuchetPackState` shared between the facade and the helper-ops modules.
        - `bridgeConstants.ts`, `countdownTypes.ts`, `memoryTypes.ts`, `movementTypes.ts`, `createWorldResult.ts`, `wireBridgeOpsTypes.ts`, `registerAllSystemsTypes.ts`, `combatStateFactory.ts` — shared constants and type contracts.
        - `bridgeHelpers.ts` — small helper closures (`ensurePlayerScoreCounters`, `ensureAiState`, `inFlightTechSetFor`, `clearUnitCommand`, `setUnitCommand`, command-rejection queue).
        - `pureHelpers.ts` — pure helpers (clamp, grid/coordinate transforms, footprint visibility, etc.) plus `GameEvents` / `GameCommands` / `GameWorld` type aliases.

        Systems tier (`bridge/systems/*` — 18 ECS factories):
        - `aiSystem.ts`, `autoAggressionSystem.ts`, `playerCommandsSystem.ts`, `monkBehaviorSystem.ts`, `productionQueueSystem.ts`, `scoutMovementSystem.ts`, `villagerEconomySystem.ts`, `wildlifeCombatSystem.ts`, `herdableMovementSystem.ts`, `herdableOwnershipSystem.ts`, `visibilitySystem.ts`, `fogMemorySystem.ts`, `towerCombatSystem.ts`, `relicGoldSystem.ts`, `wonderCountdownSystem.ts`, `relicCountdownSystem.ts`, `winConditionResolverSystem.ts`, `conquestOutcomeSystem.ts`. Each factory takes a typed deps interface and registers exactly one `world.registerSystem({...})`. Execution order is driven by explicit `before`/`after` deps, not registration sequence.

        Helper-ops tier (factories used by either systems or the input surface):
        - `playerQueries.ts`, `aiDecisionOps.ts`, `targetFindingOps.ts`, `selectionFinders.ts` — read-side queries.
        - `entityCreateOps.ts`, `entityDestroyOps.ts`, `transformOps.ts`, `movementPlanOps.ts`, `placementOps.ts`, `trainingMarketOps.ts` — write-side entity/state mutators.
        - `humanInputOps.ts`, `selectionInputOps.ts`, `selectionStateOps.ts`, `unitCommandOps.ts`, `unitSelectionOps.ts`, `sheepCommandOps.ts` — command and selection surface.
        - `monkTaskOps.ts`, `monkAiSearchHelpers.ts`, `monkTaskAppliers.ts`, `technologyOps.ts`, `matchEndOps.ts`, `trebuchetState.ts` — system-specific helpers. `monkTaskOps.ts` exposes both the legacy direct AI task assignment helper and the AI-decision intention producer; `aiSystem` uses the intention path so pickup/deposit/heal task creation goes through `monk.contextAtEntity` on the next tick. The actual task state is accessor-backed through `aoe2.monkTasks`, preserving snapshot/replay visibility.
        - `cellPassability.ts`, `visibilityQueries.ts`, `visibility.ts`, `fogMemoryOps.ts` — terrain/visibility queries.
        - `optionsRules.ts` — train/research/market/build option lookup.
        - `renderStateOps.ts`, `debugSnapshotOps.ts`, `economyStateOps.ts`, `saveGameOps.ts` — read-side projections to the HUD/test surface.

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
  - `phaser/` — Phaser-specific scenes and render projection. Hosts `scenes/GameScene.ts` (scene class wiring lifecycle, input, and projection-driven render orchestration) plus a `scenes/gameScene/` subdirectory for the dep-bag renderer factories factored out of the scene file: `debugOverlay.ts` (world-space debug-mode overlays), `worldLayers.ts` (health-bar + fog-of-war paints), `selectionLayers.ts` (selection ring + placement preview + marquee paints), `cameraController.ts` (per-frame update, middle-drag pan, edge-pan, zoom/scroll clamp, HUD-facing camera queries), and `buildingRenderer.ts` (the per-building rendering primitives — anchor sprite, footprint outline, construction overlay).
  - `ui/` — DOM HUD controller
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
