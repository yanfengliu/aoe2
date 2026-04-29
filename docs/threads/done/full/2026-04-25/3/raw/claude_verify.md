Verification complete. Writing report.

# Verification — iter-3 batch fixes against `docs/reviews/full/2026-04-25/3/REVIEW.md`

## Per-commit verdicts

### `16a098e` `[V3-1 + V3-2]` Footprint visibility for fog memory + click selection

- **V3-1**: lands on `src/game/simulation/bridge/fogMemoryOps.ts:65-83` (read-side) AND `src/game/simulation/createSimulationBridge.ts:~6034` (prototypeFogMemory write side). Both replace anchor `isVisible` with `isFootprintVisible` / `isFootprintExplored`. New helper `isFootprintExplored` added at `pureHelpers.ts:430-448` mirrors `isFootprintVisible`.
- **V3-2**: lands at `createSimulationBridge.ts:2740-2755`. Routes building hit-test through existing `isEntityFootprintVisibleToHuman`. `renderable` component added to the require-list — building skipped when no renderable; safe because every building should have one.
- **Test**: `tests/simulation/footprintVisibilityConsistency.test.ts` covers all three contracts (live render, fog memory write, click select). Strong: asserts `isMemory` flag transitions, anchor preserved at `(15, 13)`, sanity-check empty cell. Fixture `fog-memory-castle-edge-fixture` correctly engineered (radius-4 scout sees `(18, 16)` corner only).
- **Verdict**: **OK**.

### `d535741` `[V3-3 + V3-9]` FU2 units in double-click whitelist + Wonder display name

- **V3-3**: `GameScene.ts:1132-1176`. `isUnitType` rewritten as `entityType !== null && entityType in ALL_UNIT_TYPES`. `ALL_UNIT_TYPES` is `as const satisfies Record<UnitType, true>` — TS will fail compile if a new `UnitType` literal is added without a corresponding key. Counted vs `types.ts:3-40`: 34 entries match exactly (all FU2 + FU3 covered). Minor: `entityType in ALL_UNIT_TYPES` would inherit `Object.prototype` keys (`'toString'` etc.) but `SelectionState['selectedEntityType']` union doesn't include those — no real-world hole.
- **V3-9**: `displayNames.ts:98-99` (singular) + `:231-232` (plural). Both return "Wonder" / "Wonders".
- **Tests**: no new regression test added for either — small caveat. Existing browser/select tests don't exercise FU2 same-type expansion or wonder selection rendering. The TS `satisfies` clause guards V3-3 going forward; V3-9 is a one-line literal.
- **Verdict**: **OK with caveats**: no V3-3 / V3-9 runtime regression test; relies on TS exhaustiveness for V3-3 to stay healthy.

### `ce41e06` `[V3-12]` Mutual annihilation = draw

- Lands at `createSimulationBridge.ts:6385-6407`. Computes `humanAlive` and `allEnemiesEliminated` BEFORE branching, then chooses `draw` / `defeat` / `victory`. `MatchState.outcome` widened in `types.ts:458`, `saveSchema.ts:227`, `matchEndOps.ts:65,122`.
- `isMatchRunning` (`createSimulationBridge.ts:2113-2115`) checks only `=== 'running'` so 'draw' correctly halts ticks via `bridge.step` early return at `:7386`.
- HUD: `postGameSummary.ts:80` uses `outcome !== 'running'` so draw renders summary card. ✓
- **Test**: no new regression test for this behavior. Caveat — pre-fix bug was a literal three-line ordering swap, the new test would be a 1×1 mutual-suicide fixture.
- **Verdict**: **OK with caveats**: no regression test for the draw outcome.

### `77b9a7e` `[V3-13]` Default map: forest cluster cannot occupy forward-house anchor

