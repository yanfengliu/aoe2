# civ-engine Feedback (Past)

This file archives the historical observations that used to live in
`docs/engine-feedback.md`. The live summary now lives in [current.md](./current.md).

## Historical verdict

`civ-engine` is viable as the authoritative simulation core for this project's first RTS slice.

The bootstrap implemented in this repo now uses:

- `World` for deterministic fixed-step simulation
- component registration and query-based systems for terrain, units, buildings, and movement
- `createTileGrid`, `createNoise2D`, and `octaveNoise2D` for prototype map seeding
- `VisibilityMap` for per-player visible and explored state
- `RenderAdapter` to project simulation state into a renderer-facing store
- `WorldDebugger` to expose tick metrics to the HUD

That was enough to prove the basic architecture boundary the implementation plan
called for: Phaser is rendering and camera/input only, while `civ-engine` owns the
world state and tick progression.

## Strengths observed

- The fixed-tick `World` model fits AoE-style simulation better than a scene-owned game loop.
- The component and query API is simple enough to stand up RTS entities quickly.
- `RenderAdapter` gives a clean projection boundary. The game can keep Phaser-specific view logic out of the simulation.
- `VisibilityMap` plugged into the same render frame cleanly; fog and minimap logic did not need to leak into Phaser scene state.
- Simulation-side closed-over state for stockpiles and drop-off logic works fine with `World` systems. Not every RTS rule needs to be a first-class engine primitive to remain deterministic and testable.
- That same pattern also worked for the first commandable slice: production queues, construction progress, and selected-unit commands can remain simulation-owned without moving state into Phaser.
- Context-sensitive right-click orders also fit that model well. The bridge can resolve "move vs gather" entirely inside the simulation boundary while Phaser stays input-only.
- Resource-specific drop-off routing also stayed manageable in repo code. Querying the world for the nearest completed valid building was easy to express and easy to test.
- Reusing the same queue system for Town Center and Barracks worked cleanly. The engine's ECS model is flexible enough that new producers do not require a new framework pattern each time.
- The first combat slice also fit the same pattern cleanly. Repo-owned combat state plus `world.destroyEntity()` were enough to implement melee attack, death cleanup, and visibility updates without pushing combat ownership into Phaser.
- A minimal AI rush also fit inside ordinary world systems. Build-order policy, queue pressure, and attack-target bias can live in repo code without demanding a special engine-side AI framework too early.
- `WorldDebugger` is immediately useful for HUD metrics and future debug overlays.
- The `civ-engine` debugging guide is pragmatic. `WorldDebugger` probes give the repo a clean way to expose selection, visibility, or occupancy state for AI/test diagnosis without leaking debug-only state into gameplay components or Phaser scene code.
- The built-in grid and noise helpers were enough to get a deterministic prototype map online without extra infrastructure.
- `EntityRef` solves a real RTS integration problem. Long-lived selection state, queued attack/build targets, and browser test harnesses all become safer once they stop assuming entity IDs stay stable across destruction and reuse.

## Friction observed

- There is no out-of-the-box Phaser renderer adapter, so the repo needs to own that bridge layer.
- `RenderAdapter` streams the initial snapshot on `connect()` and then tick diffs. In the current same-process bridge, command handlers that mutate the world outside `world.step()` need an explicit snapshot resync or new visuals like fresh construction sites never reach the renderer. The engine contract is defensible, but the integration rule is easy to miss.
- Herdable ownership hit the same seam from inside `world.step()`: when repo code mutates a projected component like resource ownership/tint in place, the renderer stays correct only if that mutation is treated as render-affecting state and explicitly surfaced. A lighter engine-level helper for render-relevant component mutation or a dedicated projector/debug probe for those changes would make this class of bug cheaper to catch.
- The engine exposes useful low-level primitives, but higher-level RTS helpers are still this repo's job.
  - production queues
  - context-sensitive command resolution
  - resource-to-drop-off capability rules
  - producer-to-trainable-unit capability rules
  - command buffering
  - unit selection and command fan-out
  - formation and group movement behavior
  - pathfinding integration for moving unit groups around dynamic blockers
