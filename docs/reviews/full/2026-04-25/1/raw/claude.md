I have enough verified material to compile the final review. Writing it now.

---

# Senior Code Review — `aoe2` prototype (full repo)

**Scope:** ~47 kLOC of TypeScript, 26 simulation modules, 11 bridge ops, GameScene + 4 sub-renderers, 9 HUD modules, 47 vitest specs, 8 Playwright specs. I read the architecture/devlog/engine-feedback docs first, then sampled the bridge in three slices (lines 1–7333), the `bridge/` ops (11 files), `prototypeScenario.ts`, `mapGeneration/`, fixtures, save schema, GameScene, and HUD. I verified the most consequential agent-discovered claims against the source before listing them; several claims were rejected (see "Verified-not-bugs" section).

Severity scale: critical | high | medium | low | nit

---

## Critical

**[C-1] Monk conversion flip-flop wipes progress when two enemy Monks share a target**
- Theme: correctness
- Where: `src/game/simulation/bridge/monkTaskOps.ts:360-376`
- Finding: With Monks from different owners both targeting unit X in the same tick, the `state.byOwner !== monkUnit.owner` branch resets `state.progress = 0` for whichever Monk processes second, *before* the per-tick guard returns. The net result across all ticks both Monks remain in range is **zero progress for either side**, even though a single Monk would have completed the conversion. Worse than the documented "first writer wins" intent. The reset must be gated by the per-tick guard, or by a priority/deterministic-tiebreak rule between owners.

**[C-2] Save-blob sideMaps cast typed-string fields without runtime validation**
- Theme: correctness / design
- Where: `src/game/simulation/createSimulationBridge.ts:1789, 1795, 1902, 1909, 1930, 1932, 1955`
- Finding: The load path uses `as AgeType`, `as ResearchableTechnologyType`, `as TrainableUnitType`, `as MemoryEntry['entityType'/'visualVariant']`, `as AiPlan` directly on values that came out of `JSON.parse`. There is no schema check. A hand-edited save (or a save written by a future schema variant that gets re-loaded by an older build, or any blob that diverges from the in-memory enum) will silently install invalid enum strings into the side maps, producing cascading downstream crashes that are very hard to attribute to the loader. The schema doc itself (`saveSchema.ts:5`) calls cross-version migration unsupported, but the loader still doesn't reject malformed blobs.

---

## High

**[H-1] `garrisonedUnitToBuilding` / `garrisonedByBuilding` may desync on a load with cross-referenced ids**
- Theme: correctness
- Where: `src/game/simulation/createSimulationBridge.ts:1915-1923`
- Finding: The two side maps are loaded independently (`for (const [id, list] …)` and `for (const [id, buildingId] …)`). If a tampered or incomplete blob has an id present in one map but not the other, the bridge boots in an inconsistent state — `ungarrisonBuilding` will silently drop the orphan, `destroyUnitEntity` will not find a building to clean up, and the saved garrison vision sources may live on forever. Add an integrity check after hydration that the two maps mirror each other.

**[H-2] No save/load round-trip coverage for the side maps that *only* exist on the side**
- Theme: tests
- Where: `tests/simulation/saveLoad.test.ts:12-50` (snapshot helper) and the rest of the file
- Finding: `captureSnapshot` only checks tick, ages, resources, population, sorted unit/building ids, match outcome, win condition, and the two countdowns. It does **not** assert any of: `garrisonedByBuilding`, `garrisonedUnitVisionSources`, `monkTasks`, `monkCarriedRelic`, `conversionState`, `productionQueues`, `constructionStates`, `combatStates`, `wildlifeStates`, `trebuchetPackStates`, `aiStates`. Schema drift in any of these fields (which this very review identified is easy to introduce — see C-2) would land green even though gameplay would diverge. Add fixture-driven cases that mid-flight Monks, mid-construction buildings, garrisoned units, queued production, and packing Trebuchets all survive the round-trip exactly.