- `defaultMap.ts:25-32` passes `[FORWARD_ENEMY_HOUSE_POSITION, FORWARD_ENEMY_SCOUT_POSITION, ...DEFAULT_RELIC_POSITIONS]` to `applyStandardPlayerOpeningProcedural`. Predicate updated at `applyStandardPlayerOpening.ts:311-315`.
- **Defect (caveat)**: house at `(39, 18)` is **2×2** (`buildingFootprints.ts:13`); occupies cells `(39,18), (40,18), (39,19), (40,19)`. Only `(39, 18)` anchor is reserved. If the cluster walker reaches `(40, 18)` / `(39, 19)` / `(40, 19)`, validator throws. Test only asserts `(39, 18)` empty plus implicit `expect(() => createSimulationBridge(seed)).not.toThrow()` — across 10 seeds this passes today, but the reservation is anchor-only and NOT footprint-aware.
- **Verdict**: **OK with caveats**: reserved cells are anchor-only; house/relic footprint cells beyond anchor are not explicitly blocked. The 10-seed corpus implicitly catches violations via no-throw, but a future change to cluster ring extents could regress without test signal.

### `abecfb5` `[V3-14 + V3-15 + V3-16 + V3-22]`

- **V3-14**: `sharedTerrainHelpers.ts:28-30`. `for...of` already iterates code points; replacing `charCodeAt(0)` with `codePointAt(0) ?? 0` gives full-codepoint hashing. Correct.
- **V3-15**: Watch Tower Blacksmith gate dropped at both `createSimulationBridge.ts:4326` (placement options) and `:4607` (AI defensive response). Both sites now Feudal-only. ✓
- **V3-16**: `applyShoreFishPatchesProcedural` aliased to `applyShoreFishPatches` (`applyStandardPlayerOpening.ts:151`). Caller in `defaultMap.ts:66` still uses the alias name. ✓
- **V3-22**: `createApp.ts:25-30`. `rawSeed` distinguishes `null` (absent) vs `''` (empty). Empty trips a `console.warn`. ✓
- **Tests**: none added for V3-14/V3-15/V3-22; V3-16 covered by static `===` of the function reference (no behavior change).
- **Verdict**: **OK** — V3-14 / V3-22 are minor enough that no test is required; V3-15 game-design behavior should ideally be tested but this matches review intent.

### `eb8f401` `[V3-7]` Monk conversion vision/LOS gate

- `monkTaskOps.ts:367-373`. After "target valid?" check, before "per-tick processed?" guard, vision check uses `isVisibleToOwner(monkUnit.owner, targetPosition.x, targetPosition.y)` (already in deps at line 84). Returns early WITHOUT mutating `conversionState` — preserves in-flight progress. Correct ordering.
- **Test**: no dedicated regression test for mid-conversion vision interrupt. Existing `monk-fog-fixture` (line 448 of `tests/simulation/monastery.test.ts`) covers right-click on fog-hidden cell, NOT mid-conversion vision loss.
- **Verdict**: **OK with caveats**: missing regression test for the new mid-conversion vision-loss interrupt path.

### `66d1d01` `[V3-20 + V3-21 + V3-23]` Build hardening + F2 input guard

- **V3-20**: `scripts/content-lib.mjs:18-25`. `min > max` throws with the offending range. ✓
- **V3-21**: `scripts/content-lib.mjs:202-210`. Post-loop `if (inQuotes)` throws. ✓
- **V3-23**: `debugOverlay.ts:79-91`. F2 ignored when `target` is `HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | contenteditable`. Correctly placed AFTER `event.defaultPrevented` short-circuit, BEFORE `cycleMode`. ✓
- **Tests**: none added. Build-hardening throws are easy to test with parser invocation; arguably a small caveat.
- **Verdict**: **OK with caveats**: no parser-error tests for V3-20/V3-21.

### `aa795bb` `[V3-11 + V3-17]` HUD destroy() + browserTestApi sync parity