- Building footprints, placement validation, and construction progress are currently repo-level policy layered on raw ECS state rather than engine helpers.
- Fog memory for static enemy buildings/resources is still a game-level policy on top of the visibility primitive. The engine gives the visibility substrate, not the remembered-state rules.
- Renderer-side coordinate projection is also repo-owned. Browser automation and map-click input needed explicit Phaser `worldView` handling to keep world-to-canvas translation correct.
- Combat still needs repo-owned policy around target acquisition, cooldown state, and death-side cleanup across population, selection, and queued commands. The engine gives reliable entity cleanup primitives, but the RTS-specific consequences remain game code.
- AI planning likewise needs repo-owned policy for build orders, pop-cap handling, and target bias. The engine gives the deterministic substrate, but the RTS decision layer is still entirely application code.
- Build packaging still needs repo-level policy. The current warning-free Vite build is achieved by explicit vendor chunking and a chunk-size limit that acknowledges the real Phaser payload size.
- Once villagers become commandable instead of scripted, path quality and occupancy will matter more than they do in the current one-tile-per-tick prototype movement.
- The current production bundle is large because the runtime is still a single Phaser chunk. This is not a `civ-engine` problem, but it is part of the real integration cost.
- External test fixtures and UI automation cannot safely treat `EntityId` as durable identity. The engine is right to recycle IDs; the repo has to own either semantic selectors or explicit `EntityRef` handling at those boundaries.
- The Feudal slice showed that research queues fit naturally into the same repo-owned systems as unit production. The engine does not need a separate tech primitive for the game to stay deterministic and testable.
- Semantic browser selectors are still repo-owned. When Villagers or builder-occupied footprints move between frames, stable automation requires page-local helpers that resolve against the current sim snapshot instead of cached screen coordinates.
- Placement and footprint checks are still hand-rolled query scans. That is workable at prototype scale, but the engine's `OccupancyGrid` and RTS path helpers should replace more of this logic before the entity count grows.
- Technology-driven stat mutation is still repo policy. Applying a tech like `Fletching` to both existing and future Archers was straightforward, but the engine currently leaves that sort of player-wide modifier propagation entirely to game code.
- Producer capability remains repo policy too. Adding `Stable` plus `Scout Cavalry` was easy within the current ECS model, but the engine still leaves producer-to-unit menus and producer queue policy to game code across several switch-based call sites.
- Counter-damage rules are also repo policy. The new `Spearman` anti-scout bonus fits cleanly into the current sim loop, but attack bonuses by attacker/target class still need to be modeled explicitly in game code rather than declared through an engine-level combat rules layer.
- Shared producer-menu helpers are worth keeping. Once `Barracks` and `Archery Range` both had age-gated second units, pulling train-menu logic into one repo-owned helper cut down on drift between HUD rendering and queue validation.
- Static-defense behavior also sits comfortably in repo code. `Watch Tower` auto-fire worked once building-owned combat state, sight radius, and targeting rules were modeled locally, which suggests the engine does not need a dedicated "tower" primitive but still leaves all defensive-structure policy in the game layer.
- Generic rally points were similarly straightforward as repo policy. Producer-owned rally positions plus spawn-time move commands work cleanly, but the engine leaves producer command memory and any future formation/spawn-deconfliction behavior to the game layer.
- Match-global Market exchange rates also fit cleanly as repo-owned state. The engine does not need a special economy-trading primitive for buy/sell actions, but commodity pricing rules, fees, and future market technologies remain application policy.
- Garrisoning also fit well with the current engine surface by removing and restoring `position`/`visionSource` locally. That is a pragmatic approach for prototype-scale defensive structures, but richer transport, packed units, or building-arrow integration will still need clearer repo-level policy on hidden-but-alive entities.
- Extending the existing building-combat loop to Town Centers was low-friction once garrison state existed. The engine does not need a bespoke "defensive arrow" primitive for this scale, but richer projectile rules, multiple targets, and true arrow-count formulas will still live in repo combat policy.
- Castle Age plus `Knight` also fit the current repo-owned queue model cleanly. Reusing the Town Center research queue and Stable producer menu was straightforward, which is a good sign that age progression and unit-roster growth do not require new engine primitives each time.
- Additional Town Centers also fit the existing build-and-produce seams cleanly. Reusing Villager placement, construction completion, and the Town Center production queue was straightforward even though the original prototype only had one Town Center per owner.
- Multi-unit box selection fit the current engine boundary well. Querying owned units by world position and issuing one fan-out move/context command stayed simulation-owned, which is a good sign for future control groups and formation work.
- Same-type screen selection fit that boundary too. The native double-click gesture belongs in Phaser, but keeping the actual "select owned units of this type inside the viewport" rule in simulation code made the behavior deterministic and easy to cover in both unit and browser tests.
- Selection HUD embellishments also stay cleanly outside the engine boundary. Unit icons and grouped counts can be derived from selection IDs plus the current economy snapshot without pushing any UI-specific metadata into `civ-engine`.
- Placement-preview validity also fit that boundary well. A small simulation-owned helper can answer "would this building fit here?" once, and the Phaser scene can reuse that answer for green/red ghost feedback without duplicating footprint logic.
- For placement UX specifically, a tiny render-state seam in the scene was worth it. The sim-owned `getPlacementPreview()` answers legality, while a scene-owned `getPlacementPreviewVisualState()` makes browser tests verify that the overlay is actually drawn strongly enough to be useful, instead of only asserting backend legality.
- Age-prerequisite logic is still repo policy spread across helper functions and switch sites. Adding `Castle Age` was manageable, but later Castle/Imperial unlock breadth will keep increasing the payoff of moving more producer and prerequisite rules into normalized content instead of code.
- Some helper state still assumes one "primary" Town Center per owner. The current `townCenterRefs` usage is good enough for this slice, but deeper AI, economy, and fallback targeting will need to reason over multiple completed Town Centers instead of one cached reference.
- Marquee UX is still entirely repo-owned. `civ-engine` makes the unit-selection rule easy to express, but the Phaser bridge still has to own drag thresholds, screen-to-world rectangle projection, and mixed-selection HUD policy.
- Tile-inspection UX is also repo-owned. The engine correctly preserves entity identity through `EntityRef`, but stacked-tile cycling, resource inspection text, and any future selection-stack overlay still have to live in game/UI code rather than the engine.
- The `civ-engine` debugging guide was useful for this slice because it reinforced checking world state and render snapshots directly instead of guessing in Phaser. The remaining friction is repo integration: the game still lacks a lightweight live debug probe for ownership-specific roam state and footprint occupancy, so those invariants were easier to lock down in tests than inspect interactively.
- Construction-vs-completion art state is also cleanly repo-owned. The engine only needs to expose semantic `visualVariant` and footprint data; the actual foundation scaffolding, finished-building silhouette, and browser-verifiable scene state belong in the renderer layer.
- Sub-grid movement also exposed a real integration tax: once units can live between coarse cells visually, repo code has to be explicit about which systems read coarse `position` and which read fine transform state. Selection, attack range, occupancy, and fixture timing stay stable only if those boundaries are deliberate and tested.
- Combat health bars reinforced the same rule. When health lives in repo-owned side maps instead of world components, the projector can still expose it cleanly, but the render path needs an explicit sync rule for those updates; the debugging guide's focus on render snapshots/diffs made that easier to diagnose.
- The sub-grid movement guide mapped cleanly onto the current boundary. Keeping coarse `position` authoritative for visibility, occupancy, and command semantics while adding a repo-owned `unitTransform` for fine unit motion let the game gain smoother movement without pushing renderer concerns back into `civ-engine`.
- HUD interaction bugs can sit entirely outside the engine boundary. The new minimap click-to-pan slice was blocked by DOM `pointer-events` on the HUD overlay even though the camera math and bridge contract were already correct, which is a useful reminder to check the DOM-overlay event contract before suspecting `civ-engine` or Phaser camera state.
- The debugging guide's `RenderAdapter` and debug-client framing also helped on the mouse-pan slice: once edge-hover pan existed, broad Playwright pointer scripts started coupling unrelated gameplay tests to camera motion. The stable pattern was to keep a few explicit DOM-input tests for camera/selection UX, but route the rest of the browser gameplay assertions through the repo-owned browser seam that reads projected state directly.
- Stricter blocker-aware pathing exposed a fixture-validation gap more than an engine bug. `civ-engine` was right to reject blocked starts/goals and path through occupancy honestly, but the repo had several old fixtures with units spawned inside building footprints or tests that depended on random-map passability. A lightweight engine-side scenario validator or occupancy probe would make that class of integration mistake cheaper to catch.
- Water-adjacent resource access is still repo policy. Adding shoreline fish worked cleanly with the engine's terrain and resource primitives, but deciding whether a water resource can actually be gathered from nearby land tiles remains game-level logic layered on top of `civ-engine` rather than an engine-level affordance.
- Exact-entity commands became necessary once units had sub-grid motion and tiles could stack resources, units, and buildings. `civ-engine` gives the right low-level pieces, but the repo still has to bridge projected render geometry back into semantic entity targeting; without that seam, cell-based right-click resolution is too coarse for reliable attack and gather UX.
- The sub-grid movement guide was directionally correct, but this slice showed an easy integration trap: repo systems must not eagerly snap fine transform state back to coarse `position` each tick or the renderer loses the smooth movement benefit even though the simulation is otherwise valid. A small engine-level debug probe for coarse vs fine position would make that class of mistake much faster to spot.
- Smooth sub-grid visuals also need a repo-owned hit-tolerance policy. Once units move between coarse cells, exact render-geometry clicks are brittle for live targeting even when the simulation is correct; the renderer/input seam needs a small amount of pointer forgiveness to match what the player perceives on screen.
- Safe unit spawning is still repo-owned RTS policy. `civ-engine` path/passability primitives were enough to fix trapped Scouts, blocked Stable queues, and partial ungarrison behavior, but the engine does not yet offer a higher-level "find nearest legal spawn with egress" helper for producer or scenario spawns.
- Smaller-than-cell unit occupancy is also still repo-owned policy. The engine's grid/path helpers still think in whole integer cells, so letting multiple units share one coarse cell required repo-managed per-unit sub-cell slots plus movement rules that stop treating units as hard blockers; there is still no engine-native sub-cell occupancy or crowding model.
- `civ-engine` 0.3.0 materially improves the bridge ergonomics where it is fully available: typed component registries make the owned world and helper functions clearer, and `before`/`after` system ordering finally lets same-tick rules like movement -> herdable ownership -> visibility be declared instead of implied by registration order.
- The file-linked package workflow has one sharp edge: `aoe2` consumes `civ-engine` through its built `dist` entrypoint, so docs/source can expose new 0.3.0 APIs before the linked package's JS and `.d.ts` are rebuilt. The symptom was "documented API exists in source but not at runtime/typecheck" until `npm run build` was rerun in the linked engine package.
- The debugging guide was useful again on the selection-panel slice because it made it easy to confirm the projected selection state was correct before touching UI code. The remaining flaky part was not world state but browser interaction semantics, which still need a repo-owned seam on top of `civ-engine` for exact selection and click-flow tests.
- The sub-grid movement guide was the right architectural boundary for smoother motion. Keeping `civ-engine` authoritative on coarse simulation cells while interpolating unit positions in Phaser delivered the visual result without destabilizing pathing, occupancy, or save-state semantics. The remaining engine gap is that interpolation-aware hit testing is still repo-owned glue, not a shared engine helper.
- Resource depletion cleanup is still repo policy layered on top of `world.destroyEntity()`. The engine-side primitive is correct and low-friction, but deciding when a spent tree or fish node should disappear from economy state, selection, and render projections remains a game rule that needs explicit deterministic tests.
- Wildlife layered onto resource entities is workable, but it exposes a seam: boar/wolf now need repo-owned combat/health state, auto-aggro policy, and selection projection even though they still live in the `resource` query space for harvesting and map generation. `queryInRadius` made wolf aggro straightforward in 0.3.0, but a future engine-level pattern for "non-building map entities that can be both resources and combatants" would reduce game-side branching.
- The larger default map made a real performance point visible: several repo-owned progression/build tests slowed down enough that older per-test timeout budgets became stale even though gameplay stayed correct. The engine core is still fine here; the pressure is mostly from repo-side scan-heavy helpers and long fixed-step advancement loops that scale with larger maps and longer travel distances.

