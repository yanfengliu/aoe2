# Full Codebase Review — 2026-04-25 (Iteration 3)

**Reviewers:** Claude (Opus 4.7) running synthesized review with parallel sub-agents (HUD/UI, scripts/bootstrap, Phaser scenes, save schema, game-design). External CLIs were partially attempted: Gemini (`gemini-3-flash-preview`) crashed with `ERR_SSL_SSLV3_ALERT_BAD_RECORD_MAC` after ~50 lines of preamble; Claude CLI run produced an empty file; Codex (`gpt-5.4` @ `model_reasoning_effort=high`) emitted only an iteration-2-style verification report (a misread of the same `createWorld(seed)` parameter shadowing that was already rejected in iter-2 verification — see Verified-not-bugs). All material findings below are independently verified by direct code reads against the current tree.

**HEAD reviewed:** `85a281f` on `main`.

**Scope:** Same ~31 kLOC TypeScript surface (155 files) as iter 1+2, but reviewers were told to (a) verify the five iteration-2 fixes (V2-1, H2-1, H2-2, H2-3, M2-1), (b) sweep less-touched directories (`tests/browser/helpers/**`, `scripts/**`, `src/phaser/scenes/gameScene/**`, `src/ui/hud/saveLoadPanel.ts`, `src/ui/hud/displayNames.ts`, `src/ui/hud/createHudController.ts`, `src/app/bootstrap/createApp.ts`, `src/app/bootstrap/browserTestApi.ts`), (c) lean harder on canonical-AoE2 deviations, (d) emit a verified-not-bugs section to keep tempting non-bugs out of future investigation queues.

---

## Executive summary

The iteration-2 fixes hold up. V2-1 / H2-1 / H2-2 / H2-3 / M2-1 are all correctly landed. The two strongest new findings are both **iter-2 M2-1 sibling sites** that the M2-1 fix did not sweep — the fog-memory refresh path and the click-selection hit-test. Both still use anchor-cell-only visibility for multi-cell buildings even though the projector now uses `isFootprintVisible`. Net result: a partially-visible enemy Castle (anchor in fog, edge cell visible) is rendered correctly, can be auto-aggro'd against (M2-1 fix), but cannot be left in fog memory and cannot be clicked to select. That is a player-visible projector/HUD divergence.

Beyond the M2-1 sweep gap, the new highs are:

- **V3-3 (medium)**: H2-2 retry path runs `findNearestDropOffBuilding` + `findBuildingApproachPlan` *every tick* for every villager stuck without a path. 30 stuck villagers = 30 full ECS scans per tick.
- **V3-4 (medium)**: H2-2 regression test does not directly verify the carry survived; both its assertions would still pass under a regression that zeroed the carry but stayed in `to-dropoff`.
- **V3-6 (medium, game design)**: Monk conversion has no vision / LOS interrupt; conversion is gated on Manhattan distance ≤ 4 only. Canonical AoE2 uses true LOS and a vision-loss interrupt.

The codex iteration-3 raw run incorrectly re-flagged the V2-1 fix as `NEEDS CHANGE` based on `getSeed: () => seed` at line 6927. This is the same misread the iter-2 verification round rejected: that line is **inside** `function createWorld(seed: string, ...)` (defined at `createSimulationBridge.ts:377`), where the `seed` parameter receives `effectiveSeed` from the call site at line 7199. The `saveLoad.test.ts:232` re-save assertion proves the contract holds. Treating this as `OK` matches Claude's iter-2 verification verdict.

---

## Verification of iteration-2 fixes