- **V3-11**: `createHudController.ts:202-475`. `teardownCallbacks` array, LIFO walk, RAF cancel, listener removal, `debugOverlayController.destroy()` forwarded. `try/catch` around each callback so one failure doesn't block siblings.
- **Defect (minor)**: `update()` at `:372-443` does NOT check `isDestroyed` before scheduling next RAF. If `destroy()` is called *during* an `update()` execution (re-entrant), the function still schedules a fresh RAF after destroy returns — then destroy's `cancelAnimationFrame` already ran on the prior handle. Result: a zombie RAF tick after destroy. In practice destroy is only called externally between RAF firings, so this is a narrow edge case — but a one-line `if (isDestroyed) return;` at the top of `update()` would be free defensive coverage.
- **V3-17**: `browserTestApi.ts:153-162`. `getPlacementPreviewAt` now calls `scene.syncFromBridge(true)` for parity. ✓
- **Test**: no destroy()/sync regression test added.
- **Verdict**: **OK with caveats**: `update()` should also guard on `isDestroyed` for the re-entrant edge case; no regression test for the new destroy hook.

### `e82f010` `[V3-5 + V3-6]` H2-2 retry throttle + H2-1 cost dedupe O(1)

- **V3-5**: `createSimulationBridge.ts:5790-5864`. Throttle interval `GATHER_DROPOFF_RETRY_INTERVAL = 30` ticks. Stuck marker cleared on path-open, drop-off success, `clearGathererOrder`, unit destroy. Correct.
- **Defect (minor / cosmetic)**: at `:5829-5833` the `if (stuckSince === undefined) { ... } else { ... }` branches both write the SAME `gathererDropOffStuckSinceTick.set(id, activeWorld.tick)` — the conditional is dead code. Should simplify to a single set call. Behavior is correct, just unclean.
- **V3-6**: `createSimulationBridge.ts:3506` (lookup), `:3533` (add on enqueue), `:5579` (delete on dequeue), `:1990-2003` (rebuild on save-load). Lookup is O(1) via `inFlightTechByOwner`.
- **Defect (real)**: `destroyBuildingEntity` at `createSimulationBridge.ts:3222` does `productionQueues.delete(id)` but does NOT walk the queue and clean `inFlightTechByOwner` for any in-flight `kind === 'technology'` entries. Scenario: player queues Fletching at Blacksmith A → enemy razes Blacksmith A → `inFlightTechByOwner` still contains 'fletching' → player builds Blacksmith B → `enqueueResearch` rejects forever. The H2-1 fix made `applyTechnology` idempotent, but the cost-dedupe path's marker is never cleaned on building loss. `getResearchOptions` `hasTechnology` gate doesn't help — the tech is still marked in-flight, never resolved.
- **Test**: no test for building-destruction-during-research scenario.
- **Verdict**: **NEEDS CHANGE**: clean `inFlightTechByOwner` entries when destroying a building whose queue contains a `'technology'` entry. Add iteration over `productionQueues.get(id)` in `destroyBuildingEntity` before the `productionQueues.delete(id)` call. Plus dead-code simplify the V3-5 if/else.

### `09c403c` `[V3-24]` AI findIdleProducer load-balanced

- `aiDecisionOps.ts:162-191`. Iterates owned producers, picks lowest `queueLength` (ties broken by lowest entity id for determinism). `bestId !== null` guard in the tie-break is technically redundant (first match always wins via `Infinity` initial comparison) but harmless.
- Skips construction-incomplete producers and full queues (`>= 2`). Correct.
- **Test**: no new test for multi-base load-balance behavior.
- **Verdict**: **OK** — small caveat for missing regression test.

### `011fa2e` `[V3-8]` Save-load entity-id key validation

- `createSimulationBridge.ts:2056-2086`. `pruneOrphanEntityKeys` helper iterates 17 side maps post-load, drops keys not resolvable via `world.getEntityRef`.
- Coverage: `unitCommands, sheepMoveOrders, rallyPoints, monkTasks, conversionState, monkCarriedRelic, monkHealCounters, relicsInMonastery, wonderCountdowns, trebuchetPackStates, productionQueues, constructionStates, combatStates, buildingHealthStates, buildingCombatStates, wildlifeStates, garrisonedUnitVisionSources` — matches review's listed maps. `relicCountdowns`, `aiStates` keyed by player id (not entity id) so correctly excluded.
- **Test**: no test for orphan-key pruning. Covered indirectly by save-load round-trip tests not failing.
- **Verdict**: **OK** — caveat for missing direct test of the new prune behavior.