## Implications for next phases

- Keep all game rules inside the simulation bridge or deeper; do not move gameplay state into Phaser scenes.
- Expand the content pipeline before widening gameplay breadth. The engine boundary is good enough to support that work.
- Add debug overlays early. `WorldDebugger` already makes this cheaper.
- When selection, fog, or occupancy bugs become less obvious than this slice, add a `WorldDebugger` probe instead of more ad hoc scene logging.
- Evaluate `civ-engine` pathfinding and occupancy primitives as soon as villagers and military movement become command-driven instead of scripted.
- Keep expanding deterministic simulation tests alongside each slice. The current economy loop is simple, but the pattern of external stockpile state plus world-owned entities is holding up well.
- Start moving placement, footprint selection, and movement-heavy queries onto occupancy/path primitives before Castle Age-scale interactions make the current scan-heavy approach too brittle.
- Add a lightweight debug probe for coarse-vs-fine unit position if sub-grid transforms remain part of the runtime; that will make future movement and selection bugs much easier to inspect live.
- Add a cheap fixture-validation pass around occupancy and start-cell legality before using scenarios in tests. The current blocker rules are good; the missing piece was faster detection of invalid test setups.
- Rebuild the linked `civ-engine` package immediately after engine upgrades before debugging game-side type/runtime failures. Without that step, bridge work can end up diagnosing stale dist artifacts instead of real gameplay bugs.

