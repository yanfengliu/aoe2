# Review

## Critical

None.

## High

### [V4-1] Registration glue opts out of the type system at the highest-risk seam
- **Theme:** design / cleanliness
- **Where:** `C:\Users\38909\Documents\github\aoe2\src\game\simulation\bridge\registerBridgeSystems.ts:44-46`, `C:\Users\38909\Documents\github\aoe2\src\game\simulation\bridge\registerBridgeSystems.ts:166-178`
- **Finding:** The new bridge assembly path types major dependency bundles as plain `object` and then spreads them into `registerAllSystems(...)` via `as RegisterAllSystemsArg`. That means a renamed or missing export in any extracted module can still typecheck and only fail later as `undefined` inside the order-sensitive system registrar. I did not find a live omission in current HEAD, but this is the exact place where the refactor should be gaining compile-time protection, not discarding it.
- **Fix shape:** Replace the `object` bags and whole-interface casts with exact result interfaces or `Pick<RegisterAllSystemsDeps, ...>` slices so the compiler verifies every wired dependency.

### [V4-2] Fog-memory cleanup still uses anchor-only visibility for vanished large buildings
- **Theme:** correctness / tests
- **Where:** `C:\Users\38909\Documents\github\aoe2\src\game\simulation\bridge\systems\fogMemorySystem.ts:104-105`, `C:\Users\38909\Documents\github\aoe2\src\game\simulation\bridge\fogMemoryOps.ts:65-76`, `C:\Users\38909\Documents\github\aoe2\tests\simulation\footprintVisibilityConsistency.test.ts:36-97`
- **Finding:** The refactor correctly made building fog-memory writes and projections footprint-aware, but the delete path still drops a stale memory only when the anchor cell becomes visible. For a destroyed 4x4 Castle, seeing a cleared edge cell is enough to prove the building is gone, yet the ghost can persist until the anchor enters vision. The current footprint-visibility regression tests cover write/select behavior, not this destroy-and-clear case.
- **Fix shape:** Clear missing building memories when any cell of the stored footprint is visible, and add a regression that destroys a partially visible large building and asserts the memory ghost disappears.

## Medium

### [V4-3] Save-load still pays for full scenario generation it never uses
- **Theme:** efficiency
- **Where:** `C:\Users\38909\Documents\github\aoe2\src\game\simulation\bridge\createWorld.ts:81-85`, `C:\Users\38909\Documents\github\aoe2\src\game\simulation\bridge\wireBridgeOps.ts:196-220`
- **Finding:** `createWorld()` always builds `createPrototypeScenario(seed)` before it knows whether it is booting a fresh match or hydrating a save. The fresh branch uses that scenario; the saved-game branch immediately hydrates from the blob and never consumes it. On every load, the game is doing unnecessary procedural setup work before the real restore path starts.
- **Fix shape:** Lazily create the scenario only inside the `!savedGame` branch, or pass a thunk so save hydration skips map generation entirely.

### [V4-4] The canonical docs are behind the live bridge topology
- **Theme:** docs
- **Where:** `C:\Users\38909\Documents\github\aoe2\docs\architecture\ARCHITECTURE.md:15-19`, `C:\Users\38909\Documents\github\aoe2\docs\architecture\ARCHITECTURE.md:72-77`, `C:\Users\38909\Documents\github\aoe2\docs\architecture\drift-log.md:19`, `C:\Users\38909\Documents\github\aoe2\docs\devlog\summary.md:2`, `C:\Users\38909\Documents\github\aoe2\docs\devlog\detailed\2026-04-24_2026-04-25.md:492`, `C:\Users\38909\Documents\github\aoe2\docs\devlog\detailed\2026-04-24_2026-04-25.md:567`
- **Finding:** The documentation still describes Phase 5 as ending at a 2,722-line bridge and a helper-only `bridge/` subtree. It does not capture the current `createWorld -> wireBridgeOps -> wirePostSeedOps -> registerBridgeSystems/registerAllSystems` boot chain, and the Phaser scene subsection still omits today’s `buildingRenderer.ts` extraction. The detailed devlog file is also date-invalid: it says the next session should roll over to `2026-04-26_...`, then records a `2026-04-26` section inside `2026-04-24_2026-04-25.md`.
- **Fix shape:** Refresh `ARCHITECTURE.md`, `drift-log.md`, and `summary.md` to the live topology and current bridge size, and rename or roll over the detailed devlog so its filename matches its contents.

## Low / Nit

None beyond the documentation drift above.

## Verified-not-bugs

- `C:\Users\38909\Documents\github\aoe2\src\game\simulation\createSimulationBridge.ts:137-283` is now a real facade. It delegates world construction to `createWorld(...)` (`:187`), render projection to `RenderAdapter` (`:190`) and `createRenderStateOps(...)` (`:221`), and then exposes thin bridge wrappers.
- Side-map ownership is still centralized. `createBridgeState()` is instantiated once in `C:\Users\38909\Documents\github\aoe2\src\game\simulation\bridge\createWorld.ts:57` and then threaded through `wireBridgeOps(...)` at `:93`; I did not find duplicate side-map instances hiding inside extracted modules.
- The system extraction preserved explicit sequencing where it matters. `registerAllSystems` centralizes the 18 registrations (`C:\Users\38909\Documents\github\aoe2\src\game\simulation\bridge\registerAllSystems.ts:145-354`), while hard dependencies still use `after` edges, e.g. player commands after AI/auto-aggro (`...playerCommandsSystem.ts:142`) and fog memory after visibility (`...fogMemorySystem.ts:29`, with visibility registered immediately before at `...registerAllSystems.ts:313-315`).
- The current `wirePostSeedOps` restore path looks coherent. The live boot chain is `createWorld -> wireBridgeOps -> wirePostSeedOps -> registerBridgeSystems` (`...createWorld.ts:93`, `...wireBridgeOps.ts:240,323`, `...wirePostSeedOps.ts:108`), and I did not find a broken closure capture from the revert/restore sequence.

## Notes on today's bridge refactor

The shrink itself looks largely safe. `createSimulationBridge.ts` is no longer the god-file it was yesterday; `createWorld.ts` is readable; side-map ownership is still in one place; and the restored `wirePostSeedOps` composition is functioning as intended.

The main residual risk is not an obvious live behavior change, it is the new glue layer’s safety margin. The refactor moved a lot of responsibility into better-shaped files, but `registerBridgeSystems.ts` currently hides missing-dependency mistakes behind broad casts, so the compiler is no longer guarding the most order-sensitive assembly site. Separately, the documentation trail did not keep up with the final extraction stages, so the repo’s “source of truth” narrative is currently stale even though the code is in much better shape.
