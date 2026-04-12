# civ-engine Feedback

## Current verdict

`civ-engine` is viable as the authoritative simulation core for this project's first RTS slice.

The bootstrap implemented in this repo now uses:

- `World` for deterministic fixed-step simulation
- component registration and query-based systems for terrain, units, buildings, and movement
- `createTileGrid`, `createNoise2D`, and `octaveNoise2D` for prototype map seeding
- `VisibilityMap` for per-player visible and explored state
- `RenderAdapter` to project simulation state into a renderer-facing store
- `WorldDebugger` to expose tick metrics to the HUD

That is enough to prove the basic architecture boundary the implementation plan called for: Phaser is rendering and camera/input only, while `civ-engine` owns the world state and tick progression.

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
- The engine exposes useful low-level primitives, but higher-level RTS helpers are still this repo's job:
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

## Implications for next phases

- Keep all game rules inside the simulation bridge or deeper; do not move gameplay state into Phaser scenes.
- Expand the content pipeline before widening gameplay breadth. The engine boundary is good enough to support that work.
- Add debug overlays early. `WorldDebugger` already makes this cheaper.
- When selection, fog, or occupancy bugs become less obvious than this slice, add a `WorldDebugger` probe instead of more ad hoc scene logging.
- Evaluate `civ-engine` pathfinding and occupancy primitives as soon as villagers and military movement become command-driven instead of scripted.
- Keep expanding deterministic simulation tests alongside each slice. The current economy loop is simple, but the pattern of external stockpile state plus world-owned entities is holding up well.
- Start moving placement, footprint selection, and movement-heavy queries onto occupancy/path primitives before Castle Age-scale interactions make the current scan-heavy approach too brittle.

## Current recommendation

Continue with the planned Feudal and Castle Age work on top of `civ-engine`.

There is no evidence yet that the engine is the blocker. The next real proof points are:

- broader building roster and drop-off rules
- military command and combat-state fan-out
- AI combat command fan-out and building-target combat
- building-target combat and defeat conditions
- stable test-fixture seams that respect `EntityRef` semantics instead of assuming durable numeric IDs
- fog-memory rules
- save and load round-tripping
