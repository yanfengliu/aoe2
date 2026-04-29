Have enough material. Writing review.

```
# Review

## Critical

(None new. Iter-1's deferred clusters C-2 enum validation, H-2 wider round-trip, H-4 partial cache sweep remain — per scope they're explicitly out.)

## High

### [V4-1] `registerBridgeSystems.ts` uses 10 unsafe `as RegisterAllSystemsArg` casts that defeat all type checking across the registerAllSystems boundary
- **Theme:** correctness, design
- **Where:** `src/game/simulation/bridge/registerBridgeSystems.ts:44-55, 171-180`
- **Finding:** The dep-bag for the bundled 18-system register call is split across 10 ops factories, but the deps interface types each one as bare `object` (lines 44-55) and then casts each spread with `as RegisterAllSystemsArg` (lines 171-180). The cast turns every spread into the full target shape, so TypeScript can no longer verify (a) that `playerQueries`/`aiDecisionOps`/`trebuchetStateOps` etc. actually contain the fields registerAllSystems expects, (b) that the field signatures match, or (c) that a typo in a destructure or factory return value will be caught. This is the load-bearing wiring for every ECS system in the bridge — silent under-provisioning would throw at runtime, not compile time. Concrete proof of the hole below in V4-3.
- **Fix shape:** Replace `object` with the actual factory return types (e.g., `playerQueries: PlayerQueries`) and drop every `as RegisterAllSystemsArg` cast — let TS prove the spread coverage is total.

### [V4-2] `ARCHITECTURE.md` `bridge/` topology is stale by ~30 modules and 14 commits — no Phase-5 module is mentioned, side-map ownership claim is wrong
- **Theme:** docs
- **Where:** `docs/architecture/ARCHITECTURE.md:21-58`
- **Finding:** The doc enumerates 11 bridge modules from before Phase 4 (`pureHelpers`, `visibility`, `trebuchetState`, `fogMemoryOps`, `monkTaskOps`, `technologyOps`, `matchEndOps`, `aiDecisionOps`, `placementOps`, `saveGameOps`, `targetFindingOps`). The actual state has ~45 bridge modules including the entire `bridge/systems/` directory of 18 ECS factories, plus `createWorld.ts`, `wireBridgeOps.ts`, `wirePostSeedOps.ts`, `assembleBridgeApi.ts`, `bridgeState.ts`, `bridgeHelpers.ts`, `bridgeConstants.ts`, `registerAllSystems.ts`, `registerAllSystemsTypes.ts`, `registerBridgeSystems.ts`, `selectionInputOps`, `selectionStateOps`, `selectionFinders`, `unitCommandOps`, `humanInputOps`, `cellPassability`, `visibilityQueries`, `transformOps`, `debugSnapshotOps`, `economyStateOps`, `entityCreateOps`, `entityDestroyOps`, `movementPlanOps`, `combatStateFactory`, `optionsRules`, `playerQueries`, `monkAiSearchHelpers`, `monkTaskAppliers`, `renderStateOps`, `scenarioSeedOps`, `hydrateFromSavedGame`, `trainingMarketOps`, `createWorldResult`, `wireBridgeOpsTypes`. Plus the load-bearing claim "side-map ownership still lives in createWorld" is now wrong: every side map is in `bridgeState.ts:createBridgeState()`, threaded through every factory. The `bridge/systems/` subdirectory isn't named at all.
- **Fix shape:** Rewrite the `bridge/` paragraph to enumerate the new topology (orchestration/state/systems/ops/types tiers); update the "side-map ownership lives in createWorld" sentence to reference `bridgeState.ts`.

### [V4-3] Type signature mismatch on `beginTrebuchetUnpack`/`beginTrebuchetPack` papered over by V4-1 cast
- **Theme:** correctness, design
- **Where:** `src/game/simulation/bridge/registerAllSystemsTypes.ts:105-106` vs `src/game/simulation/bridge/trebuchetState.ts:23,27,53-67` and `src/game/simulation/bridge/systems/playerCommandsSystem.ts:64-65`
- **Finding:** `RegisterAllSystemsDeps` declares `beginTrebuchetUnpack: (id: number) => boolean` and `beginTrebuchetPack: (id: number) => boolean`. The actual implementations in `trebuchetState.ts` return `void`. The consumer `playerCommandsSystem.ts` correctly types them as `void`. This mismatch survives precisely because `registerBridgeSystems.ts:174` casts `(trebuchetStateOps as RegisterAllSystemsArg)` and TS no longer sees the truth. If anyone writes `if (beginTrebuchetUnpack(id))` somewhere assuming `boolean`, the compile passes but the runtime branch never enters. Same hole that V4-1 enables — this is the existence proof.
- **Fix shape:** Change the two declarations in `registerAllSystemsTypes.ts:105-106` to `(id: number) => void` to match reality (after also landing V4-1, TS will catch any future drift).

### [V4-4] `docs/architecture/drift-log.md` last entry claims `createSimulationBridge.ts` at 2,722 lines; actual is 332 — 14 commits of Phase-5 follow-ups are unlogged
- **Theme:** docs
- **Where:** `docs/architecture/drift-log.md:19`
- **Finding:** Line 19 ends with "createSimulationBridge.ts shrinks 4031 → 2722 lines (an additional -32%)." Today's later commits (registerAllSystems bundle `c287ed5`, bridgeState extract `35b16c9`, createWorld move `c9dd6c7`, factory spread + state hoisting `4895062`, wireBridgeOps + assembleBridgeApi extract `2c06143`, hydrateFromSavedGame split `ebd7327`, selectionFinders extract `6e199eb`, monkTaskOps split `031570a`, factory reorder `d4d4540`, registerBridgeSystems extract `adcdef2`, RegisterAllSystemsDeps extract `a1877e4`, wirePostSeedOps revert+restore `9818df8`/`c73649b`/`4cbc1bf`) all touch architecture but no row appended. The reader is left with a ~8x understatement of the shrink and zero record of the Phase-5 architectural events.
- **Fix shape:** Append a Phase-5 follow-up row covering the registerAllSystems bundle, createWorld move, bridgeState extract, wireBridgeOps + assembleBridgeApi + wirePostSeedOps + registerBridgeSystems extracts, with the actual final size (332 LOC).

## Medium

### [V4-5] `docs/devlog/summary.md` head entry is similarly stale — claims `createSimulationBridge.ts ~2722 lines` and lists already-extracted "remaining big chunks"
- **Theme:** docs
- **Where:** `docs/devlog/summary.md:2`
- **Finding:** "createSimulationBridge.ts shrink (Phase 4 + 5) — 19 commits, 7606 → 2722 lines (64% reduction)" understates today's true 7606 → 332 (96%) reduction by 23 commits. The "Remaining big chunks toward sub-1000 target: scenario spawn loop (~570 LOC of inline if (!savedGame) block — depends on dozens of bridge closures and is harder to extract than discrete functions)" claim is wrong — the scenario spawn loop has been extracted to `scenarioSeedOps.ts:seedFreshScenario` and the save-load hydration to `hydrateFromSavedGame.ts`. Future readers grepping summary.md for current state will be misled about what's done.
- **Fix shape:** Replace the entry with a single line stating final 7606 → 332 LOC (96% reduction), the new file count, and a one-sentence note that no chunk over 500 LOC remains in the bridge orchestration files.

### [V4-6] `humanInputOps.issueAction` falls off the end of the switch with no return — implicit `undefined` in a `boolean`-typed function
- **Theme:** correctness, cleanliness
- **Where:** `src/game/simulation/bridge/humanInputOps.ts:240-253`
- **Finding:** The function signature is `issueAction(actionType: ActionType): boolean` but the body is `switch (actionType) { case 'ungarrison': return ungarrisonBuilding(selectedEntityId); }` with no default and no trailing return. Today this works because `ActionType` is exactly `'ungarrison'` and the switch is total, but TS with `noImplicitReturns` would fail; a future addition of any other `ActionType` literal (e.g., `'cancel-construction'`) silently returns `undefined` to a caller that wraps the result in `flushOutOfBandRenderChange()` (`createSimulationBridge.ts:314-318`) — `if (!didIssue)`-style branches see undefined as falsy and proceed correctly, but it's still a contract footgun.
- **Fix shape:** Replace the switch with `if (actionType === 'ungarrison') return ungarrisonBuilding(...); return false;`, or add `default: return false;` to the switch.

### [V4-7] Four `void <param>` markers expose dep-bag fields kept "for parity" that the recipient never uses
- **Theme:** cleanliness
- **Where:** `src/game/simulation/bridge/wirePostSeedOps.ts:146` (`void enqueueRejection`); `src/game/simulation/bridge/registerAllSystems.ts:114-116` (`void isAiMilitaryUnit`); `src/game/simulation/bridge/cellPassability.ts:146-147` (`void unitId; void activeWorld;`)
- **Finding:** All four read as "future-proofing" but in practice they expand the public dep-bag that callers must satisfy without delivering value. `enqueueRejection` flowing into wirePostSeedOps is needed by registerBridgeSystems (which calls it directly), so wirePostSeedOps doesn't need it threaded through. `isAiMilitaryUnit` flowing into registerAllSystems isn't used by any of the 18 systems registered here — only `aiDecisionOps` produces it for `monkOps`. `cellPassability.isCellPassableForUnit` accepts `unitId` and `activeWorld` only to discard them and call `isCellPassableForSpawn` — every caller could call the spawn variant directly.
- **Fix shape:** Drop `enqueueRejection` from `WirePostSeedDeps`, drop `isAiMilitaryUnit` from `RegisterAllSystemsDeps` (kept only in monkOps deps where it belongs), and either inline `isCellPassableForUnit` to `isCellPassableForSpawn` or give it a real per-unit-type implementation.

### [V4-8] `gathererDropOffStuckSinceTick` is not in the save blob — save+load resets the retry throttle for every stuck villager
- **Theme:** correctness, save-load
- **Where:** `src/game/simulation/bridge/saveGameOps.ts:43-80` (no entry for `gathererDropOffStuckSinceTick`); `src/game/simulation/bridge/hydrateFromSavedGame.ts:24-62` (no entry); `src/game/simulation/bridge/systems/villagerEconomySystem.ts:286-322` (consumer)
- **Finding:** The 30-tick drop-off retry throttle (V3-5 fix) keeps a stuck villager from spamming `findNearestDropOffBuilding` + `findBuildingApproachPlan` every tick. The throttle bookkeeping lives in `gathererDropOffStuckSinceTick`; `BridgeState` declares it on line 83 of `bridgeState.ts` but the save/load pair drop it. After load, every previously-stuck villager re-attempts immediately on the next tick instead of inheriting the throttle. Probably acceptable game behavior (load is already a perceived hitch) but it's a quiet save-load determinism leak — replays across save boundaries diverge.
- **Fix shape:** Either add entries to both save and load (mirror the trivial Map-of-numbers shape) and document the round-trip contract, or document explicitly in `saveGameOps.ts` why it's intentionally transient.

### [V4-9] `monkConvertProcessedThisTick.clear()` is buried inside `prototypeMonkBehavior.execute` — invariant tied to per-tick ordering with no comment or test
- **Theme:** design, correctness
- **Where:** `src/game/simulation/bridge/systems/monkBehaviorSystem.ts:96`; `src/game/simulation/bridge/monkTaskAppliers.ts:138-146`
- **Finding:** The per-target single-progress guard relies on `monkConvertProcessedThisTick` being cleared exactly once per tick before any `applyMonkConvert` call. Today this works because all `applyMonkConvert` calls flow through `prototypeMonkBehavior` which `clear()`s at line 96 first. But the guard would silently break (carrying stale "already-processed" entries forever) if a future caller of `applyMonkConvert` ran in any other system phase — there's no comment, no test, and the `Set` is exposed in `BridgeState` for any factory to mutate. `BridgeState.monkConvertProcessedThisTick` is described as a tick-local Set but the boundary contract isn't enforced.
- **Fix shape:** Move the `clear()` to the very start of every tick (a top-of-loop call in `world.step`'s preUpdate phase or a dedicated clearing system) AND add a regression test that verifies a non-Monk-system `applyMonkConvert` path still respects the per-tick guard.

### [V4-10] `playerHasConquestPresence` walks every unit + every building per tick per player — quadratic in player count for postUpdate
- **Theme:** efficiency
- **Where:** `src/game/simulation/bridge/matchEndOps.ts:170-186`; `src/game/simulation/bridge/systems/conquestOutcomeSystem.ts:41-43`
- **Finding:** `playerHasConquestPresence` short-circuits on first match per call (good), but the conquest system invokes it once for the human and once for each enemy each tick (`enemyOwners.every(...)`). With 4 players and 200 entities, worst-case (every player has zero presence) = 800 component reads per tick × 60 TPS = 48k/s. Not a bottleneck today (only 2 players, presence is rare to be zero) but the worst-case grows with map size and lobby size. The civ-engine has `world.queryInRadius` and per-player indices; a `playersWithPresence: Set<number>` side-map maintained by `addUnitEntity`/`addBuildingEntity` and the destroy paths would be O(1) per check.
- **Fix shape:** Maintain a `playersWithPresence` side map updated in entity-create/destroy ops; replace `playerHasConquestPresence(owner)` with a Set lookup.

### [V4-11] `aiSystem.assignAiMonkTasks(owner)` runs every AI decision tick for every owner regardless of whether any owned monk exists
- **Theme:** efficiency
- **Where:** `src/game/simulation/bridge/systems/aiSystem.ts:411`; `src/game/simulation/bridge/monkTaskOps.ts:128-175`
- **Finding:** `assignAiMonkTasks` walks `world.query('unit')` for every active AI on every decision tick (default 60 ticks). For an AI with no Monks, this is pure waste — the loop walks all units, type-checks each, and bails because none match. With 4 enemy AIs × ~250 units it's ~1000 component lookups per AI decision interval per AI, all to no-op.
- **Fix shape:** Either gate `assignAiMonkTasks(owner)` on a precomputed `ownedMonkCount(owner) > 0` (the AI already has `countOwnedUnits`), or maintain an `ownedMonksByOwner` side map.

### [V4-12] Building footprint visibility skipped for resources in fog memory — comment only mentions buildings
- **Theme:** correctness (tail of V3-1)
- **Where:** `src/game/simulation/bridge/systems/fogMemorySystem.ts:69-95`
- **Finding:** The post-V3-1 fix uses `isFootprintVisible` for buildings (line 44). Resources still use anchor-only `visibility.isVisible(humanPlayerId, position.x, position.y)` (line 80). This is correct today because every memorable resource (`tree`, `berry-bush`, `gold-mine`, `stone-mine`) is 1×1, but the comment at line 69 says "static resources" without mentioning the 1×1 assumption that makes anchor-only safe. Future multi-cell resource (e.g., a multi-tile relic shrine) would silently regress.
- **Fix shape:** Either switch to `isFootprintVisible` defensively (footprint dimensions come from `renderable`), or add a sentence/assertion that all `isStaticMemorableResourceType` resources are 1×1.

## Low / Nit

### [V4-13] `wirePostSeedOps.ts:344` exports `BuildingComponent`/`UnitComponent` types only to suppress unused-import lint
- **Theme:** cleanliness
- **Where:** `src/game/simulation/bridge/wirePostSeedOps.ts:343-344`
- **Finding:** Comment "Suppress unused-import lint for type-only re-exports" plus `export type { BuildingComponent, UnitComponent };` is dead surface — neither type is actually consumed externally from this module. The imports themselves on line 14-19 should be deleted instead.
- **Fix shape:** Delete both the imports and the re-export.

### [V4-14] `playerCommandsSystem.ts` clones `unitCommands.entries()` to an array every tick to support concurrent-modification-via-clearUnitCommand
- **Theme:** efficiency
- **Where:** `src/game/simulation/bridge/systems/playerCommandsSystem.ts:144`
- **Finding:** `for (const [id, command] of [...unitCommands.entries()])` allocates a fresh array every tick (per-frame at 60 TPS) just to allow `clearUnitCommand(id)` mid-iteration. Map iteration is safe to delete-during-iterate per spec, so the spread is unnecessary; if a real concern exists it deserves a comment.
- **Fix shape:** Drop the spread (`for (const [id, command] of unitCommands.entries())`) — Map iteration permits delete during iteration.

### [V4-15] `UnitCommand`, `MonkTask`, `TrebuchetPackState` types still imported from `../createSimulationBridge` despite that file being a 332-LOC facade
- **Theme:** cleanliness
- **Where:** `src/game/simulation/bridge/bridgeHelpers.ts:21`, `bridge/hydrateFromSavedGame.ts:11`, `bridge/monkTaskOps.ts:28`, `bridge/trebuchetState.ts:8`, `bridge/unitCommandOps.ts:19`, `bridge/wireBridgeOpsTypes.ts:15`, `bridge/bridgeState.ts:25-29`
- **Finding:** Six bridge modules + `bridgeState` itself import shared types from the facade file rather than from a `bridge/types.ts`. Means the orchestrator carries types its 5-call body doesn't need; circular-ish (bridge child -> orchestrator parent for type only). Cleaner topology is a flat `bridge/sharedTypes.ts` (or extending `bridge/createSimulationBridge.ts`-namespaced types).
- **Fix shape:** Move `UnitCommand`, `MonkTask`, `TrebuchetPackState`, `ConstructionState` from `createSimulationBridge.ts:89-122` into a new `bridge/sharedTypes.ts` and re-export from `createSimulationBridge.ts` for the public `SimulationBridge` consumers.

### [V4-16] `package.json` version is `0.1.0` while AGENTS.md mandates per-shipped-feature bumps + `docs/changelog.md`; neither file appears to track today's 42 bridge-refactor commits
- **Theme:** docs / discipline
- **Where:** `package.json` (`"version": "0.1.0"`); `docs/changelog.md` does not exist (verified `ls docs/`)
- **Finding:** AGENTS.md "Versioning" section: "Maintain a version number a.b.c ... Whenever you introduce a non-breaking change, bump c." Today's 42 bridge refactor commits are non-breaking (move-only) but the version is still 0.1.0 and no `docs/changelog.md` file exists. Either the doctrine doesn't fit a still-prototyping repo (and AGENTS.md should be relaxed), or these are 42 missed bumps. Only flag because the user prompt asks for doctrine drift.
- **Fix shape:** Reconcile — either land a `docs/changelog.md` with one entry per major refactor checkpoint and bump to ~0.1.42, or amend AGENTS.md to scope versioning to behavior-changing commits only.

### [V4-17] `aiSystem.findIdleProducer` returns first match (V3-24 carry-forward) — multi-base AI never trains at second producer until first fills
- **Theme:** game design (carry-forward of iter-3 V3-24)
- **Where:** `src/game/simulation/bridge/aiDecisionOps.ts:162-179`
- **Finding:** Iter-3 flagged this; carries forward unchanged. Worth noting it survived the Phase-5 split intact — not a refactor leak, an outstanding behavior gap.

### [V4-18] `assembleBridgeApi.ts:67` trailing blank line; multiple bridge files end with a trailing newline + empty line — formatting inconsistency
- **Theme:** cleanliness
- **Where:** `src/game/simulation/bridge/assembleBridgeApi.ts:67-68`, `src/game/simulation/bridge/registerAllSystemsTypes.ts:235-236`, `src/game/simulation/bridge/wirePostSeedOps.ts:343-345`
- **Finding:** Tiny EOF formatting drift. Not worth fixing on its own; flag as nit if a sweep happens.

## Verified-not-bugs

- **System registration order in `registerAllSystems.ts`** — All 18 systems use explicit `after`/`before` deps so registration order doesn't drive execution order. Verified the bundle covers exactly the 18 prototypeXxx systems present pre-extraction (`Ai`, `AutoAggression`, `PlayerCommands`, `MonkBehavior`, `RelicGold`, `ProductionQueues`, `ScoutMovement`, `VillagerEconomy`, `WildlifeCombat`, `HerdableOwnership`, `HerdableMovement`, `Visibility`, `FogMemory`, `TowerCombat`, `WonderCountdown`, `RelicCountdown`, `WinConditionResolver`, `ConquestOutcome`).

- **`wirePostSeedOps` revert + restore (`9818df8` → `c73649b` → `4cbc1bf`)** — `git diff 9818df8 4cbc1bf -- src/game/simulation/bridge/wirePostSeedOps.ts` returns empty; the restore is byte-identical to the original extraction. The earlier revert was a vitest concurrency flake, as the restore commit message documents.

- **Closure-captured `unitCommandOps.issueUnitMoveCommand` in `wirePostSeedOps.ts:284`** — TDZ-safe because the arrow body is invoked after `unitCommandOps` is initialized later in the same module (line 301). Lexical lookup at invocation time, not at arrow-definition time. Works by design.

- **V3-1 fog-memory anchor-only** — Fixed in `fogMemorySystem.ts:42-54` (uses `isFootprintVisible`).

- **V3-2 click-selection hit-test anchor-only** — Fixed in `selectionInputOps.ts:153-170` (uses `isEntityFootprintVisibleToHuman`).

- **V3-3 FU2 unit double-click whitelist** — Fixed in `GameScene.ts:990-1034` via `ALL_UNIT_TYPES satisfies Record<UnitType, true>`. Adding a new UnitType in `types.ts` is now a TypeScript error here.

- **V3-7 Monk conversion vision/LOS interrupt** — Fixed in `monkTaskAppliers.ts:127-132`. Out-of-vision returns without incrementing progress; existing convert state preserved.

- **V3-9 `wonder` displayName** — `displayNames.ts` now has `case 'wonder'` in 4 lookups (line 98, 231, 514, 573).

- **V3-11 HUD `destroy()`** — Implemented in `createHudController.ts:461-471` (cancels RAF, removes window listeners, walks teardown stack, gates re-entrance per the iter-3 follow-up at line 375-378).

- **V3-12 mutual annihilation = draw** — Implemented in `conquestOutcomeSystem.ts:45-51`. Computes both predicates first, then chooses outcome.

- **V3-13 forest-cluster collision with FORWARD_ENEMY_HOUSE_POSITION** — Fixed in `applyStandardPlayerOpening.ts:263, 311-315` via `reservedCells` predicate threaded through `cellBlockedByScenarioEntity`.

- **V3-14 UTF-16 surrogate-pair seed hash collision** — Fixed in `sharedTerrainHelpers.ts:28-31` (`character.codePointAt(0) ?? 0`).

- **V3-16 `applyShoreFishPatchesProcedural` byte-for-byte duplicate** — Fixed in `applyStandardPlayerOpening.ts:151` via `export const applyShoreFishPatchesProcedural = applyShoreFishPatches;`.

- **Save/load coverage of `BridgeState`** — Verified: every persistent BridgeState field is in both `saveGameOps.ts` write and `hydrateFromSavedGame.ts` read except (a) `movePathCache` (transient), (b) `monkConvertProcessedThisTick` (per-tick clear), (c) `inFlightTechByOwner` (rebuilt from `productionQueues` on load — `hydrateFromSavedGame.ts:236-244`), and (d) `gathererDropOffStuckSinceTick` (flagged in V4-8 above).

- **Iter-1 H-3 garrison cross-reference** — Still enforced in `hydrateFromSavedGame.ts:200-218`; iter-3 V3-8 orphan-key prune extended in `hydrateFromSavedGame.ts:298-323`.

- **Iter-3 V3-6 inFlightTech rebuild on load** — Implemented in `hydrateFromSavedGame.ts:236-244`.

## Notes on today's bridge refactor

The 42-commit shrink (7,606 → 332 LOC, 96%) is impressively coherent. The mechanical hygiene is good: every extracted module has a typed deps interface, every consumer uses destructure, no closure capture leaks across moves, the `BridgeState` consolidation is clean, and the system registration order matches the original byte-for-byte (and is now driven entirely by `after`/`before` deps so the bundle is order-insensitive).

But the refactor exposed one architectural smell that's now load-bearing: the 10 `as RegisterAllSystemsArg` casts in `registerBridgeSystems.ts` (V4-1) trade compile-time safety for spread ergonomics. The trebuchet pack/unpack `void` vs `boolean` mismatch (V4-3) is the existence proof that this hole is real, not theoretical. Land V4-1 first; let it surface other latent type drifts like V4-3.

Doc drift is the largest unaddressed liability: ARCHITECTURE.md (V4-2) and drift-log (V4-4) both reflect a pre-Phase-5 world. Devlog summary (V4-5) understates the shrink by 8x and lists already-extracted "remaining work". A 30-minute refresh closes all three.

The wirePostSeedOps revert + restore was clean — byte-identical to the original extraction, no subtle drift introduced.

Net assessment: the shrink itself is safe. The risk concentrated in the ten `as RegisterAllSystemsArg` casts and the doc drift, both addressable in a single follow-up sprint without re-touching any of the 42 commits.
```

Caveman summary: 18 V4 findings — 4 high (cast hole + 3 doc drifts), 8 medium, 6 low/nit. Refactor structurally safe. Type-cast hole hides 1 real signature mismatch (V4-3 trebuchet pack/unpack). All 9 verified iter-3 priority items confirmed fixed.