**[H-3] `getRenderState()` walks every entity each call to filter memory ghosts**
- Theme: design / cleanliness
- Where: `src/game/simulation/createSimulationBridge.ts:7187-7220` (visible loop continues past 7220)
- Finding: `flushOutOfBandRenderChange()` then a full `liveEntities = liveEntitiesRaw.filter(...)` runs on every HUD/scene/test consumer call (HUD, scene, browser test API, debug snapshot). `installBrowserTestApi` already calls `bridge.getRenderState()` from many seams (`hud.ts`, `getSnapshot`), so each test snapshot triggers the scan. Cache the projected list per-tick (the tick counter already gates re-projection elsewhere) or expose a separate `getMemoryEntities()` lazy hook so the 80%-case (no memory entries needed) skips the full scan.

**[H-4] AI villager rebalance dead branch when total villagers is zero**
- Theme: correctness
- Where: `src/game/simulation/bridge/aiDecisionOps.ts:214-262`
- Finding: When the AI has zero villagers (early game wipe / villager kill-streak scenario), `worstRatio` and `bestRatio` never receive a finite value, the `bestRatio - worstRatio > 0.01` guard never fires, and `bestKind`/`worstKind` stay null. The rebalance silently does nothing, which means the AI cannot recover from a temporary villager wipe via redistribution. Worth a defensive zero-villager early return, or an explicit "training-only" branch.

**[H-5] `placementMode` cleared inconsistently**
- Theme: correctness
- Where: `src/game/simulation/createSimulationBridge.ts:6614, 6644, 6659` and `bridge/placementOps.ts:174`
- Finding: `placementMode.current = null` is sprinkled at the top of `issueMoveCommand`, `issueContextCommand` (both branches), and on successful `confirmBuildingPlacement`. There is no central "any non-placement player action clears placement" hook, and not every player action path clears it: e.g., `selectEntityById`/`selectEntityAtCell`/`selectUnitsByIds` do clear it (`createSimulationBridge.ts:6593`-ish, etc.) but the action surfaces are duplicated across many call sites. A centralized `clearPlacementOnPlayerAction()` helper would prevent a future regression where one path forgets the clear.

**[H-6] Many event listeners on `window` and the canvas have no symmetric cleanup**
- Theme: cleanliness / correctness
- Where: `src/ui/hud/debugOverlay.ts` (F2 keydown listener), `src/ui/hud/createHudController.ts:424` (recursive `requestAnimationFrame` with no cancel), `src/ui/hud/saveLoadPanel.ts` (button listeners; not visible in the slice I read)
- Finding: The F2 keydown handler is attached at HUD construction with no removeEventListener exposed in the returned API, and the per-frame `requestAnimationFrame(update)` runs forever — including after the match ends, including during paste-load (where a fresh bridge swaps in). For the single-tab production case this just wastes CPU after victory; for hot-reload during development it leaks. Consider returning a `destroy()` from `createHudController` that the test harness/HMR can call.

---

## Medium

**[M-1] `prototypeAutoAggression` and target-finding helpers do not enforce true LOS, only Manhattan radius**
- Theme: design / correctness
- Where: `src/game/simulation/bridge/targetFindingOps.ts:408-486`
- Finding: The "personal-LOS variant" helpers (`findPreferredEnemyUnitInRadius`, `findPreferredEnemyBuildingInRadius`) only check Manhattan distance — there is no actual LOS or visibility check. The doc comment (~line 97-117) implies "personal sight radius", but a unit standing on the other side of a 4×4 Castle still aggros a target on the far side at radius+0 because terrain/blockers don't break the visibility cone. Defensible as v1 simplification, but the comment overpromises. Either rename the helpers or add an actual visibility check via `world.queryInRadius` + `visibility.isVisible` parity with their `findPreferredVisibleEnemy*` siblings.

**[M-2] `currentRelicHoldingOwner` collides with countdown lifecycle in two-player races**
- Theme: correctness
- Where: `src/game/simulation/bridge/matchEndOps.ts:161-202`
- Finding: The function returns `null` whenever any relic is on the map or in flight. That is correct for "ambiguous" cases, but the *consumers* (the per-tick relic-countdown system, in the parts I read) start a countdown the first tick `currentRelicHoldingOwner !== null`. If a player picks up the last neutral relic mid-countdown, the countdown is canceled, then must restart from full. That cancellation is the spec, but ensure the test suite locks it (saw no test in `tests/simulation/winConditions.test.ts` covering "an enemy Monk grabs a free relic mid-countdown").