| Fix | Verdict | Notes |
|-----|---------|-------|
| **[V2-1]** `getHudState()` returns saved seed | **OK** | Confirmed line 7347. The other consumer at line 6927 (`getSeed: () => seed` inside `createSaveGameOps`) is bound to the `createWorld` parameter that receives `effectiveSeed`; the re-save test at `saveLoad.test.ts:232` exercises the full chain. The codex iter-3 NEEDS-CHANGE verdict is the same parameter-shadowing misread rejected in iter-2 verification. |
| **[H2-1]** `applyTechnology` idempotency + cost dedupe | **OK** | Guard at `technologyOps.ts:166-170`. Cost dedupe across owned producer queues at `createSimulationBridge.ts:3416-3430` correctly walks every queue belonging to the same owner and rejects duplicate tech entries up front. Test verifies `attackDamage === 5` (would be 6 pre-fix). One efficiency caveat — see V3-5. |
| **[H2-2]** Carry preservation when no drop-off path | **OK with caveats** | Logic at `createSimulationBridge.ts:5723-5731` is correct: the empty `else if (!dropOffPlan)` block intentionally keeps the gatherer in `to-dropoff` without zeroing carry. Test is too loose — see V3-4. Retry path is wasteful — see V3-3. |
| **[H2-3]** Black Forest pocket radius 7 | **OK** | `blackForestMap.ts:39`. Squared distances: STARTING_STONE (1,6)=37, STARTING_GOLD (6,-1)=37, STARTING_BOARS (4,-5)=41, all ≤ 49 (radius² for r=7). Per-owner counts test at `prototypeScenario.test.ts:506-528` locks the contract. |
| **[M2-1]** Building target finding uses footprint visibility | **OK with caveats** | `targetFindingOps.ts:311-356` correctly routes `findPreferredVisibleEnemyBuilding` through `isFootprintVisible`. **But two sibling sites still use anchor-only visibility for buildings — V3-1 and V3-2 below.** |

---

## Critical