## Historical recommendation

Continue with the planned Feudal and Castle Age work on top of `civ-engine`.

At that point there was no evidence yet that the engine was the blocker. The next
real proof points were:

- broader building roster and drop-off rules
- military command and combat-state fan-out
- AI combat command fan-out and building-target combat
- building-target combat and defeat conditions
- stable test-fixture seams that respect `EntityRef` semantics instead of assuming durable numeric IDs
- fog-memory rules
- save and load round-tripping

## 2026-04-12 - Locked command visibility

- The Town Center age-up bug was not an engine limitation. The missing piece was a repo-owned UI contract that distinguishes `visible commands` from `currently queueable commands`. Once that split existed, the bridge could expose locked-but-relevant research actions cleanly without changing `civ-engine` behavior.
- This is a good reminder to keep command discoverability concerns above the engine boundary. `civ-engine` correctly owns world state and system execution; player HUD affordances such as disabled-but-visible buttons should stay in the game layer.

## 2026-04-12 - Larger default world and test seams

- Enlarging the default map for minimap usability immediately increased the cost of any test that advances the live simulation on the default seed. The engine handled the bigger world correctly, but the repo-owned test layout needed to change: long browser and Vitest files had to be split into smaller suites with realistic time budgets.
- The useful takeaway is that `civ-engine` scales adequately for this prototype, but the repo should avoid coupling too many long-running gameplay flows to one seed/file. Deterministic fixture slicing matters more as map size grows.

