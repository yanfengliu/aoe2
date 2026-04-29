# Full Codebase Review — 2026-04-26 (Iteration 1)

**Reviewers:** Codex (`gpt-5.4` @ `model_reasoning_effort=xhigh`, sandbox read-only), Gemini (`gemini-3.1-pro-preview` @ `--approval-mode plan`), Claude (`opus` @ `--effort xhigh`). Each ran independently with read-only access to the working tree from CWD; raw outputs in `raw/codex.md`, `raw/gemini.md`, `raw/opus.md`. Iter-1/2/3 REVIEW.md from 2026-04-25 were included in the prompt so reviewers wouldn't re-flag known fixed/deferred items.

**HEAD reviewed:** `4cbc1bf` on `main` (today's 42-commit `createSimulationBridge.ts` shrink fully merged).

**CLI invocation refresh:** Gemini needed `--approval-mode plan` to stay in read-only mode (without it, the model attempts `run_shell_command` / `invoke_agent` and fails with policy violations). Codex's `--sandbox read-only` blocks PowerShell `Select-String` invocations on Windows but file reads still work — its review remained complete. The `claude -p "<prompt>"` form with the long prompt as the positional argument worked; piping into stdin or using `--append-system-prompt` was unnecessary for the no-diff full-codebase case. Will fold these into AGENTS.md as part of fix batch.

---

## Executive summary

The 42-commit Phase 4 + 5 shrink that took `createSimulationBridge.ts` from **7,606 → 332 lines (-96%)** is structurally safe — all three reviewers verify side-map ownership is centralized (in `bridgeState.ts` now, no longer `createWorld`), system-registration order is determinism-safe (driven by explicit `after`/`before` deps, not registration sequence), and the wirePostSeedOps revert + restore introduced no drift (byte-identical to the original extraction).

But the refactor also exposed **one load-bearing type-safety hole** that two reviewers caught and Claude proved is real:

1. **[V4-1] 10 unsafe `as RegisterAllSystemsArg` casts** in `registerBridgeSystems.ts` collapse the full `RegisterAllSystemsDeps` type onto each spread, telling TypeScript to trust each ops factory return value matches the entire deps interface. *(Codex V4-1 + Claude V4-1)*
2. **[V4-2] Existence proof:** `beginTrebuchetUnpack` / `beginTrebuchetPack` in `registerAllSystemsTypes.ts:105-106` declare `=> boolean` return; the actual implementations in `trebuchetState.ts:23,27` return `void`. The cast hole hid this drift. *(Claude V4-3)*

Beyond the cast hole, the strongest cross-reviewer agreement is **doc drift**: all three reviewers caught that `ARCHITECTURE.md`, `drift-log.md`, and `devlog/summary.md` describe a pre-Phase-5 world. The drift-log says `2722` lines, the actual is `332`. Phase-5 modules (~30 of them) are unmentioned. The "side-map ownership lives in `createWorld`" claim is now wrong (lives in `bridgeState.ts:createBridgeState`). Plus the detailed devlog filename (`2026-04-24_2026-04-25.md`) is date-invalid — it now contains 2026-04-26 entries. *(Codex V4-4 + Claude V4-2/V4-4/V4-5 + Gemini V4-3)*

The remaining findings cluster into four groups: a fog-memory delete-path edge case (Codex V4-2 — sibling of iter-3 V3-1 on the cleanup side), a save-load throttle gap (Claude V4-8), three efficiency hot-spots (Gemini V4-1/V4-2 + Claude V4-10/V4-11), and a handful of cleanliness nits (4 dead `void` params, dead type re-exports, switch fall-through, unnecessary `Map.entries()` clone, types still imported from the facade).

---

## Cross-reviewer agreement

| Theme | Codex | Gemini | Claude |
|---|---|---|---|
| **Cast hole at registerBridgeSystems** | ✓ (V4-1) | — | ✓ (V4-1) |
| **Trebuchet pack/unpack signature mismatch** *(existence proof)* | — | — | ✓ (V4-3) |
| **Doc drift: ARCHITECTURE / drift-log / summary** | ✓ (V4-4) | ✓ (V4-3) | ✓ (V4-2/V4-4/V4-5) |
| **Devlog filename date-invalid** | ✓ (V4-4) | — | — |
| **Fog-memory delete-path anchor-only** | ✓ (V4-2) | — | — *(missed; Claude marked write/select fix as complete)* |
| **Efficiency: full-world allocations / quadratic loops** | — | ✓ (V4-1/V4-2) | ✓ (V4-10/V4-11) |
| **`gathererDropOffStuckSinceTick` not in save blob** | — | — | ✓ (V4-8) |
| **Save-load wastes scenario gen** | ✓ (V4-3) | — | — |
| **`syncSpawnedEntityOccupancy` swallows errors** | — | ✓ (V4-5) | — |
| **`humanInputOps.issueAction` switch fall-through** | — | — | ✓ (V4-6) |
| **`monkConvertProcessedThisTick` clear timing** | — | — | ✓ (V4-9) |
| **`aiSystem.ts` ~492 LOC (just under 500)** | — | ✓ (V4-4) | — |

---

## Verified iter-3 fixes

All 9 priority items from iter-3 confirmed landed and correct:

| Iter-3 ID | Site | Verdict |
|---|---|---|
| V3-1 fog-memory write/select footprint | `fogMemorySystem.ts:42-54`, `fogMemoryOps.ts:65-76` | **OK** *(but delete path missed — see V4-3 below)* |
| V3-2 click-selection footprint | `selectionInputOps.ts:153-170` | **OK** |
| V3-3 FU2 unit double-click whitelist | `GameScene.ts:990-1034` | **OK** *(now exhaustive via `satisfies Record<UnitType, true>`)* |
| V3-7 Monk conversion vision/LOS | `monkTaskAppliers.ts:127-132` | **OK** |
| V3-9 `wonder` displayName | `displayNames.ts:98,231,514,573` | **OK** |
| V3-11 HUD `destroy()` | `createHudController.ts:461-471` | **OK** |
| V3-12 mutual annihilation = draw | `conquestOutcomeSystem.ts:45-51` | **OK** |
| V3-13 forest-cluster collision | `applyStandardPlayerOpening.ts:263, 311-315` | **OK** |
| V3-14 UTF-16 surrogate-pair hash | `sharedTerrainHelpers.ts:28-31` | **OK** |
| V3-16 `applyShoreFishPatchesProcedural` alias | `applyStandardPlayerOpening.ts:151` | **OK** |
| V3-6 inFlightTech rebuild on load | `hydrateFromSavedGame.ts:236-244` | **OK** |
| V3-8 orphan-key prune | `hydrateFromSavedGame.ts:298-323` | **OK** |
| H-3 garrison cross-reference | `hydrateFromSavedGame.ts:200-218` | **OK** |

Outstanding from iter-3 (carry-forward, not re-flagged unless new angle):
- **V3-24** AI `findIdleProducer` first-match — survived Phase 5 split intact (Claude V4-17). Behavior gap, not a refactor leak.

---

## Critical

*(none — iter-1's deferred clusters C-2 enum validation, H-2 wider round-trip, H-4 partial cache sweep remain explicitly out of scope.)*

---

## High

### [V4-1] `registerBridgeSystems.ts` uses 10 unsafe `as RegisterAllSystemsArg` casts that defeat type checking at the highest-risk seam *(Codex + Claude — strongest cross-reviewer agreement)*

- **Theme:** correctness, design
- **Where:** `src/game/simulation/bridge/registerBridgeSystems.ts:44-55, 171-180`
- **Finding:** The dep-bag for the bundled 18-system register call is split across 10 ops factories, but the deps interface types each one as bare `object` (lines 44-55 — `playerQueries: object`, `aiDecisionOps: object & { isAiMilitaryUnit: ... }`, `targetFindingOps: object & { findNearestDropOffBuilding: ... }`, etc.) and then casts each spread with `as RegisterAllSystemsArg` (lines 171-180). The cast turns every spread into the full target shape, so TypeScript can no longer verify that any factory return value (a) actually contains the fields `registerAllSystems` expects, (b) has matching field signatures, or (c) survives a future renamed export — silent under-provisioning would throw at runtime, not compile time. This is the load-bearing wiring for every ECS system in the bridge. Concrete proof of a real signature drift hidden by this hole is V4-2 below.
- **Fix shape:** Replace the `object` types with the actual factory return types (`playerQueries: PlayerQueries`, etc., possibly slicing via `Pick<RegisterAllSystemsDeps, ...>`), and drop every `as RegisterAllSystemsArg` cast. Let TS prove the spread coverage is total.

### [V4-2] Type signature mismatch on `beginTrebuchetUnpack`/`beginTrebuchetPack` papered over by V4-1 cast *(Claude — existence proof for V4-1)*

- **Theme:** correctness
- **Where:** `src/game/simulation/bridge/registerAllSystemsTypes.ts:105-106` vs `src/game/simulation/bridge/trebuchetState.ts:23, 27, 53-67` and `src/game/simulation/bridge/systems/playerCommandsSystem.ts:64-65`
- **Finding:** `RegisterAllSystemsDeps` declares `beginTrebuchetUnpack: (id: number) => boolean` and `beginTrebuchetPack: (id: number) => boolean` (lines 105-106). The actual implementations in `trebuchetState.ts` (lines 23, 27, 53-67) return `void`. The consumer `playerCommandsSystem.ts:64-65` correctly types them as `void`. This mismatch survives precisely because `registerBridgeSystems.ts:174` casts `(trebuchetStateOps as RegisterAllSystemsArg)` and TS no longer sees the truth. If anyone writes `if (beginTrebuchetUnpack(id))` somewhere assuming `boolean`, the compile passes and the runtime branch never enters.
- **Fix shape:** Change the two declarations in `registerAllSystemsTypes.ts:105-106` to `(id: number) => void` to match reality. (After V4-1 lands, TS catches future drift automatically.)

### [V4-3] Fog-memory delete path uses anchor-only visibility — destroyed multi-cell buildings can leave permanent ghosts *(Codex — V3-1 sibling on the cleanup side, missed in iter-3 sweep)*

- **Theme:** correctness, tests
- **Where:** `src/game/simulation/bridge/systems/fogMemorySystem.ts:97-107` (delete loop, line 104 in particular)
- **Finding:** Iter-3 V3-1 made fog-memory writes and projection footprint-aware (`fogMemoryOps.ts:65-76` uses `isFootprintExplored` + `isFootprintVisible`). But the delete path that forgets memories of destroyed entities still uses `visibility.isVisible(humanPlayerId, entry.position.x, entry.position.y)` — anchor cell only — at line 104. A 4×4 Castle that gets destroyed while its anchor is in fog never has its memory entry cleared even when the player can clearly see destroyed-rubble cells. The stored entry has `footprintWidth`/`footprintHeight` already (used by `fogMemoryOps.ts:70-71` for the read path), so the data is available; only the delete-path predicate needs updating.
- **Fix shape:** Replace the anchor-only `visibility.isVisible(...)` with `isFootprintVisible(visibility, humanPlayerId, entry.position.x, entry.position.y, entry.footprintWidth, entry.footprintHeight)` and add a regression test that destroys a partially-visible 4×4 building and asserts the memory entry disappears once any of its cells are visible.

### [V4-4] `ARCHITECTURE.md` `bridge/` topology is stale by ~30 modules and 14 commits — no Phase-5 module is mentioned, side-map ownership claim is wrong *(Codex + Claude + Gemini — full agreement)*

- **Theme:** docs
- **Where:** `docs/architecture/ARCHITECTURE.md:21-58, 70-78` (Phaser scene also stale on `buildingRenderer.ts`)
- **Finding:** The doc enumerates 11 bridge modules from before Phase 4 (`pureHelpers`, `visibility`, `trebuchetState`, `fogMemoryOps`, `monkTaskOps`, `technologyOps`, `matchEndOps`, `aiDecisionOps`, `placementOps`, `saveGameOps`, `targetFindingOps`). The actual state has ~45 bridge modules including the entire `bridge/systems/` directory of 18 ECS factories, plus `createWorld.ts`, `wireBridgeOps.ts`, `wirePostSeedOps.ts`, `assembleBridgeApi.ts`, `bridgeState.ts`, `bridgeHelpers.ts`, `bridgeConstants.ts`, `registerAllSystems.ts`, `registerAllSystemsTypes.ts`, `registerBridgeSystems.ts`, `selectionInputOps`, `selectionStateOps`, `selectionFinders`, `unitCommandOps`, `humanInputOps`, `cellPassability`, `visibilityQueries`, `transformOps`, `debugSnapshotOps`, `economyStateOps`, `entityCreateOps`, `entityDestroyOps`, `movementPlanOps`, `combatStateFactory`, `optionsRules`, `playerQueries`, `monkAiSearchHelpers`, `monkTaskAppliers`, `renderStateOps`, `scenarioSeedOps`, `hydrateFromSavedGame`, `trainingMarketOps`, `createWorldResult`, `wireBridgeOpsTypes`. The load-bearing claim "side-map ownership still lives in createWorld" is now wrong: every side map lives in `bridgeState.ts:createBridgeState()`, threaded through every factory. The `bridge/systems/` subdirectory isn't named at all. The `phaser/scenes/gameScene/` paragraph also omits today's `buildingRenderer.ts` extraction.
- **Fix shape:** Rewrite the `bridge/` paragraph to enumerate the new topology (orchestration/state/systems/ops/types tiers); update the "side-map ownership lives in createWorld" sentence to reference `bridgeState.ts`; add `buildingRenderer.ts` to the `gameScene/` paragraph.

### [V4-5] `docs/architecture/drift-log.md` Phase-5 entry says `createSimulationBridge.ts` is 2,722 lines; actual is 332 — 14 commits of Phase-5 follow-ups are unlogged *(Codex + Claude + Gemini)*

- **Theme:** docs
- **Where:** `docs/architecture/drift-log.md:19`
- **Finding:** The 2026-04-26 Phase-5 row ends with "`createSimulationBridge.ts` shrinks 4031 → 2722 lines (an additional -32%)." Today's later commits (registerAllSystems bundle `c287ed5`, bridgeState extract `35b16c9`, createWorld move `c9dd6c7`, factory spread + state hoisting `4895062`, wireBridgeOps + assembleBridgeApi extract `2c06143`, hydrateFromSavedGame split `ebd7327`, selectionFinders extract `6e199eb`, monkTaskOps split `031570a`, factory reorder `d4d4540`, registerBridgeSystems extract `adcdef2`, RegisterAllSystemsDeps extract `a1877e4`, wirePostSeedOps revert+restore `9818df8`/`c73649b`/`4cbc1bf`) all touch architecture but no row appended. The reader is left with a ~8x understatement of the shrink and zero record of the Phase-5 architectural events.
- **Fix shape:** Append a Phase-5 follow-up row covering the `registerAllSystems` bundle, `createWorld` move, `bridgeState` extract, `wireBridgeOps` + `assembleBridgeApi` + `wirePostSeedOps` + `registerBridgeSystems` extracts, with the actual final size (332 LOC, -96%).

### [V4-6] Detailed devlog filename `2026-04-24_2026-04-25.md` contains 2026-04-26 entries — date-range invalid per AGENTS.md devlog convention *(Codex)*

- **Theme:** docs
- **Where:** `docs/devlog/detailed/2026-04-24_2026-04-25.md` (file naming) — entries for 2026-04-26 from line ~492 onward
- **Finding:** AGENTS.md "Devlog" section: "Detailed devlogs live under `docs/devlog/detailed/` as files named `START_DATE_END_DATE.md`. Periodically archive: when the active file grows larger than 500 lines or a significant time boundary is reached, `git mv` the file to update its `END_DATE` to the date of its last entry, then start a new file whose `START_DATE` is today." The current file `2026-04-24_2026-04-25.md` has 2026-04-26 entries appended without the rename. Either rename to `2026-04-24_2026-04-26.md` or roll over: `git mv` to `2026-04-24_2026-04-25.md` (no change, locks the prior date range) and start `2026-04-26_2026-04-26.md` for today's entries.
- **Fix shape:** `git mv docs/devlog/detailed/2026-04-24_2026-04-25.md docs/devlog/detailed/2026-04-24_2026-04-26.md` (preserves the appended-today pattern), or split today out into a fresh `2026-04-26_2026-04-26.md` and shrink the prior file back to its original cutoff.

---

## Medium

### [V4-7] `gathererDropOffStuckSinceTick` is not in the save blob — save+load resets the retry throttle for every stuck villager *(Claude)*

- **Theme:** correctness, save-load
- **Where:** `src/game/simulation/bridge/saveGameOps.ts:43-80` (no entry for `gathererDropOffStuckSinceTick`); `src/game/simulation/bridge/hydrateFromSavedGame.ts:24-62` (no entry); declared in `bridgeState.ts:83`; consumed in `villagerEconomySystem.ts:286-322`
- **Finding:** The 30-tick drop-off retry throttle (iter-3 V3-5 fix) keeps a stuck villager from spamming `findNearestDropOffBuilding` + `findBuildingApproachPlan` every tick. The throttle bookkeeping lives in `gathererDropOffStuckSinceTick`. After load, every previously-stuck villager re-attempts immediately on the next tick instead of inheriting the throttle. Probably acceptable game behavior (load is already a perceived hitch) but it's a quiet save-load determinism leak — replays across save boundaries diverge.
- **Fix shape:** Add the map (Map<number, number>) to both `saveGameOps.ts` write and `hydrateFromSavedGame.ts` read.

### [V4-8] Save-load pays for full scenario generation it never uses *(Codex)*

- **Theme:** efficiency
- **Where:** `src/game/simulation/bridge/createWorld.ts:81-85`; `src/game/simulation/bridge/wireBridgeOps.ts:196-220`
- **Finding:** `createWorld()` always builds `createPrototypeScenario(seed)` before it knows whether it is booting a fresh match or hydrating a save. The fresh branch uses that scenario; the saved-game branch immediately hydrates from the blob and never consumes it. On every load, the game does unnecessary procedural setup work (sometimes hundreds of ms on Black Forest seeds) before the real restore path starts.
- **Fix shape:** Lazily create the scenario inside the `!savedGame` branch only, or pass a thunk so save hydration skips map generation entirely.

### [V4-9] `assignNearestResource` allocates + sorts the entire resource set per-villager per-tick — quadratic spike during simultaneous drop-offs *(Gemini)*

- **Theme:** efficiency
- **Where:** `src/game/simulation/bridge/systems/villagerEconomySystem.ts:79`
- **Finding:** When multiple villagers finish dropping off in the same tick and call `shouldMaintainGatheringOrder` → `assignNearestResource`, each villager triggers a full-world `world.query('position', 'resource')` that filters, allocates a wrapper object per resource, and sorts. With 12 villagers × ~120 resources per map = ~1,440 wrapper allocations + ~12 full sorts in a single tick.
- **Fix shape:** Use the engine's `queryInRadius` for a tight spiral search around the villager's position (resources on canonical AoE2 maps are usually within 8 cells of a drop-off site), or maintain an `availableResourcesByType` index keyed by `resourceType`.

### [V4-10] `getHumanUnitIdsInRect` / `getHumanOwnedSheepIdsInRect` map the whole world before applying the bbox filter *(Gemini)*

- **Theme:** efficiency
- **Where:** `src/game/simulation/bridge/selectionInputOps.ts:145, 206`
- **Finding:** The two helpers iterate `world.query('position', 'unit')` and `world.query('position', 'resource')`, allocating an intermediate `{ id, position, unit }` wrapper per entity, *then* filter by the bounding box. Drag-box selection on a busy map allocates ~200 wrappers per frame just to keep the 5-15 inside the box.
- **Fix shape:** Apply the bbox check against the raw component lookups inside the iterator before constructing the wrapper, so allocations only happen for entities that survive the filter.

### [V4-11] `playerHasConquestPresence` walks every unit + every building per player per tick — grows quadratically with player count *(Claude)*

- **Theme:** efficiency
- **Where:** `src/game/simulation/bridge/matchEndOps.ts:170-186`; `src/game/simulation/bridge/systems/conquestOutcomeSystem.ts:41-43`
- **Finding:** Short-circuits on first match per call (good), but the conquest system invokes it once for the human and once for each enemy each tick. With 4 players and 200 entities, worst-case (every player has zero presence) = 800 component reads per tick × 60 TPS = 48k reads/sec just for conquest. Not a bottleneck today (only 2 players, presence is rare to be zero) but the worst case grows with map size and lobby size.
- **Fix shape:** Maintain a `playersWithPresence: Set<number>` side map updated in `entityCreateOps`/`entityDestroyOps`; replace per-tick scans with O(1) Set lookups.

### [V4-12] `aiSystem.assignAiMonkTasks(owner)` runs every AI decision tick for every owner regardless of whether any owned monk exists *(Claude)*

- **Theme:** efficiency
- **Where:** `src/game/simulation/bridge/systems/aiSystem.ts:411`; `src/game/simulation/bridge/monkTaskOps.ts:128-175`
- **Finding:** `assignAiMonkTasks` walks `world.query('unit')` for every active AI on every decision tick (default 60 ticks). For an AI with no Monks, this is pure waste. With 4 enemy AIs × ~250 units it's ~1,000 component lookups per AI decision interval per AI, all to no-op.
- **Fix shape:** Gate `assignAiMonkTasks(owner)` on `countOwnedUnits(owner, 'monk') > 0` (the AI already has `countOwnedUnits`), or maintain an `ownedMonksByOwner` side map.

### [V4-13] `humanInputOps.issueAction` falls off the end of the switch with no return — implicit `undefined` returned from a `boolean`-typed function *(Claude)*

- **Theme:** correctness, cleanliness
- **Where:** `src/game/simulation/bridge/humanInputOps.ts:240-253`
- **Finding:** Signature is `issueAction(actionType: ActionType): boolean` but the body is `switch (actionType) { case 'ungarrison': return ungarrisonBuilding(selectedEntityId); }` with no default and no trailing return. Today this works because `ActionType` is exactly `'ungarrison'` and the switch is total, but adding any future `ActionType` literal silently returns `undefined` to a caller that wraps the result in `flushOutOfBandRenderChange()` (`createSimulationBridge.ts:314-318`). `noImplicitReturns` would have caught this at compile time.
- **Fix shape:** Add `default: return false;` to the switch, or replace with `if (actionType === 'ungarrison') return ungarrisonBuilding(...); return false;`.

### [V4-14] `monkConvertProcessedThisTick.clear()` is buried inside `prototypeMonkBehavior.execute` — invariant tied to per-tick ordering with no comment or test *(Claude)*

- **Theme:** design, correctness
- **Where:** `src/game/simulation/bridge/systems/monkBehaviorSystem.ts:96`; `src/game/simulation/bridge/monkTaskAppliers.ts:138-146`
- **Finding:** The per-target single-progress guard relies on `monkConvertProcessedThisTick` being cleared exactly once per tick before any `applyMonkConvert` call. Today this works because all `applyMonkConvert` calls flow through `prototypeMonkBehavior` which `clear()`s at line 96 first. But the guard would silently break (carrying stale "already-processed" entries forever) if a future caller of `applyMonkConvert` ran in any other system phase. The Set is exposed in `BridgeState` for any factory to mutate.
- **Fix shape:** Move the `clear()` to the very start of every tick (a top-of-loop call in `world.step`'s preUpdate phase or a dedicated clearing system) AND add a regression test that verifies a non-Monk-system `applyMonkConvert` path still respects the per-tick guard.

### [V4-15] `syncSpawnedEntityOccupancy` swallows all errors during `isBootstrappingScenario()` — bug in scenario rules silently produces overlapping placement *(Gemini)*

- **Theme:** correctness
- **Where:** `src/game/simulation/bridge/transformOps.ts:133`
- **Finding:** `syncSpawnedEntityOccupancy` catches and suppresses all errors during scenario bootstrap. The intent is to let the scenario-seed code throw the user-facing fixture error, but if a spawn genuinely fails occupancy unexpectedly due to a bug in the prototype rules (e.g., an overlapping entity placement that bypasses the dedupe), the error is silently swallowed and the entity is placed overlapping. Bridge-boot fixture validation runs separately so most cases would be caught, but the shape "catch-all + log nothing" hides bugs.
- **Fix shape:** Either let it throw (and rely on the bootstrap validator to surface a friendlier message) or narrow the catch to the specific `OccupancyConflictError` type with a `console.warn` for diagnostics.

---

## Low / Nit

### [V4-16] Four `void <param>` markers expose dep-bag fields kept "for parity" that the recipient never uses *(Claude)*

- **Where:** `src/game/simulation/bridge/wirePostSeedOps.ts:146` (`void enqueueRejection`); `src/game/simulation/bridge/registerAllSystems.ts:114-116` (`void isAiMilitaryUnit`); `src/game/simulation/bridge/cellPassability.ts:146-147` (`void unitId; void activeWorld;`)
- **Finding:** All four read as "future-proofing" but in practice they expand the public dep-bag that callers must satisfy without delivering value. `cellPassability.isCellPassableForUnit` accepts `unitId` and `activeWorld` only to discard them and call `isCellPassableForSpawn` — every caller could call the spawn variant directly.
- **Fix shape:** Drop `enqueueRejection` from `WirePostSeedDeps`, drop `isAiMilitaryUnit` from `RegisterAllSystemsDeps` (kept only in monkOps deps), and inline `isCellPassableForUnit` to its body or give it real per-unit semantics.

### [V4-17] `playerCommandsSystem.ts` clones `unitCommands.entries()` to an array every tick to support concurrent-modification-via-`clearUnitCommand` *(Claude)*

- **Where:** `src/game/simulation/bridge/systems/playerCommandsSystem.ts:144`
- **Finding:** `for (const [id, command] of [...unitCommands.entries()])` allocates a fresh array every tick (60 TPS) just to allow `clearUnitCommand(id)` mid-iteration. Map iteration is delete-during-iterate-safe per ECMAScript spec; the spread is unnecessary.
- **Fix shape:** Drop the spread (`for (const [id, command] of unitCommands.entries())`).

### [V4-18] `wirePostSeedOps.ts:343-344` exports `BuildingComponent`/`UnitComponent` types only to suppress unused-import lint *(Claude)*

- **Where:** `src/game/simulation/bridge/wirePostSeedOps.ts:14-19, 343-344`
- **Finding:** Comment "Suppress unused-import lint for type-only re-exports" plus `export type { BuildingComponent, UnitComponent };` is dead surface — neither type is actually consumed externally from this module. The imports themselves on line 14-19 should be deleted instead.
- **Fix shape:** Delete both the imports and the re-export.

### [V4-19] `UnitCommand`, `MonkTask`, `TrebuchetPackState`, `ConstructionState` types still imported from `../createSimulationBridge` despite that file being a 332-LOC facade *(Claude)*

- **Where:** `src/game/simulation/bridge/bridgeHelpers.ts:21`, `bridge/hydrateFromSavedGame.ts:11`, `bridge/monkTaskOps.ts:28`, `bridge/trebuchetState.ts:8`, `bridge/unitCommandOps.ts:19`, `bridge/wireBridgeOpsTypes.ts:15`, `bridge/bridgeState.ts:25-29`
- **Finding:** Six bridge modules + `bridgeState` itself import shared types from the facade file rather than from a `bridge/sharedTypes.ts`. Means the orchestrator carries types its 5-call body doesn't need; circular-ish (bridge child → orchestrator parent for type only).
- **Fix shape:** Move `UnitCommand`, `MonkTask`, `TrebuchetPackState`, `ConstructionState` from `createSimulationBridge.ts:89-122` into a new `bridge/sharedTypes.ts` and re-export from `createSimulationBridge.ts` for the public `SimulationBridge` consumers.

### [V4-20] `aiSystem.ts` at ~492 LOC just under the AGENTS.md ideal 500 ceiling *(Gemini)*

- **Where:** `src/game/simulation/bridge/systems/aiSystem.ts`
- **Finding:** Slightly under 500 LOC; well under the strict 1000 LOC limit. Not actionable today.
- **Fix shape:** Defer; revisit if the file grows past 500.

### [V4-21] Building footprint visibility skipped for resources in fog memory — comment only mentions buildings *(Claude — defensive guard for future multi-cell resources)*

- **Where:** `src/game/simulation/bridge/systems/fogMemorySystem.ts:69-95`
- **Finding:** The post-V3-1 fix uses `isFootprintVisible` for buildings (line 44). Resources still use anchor-only `visibility.isVisible(humanPlayerId, position.x, position.y)` (line 80). This is correct today because every memorable resource (`tree`, `berry-bush`, `gold-mine`, `stone-mine`) is 1×1, but the comment at line 69 says "static resources" without the 1×1 caveat.
- **Fix shape:** Either switch to `isFootprintVisible` defensively (footprint dimensions come from `renderable`), or add a brief comment that all `isStaticMemorableResourceType` resources are 1×1.

### [V4-22] `package.json` version is `0.1.0`; `docs/changelog.md` does not exist; AGENTS.md mandates per-feature bumps + changelog *(Claude — discipline drift)*

- **Where:** `package.json` (`"version": "0.1.0"`); `docs/changelog.md` absent; `AGENTS.md` "Versioning" + "Discipline" sections
- **Finding:** AGENTS.md "Versioning" mandates `a.b.c` bumps for every non-breaking change and a `docs/changelog.md`. Neither has happened across today's 42 commits (or yesterday's iter-1/2/3 sweeps). Either the doctrine doesn't fit a still-prototyping repo, or these are dozens of missed bumps.
- **Fix shape:** Reconcile — either land a `docs/changelog.md` with one entry per major refactor checkpoint and bump to `0.2.0`-ish, or amend AGENTS.md to scope versioning to behavior-changing commits only.

### [V4-23] CLI flag landscape confirmed today: Gemini needs `--approval-mode plan`, Codex tolerates PowerShell tool blocks on Windows *(meta — update AGENTS.md)*

- **Where:** `AGENTS.md` "Code review" section; this REVIEW.md "CLI invocation refresh" preamble
- **Finding:** Discovered during today's run: (a) Gemini `gemini-3.1-pro-preview` without `--approval-mode plan` tries to call `run_shell_command` / `invoke_agent` and produces zero output; with `plan` mode it produces a clean review. (b) Codex on Windows hits "blocked by policy" on PowerShell `Select-String` invocations (sandbox: read-only blocks them) but the model recovers via direct file reads. Both AGENTS.md `Code review` flag examples need a refresh.
- **Fix shape:** Append `--approval-mode plan` to Gemini example; note the PowerShell-block behavior on Codex.

### [V4-24] Carry-forward: `findIdleProducer` returns first match (V3-24 from iter-3) *(Claude — confirms refactor preserved the old gap)*

- **Where:** `src/game/simulation/bridge/aiDecisionOps.ts:162-179`
- **Finding:** Iter-3 V3-24 noted multi-base AI never trains at second producer until first fills. Survived Phase 5 split intact — not a refactor leak, an outstanding behavior gap.
- **Fix shape:** Defer to a future AI tuning sprint.

### [V4-25] EOF formatting drift across several bridge files *(Claude — nit only)*

- **Where:** `src/game/simulation/bridge/assembleBridgeApi.ts:67-68`, `registerAllSystemsTypes.ts:235-236`, `wirePostSeedOps.ts:343-345`
- **Finding:** Trailing newline + empty-line patterns inconsistent. Not worth a dedicated commit.
- **Fix shape:** Sweep with the next batch.

---

## Verified-not-bugs

- **System registration order in `registerAllSystems.ts`** — All 18 systems use explicit `after`/`before` deps; registration sequence does not drive execution order. Bundle covers exactly the 18 prototypeXxx systems present pre-extraction.
- **`wirePostSeedOps` revert + restore (`9818df8` → `c73649b` → `4cbc1bf`)** — `git diff 9818df8 4cbc1bf -- src/game/simulation/bridge/wirePostSeedOps.ts` returns empty; restore is byte-identical to original extraction. Codex independently traced the same conclusion.
- **Closure-captured `unitCommandOps.issueUnitMoveCommand` in `wirePostSeedOps.ts:284`** — TDZ-safe because the arrow body is invoked after `unitCommandOps` is initialized later in the same module (line 301). Both Gemini and Claude verified independently.
- **Side-map ownership** — Centralized in `bridgeState.ts:createBridgeState()`, instantiated once in `createWorld.ts:57`, threaded by reference through every factory. No duplicate side-map instances inside extracted modules.
- **`createSimulationBridge.ts` (332 LOC)** — Genuine facade now: delegates world construction to `createWorld(...)` (`:187`), render projection to `RenderAdapter` (`:190`) and `createRenderStateOps(...)` (`:221`), exposes thin bridge wrappers.
- **`createWorld.ts` (126 LOC)** — Readable. Calls `createBridgeState()` once, then `wireBridgeOps(...)`, then returns the result. No God-class regrowth.
- **`issueMoveCommand` omitting `flushOutOfBandRenderChange()`** — Verified safe: `issueMoveCommand` only mutates `unitCommands` and `placementMode`, neither of which require an out-of-band invalidation of `getRenderState()`.

---

## Top issues to fix first

User explicitly invoked `/full-review` with no scope cap, so target is everything actionable that doesn't need a standalone sprint. Ordered by impact + cross-reviewer agreement:

1. **[V4-1] Type the `RegisterBridgeSystemsDeps` ops factories properly + drop `as RegisterAllSystemsArg` casts** *(highest agreement; closes the load-bearing safety hole)*
2. **[V4-2] Fix `beginTrebuchetUnpack`/`beginTrebuchetPack` return types to `void`** *(falls out of V4-1)*
3. **[V4-3] Fog-memory delete path → `isFootprintVisible`** *(real correctness bug; sibling of iter-3 V3-1)*
4. **[V4-4 + V4-5 + V4-6] Doc refresh: ARCHITECTURE.md + drift-log + devlog summary + rename `2026-04-24_2026-04-25.md`** *(triple agreement; ~30 minute sweep)*
5. **[V4-7] `gathererDropOffStuckSinceTick` save-load round-trip**
6. **[V4-8] Lazy scenario gen on save-load**
7. **[V4-9 + V4-10 + V4-11 + V4-12] Efficiency batch (4 hot spots)**
8. **[V4-13] `humanInputOps.issueAction` default branch**
9. **[V4-14] `monkConvertProcessedThisTick` clear timing + regression test**
10. **[V4-15] Tighten `syncSpawnedEntityOccupancy` catch**
11. **[V4-16 → V4-25] Cleanliness sweep (drop `void` markers, dead re-exports, types-in-facade, EOF)** *(small, can ride the doc commit)*
12. **[V4-23] AGENTS.md CLI flag refresh** *(ride the doc commit)*

Deferred (mentioned but not in this batch):
- **V4-22** versioning + `docs/changelog.md` — needs user input on whether to relax AGENTS.md or backfill 50+ entries.
- **V4-20** `aiSystem.ts` ~492 LOC — under threshold; revisit if growth.
- **V4-21** resource fog-memory comment — defensive only.
- **V4-24** V3-24 carry-forward — multi-base AI behavior gap.

Critical / iter-1 deferred items remain explicitly out (C-2 enum validation, H-2 wider round-trip, H-4 cache sweep).
