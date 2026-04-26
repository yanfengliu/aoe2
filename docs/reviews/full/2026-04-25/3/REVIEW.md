# Full Codebase Review — 2026-04-25 (Iteration 3)

**Reviewers:** Codex (`gpt-5.4` @ `model_reasoning_effort=high`), Gemini (`gemini-3-flash-preview` again — pro and pro-preview both still `QUOTA_EXHAUSTED` with ~11 h reset), Claude (`opus` @ `--effort high`). Each ran independently with read-only access to the working tree; raw outputs in `raw/codex.md`, `raw/gemini.md`, `raw/claude_full.md` (Claude wrote the synthesized form directly to `REVIEW.md` — moved aside; this is the fresh synthesis). Iteration 1 + 2 REVIEW.md were both included in the prompt so reviewers wouldn't re-flag known fixed/deferred items.

**HEAD reviewed:** `85a281f` on `main`.

---

## Executive summary

The iteration-2 fixes hold up. All three reviewers verdict V2-1 / H2-1 / H2-2 / H2-3 / M2-1 as `OK` (Codex incorrectly NEEDS-CHANGE'd V2-1 again on the same `getSeed: () => seed` parameter-shadowing misread that iteration-2 verification already rejected; both Claude and Gemini correctly trace it, and the `saveLoad.test.ts:232` re-save test independently proves the contract).

The strongest new findings are **two iter-2 M2-1 sibling sites that the M2-1 sweep missed** — every reviewer found this. The fog-memory refresh (`createSimulationBridge.ts:5919-5926`) and the click-selection hit-test for buildings (`createSimulationBridge.ts:2660-2670`) both still use anchor-only visibility for multi-cell buildings, while the projector and the M2-1-fixed target-finder both use `isFootprintVisible`. Net result: a partially-visible enemy Castle (anchor in fog, edge cell visible) is rendered correctly, can be auto-aggro'd against, but cannot be left in fog memory and cannot be left-clicked to select. Player-visible projector / HUD divergence.

Beyond the M2-1 sweep gap:

- **Codex (sole reviewer)**: same-type double-click selection's `GameScene.isUnitType` whitelist hasn't been updated since FU2 — Man-at-Arms, Long Swordsman, Two-Handed Swordsman, Paladin, Heavy Camel are recognized everywhere else but double-clicking one does not expand to same-type friendlies. Plus `displayNames.ts` is missing `wonder`, so the selection panel shows `wonder` / `wonders` instead of "Wonder".
- **Claude (sole reviewer)**: Monk conversion has no LOS / vision-loss interrupt — only Manhattan distance ≤ 4 is checked. A Monk converts through walls and through fog. Plus the H2-2 fix retries A* every tick for every stuck villager (no throttle), and the H2-2 regression test would still pass under a regression that zeroed the carry but stayed in `to-dropoff`. Plus a wider variant of iter-1 H-3: most save-load side maps load entity-id keys without validating that the key resolves via `world.getEntityRef`.
- **Gemini (only flash-preview, model gap)**: re-flagged the iter-2 deferred `M2-4` mutual-annihilation = `'defeat'` outcome, the `M2-10` forward-house forest-cluster collision in default map gen, the `M2-8` `applyShoreFishPatches` byte-for-byte duplicate, the `M2-12` UTF-16 surrogate-pair seed hash collision. Plus elevated the recurring `M2-6` HUD `destroy()` to `M3-1` (third iteration to flag this).

---

## Cross-reviewer agreement

| Theme | Codex | Gemini | Claude |
|---|---|---|---|
| **M2-1 sibling: fog-memory anchor-only** (`:5919-5926`) | ✓ (V3-1, T2 priority) | ✓ (M3-3) | ✓ (V3-1, high) |
| **M2-1 sibling: click hit-test anchor-only** (`:2660-2670`) | — (implied) | — | ✓ (V3-2, high) |
| H2-2 test too loose | ✓ (caveat) | — | ✓ (V3-4) |
| HUD `destroy()` not exposed | — | ✓ (M3-1) | — (re-flag of M2-6 implied) |
| Save-load enum validation / wider round-trip (iter-1 C-2 / H-2 still open) | ✓ (T1 priority) | — | ✓ (V3-7 / V3-10) |
| Codex's V2-1 NEEDS-CHANGE (rejected) | ✓ (incorrect) | OK | OK (correctly rebutted) |

Anything below appears in only one reviewer unless noted.

---

## Verification of iteration-2 fixes

| Fix | Codex | Gemini | Claude | Final verdict |
|---|---|---|---|---|
| **V2-1** `getHudState()` returns saved seed | NEEDS CHANGE (misread) | OK | OK | **OK** — Codex misread same parameter shadowing as iter-2 round 2; both other reviewers correctly trace, and `saveLoad.test.ts:232` proves it |
| **H2-1** Tech idempotency + cost dedupe | OK | OK | OK | **OK** — efficiency caveat (V3-5) |
| **H2-2** Carry preservation | OK with caveats (test loose) | OK | OK with caveats | **OK with caveats** — V3-3 retry-path inefficiency, V3-4 weak test |
| **H2-3** Black Forest pocket | OK | OK | OK | **OK** |
| **M2-1** Building target finding | OK with caveats | OK | OK with caveats | **OK with caveats** — V3-1 + V3-2 sibling sites still anchor-only |

---

## Critical

*(none new — iter-1's still-open clusters C-2 enum validation, H-2 wider round-trip coverage, H-4 `getRenderState` cache, N-1 bridge size remain.)*

---

## High

### [V3-1] Fog-memory refresh of buildings still uses anchor-only visibility *(M2-1 sibling — Codex + Gemini + Claude)*

- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:5919-5926`
- **Finding:** `prototypeFogMemory.execute` walks `world.query('position', 'building', 'renderable')` and writes a memory snapshot only if `visibility.isVisible(HUMAN_PLAYER_ID, position.x, position.y)` (anchor cell only). The comment at lines 5916-5918 explicitly claims this matches the projector — that claim is now false (projector uses `isFootprintVisible`, M2-1-fixed target finder uses `isFootprintVisible`). A 4×4 Castle whose edge cell is visible but whose anchor is in fog is rendered, can be auto-aggro'd against, but is **never written to fog memory**. The moment it leaves vision entirely, it disappears completely (no last-seen ghost).
- **Fix shape:** Replace the `visibility.isVisible(playerId, x, y)` call with `isFootprintVisible(visibility, playerId, position.x, position.y, footprint.width, footprint.height)`.

### [V3-2] Click-selection hit-test for buildings still uses anchor-only visibility *(M2-1 sibling — Claude only)*

- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:2547-2549, 2660-2670`
- **Finding:** `getSelectableEntitiesAtCell` filters buildings via `isVisibleToHuman(position, owner)` where `isVisibleToHuman` is anchor-only. `buildingOccupiesCell(id, x, y)` correctly accepts non-anchor cells, but the visibility filter immediately drops the candidate because the anchor is in fog. Result: a partially-visible enemy Castle is rendered, can be right-click auto-aggro'd, but **left-click on the visible edge cell selects nothing**. There is already an `isEntityFootprintVisibleToHuman` helper at line 2555 (used at line 2605 for one consumer); rewiring the building hit-test to use it closes the gap.
- **Fix shape:** Replace the anchor-only call at line 2663 with the existing `isEntityFootprintVisibleToHuman` helper, threading building footprint dims.

### [V3-3] Same-type double-click selection has stale unit-type whitelist (FU2 units missing) *(Codex only)*

- **Theme:** correctness, tests
- **Where:** `src/phaser/scenes/GameScene.ts:1050-1051,1128-1160`
- **Finding:** `isUnitType` is a long `||`-chain of unit-type literals used to gate same-type double-click selection. FU2 added Man-at-Arms / Long Swordsman / Two-Handed Swordsman / Paladin / Heavy Camel — they're recognized in the unit registry, training, and combat code, but the double-click whitelist still stops before them. Net: double-clicking a Long Swordsman does not expand to same-type friendlies, and the browser suite only covers villagers so the regression is currently invisible.
- **Fix shape:** Either (a) replace the whitelist with a `UnitType`-driven exhaustiveness check (iter-1 M-6 also flagged this), or (b) add the FU2 / FU3 units to the chain. Cheap option (b) for now, durable option (a) on next refactor pass. (Iter-1 M-6 was flagged as deferred; this iteration escalates.)

---

## Medium

### [V3-4] H2-2 regression test does not directly verify the carry survived *(Codex + Claude)*

- **Theme:** tests
- **Where:** `tests/simulation/gatherCarryPreservation.test.ts:73, 76`
- **Finding:** Test asserts `treeAfter.amount >= 190` and `wood === 200`. Both pass under a regression that preserves `to-dropoff` task but silently zeroes the carry. The actual contract is "the gatherer's `carriedAmount` is non-zero and `carriedResource` is non-null." (Iter-2 verification round caught this and a partial fix landed in commit `2a1267a`, but Claude verified the test was strengthened only via villager-state assertions in the SAME test as the cost dedupe. The standalone H2-2 test still has the looser assertions.)
- **Fix shape:** Add `expect(villagerAfter.carriedAmount).toBe(10)` and `expect(villagerAfter.carriedResource).toBe('wood')` to the H2-2-specific test.

### [V3-5] H2-2 retry path runs `findNearestDropOffBuilding` + `findBuildingApproachPlan` every tick for every stuck villager *(Claude)*

- **Theme:** efficiency, correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:5701-5731`
- **Finding:** A player whose 30 villagers are stuck behind a temporarily-blocked drop-off path now pays 30 full owned-building scans + 30 A* searches per tick (60 ticks/sec on dev = 1800 scans/sec). H2-2 is correct but the cost is invisible because no test sweeps CPU.
- **Fix shape:** Either throttle retries (re-plan every 30 ticks instead of every tick), or flag the gatherer as `path-blocked` and only re-plan on a global "drop-off built / destroyed / unit-died" event.

### [V3-6] H2-1 cost dedupe is O(producers × queue) per `enqueueResearch` call *(Claude)*

- **Theme:** efficiency
- **Where:** `src/game/simulation/createSimulationBridge.ts:3416-3431`
- **Finding:** `enqueueResearch` walks every owned producer's queue per call. AI build-order loop calls per-producer-kind × per-owned-producer per decision tick.
- **Fix shape:** Maintain an `inFlightTechByOwner: Map<number, Set<ResearchableTechnologyType>>` side map and consult/update it when entries enter and leave any production queue.

### [V3-7] Monk conversion has no vision / LOS interrupt — distance gate only *(Claude)*

- **Theme:** correctness, game design
- **Where:** `src/game/simulation/bridge/monkTaskOps.ts:348-431`; `src/game/simulation/createSimulationBridge.ts:5343-5371`
- **Finding:** `applyMonkConvert` only checks `targetUnit.owner === monkUnit.owner`. The caller in `prototypeMonkBehavior` only checks `manhattanDistance(monkPosition, targetPosition) > MONK_ACTION_RANGE` (≤ 4). Neither validates true LOS or that the target is in the Monk's vision radius. Canonical AoE2: a Castle wall cell breaks Monk conversion; moving the converting unit out of the Monk's vision radius interrupts.
- **Fix shape:** Gate `applyMonkConvert` (or its caller) on `visibility.isVisible(monkUnit.owner, targetPosition.x, targetPosition.y)`. Test fixture: 1×1 Castle wall between Monk and target should prevent conversion.

### [V3-8] Save-load: most side-map loaders silently install entries for ids the deserialized world doesn't know *(Claude — wider variant of iter-1 H-3)*

- **Theme:** correctness, design
- **Where:** `src/game/simulation/createSimulationBridge.ts:1830-1989` (load loop, multiple side maps)
- **Finding:** Iter-1 H-3 added a cross-reference invariant for `garrisonedByBuilding` ↔ `garrisonedUnitToBuilding`. The same pattern needs to extend to: `wildlifeStates`, `combatStates`, `buildingCombatStates`, `buildingHealthStates`, `productionQueues`, `constructionStates`, `rallyPoints`, `sheepMoveOrders`, `monkHealCounters`, `monkConvertProcessedThisTick`, `monkTasks` map keys, `aiStates`, `conversionState.byOwner`. Consumers guard against `world.getComponent(...)` returning null, so orphans are functionally harmless, but the iter-1 H-2 deferred-widening would deserialize partial blobs into inconsistent state without failing fast.
- **Fix shape:** Either land a `loadKeyedSideMap(world, entries, target)` helper that filters via `world.getEntityRef`, or a single post-load cross-check.

### [V3-9] `displayNames` missing `wonder` — selection panel shows raw `wonder`/`wonders` text *(Codex)*

- **Theme:** correctness, docs
- **Where:** `src/ui/hud/displayNames.ts:12-143,145-278,510,569`
- **Finding:** `SelectionState.selectedEntityType` includes `wonder`, and the icon/accent helpers already support it. But the naming helpers omit it. Selecting a Wonder falls back to raw `wonder` / `wonders` text in the selection panel.
- **Fix shape:** Add `'wonder'` to the singular + plural name maps with display "Wonder".

### [V3-10] `prototypeFogMemory` and `isVisibleToHuman` claim the projector matches anchor-only — comment now incorrect *(Gemini — re-flag of V3-1 docs angle)*

- **Theme:** docs (related to V3-1)
- **Where:** `src/game/simulation/createSimulationBridge.ts:5916-5918, 2547-2549`
- **Finding:** Comments explicitly claim "this matches how the projector itself decides whether an entity is visible." The projector now uses `isFootprintVisible`. Update comments after the V3-1 fix to reflect the new contract.

### [V3-11] HUD controller leaks `requestAnimationFrame` and global listeners *(Gemini — third-iteration recurrence of H-7 / M2-6)*

- **Theme:** cleanliness
- **Where:** `src/ui/hud/createHudController.ts:330-331, 353, 356`; `src/ui/hud/debugOverlay.ts:170-173` (already has `destroy()`)
- **Finding:** Adds `mousemove` and `mouseup` listeners to `window` and starts a recursive `requestAnimationFrame` loop. No `destroy()` exposed. `debugOverlay` already implements `destroy()`; the inner controller is ready — `createHudController` just needs to expose it.
- **Fix shape:** Have `createHudController` return `destroy()` that cancels the RAF, removes the listeners, and forwards to `debugOverlay.destroy()`. Wire `createApp` to call it on `handleLoadGame` before constructing the new bridge.

### [V3-12] Conquest resolver: simultaneous mutual annihilation grants 'defeat' instead of 'draw' *(Gemini — re-flag of iter-2 M2-4)*

- **Theme:** correctness, game design
- **Where:** `src/game/simulation/createSimulationBridge.ts:6265-6273`; `MatchState.outcome` schema
- **Finding:** "If human has no presence → defeat (early return); else if all enemies have no presence → victory". A tick destroying both sides' last unit/building reaches the human-presence check first.
- **Fix shape:** Widen `MatchState.outcome` to include `'draw'` and resolve simultaneous extinction as draw.

### [V3-13] Default-map procedural placement: forest cluster can collide with FORWARD_ENEMY_HOUSE_POSITION *(Gemini — re-flag of iter-2 M2-10)*

- **Theme:** correctness
- **Where:** `src/game/simulation/mapGeneration/defaultMap.ts:25-42`; `applyStandardPlayerOpening.ts:524-580` (`placeForestCluster`)
- **Finding:** `createDefaultMap` places the forward house at `(39, 18)` *after* forest clusters seed. `placeForestCluster` does not consult building spawns. Some seeds will place a tree at `(39, 18)`, causing the bridge bootstrap validator to throw.
- **Fix shape:** Drive `placeForestCluster` through a "blocked by static landmarks" predicate that also excludes `FORWARD_ENEMY_HOUSE_POSITION` / `SCOUT_POSITION` / `DEFAULT_RELIC_POSITIONS`.

### [V3-14] `seedToNumber` walks code points but indexes by code unit — UTF-16 surrogate pair hash collisions *(Gemini — re-flag of iter-2 M2-12)*

- **Theme:** correctness
- **Where:** `src/game/simulation/mapGeneration/sharedTerrainHelpers.ts:20-26`
- **Finding:** `for (const character of seed)` iterates code points; `character.charCodeAt(0)` returns the first UTF-16 code unit. Hash collisions for any non-BMP seed names. Latent today (only ASCII fixture names + URL input).
- **Fix shape:** `hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0`.

### [V3-15] AI Watch-Tower defensive response gated on Blacksmith *(Codex — re-flag of iter-2 M2-5)*

- **Theme:** game design, AI behavior
- **Where:** `src/game/simulation/createSimulationBridge.ts:4503-4514`
- **Finding:** AI's "saw an enemy near base, build Watch Tower" requires `hasCompletedBuilding(owner, 'blacksmith')`. Canonical AoE2 unlocks Watch Tower in Feudal as soon as Lumber Camp + Mining Camp exist.
- **Fix shape:** Drop the Blacksmith requirement.

### [V3-16] `applyShoreFishPatches` and `applyShoreFishPatchesProcedural` are byte-for-byte duplicates *(Gemini — re-flag of iter-2 M2-8)*

- **Theme:** cleanliness
- **Where:** `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts:88-144` vs `:147-202`
- **Finding:** Both 56-line bodies do the same candidate scan, dedupe, fallback. Both are exported and have callers.
- **Fix shape:** Pick one, alias the other.

### [V3-17] `browserTestApi.getPlacementPreviewAt` skips `scene.syncFromBridge(true)` while every sibling getter calls it *(Claude)*

- **Theme:** tests, design
- **Where:** `src/app/bootstrap/browserTestApi.ts:132`
- **Finding:** Asymmetry — every other getter calls `scene.syncFromBridge(true)` first, but `getPlacementPreviewAt` returns `bridge.getPlacementPreview` directly. Tests that call this after a command but before manually advancing ticks could see a stale preview.
- **Fix shape:** Add the sync for parity, or document that this getter is a pure bridge read.

### [V3-18] `renderFog` per-frame full-map scan + per-cell allocations *(Gemini — re-flag of iter-2 M2-14)*

- **Theme:** efficiency
- **Where:** `src/phaser/scenes/gameScene/worldLayers.ts:133-154`
- **Finding:** Every frame: nested `y/x` loop over the entire map, two new `Set` objects, one `fillRect` per non-visible cell. Standard 60×36 map = 2,160 `fillRect` calls per 16 ms.
- **Fix shape:** Hoist `Set` allocation; render only when fog frame changes via a tick + visibility-version counter.

### [V3-19] `getSnapshot` triggers redundant projecting and filtering *(Gemini — re-flag of iter-2 M2-15)*

- **Theme:** efficiency
- **Where:** `src/app/bootstrap/browserTestApi.ts:103-113, 211-221`
- **Finding:** `getSnapshot` calls `scene.syncFromBridge(true)` AND `bridge.getRenderState()` AND multiple bridge methods, each triggering a full entity filter/projection pass.
- **Fix shape:** Same as iter-1 H-4: cache projected list per-tick.

---

## Low / Nit

### [V3-20] `parseRange` accepts inverted ranges silently *(Claude)*

- **Where:** `scripts/content-lib.mjs:13-35`
- **Finding:** `parseRange("7-3")` returns `{ min: 7, max: 3 }`. Trusted CSVs today, footgun for any future automation.

### [V3-21] `parseCsv` does not detect unclosed quotes; consumes rest of file as one cell *(Claude)*

- **Where:** `scripts/content-lib.mjs:138-204`
- **Finding:** A typo `"long swordsman` (missing closing quote) flips `inQuotes` permanently. Trusted input today; one-line guard `if (inQuotes) throw` after CSV parse closes the gap.

### [V3-22] `?seed=` (empty value) and no-`seed` URL produce the same default *(Claude)*

- **Where:** `src/app/bootstrap/createApp.ts:20`
- **Finding:** `searchParams.get('seed')?.trim() || undefined` collapses both "param absent" and "param explicitly empty" to `undefined`. User trying `?seed=` gets the canonical fixture map.

### [V3-23] F2 keydown fires regardless of focused element *(Claude)*

- **Where:** `src/ui/hud/debugOverlay.ts:72-82`
- **Finding:** Only checks `event.defaultPrevented`. A player with a textarea focused who presses F2 still toggles the debug overlay.

### [V3-24] AI `findIdleProducer` returns first match *(Claude — re-flag of iter-2 M2-11)*

- **Where:** `src/game/simulation/bridge/aiDecisionOps.ts:162-179`
- **Finding:** Multi-base AI never trains at second producer until first fills.

### [V3-25] `installBrowserTestApi` re-installs `window.__AOE2_TEST__` on load without disposing the prior API *(Claude)*

- **Where:** `src/app/bootstrap/createApp.ts:40`; `src/app/bootstrap/browserTestApi.ts:113`
- **Finding:** Stale-reference footgun for any future test that holds a long-lived ref.

### [V3-26] Stale `// HUD via getHudState()` debug comment *(Claude)*

- **Where:** `src/game/simulation/createSimulationBridge.ts:620`
- **Finding:** Comment-vs-code drift. Iter-1 L-2 + iter-2 L2-1 already noted similar; sweep overdue.

---

## Verified-not-bugs (do not re-investigate)

From all reviewers:

- **Codex iter-3 V2-1 NEEDS-CHANGE**: same misread as iter-2 verification — `getSeed: () => seed` at `createSimulationBridge.ts:6927` is **inside** `function createWorld(seed: string, ...)`. The call site at line 7199 passes `effectiveSeed`. Re-save test at `saveLoad.test.ts:232` proves correctness.
- **`selectionPanel` button-listener accumulation**: `el.innerHTML` reset before `querySelectorAll` re-attaches. No leak.
- **`createApp` closure-bridge load swap**: Facade arrows re-read `bridge` variable on every call. Works by design.
- **Phaser `input.on(...)` handler leaks on `setBridge()`**: handlers reference `this.bridge` through the closure and pick up the new bridge correctly. Phaser cleans up scene-scoped handlers on `SHUTDOWN`.
- **Fletching grants +1 attack +1 range +1 LOS**: matches canonical AoE2 (verified against `design/stats/technologies.csv:17`).
- **Watch Tower garrisoned-archer extra arrows**: `Math.min(5, 1 + garrisonedArchers)` matches canonical.
- **Wonder / Relic 2000-tick countdown**: prototype-specific tuning, not a canonical contract.
- **Bodkin Arrow / Bracer +1 range**: matches canonical AoE2.

---

## Top issues to fix first

User explicitly said "address all remaining concerns" — so this list is ordered by impact but the goal is to land everything actionable that doesn't require an architectural rewrite.

1. **[V3-1 + V3-2] M2-1 sweep gap — fog memory + click hit-test** *(highest cross-reviewer agreement)*
2. **[V3-3] FU2 units in double-click whitelist** *(Codex; small isolated fix)*
3. **[V3-9] `wonder` in displayNames** *(Codex; one-liner)*
4. **[V3-4] H2-2 test stronger carry-state assertion** *(Codex + Claude)*
5. **[V3-5] H2-2 retry path throttle** *(Claude)*
6. **[V3-7] Monk conversion vision/LOS interrupt** *(Claude; canonical AoE2)*
7. **[V3-12] Mutual-annihilation = draw outcome** *(Gemini; canonical AoE2)*
8. **[V3-13] Forward-house collision in default map** *(Gemini)*
9. **[V3-11] HUD `destroy()`** *(third-iteration recurrence)*

Plus the smaller V3-6, V3-8, V3-14 through V3-26 items as time permits.

The big architectural items (C-2 enum validation system, H-2 wider round-trip widening, H-4 `getRenderState` cache, N-1 bridge size) remain deferred — they need standalone sprints.