**[M-3] `monkCarriedRelic` is loaded without verifying the relic id still resolves**
- Theme: correctness
- Where: `src/game/simulation/createSimulationBridge.ts:1844-1846`
- Finding: Unlike `townCenterRefs` / `unitCommands` / `monkTasks` / `wildlifeStates` (all guarded by `refFromSerialized` with an explicit generation check), the `monkCarriedRelic` load loop just pushes raw relic ids in. If the saved relic entity was destroyed in the same tick the save was taken (via Monastery deposit), the loader still records a phantom relic carrier and the `prototypeMonkBehavior` follow loop (line 5335-5349) deletes the entry harmlessly — but `findNearestVisibleNeutralRelic` will skip the same id forever (line 271), and the wonder/relic countdown could deadlock if the phantom was the last "carried" relic. Add a `world.getEntityRef` validation at load time.

**[M-4] `playerHasConquestPresence` walks every unit and every building each call**
- Theme: design / cleanliness
- Where: `src/game/simulation/bridge/matchEndOps.ts:204-220`
- Finding: Two full ECS queries per call. This is invoked from the win-condition resolver every tick. For a 100-villager / 50-building game late, that's a 150-entity scan per player per tick. Replace with an incremental count (incremented on `addUnitEntity`/`addBuildingEntity`, decremented on `destroyUnitEntity`/`destroyBuildingEntity`) keyed by owner; you already maintain `population.current` and could piggy-back the same hooks.

**[M-5] HUD selection signature uses `JSON.stringify(selectionState)` per frame**
- Theme: cleanliness / performance
- Where: `src/ui/hud/selectionPanel.ts:332`
- Finding: The full selection state — including `buildOptions`, `actionOptions`, `marketOptions`, `visibleResearchOptions`, `trainOptions`, queue entries — is JSON-stringified each RAF tick to detect change. For a selected Town Center with a 10-entry queue, this is a non-trivial allocation. A stable `state.signature` exposed by the bridge (or even a tick + selectedEntityId composite key) would avoid the per-frame allocation.

**[M-6] `saveLoadPanel` reads `localStorage` without quota / private-mode handling**
- Theme: correctness
- Where: `src/ui/hud/saveLoadPanel.ts` (loader/saver path; slice not read fully but the `setItem` failure path is generic)
- Finding: A 60×36 map with 100+ units serializes to a multi-MB JSON; private-browsing Safari rejects all `setItem`. The current toast simply says "Save failed (storage unavailable)". Consider distinguishing `QuotaExceededError` (offer to download instead) from "storage unavailable" (private mode), and clamp save size — the `lastSeenStatic` map can grow unbounded for long sessions.

**[M-7] `displayNames.ts` and `GameScene.isUnitType` unit-type lists are duplicated and unsynchronized**
- Theme: cleanliness / correctness
- Where: `src/phaser/scenes/GameScene.ts:1128-1160` and `src/ui/hud/displayNames.ts` (full file)
- Finding: `isUnitType` is a long `||`-chain of unit-type literals used to gate same-type double-click selection. Adding a new unit (say, a future Plumed Archer) requires editing both the long chain in GameScene and the corresponding entry in displayNames; missing the GameScene chain silently disables double-click select-by-type for that unit. Replace with a `UnitType` exhaustiveness check (e.g., `isUnitType(t): t is UnitType` driven by a single source of truth — the `UnitType` union or an enumeration array).

**[M-8] AI villager attack-group iteration order depends on ECS query order**
- Theme: correctness / determinism
- Where: `src/game/simulation/createSimulationBridge.ts:4739-4746` area (per agent finding) and `findOwnedMilitaryUnits` in `bridge/aiDecisionOps.ts`
- Finding: `state.attackGroup` is populated from a `world.query('unit')` walk; the engine's iteration order is not documented as stable across save/load cycles. Determinism contract (ARCHITECTURE.md:82-88) is "fixed-step ticks are the only sources of state change", but AI commands derived from query order could re-order on rehydrate. Verify that `world.serialize`/`deserialize` preserves entity creation order, otherwise pre-sort the ECS query results by id at every consumption site.