## 2026-04-13 - Phaser rendered camera view

- For HUD-facing viewport work, Phaser's rendered `camera.worldView` is the safer source of truth than reconstructing the visible world from `scrollX`, `scrollY`, `width`, and `zoom`. The approximation is close, but it can drift enough to make an overlay like the minimap viewport box disagree with what the player actually sees.
- Browser helpers that synthesize minimap clicks also need to use the same canvas draw-area math as the HUD itself. Using outer element bounds alone was close, but not exact enough for deterministic viewport-target assertions.

## 2026-04-18 - Slice 2-11 observations

- Castle-Age in-place unit upgrades (Crossbowman, Pikeman, Light Cavalry) landed entirely as repo-owned policy without pushing new engine primitives. `applyTechnology` mutates live unit components (`unit.unitType`, `renderable`, `combatStates`) while preserving `EntityId`; the engine's component-mutation semantics + `EntityRef` stability were enough to make selection, order queues, and combat all survive an upgrade cleanly. An engine-level "unit-line upgrade" helper would be overkill for this scale.
- Imperial-Age upgrades reused the same pattern for 10 unit-line upgrades. The repo owns `rewriteQueuedPredecessorUnits` to rewrite in-flight train entries so a queue ahead of the research finish still yields upgraded units. This kind of cross-queue mutation is clearly game policy, not engine concern.
- Civ-gating (Britons Longbowman) confirmed that `getPlayerCivilization` + switch-based train menu filters stay cheap at the current civ breadth. A normalized "producer unit table gated on (age, civ, tech)" would start paying off if civs branch further — flag for future.
- Monastery heal / convert / relic mechanics fit the engine boundary fine. Per-tick counters and `monkTasks` live in repo side maps keyed by `EntityId`; `monkCarriedRelic` is a plain `Map<number, number>`. Save/load serializes all of this through the side-map boundary with no engine hooks.
- Wonder / Relic / Score win conditions added postUpdate systems (`prototypeWonderCountdown`, `prototypeRelicCountdown`) and per-owner `playerScoreCounters`. Clean repo work; the engine's system-ordering contract made the countdown systems trivial to express.
- Save / load (Slice 9) exercised `World.serialize()` + `VisibilityMap.getState()` round-tripping. Byte-for-byte deterministic replay after 100 ticks past restore proved the engine's serialization contract is correct. Generation-preserving `getEntityRef` means every stored ref rehydrates (or returns null if recycled), exactly what the repo needed.
- AI baseline (Slice 10) could read production queues, research queues, and countdown state from canonical side maps without any new engine affordance. The AI planner is one more postUpdate system over the same shared world query surface.
- Black Forest + Arena maps (Slice 11) reused the base scenario generator with different terrain paint. The engine's `createTileGrid` + `createNoise2D` + `octaveNoise2D` were enough; no new engine primitives required.
- HUD tooltips + toast + debug overlay (Slice 11) stayed strictly DOM/HUD-side; the simulation exposed a `SimulationDebugSnapshot` per tick and the HUD / scene consumed it. The existing `WorldDebugger` surface is still the right pattern for this kind of diagnostic hook.
- Addressed in repo (Slice 12): safe unit spawn with egress is now the shared `findSafeSpawnWithEgress` helper in `src/game/simulation/spawn.ts`. Scenario-spawn, producer-spawn, and ungarrison paths share one definition. An engine-level version of this would still be welcome (any RTS-shaped consumer needs it), but the game-side pattern is clean.
- Addressed in repo (Slice 12): fixture-validation pass at bridge construction. `createSimulationBridge` now rejects scenarios whose spawns extend past map bounds, overlap a building footprint, or wedge a unit inside a building. Each error identifies the offending seed + spawn. This catches the "blocked start, opaque downstream crash" class the Feudal/Castle slices surfaced.
- Addressed in repo (Slice 12): coarse-vs-fine debug probe. `F2 -> coarse-vs-fine` renders one line per unit from its coarse simulation cell center to the interpolated fine render position so the "unit at coarse A but rendering at B" class of bugs is visible live. The repo-side probe is cheap (one `getDebugSnapshot` read per frame when active); a shared engine probe would still be welcome for any consumer that adds fine transforms.
- OccupancyGrid migration attempted then descoped (Slice 12): `civ-engine`'s `OccupancyGrid` requires an externally-managed block/unblock/occupy/release lifecycle synchronized with every building creation, construction completion, and destruction. The current `isCellBlockedByBuilding` / `isCellOccupiedByUnit` scans are small and obvious; migrating would increase surface area (lifecycle bookkeeping) without shrinking the placement helpers below their current size. Revisit when `civ-engine` exposes a higher-level "register buildings, query automatically" binding, or when entity counts start making the scan cost measurable.

