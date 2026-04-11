# civ-engine Feedback

## Current verdict

`civ-engine` is viable as the authoritative simulation core for this project's first RTS slice.

The bootstrap implemented in this repo now uses:

- `World` for deterministic fixed-step simulation
- component registration and query-based systems for terrain, units, buildings, and movement
- `createTileGrid`, `createNoise2D`, and `octaveNoise2D` for prototype map seeding
- `RenderAdapter` to project simulation state into a renderer-facing store
- `WorldDebugger` to expose tick metrics to the HUD

That is enough to prove the basic architecture boundary the implementation plan called for: Phaser is rendering and camera/input only, while `civ-engine` owns the world state and tick progression.

## Strengths observed

- The fixed-tick `World` model fits AoE-style simulation better than a scene-owned game loop.
- The component and query API is simple enough to stand up RTS entities quickly.
- `RenderAdapter` gives a clean projection boundary. The game can keep Phaser-specific view logic out of the simulation.
- `WorldDebugger` is immediately useful for HUD metrics and future debug overlays.
- The built-in grid and noise helpers were enough to get a deterministic prototype map online without extra infrastructure.

## Friction observed

- There is no out-of-the-box Phaser renderer adapter, so the repo needs to own that bridge layer.
- The engine exposes useful low-level primitives, but higher-level RTS helpers are still this repo's job:
  - production queues
  - command buffering
  - unit selection and command fan-out
  - formation and group movement behavior
  - fog of war and per-player visibility plumbing
  - pathfinding integration for moving unit groups around dynamic blockers
- The current production bundle is large because the runtime is still a single Phaser chunk. This is not a `civ-engine` problem, but it is part of the real integration cost.

## Implications for next phases

- Keep all game rules inside the simulation bridge or deeper; do not move gameplay state into Phaser scenes.
- Expand the content pipeline before widening gameplay breadth. The engine boundary is good enough to support that work.
- Add debug overlays early. `WorldDebugger` already makes this cheaper.
- Evaluate `civ-engine` pathfinding, occupancy, and visibility primitives as soon as villagers and military movement become command-driven instead of scripted.

## Current recommendation

Continue with the planned Phase 2 and Phase 3 work on top of `civ-engine`.

There is no evidence yet that the engine is the blocker. The next real proof points are:

- commandable unit movement
- villager task loops
- producer queues
- fog of war
- save and load round-tripping