**[M-9] `selectionActivity` allocates `new Map` per `getSelectionActivityBreakdown` call**
- Theme: cleanliness
- Where: `src/game/simulation/selectionActivity.ts:196` (per agent)
- Finding: HUD selection panel calls this once per RAF tick when selection changes. Trivial GC pressure unless there's a long combat where the player keeps a 50-unit selection active. Could be a reusable scratch map, but verify before touching — premature optimization risk.

**[M-10] `HUD tooltips.ts` positioning ignores `window.scrollX/Y`**
- Theme: correctness (low impact in practice)
- Where: `src/ui/hud/tooltips.ts:110-124` (per agent)
- Finding: `getBoundingClientRect()` is viewport-relative; setting `tooltip.style.left/top` directly with the viewport coordinates means a scrolled HUD (e.g., during dev when devtools is docked at the bottom) misplaces the tooltip. Low impact because the prototype's HUD root is not normally scrolled, but worth a one-line fix when next touched.

**[M-11] Tests assert hardcoded fixture cell coordinates that are coupled to map-gen drift**
- Theme: tests
- Where: `tests/simulation/createSimulationBridge.combat.test.ts:48-49,63-64,75-76`; `tests/simulation/sheepVision.test.ts:48,82-83`
- Finding: Tests look for `building.x === 10 && building.y === 8` (combat) and `findSheepAtCell(bridge, 22, 10)` (vision). The 2026-04-23 devlog explicitly notes that two tests had to be re-anchored after the procedural map switch — these uses repeat the same risk. Re-anchor by querying for the entity by type/owner first, then asserting position is equal to its initial position.

**[M-12] `aiPlayer.test.ts` "ages up through the ages" lacks an assertion on early termination**
- Theme: tests
- Where: `tests/simulation/aiPlayer.test.ts:107-141` (per agent)
- Finding: 8000-tick budget with a `break` on age advancement. If the AI never advances, the loop simply exits silently without telling the test runner that the desired transition was not reached. Add `expect(reachedCastleAge, 'AI failed to advance to Castle Age in 8000 ticks').toBe(true)`.

---

## Low / Nit

**[L-1] `applyForestPatch` calls `setTerrainKind` before `isInBounds` while `applyResourcePatch` does the reverse**
- Theme: cleanliness
- Where: `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts:64-86`
- Finding: `setTerrainKind` is internally bounds-checked (`sharedTerrainHelpers.ts:48`), so there is no actual corruption — but the asymmetry is a footgun for a future agent who refactors `setTerrainKind` and removes the inner guard. Make the two helpers parallel.

**[L-2] Dead local `carriedRelicId` in `destroyUnitEntity`**
- Theme: cleanliness
- Where: `src/game/simulation/createSimulationBridge.ts:3063-3068`
- Finding: The local `carriedRelicId = monkCarriedRelic.get(id)` is fetched, the comment promises "drop the relic at the Monk's last cell", but the variable is never read — only `monkCarriedRelic.delete(id)` runs. The relic *does* end up at the Monk's last cell because the per-tick follow loop kept the relic position glued to the Monk, so the effect matches the comment. Either delete the unused local + reword the comment, or actually call setPositionAndSyncOccupancy explicitly so the comment matches the code.

**[L-3] `GameScene.update` calls `this.bridge.step(delta)` with raw Phaser delta**
- Theme: correctness
- Where: `src/phaser/scenes/GameScene.ts:380-387`
- Finding: Phaser hands `delta` in milliseconds and can spike (>1s) on tab unfocus. The bridge's accumulator (`createSimulationBridge.ts:7179-7185`) catches up correctly, but a 5-minute tab unfocus produces a 3000-tick catch-up burst inside one Phaser tick, freezing the UI thread. Cap the accumulated step (e.g. `Math.min(deltaMs, 250)`) or document the trade-off.

**[L-4] `currentEntityId` cast usage in load path silently drops generation mismatches**
- Theme: cleanliness / docs
- Where: `src/game/simulation/createSimulationBridge.ts:1779-1781`
- Finding: Correct behavior, but no log or counter — silently dropping a saved ref because of a generation mismatch makes a partially-corrupt save load with no diagnostic. Optional: count drops and surface them through the debug snapshot.