## 2026-04-18 - Sub-cell crowding / smaller-than-cell occupancy (suggested future feature)

- Repo has fully implemented sub-cell unit slots (`UNIT_CELL_SLOT_OFFSETS`) and sub-grid movement via a `unitTransform` component layered on top of coarse `position`. Multiple friendly units share one coarse cell via four quarter-cell slots with fractional render offsets; other units no longer count as hard blockers for pathing.
- This exposed the clearest engine next-step request: a sub-cell occupancy / crowding primitive. The coarse-cell `OccupancyGrid` treats cells as binary blocked / free; an RTS needs a cheap "can this sub-cell slot accept another unit" or "pack N units into this cell" query.
- Desired shape: `OccupancyGrid` (or a sibling `SubcellOccupancyGrid`) that takes a per-cell capacity plus per-unit footprint and answers `canOccupy`, `bestSlotForUnit`, and `neighborsWithSpace` without the game having to manage a parallel slot-assignment map.
- Until then, the repo-side pattern in `createSimulationBridge.ts` (quarter-cell slots, fractional render offsets, no-hard-blocker rule during pathing) is stable and serializes cleanly across save/load.

## 2026-04-18 - Slice 12 close

- `civ-engine` has held up through all 12 slices. The only unambiguous engine-shaped ask is sub-cell crowding (above). Everything else — upgrades, age gating, combat bonuses, conversion, relics, win conditions, save/load, AI, debug overlays — fit behind the existing bridge boundary with no engine modification.
- At the time of the Slice 12 close, the single-file engine feedback doc was long but still useful. Splitting current versus past notes would eventually make the live guidance easier to scan.

## 2026-04-20 - Occupancy binding and metrics landed

- The occupancy/crowding follow-up ask from FU8 is now resolved in `civ-engine`.
  `OccupancyBinding` owns blocker metadata, whole-cell occupancy, optional
  sub-cell crowding, and destroy-time cleanup through `world.onDestroy()`.
- That closes the earlier concern that sub-cell crowding would keep leaking more
  policy into the bridge. The engine now exposes the distinction the repo
  actually needs: `building` vs `resource` vs `unit` through
  `getCellStatus().blockedBy`.
- The engine also now exposes measurable occupancy scan counters
  (`OccupancyGrid.getMetrics()`, `SubcellOccupancyGrid.getMetrics()`) and the
  built-in RTS benchmark reports an occupancy workload with hundreds of
  buildings and thousands of units. The old "revisit when occupancy scan costs
  become measurable" condition has been satisfied and archived.

## 2026-06-13/14 — Typed recording/replay generics (resolved in 1.2.0, adopted in aoe2)

Resolved and adopted; archived from current.md.