### `436d332` `[V3-25]` browserTestApi install once + dynamic bridge resolution

- `browserTestApi.ts:120-241`. `getBridge: () => BrowserTestBridge` thunk. Early-return on existing `target.__AOE2_TEST__`. `Object.freeze(api)` on assignment.
- All getters / mutators that touch the bridge use `getBridge()` per call. Confirmed: `getHudState/RenderState/EconomyState/SelectionState/PlacementPreviewAt`, all `select*`, `confirmBuildingPlacement`, `clearSelection`, `issueContextCommand`, `issueMoveCommand`, `getSnapshot`. ✓
- `advanceTicks` captures `liveBridge` once via `getBridge()` before the loop — fine because the bridge cell can't swap mid-loop (sync).
- `createApp.ts:95` passes `() => bridge` thunk; `handleLoadGame` only updates the cell, no re-install.
- **Verdict**: **OK**.

### `724beba` `[V3-18 + V3-19 / iter-1 H-4]` renderFog memo + getRenderState per-tick cache

- **V3-18**: `worldLayers.ts:171-199`. `lastRenderedFrame` reference equality. `fogLayer.clear()` moved INTO `renderFog` (only on change). `GameScene.ts:494-498` removed `this.fogLayer.clear()` from sync path. ✓
- **V3-19**: `createSimulationBridge.ts:7352-7515`. Cache key `(tick, renderStoreVersion, fogMemorySize)`. `renderStoreVersion` bumped on `flushOutOfBandRenderChange` (which the bridge calls at `step` start AND at every `getRenderState`). Cache populated for all three return paths (no-fog-memory fast path, no-memory-after-dedupe path, merged path).
- Soundness: `frame` reference inside cached `value` is stable per tick (renderStore.getFrame() returns stable per-tick). When V3-19 cache is hit, V3-18 sees same frame ref → skip. When V3-19 cache misses (tick advance / out-of-band), new `value` with new `frame` ref → V3-18 re-renders. Coupling correct.
- Fog-memory-size as a freshness proxy: memory entries don't change in a way that affects projection without size also changing (memory is write-once-per-tick, entries are stable references with `isMemory` derived purely from the cache-keyed visibility state). ✓
- **Verdict**: **OK**.

---

## Out-of-scope follow-ups

- **V3-6 cleanup on building destroy** (HIGH): not mentioned in REVIEW.md but introduced by THIS branch. `destroyBuildingEntity` must walk the destroyed building's queue and `inFlightTechByOwner.get(owner)?.delete(tech)` for each `kind === 'technology'` entry, otherwise the cost-dedupe marker leaks permanently and the player can't re-research the tech anywhere. See verdict above.
- **V3-13 reservation completeness**: house anchor reserved but the other 3 cells of the 2×2 footprint are not. Today's seed corpus implicitly catches via no-throw. Future-proofing wants `reservedCells` expanded to full footprints (loop over `width × height` per landmark) or a separate "reserved building footprints" predicate.
- **V3-11 update() guard**: minor — add `if (isDestroyed) return;` at top of `update()` for re-entrant safety.
- **V3-26 stale comment** (REVIEW.md item not addressed by this batch): `createSimulationBridge.ts:620` "HUD via getHudState()" comment still present. Not in any commit subject — confirmed left for a future sweep per "address all remaining concerns" being broad but not exhaustive.

## Summary line

12 commits substantive, 2 docs/meta out of scope. Most fixes land cleanly. **One real defect (V3-6 building-destroy cleanup) → NEEDS CHANGE.** Several caveats around missing regression tests (V3-3/V3-9/V3-12/V3-7/V3-23/V3-24/V3-8) and one cosmetic dead-if/else in V3-5.