**[L-5] `targetFindingOps.findPreferredEnemyBuildingInRadius` returns 5 for unknown building types**
- Theme: cleanliness
- Where: `src/game/simulation/bridge/targetFindingOps.ts:213-215`
- Finding: The `default: return 5;` swallows new building types added later. Use TS exhaustiveness check (`const _: never = buildingType;`) so adding a new building type forces a priority decision.

**[L-6] HUD camera signature uses `toFixed(2)` / `toFixed(3)` — not robust for change detection**
- Theme: cleanliness
- Where: `src/ui/hud/createHudController.ts:405-406`
- Finding: Sub-pixel pans are dropped from the minimap update key, so very slow pans don't redraw the viewport rectangle until the rounded value crosses a boundary. Acceptable for a minimap, but document the trade-off.

**[N-1] `createSimulationBridge.ts` is still 7,333 lines after Phase 1–3 extractions**
- Theme: design
- Where: `src/game/simulation/createSimulationBridge.ts` (whole file)
- Finding: ARCHITECTURE.md:14-19 explicitly calls out the goal of preventing god-class regression. Several large surfaces remain in-file: combat systems (~lines 4900–5200), production-queues system (~5378+), gather/dropoff loop, sheep ownership update. Each is a candidate for a `bridge/` extraction. The note in `drift-log.md:13` ("planned 4th commit was skipped because dep-bag exceeded 15 fields") is worth revisiting now that combat could be split off the rest.

**[N-2] `ARCHITECTURE.md:22-24` still describes the bridge as 9,519 lines pre-extraction**
- Theme: docs
- Where: `docs/architecture/ARCHITECTURE.md` (the prose mentions various sub-modules but does not commit a current size)
- Finding: Not load-bearing, but a future agent reading ARCHITECTURE.md gets old numbers from the drift log instead of a current line count. Consider a one-line "current size: N lines" annotation maintained by drift-log entries.

---

## Verified-not-bugs (claims I checked and rejected)

These came up during the audit and would otherwise be tempting to fix; flagging so they don't get cargo-culted into a sprint plan:

- **`movePathCache` leaks on unit death.** `destroyUnitEntity` calls `clearUnitCommand(id)` (`createSimulationBridge.ts:3060`), and `clearUnitCommand` deletes from `movePathCache` (lines 641, 645). Cache is correctly purged.
- **`selectionPanel` accumulates click listeners on rerender.** `el.innerHTML = …` (line 443) destroys the old buttons and their listeners; the subsequent `querySelectorAll` selects fresh nodes. No leak.
- **`isPlacementBlocked` doesn't catch out-of-bounds footprints.** `worldOccupancy.isPlacementBlocked` walks each footprint cell and `getCellStatus` returns a `bounds`-blocked status for OOB (`worldOccupancy.ts:83-91`). OOB footprints are correctly rejected.
- **`monkConvertProcessedThisTick` not in save schema is a load bug.** The set is `clear()`ed at the start of `prototypeMonkBehavior.execute` (line 5268). It is per-tick scratch state and correctly omitted from saves.
- **`garrisonedUnitVisionSources` leaks when a garrisoned unit dies.** `destroyUnitEntity` deletes from the side map (line 3047) when the unit is currently garrisoned. No leak.
- **`issueMoveCommand` missing `flushOutOfBandRenderChange`.** Move commands only mutate `unitCommands`; no render-affecting side map changes immediately. The flush at the start of the next `step()` is sufficient.

---

## Top issues to fix first

1. **[C-1] Monk conversion flip-flop** — gameplay bug that silently breaks two-player Monk wars; the fix is small but the test fixture takes thought (need two enemy Monks, two enemy units, deterministic priority).
2. **[H-2] Save/load round-trip coverage gap** — without these tests, any future schema or side-map drift will land green; the fix is purely additive (new test cases over existing fixtures + the existing `captureSnapshot` extended).
3. **[C-2] Save loader has no enum validation** — couples to H-2: validate during hydrate, surface a single rejection with the offending field name and value.
4. **[H-1] Garrison side-map cross-reference integrity** — same load path as C-2; a one-pass invariant check at load time prevents the most common save-corruption mode silently producing a half-broken bridge.
5. **[H-3] `getRenderState` per-call full scan** — gets called from the HUD RAF loop and from every browser-test snapshot; a per-tick memoization is cheap and removes a hot-path allocation that grows linearly with entity count.