- **Ask (surfaced 2026-06-10 by v0.8.15).** `SessionRecorder` / `SessionReplayer` hardcoded `World<TEventMap, TCommandMap>` with default `TComponents = Record<string, unknown>`. Before v0.8.15 a component-typed world (`World<E, C, GameComponents>`) was still assignable into those signatures; the 0.8.15 layer-chain split surfaced `TComponents`-dependent declarations (e.g. `validators`, `transaction().require`) in protected position, making the parameter effectively invariant (96 type errors in aoe2). aoe2 absorbed it with a sanctioned cast seam (`toEngineWorld`/`fromEngineWorld` in `pureHelpers.ts`) that erased component-type safety at the recorder/replayer boundary. The ask was to thread `TComponents`/`TState` through `SessionRecorder`, `SessionReplayer`, `worldFactory`, and `openAt`, defaulted for back-compat.
- **Resolved in engine 1.2.0 (2026-06-13).** `SessionRecorder` / `SessionReplayer` (and `SessionRecorderConfig` / `ReplayerConfig`, plus `AgentDriverContext` / `AgentDriver`) now thread `TComponents` / `TState` (mirroring `World`, appended after the existing params, defaulted — strictly non-breaking; threading sidesteps the invariance by inference, World's layer chain untouched). `new SessionRecorder({ world })` takes a `World<GameEvents, GameCommands, GameComponents>` with no cast, and `replayer.openAt(t)` returns it typed (`getComponent(id, 'position')` is `Position`, not `unknown`). Full inference is required (an explicit `<E, C>` defaults `TComponents` back to erased). `toBundle()` stayed default-generic by design (a typed return would break consumers holding a default-generic `SessionBundle` slot — e.g. `runPlaytest.ts`), so component types are reasserted via `worldFactory`'s return on replay, not via the bundle.
- **Adopted in aoe2 (2026-06-14, thread `typed-recording-seam`).** `fromEngineWorld` deleted; the recorder/replayer paths (`runPlaytest`, `ReplayController`, the replay test fixtures, `replay-inspect.mjs`) pass `GameWorld` through by inference, and `ReplayController`'s `ReplayReplayer` alias pins `GameComponents` (recovering the unexported `TDebug = JsonValue` via `infer` from the bundle type) so `replayer.openAt(t)` returns a registry-typed `GameWorld`. `toEngineWorld` retained ONLY for the `WorldDebugger` / `RenderAdapter` boundary — 1.2.0 did NOT thread those classes (they still take `World<TEventMap, TCommandMap>`), and `World`'s `TComponents` remains invariant, so a `GameWorld` is not assignable there; the cast is structurally required and is the lone surviving seam.

## 2026-06-30 — "Sim-throughput regression 0.8.24→1.0.1" (investigated, NOT-A-REGRESSION)

Archived from current.md. The original claim + the resolution.

- **Original claim (surfaced 2026-06-12 by the 1.0 absorb).** Same machine, same suite, engine 0.8.23 → 1.0.1: `createSimulationBridge.ageUp` 136s → 209s (+53%), `castleUpgrades` 155s → 248s (+60%), `blacksmithProgression` 171s → 284s (+66%), `aiPlayer` 271s → 473s (+75%) under full-suite load; aoe2's whole-suite cumulative test time went 2056s → 3330s. An A/B with `strict: false` measured only ~4% (150.4s vs 156.6s on ageUp isolated), so it was assumed the regression lived elsewhere in 0.8.24/0.8.25/1.0.0/1.0.1's hot path; aoe2 absorbed it by doubling per-test timeout caps in 9 fixture files (`x2 2026-06-12`) and the engine was asked to profile a long mixed-load scenario against v0.8.23 and bisect.
- **Resolution (2026-06-30) — NOT a civ-engine regression.** Full write-up in aoe2 `docs/debugging/2026-06-30-engine-throughput-regression.md`. Static diff audit: `git log a53efc2..8a10966 -- src/world-tick.ts src/world-queries.ts src/component-store.ts src/entity-manager.ts src/world-systems.ts src/query-cache.ts` is EMPTY — the per-tick hot path is byte-identical across the whole window. The only per-tick change is v1.0.0 flipping strict-mode ON by default (`world-core.ts`: `config.strict === true` → `!== false`); `world.ts` changes in the window are serialize/deserialize/applySnapshot (not per-tick); v0.8.25's `player-observer.ts` change HOISTED `getRegistrationManifest()` out of a loop (an optimization). The strict guard (`assertWritable`) is O(1)/allocation-free (`if (!world.strict) return;` then three boolean reads). Direct A/B on the real `ageUp` fixture (aoe2 does not pass `strict`, so v1.0.0 flipped its worlds false→true): strict-on 42.71s vs strict-off 43.24s tests — within noise. Isolated single-thread, ageUp is ~43s/file (~7s/test); the +50-75% only appears under full-suite `threads`-pool CPU saturation. Conclusion: the observed slowdown was contention, not engine cost.
- **Actions.** (1) aoe2's `x2 2026-06-12` caps ratcheted back to data-driven values (uniform per file at ~3× the worst measured *contended* per-test time: 90s for ageUp/blacksmith, 45s for the mid-weight files, 30s for autoAggression) with corrected annotations pointing at the debugging doc; verified green under worst-case parallel contention. (2) civ-engine benchmark gate gained a `commands` scenario (strict world + per-tick validated commands + in-tick emitting handlers/systems + 14 systems over 60 ticks) so a genuine future per-tick regression in the aoe2 load profile is caught — the gate previously under-weighted it. No engine code fix (nothing regressed).

## Resolved items moved from current.md (2026-08-17 freshness audit)

- **✅ RESOLVED in engine 1.1.4 (2026-06-13).** Root cause: `endTick`/`durationTicks` were finalized only in `SessionRecorder.disconnect()`, but the harness exports via a live `toBundle()` (`getRecorderBundle()` / `RecordingService.bundle()`) that never disconnects — so they stayed at `startTick` while the sink kept `persistedEndTick` current. Engine fix (both the recording defect and the on-disk corpus): the sinks now advance `endTick`/`durationTicks` on every recorded tick (`writeTick` + `writeTickFailure`), and the reachable replay bound is `max(endTick, persistedEndTick)` for complete bundles across `openAt`/`tickEntriesBetween`/`snapshotAtTick`/`BundleViewer`/`materializedEndTick` (a no-op for clean bundles; recovers already-recorded ones). Since aoe2 links `civ-engine` by symlink, the rebuilt engine already replays the existing `campaign-*` bundles directly. **Follow-up aoe2 cleanup (now safe, separate change):** drop the `endTick`-repair hack in `scripts/replay-inspect.mjs`, and `replayTimelineUpperBound` in `src/game/replay/TimelinePanel.ts` can rely on a correct `endTick` for new captures (still repair on load for pre-1.1.4 bundles, or re-record them). Original report retained below.
- **Recorded `metadata.endTick` stays 0 for stepped/`advanceTicks`-driven runs, making bundles non-replayable past tick 0 (surfaced 2026-06-13, engine 1.1.3).** campaign-4's LLM-playtest bundle records `ticks` [1..9000], `executions` [1..8751], and `snapshots` [1000..9000] — the run is fully captured — yet `metadata.endTick: 0` / `durationTicks: 0` while `metadata.persistedEndTick: 9000` is correct. `SessionReplayer.openAt(tick)` clamps its upper bound to `endTick`, so it rejects every `tick > 0` ("tick N above upper bound 0"). This breaks the engine's own replay-debugging path for ALL LLM-playtest bundles (which advance the sim via the harness's atomic unpause→stepN→repause `advanceTicks`, not per-frame ticking) — and likely the aoe2 browser scrubber too, since `replayCanReachTick(persistedEndTick)` will fail even though `replayTimelineUpperBound` already prefers `persistedEndTick`. aoe2 workaround: repair `endTick` from `persistedEndTick` (or the max recorded tick) on bundle load (`scripts/replay-inspect.mjs` does this inline; the browser load path needs the same). Ask: either finalize `endTick` from the actual recorded tick range when the recording is closed, or have `openAt` honor `persistedEndTick` as the reachable bound. Without it, recorded runs can't be inspected via replay — the primary "what actually happened" debugging tool.
- **✅ RESOLVED / NOT-A-REGRESSION (2026-06-30).** The "0.8.24→1.0.1 sim-throughput regression (+50-75%)" was investigated end-to-end and found to be full-suite thread-pool CONTENTION, not a civ-engine hot-path regression. Evidence: every per-tick hot-path file (`world-tick`, `world-queries`, `component-store`, `entity-manager`, `world-systems`, `query-cache`) is byte-identical across the entire 0.8.23→1.0.2 window; the only per-tick change is v1.0.0's strict-by-default flip (`world-core.ts`: `config.strict === true` → `!== false`), and a direct A/B on the real `ageUp` fixture (isolated, single-thread) measured strict-on 42.71s vs strict-off 43.24s — within run-to-run noise. Isolated, `ageUp` is ~43s for the whole file (~7s/test) vs the doubled 40-180s caps; the +50-75% only appears when the CPU-heavy sim suite runs under the parallel `threads` pool. Actions taken: aoe2's `x2 2026-06-12` timeout caps ratcheted back to data-driven values (~3× the worst measured *contended* per-test time) with corrected annotations; a new `commands` (aoe2-shape: strict + per-tick commands + events + many systems) scenario was added to the civ-engine benchmark gate so a genuine future per-tick regression in that profile is caught. Full write-up: `docs/debugging/2026-06-30-engine-throughput-regression.md`. Detail archived in [past.md](./past.md).
