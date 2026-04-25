# Architecture

This document describes the structural boundaries of the project. Update it only for
structural changes (new modules, shifted boundaries, new build or data pipelines). Do
not update it for UI tweaks, bug fixes, refactors, or test-only work. When it does
change, also append a row to `drift-log.md` and mention the update in the devlog.

## Repository layout

- `src/` — game code (TypeScript)
  - `app/bootstrap/` — app startup, dev HTTP API used by browser tests
  - `game/` — gameplay rules, scenarios, content
    - `content/` — shared content tables (e.g., building footprints)
    - `simulation/` — simulation bridge, scenario setup, command handlers.
      Top-level siblings of `createSimulationBridge.ts` include
      `worldOccupancy.ts` (the `OccupancyBinding` adapter that keeps the
      authoritative blocker/crowding contract), `selectionActivity.ts`
      (structured activity payload for the HUD selection panel), and
      `renderStore.ts` (the per-tick render-message store the projector
      writes into).
      - `bridge/` — helper modules factored out of `createSimulationBridge.ts`
        to keep the entry file from drifting back into god-class shape.
        Each module either exports plain helpers or a dep-bag factory whose
        side-map ownership still lives in `createWorld` so save/load and
        destroy-entity hooks share the same references:
        - `pureHelpers.ts` — pure helpers (clamp, grid/coordinate
          transforms, economy/resource helpers, footprint and projection
          comparators) plus the shared `GameEvents` / `GameCommands` /
          `GameComponents` / `GameWorld` type aliases and the
          `UNIT_SUBGRID_*` / `UNIT_CELL_SLOT_OFFSETS` / `MARKET_BASE_RATE`
          constants.
        - `visibility.ts` — `createProjector` (RenderAdapter projection),
          `syncVisibilitySources`, and the sheep claim / ownership helpers
          plus `SHEEP_VISION_RADIUS` / `MAX_HERDABLE_CLAIM_RADIUS`.
        - `trebuchetState.ts` — `createTrebuchetStateOps` factory wrapping
          the Trebuchet pack/unpack transition over `trebuchetPackStates`.
        - `fogMemoryOps.ts` — `createFogMemoryOps` factory bundling
          `getOrCreateMemoryMap`, `getFogMemoryEntities`,
          `getHumanFogMemorySize`.
        - `monkTaskOps.ts` — `createMonkTaskOps` factory for the Monk
          heal / convert / pickup / deposit lifecycle, including AI-side
          task assignment and human-side context-click routing.
        - `technologyOps.ts` — technology / upgrade application (research
          completion, per-unit / per-building stat propagation, civ
          unique-tech handling).
        - `matchEndOps.ts` — match-end / score / win-condition resolution
          (conquest, Wonder, relic timers, score tally).
        - `aiDecisionOps.ts` — Slice-10 AI decision helpers (villager
          retargeting, attack-group forming, plan transitions).
        - `placementOps.ts` — placement preview + building placement
          confirmation (footprint validation, occupancy reservation).
        - `saveGameOps.ts` — `createSaveGameOps` factory: serializes the
          world snapshot, visibility, match state, and every side map into
          a `SaveBlob`.
        - `targetFindingOps.ts` — target-priority tables and helpers for
          finding visible enemies, nearest drop-offs, and nearest wildlife.
        `createSimulationBridge.ts` imports from `bridge/` rather than
        re-declaring any of this.
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
  - `phaser/` — Phaser-specific scenes and render projection. Hosts
    `scenes/GameScene.ts` (scene class wiring lifecycle, input, and
    projection-driven render orchestration) plus a `scenes/gameScene/`
    subdirectory for the dep-bag renderer factories factored out of the
    scene file: `debugOverlay.ts` (world-space debug-mode overlays),
    `worldLayers.ts` (health-bar + fog-of-war paints), `selectionLayers.ts`
    (selection ring + placement preview + marquee paints), and
    `cameraController.ts` (per-frame update, middle-drag pan, edge-pan,
    zoom/scroll clamp, HUD-facing camera queries).
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
