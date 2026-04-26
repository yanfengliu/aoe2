# Code Review Findings

This report summarizes a full-repository audit of the Age of Empires II browser prototype. The review focused on design, test coverage, correctness, cleanliness, and documentation.

## Findings

---

- **Severity:** critical
- **Theme:** design
- **Where:** `src/game/simulation/createSimulationBridge.ts:1-7334`
- **Finding:** The `createWorld` closure within this file is a "god object" that centrally manages almost all game state via dozens of manually synchronized `Map` objects (e.g., `combatStates`, `unitCommands`, `monkTasks`). This pattern, often called "side-maps," runs parallel to the `civ-engine`'s ECS. It makes state inconsistent by default, is extremely difficult to reason about, and makes adding or changing features fragile and error-prone. The root of many other issues is this fundamental architectural choice.

---

- **Severity:** high
- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:1113-1303`
- **Finding:** The save/load logic relies on manually serializing and deserializing every side-map. This is extremely brittle and susceptible to schema drift. If a developer adds a new side-map but forgets to update the serialization or deserialization blocks, it will lead to silent state corruption or crashes on load. The code itself notes this fragility in comments.

---

- **Severity:** high
- **Theme:** cleanliness / efficiency
- **Where:** `src/game/simulation/createSimulationBridge.ts:2587-2633` (example: `getSelectableEntitiesAtCell`)
- **Finding:** The codebase frequently uses brute-force iteration over all entities to perform spatial queries (e.g., finding entities at a cell or in a rectangle). These linear scans (`world.query(...)` followed by a filter) are highly inefficient and will cause significant performance degradation and high per-tick costs as the number of entities in the simulation grows.

---

- **Severity:** medium
- **Theme:** design
- **Where:** `src/game/simulation/createSimulationBridge.ts:3485-4078` (example: `getTrainOptions`, `getResearchOptions`)
- **Finding:** Unit and technology unlock prerequisites are hardcoded as complex `if/else` and `switch` statements directly in the simulation logic. This makes the game's content (tech trees, unit lines) difficult to modify and maintain. This data should be externalized into configuration files (similar to the existing CSVs) and consumed by the simulation, separating game logic from game data.

---

- **Severity:** medium
- **Theme:** correctness / efficiency
- **Where:** `src/game/simulation/createSimulationBridge.ts:7179-7236` (function: `getRenderState`)
- **Finding:** The `getRenderState` function, which is called by the UI layer every frame, performs complex and potentially slow operations like filtering, set creation, merging, and sorting to combine live entities with fog-of-war "memory" entities. While it has a "fast path," the slow path can be a performance bottleneck, especially as the number of remembered entities grows. This logic also increases the risk of visibility-related bugs.

---

- **Severity:** low
- **Theme:** docs
- **Where:** `src/game/simulation/ai.ts:1-5`
- **Finding:** The file-level comment correctly states that the main AI decision loop lives in `createSimulationBridge.ts`. However, since the `...Ops.ts` refactoring pattern is now established, it would be beneficial to update this and other similar comments to point to the more specific, refactored modules (e.g., `createAiDecisionOps.ts`) to guide developers to the most relevant code.

---

- **Severity:** low
- **Theme:** cleanliness
- **Where:** `src/game/simulation/createSimulationBridge.ts:6961-6967` (function: `issueContextCommandAtEntityInternal`)
- **Finding:** The command rejection mechanism uses raw strings (e.g., `enqueueRejection('Target not visible.')`). This is brittle and prone to typos. Using a shared enum or string constants for rejection reasons would improve type safety and maintainability.

---

- **Severity:** nit
- **Theme:** tests
- **Where:** `tests/simulation/aiPlayer.test.ts`
- **Finding:** The end-to-end simulation tests have very long timeouts (up to 180,000ms). While necessary for the number of ticks being simulated, this indicates that the test suite can be slow to run. The performance issues identified in `createSimulationBridge.ts` are a likely contributor to this slowness.

## Top issues to fix first

1.  **Refactor `createSimulationBridge.ts` (Critical, Design):** The highest priority is to continue the refactoring efforts already started (e.g., `selectionActivity.ts`, `ai.ts`). The goal should be to systematically dismantle the `createWorld` god-closure. Move state from side-maps into `civ-engine` ECS components wherever possible. Logic should be extracted into pure, testable functions that receive their state explicitly.
2.  **Address Inefficient Queries (High, Efficiency):** Replace brute-force entity iteration with efficient spatial queries. This will likely involve implementing or leveraging a spatial partitioning data structure (e.g., a 2D grid or quadtree) to quickly find entities in a given area. This will improve performance across the entire simulation, including in tests.
3.  **Stabilize Save/Load (High, Correctness):** The manual save/load system is a critical bug risk. A more automated or schema-driven approach is needed. For example, each state-holding module could be responsible for its own serialization, or a more robust library could be used. At a minimum, comprehensive tests should be written to cover all serialized state to catch schema drift.
4.  **Externalize Game Data (Medium, Design):** Move tech trees and unit production rules out of `getTrainOptions`/`getResearchOptions` and into data files. This will make the game content much easier to manage and will simplify the simulation code significantly.
5.  **Optimize `getRenderState` (Medium, Correctness/Efficiency):** Investigate ways to reduce the per-frame cost of `getRenderState`. This might involve pre-calculating visibility sets within the simulation ticks rather than on-demand, or finding ways to avoid the expensive merge-and-sort operation.