*(none new — iter-1's still-open clusters C-2 enum validation, H-2 wider round-trip coverage, H-4 / N-1 bridge size remain.)*

---

## High

### [V3-1] Fog-memory refresh of buildings still uses anchor-only visibility *(iter-2 M2-1 sibling)*

- **Severity:** high
- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:5919-5926`
- **Finding:** `prototypeFogMemory.execute` walks `world.query('position', 'building', 'renderable')` and writes a memory snapshot only if `visibility.isVisible(HUMAN_PLAYER_ID, position.x, position.y)` (the anchor cell). The comment at lines 5916-5918 explicitly claims this "matches how the projector itself decides whether an entity is visible." That claim is now false: `createProjector` at `bridge/visibility.ts:80-93` uses `isFootprintVisible(...)` for the full footprint, and the M2-1 fix routed `findPreferredVisibleEnemyBuilding` through the same helper. So a 4×4 Castle whose edge cell is visible but whose anchor is in fog is rendered, can be auto-aggro'd against, but is **never written to fog memory**. The moment it leaves vision entirely, it disappears completely (no last-seen ghost) instead of leaving the memory snapshot every other building leaves. Codex's iter-2 verification round flagged this as a follow-up; it remains open.

### [V3-2] Click-selection hit-test for buildings still uses anchor-only visibility *(iter-2 M2-1 sibling)*

- **Severity:** high
- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:2547-2549, 2660-2670`
- **Finding:** `getSelectableEntitiesAtCell` filters buildings with `isVisibleToHuman(position, building.owner)`, where `isVisibleToHuman` is anchor-only (`visibility.isVisible(HUMAN_PLAYER_ID, position.x, position.y)`). `buildingOccupiesCell(id, x, y)` correctly accepts non-anchor cells of multi-cell buildings, but the visibility filter immediately drops the candidate because the anchor is in fog. Result: a partially-visible enemy Castle is rendered (projector uses `isFootprintVisible`), but a click on its visible edge cell returns no selectable building — the player sees the building, can target it via right-click auto-aggro (post-M2-1 fix), but cannot left-click to select it. The same anchor-only call appears at the unit query (line 2651), the resource query (line 2679), the deduplication at lines 2778 and 2792, and a friendly-units variant — all of those targets are 1×1 so the anchor IS the only cell, but the building case at line 2663 has the divergence. There is already an `isEntityFootprintVisibleToHuman` helper at line 2555 (used at line 2605 for one consumer); rewiring the building hit-test to use it closes the gap.

---

## Medium

### [V3-3] H2-2 retry path runs `findNearestDropOffBuilding` + `findBuildingApproachPlan` every tick for every stuck villager

- **Severity:** medium
- **Theme:** efficiency, correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:5701-5731`
- **Finding:** When the H2-2 fix added the "stay in `to-dropoff` and retry next tick" branch, it kept the per-tick `findNearestDropOffBuilding` (which scans every owned drop-off building) and `findBuildingApproachPlan` (A* search) inside the gather loop. A player whose 30 villagers are all stuck behind a temporarily-blocked drop-off path now pays 30 full owned-building scans + 30 A* searches per tick (60 ticks/sec on the dev machine = 1800 scans/sec). H2-2 is correct, but the cost is invisible because the regression test (V3-4 below) doesn't sweep CPU. Either throttle retries (e.g., re-plan every 30 ticks instead of every tick), or flag the gatherer as `path-blocked` and only re-plan on a global "drop-off built / destroyed / unit-died" event.

### [V3-4] H2-2 regression test does not directly verify the carry survived

- **Severity:** medium
- **Theme:** tests
- **Where:** `tests/simulation/gatherCarryPreservation.test.ts:73, 76`
- **Finding:** The test asserts `treeAfter.amount >= 190` (i.e., only one chop happened) and `wood === 200` (no deposit). Both of those assertions would still pass under a regression that (a) preserved the gatherer in `to-dropoff` but (b) silently zeroed the carry — because no second chop would happen and no deposit would happen. The actual contract is "the gatherer's `carriedAmount` is non-zero and `carriedResource` is non-null at the end of the wait window." Add `expect(gatherer.carriedAmount).toBeGreaterThan(0)` and `expect(gatherer.carriedResource).not.toBeNull()` directly. (Codex iter-3 verification flagged the same gap.)

### [V3-5] H2-1 cost dedupe scans every owned producer's queue per `enqueueResearch` call

- **Severity:** medium
- **Theme:** efficiency
- **Where:** `src/game/simulation/createSimulationBridge.ts:3416-3431`
- **Finding:** The fix correctly walks `for (const [otherBuildingId, otherQueue] of productionQueues.entries())` and rejects if any same-owner queue already has the tech. Cost is O(producers × queue depth) per call. `enqueueResearch` is called by both player UI clicks (low-frequency) and the AI build-order loop (per AI decision tick, multiple producer kinds × multiple owned producers). Multiplying by `getResearchOptions` UI re-emission, this scales linearly with the number of producer buildings. Cheap mitigation: maintain an `inFlightTechByOwner: Map<number, Set<ResearchableTechnologyType>>` side map and consult/update it when entries enter and leave any production queue. Same pattern as the existing `researchedTechnologies` set.

### [V3-6] Monk conversion has no vision / LOS interrupt — distance gate only

- **Severity:** medium
- **Theme:** correctness, game design
- **Where:** `src/game/simulation/bridge/monkTaskOps.ts:348-431`; `src/game/simulation/createSimulationBridge.ts:5343-5371`
- **Finding:** `applyMonkConvert` only checks `targetUnit.owner === monkUnit.owner` (already-friendly bail). The caller in `prototypeMonkBehavior` only checks `manhattanDistance(monkPosition, targetPosition) > MONK_ACTION_RANGE` (≤ 4). Neither path validates true LOS (terrain blockers / wall blockers between Monk and target) or that the target is in the Monk's vision radius. Canonical AoE2: a Castle wall cell breaks Monk conversion; moving the converting unit out of the Monk's vision radius interrupts conversion. The prototype lets a Monk convert through walls and through fog as long as the target is within Manhattan distance 4. Combined with `MONK_ACTION_RANGE = 4` (line 274) being a free Manhattan radius rather than a true-LOS cone, Monks are stronger than canonical for early micro. A test fixture with a 1×1 wall cell between Monk and target would pin the contract.

### [V3-7] Save load: `monkTasks` map keys (monk entity ids) are not validated to exist

- **Severity:** medium
- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:1837-1843`
- **Finding:** The load loop walks `blob.monkTasks` and stores `monkTasks.set(monkId, { kind, targetEntityRef })`. The `targetEntityRef` is correctly validated via `refFromSerialized`, but the **monk entity id (the map key) is never checked** against `world.getEntityRef(monkId)`. A blob with a stale monk id installs a dead-monk task that the next-tick `prototypeMonkBehavior` cleans up reactively. Sibling load paths (`unitCommands`, `combatStates`, `wildlifeStates`, `productionQueues`, `monkCarriedRelic`, `garrisonedByBuilding`, `garrisonedUnitToBuilding`, etc.) all share the same key-not-validated pattern. This is a wider variant of iter-1 H-3 (which fixed only the garrison case) — most side maps need the same defensive `if (!world.getEntityRef(id)) continue;` guard.

### [V3-8] Save load: `conversionState.byOwner` (player id) loaded with no player-existence check

- **Severity:** medium
- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:1841-1843`; `src/game/simulation/saveSchema.ts` (`conversionState` schema)
- **Finding:** The loader pushes raw `byOwner` numbers into `conversionState`. Subsequent `applyMonkConvert` flips do `population.get(previousOwner)` and `population.get(monkUnit.owner)` (`bridge/monkTaskOps.ts:387-394`); a stale `byOwner` from a 4-player save loaded into a 2-player match silently does nothing on the population side, but if `byOwner` ever appears in player-keyed iteration (score totals, win-condition checks) it leaks. Same flavor as the broader C-2 enum-validation cluster, but specifically targets the player-id surface — owners must be in `playerAges.keys()` post-load.

### [V3-9] `browserTestApi.getPlacementPreviewAt` skips `scene.syncFromBridge(true)` while every sibling getter calls it

- **Severity:** medium
- **Theme:** tests, design
- **Where:** `src/app/bootstrap/browserTestApi.ts:132`
- **Finding:** Line 132 returns `bridge.getPlacementPreview(cellX, cellY)` directly, while `getPlacementPreviewState` (124), `getPlacementPreviewVisualState` (128), `getBuildingVisualStates` (133), `getEntityHealthBarStates` (137), and every selection / move command all call `scene.syncFromBridge(true)` first. Tests that call `getPlacementPreviewAt` after a command but before manually advancing ticks could see a stale preview. The bridge is the authoritative source (so the placement preview itself isn't wrong), but the asymmetry across the API surface is a correctness footgun. Add the sync for parity, or document that this getter is a pure bridge read.

### [V3-10] Save load: most side-map loaders silently install entries for ids the deserialized world doesn't know

- **Severity:** medium
- **Theme:** correctness, design
- **Where:** `src/game/simulation/createSimulationBridge.ts:1830-1989` (load loop, multiple side maps)
- **Finding:** Iter-1 H-3 added a cross-reference invariant for `garrisonedByBuilding` ↔ `garrisonedUnitToBuilding`. The pattern needs to extend: `wildlifeStates`, `combatStates`, `buildingCombatStates`, `buildingHealthStates`, `productionQueues`, `constructionStates`, `rallyPoints`, `sheepMoveOrders`, `monkHealCounters`, `monkConvertProcessedThisTick`, `aiStates` — all of those load entries into `Map<number, X>` keyed by entity id, none of those validate the key resolves via `world.getEntityRef(id)`. Consumers guard against `world.getComponent(...)` returning null, so the orphans are functionally harmless, but the `H-2 widen the round-trip snapshot` deferred work would currently deserialize a partial blob into an inconsistent state without failing fast. Either land a single helper `loadKeyedSideMap(world, blob, sideMap)` that validates and skips, or add a generic post-load cross-check that walks every side map and asserts the key resolves.

### [V3-11] AGENTS.md "Code review" Codex CLI line still references `gpt-5.4`; iter-3 codex run consumed iter-2 verification context and failed the iter-3 task

- **Severity:** medium
- **Theme:** docs, process
- **Where:** `AGENTS.md` Code review section; `docs/reviews/full/2026-04-25/3/raw/codex.md`
- **Finding:** The codex iter-3 raw output is 5,588 lines but only ~50 lines of actual review content — the rest is `<system-reminder>` blocks, the iter-2 review reports re-piped in as context, and PowerShell `Cannot set property...` warnings. The codex run *also* re-emitted iter-2's verification report (with the same `getSeed` parameter-shadowing misread rejected last round). This suggests either (a) the prompt invocation accidentally re-piped the iter-2 raw outputs, or (b) the tool routing in the user's `/full-review` command is concatenating prior-iteration context that the model then summarized instead of doing fresh work. The Gemini iter-3 run also crashed (`ERR_SSL_SSLV3_ALERT_BAD_RECORD_MAC` after ~50 lines), and the Claude iter-3 raw is 0 bytes. Iteration-3 effectively had only one viable independent reviewer (this run). Worth a process re-check before iteration 4 is convened.

---

## Low / Nit

### [V3-12] `parseRange` accepts inverted ranges silently

- **Severity:** low
- **Theme:** correctness
- **Where:** `scripts/content-lib.mjs:13-35`
- **Finding:** `parseRange("7-3")` returns `{ min: 7, max: 3 }` without complaint. Build-time content normalization, trusted CSVs, but any future automation generating range strings from a script could emit inverted bounds and silently install them into the content bundle. One-line guard: if `min > max`, swap or throw.

### [V3-13] `parseCsv` does not detect unclosed quotes; consumes rest of file as one cell

- **Severity:** low
- **Theme:** correctness
- **Where:** `scripts/content-lib.mjs:138-204`
- **Finding:** A typo in `design/stats/units.csv` of the form `"long swordsman` (missing closing quote) flips `inQuotes` permanently and consumes every subsequent comma and newline as literal text. The build emits a single mega-row with all remaining content jammed into one cell; downstream normalizers silently accept the malformed shape. Trusted input today, but the CSVs are hand-edited and `npm run build` produces no warnings. After `pushRow()` at line 191, `if (inQuotes) throw new Error('CSV ended inside a quoted cell — check for unclosed quote');` would surface the issue.

### [V3-14] `?seed=` (empty value) and no-`seed` URL produce the same default seed

- **Severity:** low / nit
- **Theme:** correctness, UX
- **Where:** `src/app/bootstrap/createApp.ts:20`
- **Finding:** `searchParams.get('seed')?.trim() || undefined` collapses both "param absent" and "param explicitly empty" to `undefined`, both of which fall through to the prototype's `DEFAULT_SEED`. A user attempting `?seed=` to "reset to a fresh map" gets the same canonical fixture map as `?seed=aoe2-prototype` does. Either reject empty seed with a console.warn, or randomize.

### [V3-15] F2 keydown fires regardless of focused element (debugOverlay.ts)

- **Severity:** nit
- **Theme:** correctness, UX
- **Where:** `src/ui/hud/debugOverlay.ts:72-82`
- **Finding:** The window-level F2 listener only checks `event.defaultPrevented` before flipping the debug overlay. F2 is not printable (so no input is "lost"), but a player with the load-blob textarea focused who presses F2 still toggles the overlay. Adding `if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;` is the standard guard.

### [V3-16] `installBrowserTestApi` re-installs `window.__AOE2_TEST__` on load without disposing the prior API

- **Severity:** nit
- **Theme:** design
- **Where:** `src/app/bootstrap/createApp.ts:40`; `src/app/bootstrap/browserTestApi.ts:113`
- **Finding:** Each `handleLoadGame` call writes a fresh API object onto `window.__AOE2_TEST__`. Tests that captured a reference to the prior object would keep using stale bridge/scene closures. The current Playwright suite always re-evaluates `window.__AOE2_TEST__` per call, so this isn't biting today, but it's a footgun for any future test that holds a long-lived ref. Either expose a `disposePriorApi` step, or freeze the API object so test code is forced to re-read `window.__AOE2_TEST__` on each access.

### [V3-17] Stale `// HUD via getHudState()` debug comment at `createSimulationBridge.ts:620`

- **Severity:** nit
- **Theme:** docs
- **Where:** `src/game/simulation/createSimulationBridge.ts:620`
- **Finding:** Picked up in passing. Low signal; only flagging because iter-1 + iter-2 already noted multiple comment-vs-code drift cases (L-2, L2-1) and a sweep is overdue.

---

## Verified-not-bugs (do not re-investigate)

- **`selectionPanel` button-listener accumulation** *(re-confirms iter-1 verified-not-bug)*: the parallel sub-agent flagged this as critical, but `selectionPanel.ts:443` resets `el.innerHTML` before the `querySelectorAll` re-attaches. Old buttons are GC'd; closures are not retained. No leak.
- **Codex iter-3 V2-1 NEEDS-CHANGE**: same misread as iter-2 verification. `getSeed: () => seed` at `createSimulationBridge.ts:6927` is **inside** `function createWorld(seed: string, ...)` (declared at line 377). The call site at line 7199 passes `effectiveSeed`. The `seed` referenced inside the closure is the parameter, not the outer constructor seed. The `saveLoad.test.ts:232` re-save assertion proves the chain is correct.
- **Fletching grants +1 attack +1 range +1 LOS**: not a canonical-AoE2 deviation. Verified against `design/stats/technologies.csv:17` — the design CSV explicitly lists `+1 attack +1 range +1 LOS +1 search radius`. Matches canonical AoE2 (Fletching does grant +1 range; the parallel sub-agent's claim that it shouldn't was incorrect).
- **Watch Tower garrisoned-archer extra arrows**: verified `prototypeBuildingRules.ts:325-333` returns `Math.min(5, 1 + garrisonedArchers)` for Watch Tower (and FU3 increases to a higher cap for Castle). Matches canonical AoE2 (1 base arrow + 1 per garrisoned archer, capped). The parallel sub-agent's "Watch Tower fixed at 1" claim was wrong.
- **GameScene `input.on(...)` handlers leak on `setBridge()`**: the parallel sub-agent flagged as critical, but `setBridge()` only updates the `this.bridge` field; it does not re-register Phaser input handlers. The handlers reference `this.bridge` through the closure and pick up the new bridge correctly. Phaser cleans up scene-scoped `input.on(...)` registrations on `SHUTDOWN`. The agent's claim that handlers fire multiple times is unsupported by the code.
- **`renderFog` Set allocations every frame**: not a new finding — already covered by iter-2 M2-14.
- **Wonder / Relic countdown ticks**: the parallel sub-agent flagged 2000 ticks (~100 sec @ 20 TPS) as a deviation from canonical 200 game-years. The countdown is intentionally tunable per fixture (`wonderCountdownOverrideTicks` at `prototypeScenario.ts:249`) and the 2000-tick number is a prototype-specific tuning choice, not a canonical-AoE2 contract. Not a bug.
- **Bodkin Arrow / Bracer +1 range**: matches canonical AoE2 (both grant +1 range). Sub-agent claim was incorrect.

---

## Top issues to fix first (synthesized)

1. **[V3-1] + [V3-2] Sweep all non-projector building visibility paths to use `isFootprintVisible`** — the M2-1 fix landed at the target-finding seam but missed the fog-memory refresh (`createSimulationBridge.ts:5919-5926`) and the click hit-test (`:2660-2670`). Both produce player-visible projector divergences. Wire `isVisibleToHuman` for buildings through the existing `isEntityFootprintVisibleToHuman` helper at line 2555 (already used at line 2605); same for the `prototypeFogMemory` system. One sprint, two findings closed, parity restored across the projector / target-finding / hit-test / fog-memory contracts.
2. **[V3-3] H2-2 retry path throttle** — gate `findNearestDropOffBuilding` + `findBuildingApproachPlan` on a `lastRetryTick` per-gatherer counter (re-plan every 30 ticks instead of every tick). Same fix would also help the AI-villager-stuck-behind-a-wall hot path.
3. **[V3-4] H2-2 regression test asserts on the actual carry** — add `expect(gatherer.carriedAmount).toBeGreaterThan(0)` and `expect(gatherer.carriedResource).toBe('wood')` directly in `tests/simulation/gatherCarryPreservation.test.ts`. Same change shape as the iter-2 H2-1 follow-up that strengthened H2-2 assertions but didn't land directly on the carry surface.
4. **[V3-7] + [V3-10] Defensive load-path cross-checks for entity-id-keyed side maps** — extend the iter-1 H-3 garrison invariant to every other side map. Either land a `loadKeyedSideMap(world, entries, target)` helper that filters via `world.getEntityRef`, or a single post-load cross-check that walks every side map and asserts the key resolves. Closes the wider half of iter-1 H-2 + C-2 cluster too.
5. **[V3-6] Monk conversion vision / LOS interrupt** — gate `applyMonkConvert` (or its caller in `prototypeMonkBehavior`) on `visibility.isVisible(monkUnit.owner, targetPosition.x, targetPosition.y)` (or the projector's footprint variant). Add an LOS check between Monk and target if the team wants strict canonical AoE2. Test fixture: 1×1 Castle wall between Monk and target should prevent conversion.

`[V3-5]` (cost-dedupe scan), `[V3-8]` (conversionState player validation), `[V3-9]` (browserTestApi sync parity), `[V3-11]` (codex/gemini CLI process audit) are also fix-worthy but not blocking.

---

## Process notes for next iteration

- **External CLI run health is degrading.** Codex iter-3 raw is 5,588 lines but ~50 lines of actual review (the rest is system-reminders, prior-iteration context, and PowerShell warnings). Gemini iter-3 crashed with `ERR_SSL_SSLV3_ALERT_BAD_RECORD_MAC` — possibly a transient network issue, or the gemini-cli 0.39.1 version has a known issue. Claude CLI iter-3 produced 0 bytes. Before iteration 4: (a) re-probe the codex `--ephemeral` flag to confirm prior-iteration context isn't being sent, (b) retry gemini-cli on a fresh terminal session, (c) check whether claude-cli silently fails on Windows when its prompt exceeds a token budget.
- **The codex `getSeed` misread keeps recurring.** Both iter-2 and iter-3 codex runs flagged the same parameter-shadowing issue as a NEEDS-CHANGE. Either rename the `createWorld` parameter from `seed` to `effectiveSeed` and explicitly pass `effectiveSeed` to `createSaveGameOps` (eliminating the ambiguity), or add a one-line code comment at line 6927 documenting the shadowing. Cheap to do; protects future review iterations from the same confusion.
- **The "verified-not-bugs" prompt addition continues to pay off.** This iteration ruled out 7+ tempting non-bugs from sub-agents (Fletching range, Watch Tower arrows, selectionPanel listener leak, GameScene input handler leak, Wonder/Relic timing). Keep the section in the prompt for iteration 4.
- **Sub-agent verification is essential.** Three of this iteration's sub-agents flagged confident-sounding criticals (selectionPanel listener accumulation, input handler leak, Fletching range bonus) that turned out to be wrong on direct code inspection. Sub-agents are still net-positive — they caught V3-2 (browserTestApi sync parity), V3-12 / V3-13 (CSV parser robustness), V3-14 (empty seed URL) — but every sub-agent finding needs a 1-2 minute direct verification pass before promotion to the report.
