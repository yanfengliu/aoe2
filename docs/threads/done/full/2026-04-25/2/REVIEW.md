# Full Codebase Review — 2026-04-25 (Iteration 2)

**Reviewers:** Codex (`gpt-5.4` @ `model_reasoning_effort=high`), Gemini (`gemini-3-flash-preview` — `gemini-2.5-pro` and `gemini-3.1-pro-preview` were both quota-exhausted on this account; reset in ~13 h, see process notes), Claude (`opus` @ `--effort high`). Each ran independently with read-only access to the working tree; raw outputs in `raw/codex.md`, `raw/gemini.md`, `raw/claude.md`.

**Scope:** Same ~47 kLOC TypeScript surface as iteration 1, but reviewers were told to (a) verify the four iteration-1 fixes, (b) sweep less-touched directories (`mapGeneration/`, `fixtures/`, `phaser/scenes/gameScene/`, `tests/browser/`, `scripts/`, `app/bootstrap/`), (c) focus more on game-design and player-experience correctness this round, (d) emit a verified-not-bugs section (Claude pioneered this in iter 1).

**HEAD reviewed:** `2e5283d` on `main`.

**Iteration-1 commits we asked them to verify:** `3f413e2` (C-1 monk flip-flop), `7bba71e` (H-1 projector seed), `bfce2c7` (H-3 garrison cross-reference), `6b37c62` (M-16 ARCHITECTURE.md `bridge/` topology).

---

## Executive summary

Two independent reviewers (Codex + Claude) caught that **the iteration-1 H-1 fix is incomplete**. Commit `7bba71e` correctly switched `createWorld(...)` and `createProjector(...)` to `effectiveSeed`, but the outer `seed` still leaks via `getSeed: () => seed` (`createSimulationBridge.ts:6894`, consumed by `saveGameOps.ts:210` for re-save) and `seed,` (`createSimulationBridge.ts:7314`, returned by `getHudState()`). After loading a saved game: world ticks the saved seed, but the HUD reports the outer seed and any subsequent save *writes the outer seed* back into the blob, breaking the determinism contract on the load → re-save path. Iteration-1's regression test only asserted on `frame.seed`, which is the one path that was fixed.

Beyond that:

- **Claude found two new gameplay correctness bugs:**
  - **[H2-1]** Tech double-research via simultaneous queueing in two producer buildings — non-idempotent Blacksmith techs can stack `+2` instead of `+1`.
  - **[H2-2]** A villager carrying gathered resources silently zeroes its load when `findBuildingApproachPlan` momentarily returns null (path blocked by an enemy unit, drop-off rebuilding) instead of waiting for the path to reopen.
- **Codex found a new map-generation regression:**
  - Black Forest seeds trees over `STARTING_STONE` cell `(1, 6)` because the carved start pocket is only radius 6; `applyResourcePatch()` ignores the rejected `addResourceSpawn(...)` and the map silently drops a starting stone node.
- **Gemini found a target-finding visibility bug:**
  - **[M-20]** `findPreferredVisibleEnemyBuilding` checks visibility of the building's anchor cell only, missing partially visible large buildings (Town Centers, Castles) — diverges from `createProjector` which uses `isFootprintVisible`.

The iteration-1 deferred items (C-2 enum validation, H-2 wider round-trip, H-4 `getRenderState` cache, N-1 god class drain) all remain open and were re-acknowledged by at least one reviewer.

---

## Cross-reviewer agreement

| Theme | Codex | Gemini | Claude |
|---|---|---|---|
| H-1 fix is incomplete (HUD seed leak / re-save seed leak) | ✓ (high) | — (called V-2 verified) | ✓ (medium) |
| Black Forest map silently loses starting stone | ✓ (high) | — | — |
| Tech double-research via simultaneous queueing | — | — | ✓ (high) |
| Carried gather load zeroed on temp path block | — | — | ✓ (high) |
| `findPreferredVisibleEnemyBuilding` anchor-only visibility | — | ✓ (medium) | — |
| Save panel discards download fallback on storage failure | ✓ (medium) | — | — (iter 1 M-15 stands) |
| ARCHITECTURE.md `app/bootstrap/` description stale (refers to "dev HTTP API") | ✓ (low) | — | — |
| HUD `destroy()` never returned (iter 1 H-7 still open) | — | — | ✓ (medium) |
| Map-gen / scenario fuzz coverage gaps | — | — | ✓ (medium) |
| AI build-order ergonomics (gathering-villager preference, watch-tower gate, idle producer round-robin) | — | — | ✓ (medium ×3) |

Anything below appears in only one reviewer unless noted.

---

## Verification of iteration-1 fixes

### [V2-1] H-1 fix is incomplete — outer `seed` leaks via `getSeed()` (re-save path) and `getHudState()` *(Codex + Claude — independent)*

- **Severity:** high
- **Theme:** correctness
- **Where:**
  - `src/game/simulation/createSimulationBridge.ts:6894` — `getSeed: () => seed,` (consumed by `saveGameOps.ts:210`)
  - `src/game/simulation/createSimulationBridge.ts:7314` — `seed,` inside `getHudState()` return
  - `src/game/simulation/bridge/saveGameOps.ts:210` — writes `getSeed()` into the blob `seed` field
  - `tests/simulation/saveLoad.test.ts:167-184` — only asserts `frame.seed`
- **Finding:** Commit `7bba71e` plumbed `effectiveSeed` to `createWorld` (line 7166) and `createProjector` (line 7171) only. Two other consumers of `seed` survived:
  1. The save serializer reads `getSeed()` which returns the outer constructor `seed`. After load → re-save, the new blob carries the outer (URL-param / default) seed, not the original `savedGame.seed`. The saved blob is then unloadable into a project that tracks seed-based determinism.
  2. `getHudState()` returns the outer `seed`. The HUD seed display, browser-test snapshots via `__AOE2_TEST__.getHudState()`, and any future debug overlay that surfaces the seed all read the wrong value after load.
- **Fix shape:** Change `getSeed: () => seed` to `getSeed: () => effectiveSeed` (or thread the resolved seed up explicitly). Change `seed,` in `getHudState()` to `seed: effectiveSeed,`. Widen `saveLoad.test.ts` to assert `getHudState().seed` and the re-save blob's `seed` both equal the originally loaded seed.

### [V2-2] C-1 monk-conversion regression test is order-dependent *(Claude)*

- **Severity:** low (probably-fine but worth tightening)
- **Theme:** tests
- **Where:** `tests/simulation/monkConversion.test.ts:51`
- **Finding:** The test asserts `expect(finalMilitia!.owner).toBe(1)`, which only passes because civ-engine's `world.query('unit')` iteration order happens to be stable. The actual contract is "first-processed Monk owns the increment, no flip-flop" — the *which* is a side effect of iteration order. If iteration order ever changes (e.g., across save/load — see iter-1 M-7), the asserted owner flips from 1 to 2 and the test fails despite the bug being correctly fixed.
- **Fix shape:** `expect([1, 2]).toContain(finalMilitia!.owner)` plus a separate assertion that the militia is no longer owned by player 3.

### [V2-3] H-3 garrison cross-reference, full H-1 projector seed (the part that was fixed), M-16 ARCHITECTURE.md refresh — verified correct *(Codex + Gemini + Claude — agreement)*

- The H-3 invariant covers all three breakage modes the regression test (`tests/simulation/saveLoadIntegrity.test.ts:14-63`) exercises.
- The fixed half of H-1 (projector / world consume `effectiveSeed`) is correct; the unfixed half is V2-1 above.
- ARCHITECTURE.md `bridge/` section matches the on-disk topology (11 modules + 3 top-level siblings); `drift-log.md` row added per AGENTS.md rules.

### Verified-also-correct from C-1 fix (with one nit)

- **[V2-4 — applyMonkConvert per-tick guard stale-state edge case](#m2-7-applymonkconvert-per-tick-guard-can-write-stale-default-after-same-tick-flip-claude)** *(Claude)* — see M2-7 below. Self-healing next tick, but the in-between state is misleading.

---

## Critical

*(none new — iter-1's still-open clusters C-2 enum validation, H-2 wider round-trip coverage, H-4 / N-1 bridge size remain.)*

---

## High

### [H2-1] Same technology can be researched twice if queued in two producer buildings simultaneously *(Claude)*

- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:3406-3409` (`enqueueResearch` dedupe), `:5467-5469` (production queue completion); `src/game/simulation/bridge/technologyOps.ts:158-475` (no idempotency guard in `applyTechnology`)
- **Finding:** `enqueueResearch` only blocks "already in *this* building's queue". `getResearchOptions` filters via `hasTechnology(...)`, but a tech in flight in Blacksmith A is not yet researched, so it can be queued in Blacksmith B too. Both complete; `applyTechnology` runs twice. For idempotent techs (`'fletching'`: `combat.attackDamage = base + 1`) double-fire is harmless, but every Blacksmith tier (`'forging'`, `'iron-casting'`, `'blast-furnace'`, `'bracer'`, `'chemistry'`, all armor tiers, `'bodkin-arrow'`, ...) uses `combat.attackDamage += 1` / `combat.armor += 1`. A player with 2+ Blacksmiths can race-queue and get `+2` instead of `+1`. AI build order does not preclude multi-Blacksmith.
- **Fix shape:** Either (a) one-line guard at the top of `applyTechnology`: `if (hasTechnology(owner, technologyType)) return;`, or (b) widen `enqueueResearch` to also reject techs currently in flight in any owned producer.

### [H2-2] Carried gather amount silently zeroed when no drop-off path exists *(Claude)*

- **Theme:** correctness, player-experience
- **Where:** `src/game/simulation/createSimulationBridge.ts:5694-5697`
- **Finding:** The `to-dropoff` task branch resets `gatherer.carriedAmount = 0` and `gatherer.carriedResource = null` whenever `findBuildingApproachPlan` returns `null`. A temporarily blocked path (an enemy unit in the way, a drop-off rebuilding) silently zeroes the player's carried wood / gold / stone / food load. Canonical AoE2 idles the villager (preserving the load) until a path opens.
- **Fix shape:** Only zero out when `carriedAmount === 0 || carriedResource === null`; otherwise transition `task = 'idle'` (or stay in `to-dropoff`) and retry next tick.

### [H2-3] Black Forest map silently drops a starting stone node *(Codex)*

- **Theme:** correctness
- **Where:** `src/game/simulation/mapGeneration/blackForestMap.ts:31-33,61-74`; `src/game/simulation/mapGeneration/startingOffsets.ts:52-56`; `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts:52-53`; `tests/simulation/prototypeScenario.test.ts:475-504`
- **Finding:** Black Forest seeds trees into every remaining forest cell before `applyStandardPlayerOpening` runs, but the carved start pocket is radius 6 while `STARTING_STONE` includes `{ x: 1, y: 6 }` outside that radius. The tree claims the cell first; `applyResourcePatch()` ignores the rejected `addResourceSpawn(...)` (silent no-op since the spawn-list helper enforces first-write-wins) and the map ships with one fewer starting stone node than the standard opening promises. The Black Forest test only checks villagers / Town Centers / berries.
- **Fix shape:** Either widen the carved pocket radius to ≥7, or have `placeForestCluster` consult `cellBlockedByScenarioEntity` (extended to also reserve the starting-resource offset cells), or assert that `addResourceSpawn(...)` returned true and surface the failure to the bridge bootstrap validator.

---

## Medium

### [M2-1] `findPreferredVisibleEnemyBuilding` only checks anchor-cell visibility *(Gemini)*

- **Theme:** correctness
- **Where:** `src/game/simulation/bridge/targetFindingOps.ts:316`
- **Finding:** The visibility filter calls `visibility.isVisible(building.x, building.y)` (the anchor cell). `createProjector` uses `isFootprintVisible(...)` from `pureHelpers.ts` — the canonical helper that walks the full footprint. AI / auto-aggression therefore fails to target large buildings (TC, Castle, Wonder) when only non-anchor cells are visible to the player, even though the building is rendered. Diverges from the rendering contract.
- **Fix shape:** Replace the `visibility.isVisible(building.x, building.y)` call with `isFootprintVisible(building, visibility, owner)` parity.

### [M2-2] Save button discards the download fallback when `localStorage.setItem` fails *(Codex)*

- **Theme:** correctness
- **Where:** `src/ui/hud/saveLoadPanel.ts:159-165`
- **Finding:** The Save button writes `localStorage`, catches `setItem` failure, surfaces a generic toast, and **returns before** `triggerBlobDownload(json)`. In private-browsing Safari, quota-exhausted localStorage, or any setup where the storage write fails, the player loses the only remaining export path even though the JSON blob is already prepared. Browser suite only covers the happy-path localStorage flow.
- **Fix shape:** Try `localStorage.setItem`; on failure (especially `QuotaExceededError`), continue to `triggerBlobDownload(json)` and surface a clearer toast that the save was downloaded instead of stored.

### [M2-3] AI `findAvailableVillager` treats actively-gathering villagers as available *(Claude)*

- **Theme:** correctness, AI behavior
- **Where:** `src/game/simulation/createSimulationBridge.ts:3671-3680`
- **Finding:** "Available" is gated on `!unitCommands.has(id)`. Villager gathering uses `GathererComponent`, not `unitCommands`, so every gathering villager qualifies as "available" alongside truly idle villagers; iteration order picks the first match. The AI build-order loop calls `findAvailableVillager` up to 3× per decision tick (Watch Tower / Wonder / next build), repeatedly disrupting gather progress.
- **Fix shape:** Two-pass priority — first match `gatherer?.task === 'idle' && !unitCommands.has(id)`, then fall back to any villager. Mirrors canonical AoE2 "idle → unassigned → on-resource".

### [M2-4] Conquest resolver: simultaneous mutual annihilation grants human "defeat" instead of a draw *(Claude)*

- **Theme:** correctness, game design
- **Where:** `src/game/simulation/createSimulationBridge.ts:6232-6240`; `MatchState.outcome` schema
- **Finding:** Order is "if human has no presence → defeat (early return); else if all enemies have no presence → victory". A tick destroying both sides' last unit/building reaches the human-presence check first. `MatchState.outcome` only allows `'running' | 'victory' | 'defeat'` — partly schema-driven.
- **Fix shape:** Either widen outcome to include `'draw'` and resolve simultaneous extinction as draw, or document the human-loses-on-tie semantics in the win-condition spec.

### [M2-5] AI Watch-Tower defensive response gated on Blacksmith *(Claude)*

- **Theme:** game design, AI behavior
- **Where:** `src/game/simulation/createSimulationBridge.ts:4503-4514`
- **Finding:** AI's "saw an enemy near base, build Watch Tower" response requires `hasCompletedBuilding(owner, 'blacksmith')`. Canonical AoE2 unlocks Watch Tower in Feudal as soon as Lumber Camp + Mining Camp exist. The Blacksmith gate makes the AI unable to respond to early Feudal aggression with the option canonical AoE2 affords it.
- **Fix shape:** Drop the Blacksmith requirement (matches canonical Feudal gating) or document why this is intentional.

### [M2-6] HUD controller `destroy()` not exposed (iter-1 H-7 still open) *(Claude)*

- **Theme:** cleanliness, correctness
- **Where:** `src/ui/hud/createHudController.ts:76-82, 424, 429-433`; `src/ui/hud/debugOverlay.ts:170-173`
- **Finding:** `debugOverlay.ts:170` already implements a `destroy()` method. `createHudController` returns only `{ getDebugOverlayMode, cycleDebugOverlayMode }` — the recursive RAF `update()` and window F2 keydown remain attached forever. Bundle with the load-flow refactor: `handleLoadGame` already replaces the bridge cleanly; teach `createApp` to also tear down the prior HUD controller before constructing the next one.

### [M2-7] `applyMonkConvert` per-tick guard can write stale default after same-tick flip *(Claude)*

- **Theme:** correctness
- **Where:** `src/game/simulation/bridge/monkTaskOps.ts:360-378`
- **Finding:** When the first-processed Monk hits flip threshold, `conversionState.delete(targetId)` runs inside the flip block, but `monkConvertProcessedThisTick.add(targetId)` already fired earlier. A second-processed Monk on the same tick re-enters: `state = conversionState.get(targetId) ?? { byOwner: monkB.owner, progress: 0 }` resolves to the default; per-tick guard hits; `conversionState.set(targetId, state)` writes the stale default. Self-heals next tick (target is now the second monk's owner so the early-return at 355 fires), but the in-between state is misleading.
- **Fix shape:** Move `monkConvertProcessedThisTick.add` after the flip block, or skip the `set` when the entry was missing.

### [M2-8] `applyShoreFishPatches` and `applyShoreFishPatchesProcedural` are byte-for-byte identical *(Claude)*

- **Theme:** cleanliness
- **Where:** `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts:88-144` vs `:147-202`
- **Finding:** Both 56-line bodies do the same candidate scan, same math, same dedupe. Both exported, both have callers. Pick one; alias the other.

### [M2-9] No fuzz test exercises `createDefaultMap` across multiple seeds *(Claude)*

- **Theme:** tests
- **Where:** `tests/simulation/mapGeneration/defaultMap.test.ts:15-100`
- **Finding:** Every test pins `'aoe2-prototype'` or one alternate seed. Combined with M2-10 below, an arbitrary `?seed=...` URL is one collision away from a hard crash the suite cannot catch.
- **Fix shape:** Add a 10-20 seed corpus and assert `createSimulationBridge(seed)` constructs successfully for each.

### [M2-10] Default-map procedural placement can collide forward-enemy-house spawn with player-2 forest cells *(Claude)*

- **Theme:** correctness
- **Where:** `src/game/simulation/mapGeneration/defaultMap.ts:25-42`; `applyStandardPlayerOpening.ts:524-580` (`placeForestCluster`)
- **Finding:** `createDefaultMap` calls `paintDisc` to clear terrain at `FORWARD_ENEMY_HOUSE_POSITION (39, 18)` then `addBuildingSpawn` for the house — but the building spawn does not consult `spawns.isCellOccupiedByResource`, and forest-cluster placement at owner-2's TC `(48, 24)` at angle `1.25π` reaches ring-12 cells around `(39.5, 15.5)`. With `step ∈ [-4, 4]` per direction, individual tree spawns can land at `(39, 18)`. Bootstrap validator throws "resource at (x,y) overlaps a building footprint" — some seeds refuse to boot. Today's pinned seeds dodge it; switching seeds via URL could surface a hard crash.
- **Fix shape:** Drive `placeForestCluster` through a "blocked by static landmarks" predicate that also excludes `FORWARD_ENEMY_HOUSE_POSITION` / `SCOUT_POSITION` / `DEFAULT_RELIC_POSITIONS`.

### [M2-11] AI `findIdleProducer` returns first match; multi-base AI never trains at second producer until first fills *(Claude)*

- **Theme:** game design, AI behavior
- **Where:** `src/game/simulation/bridge/aiDecisionOps.ts:162-179`
- **Finding:** Iteration order across `world.query('building')` is essentially creation order. AI with a forward Barracks placed second never trains there until the home Barracks fills its 2-entry queue. Forward Barracks rarely trains.
- **Fix shape:** Tie-break by least-loaded producer (queue length) or by distance-to-target.

### [M2-12] `seedToNumber` walks code points but indexes by code unit *(Claude)*

- **Theme:** correctness
- **Where:** `src/game/simulation/mapGeneration/sharedTerrainHelpers.ts:20-26`
- **Finding:** `for (const character of seed)` iterates code points; `character.charCodeAt(0)` returns the first UTF-16 code unit (high surrogate for surrogate pairs). Hash collisions for any non-BMP seed names. Latent today (only ASCII fixture names + URL input).
- **Fix shape:** `hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0`.

### [M2-13] Stale C-1 regression test asserts specific owner *(Claude)*

- **Theme:** tests
- **Where:** `tests/simulation/monkConversion.test.ts:51`
- **Finding:** See V2-2.

### [M2-14] `renderFog` per-frame full-map scan + per-cell allocations *(Gemini)*

- **Theme:** efficiency
- **Where:** `src/phaser/scenes/gameScene/worldLayers.ts:133`
- **Finding:** Every frame, nested `y/x` loop over the entire map. Allocates two new `Set` objects from `number[]` arrays and calls `fogLayer.fillRect` per non-visible cell. Standard 120×120 = 14 400 iterations + 2 set allocations / frame.
- **Fix shape:** Hoist the `Set` allocation; render fog only when the visibility frame's cell list changes (compare via tick + visibility-version counter); or cache the fog `Graphics` and re-paint only when frame changes.

### [M2-15] `getSnapshot` triggers redundant projecting and filtering *(Gemini)*

- **Theme:** efficiency, design
- **Where:** `src/app/bootstrap/browserTestApi.ts:98`
- **Finding:** `getSnapshot` calls multiple bridge methods (`getHudState`, `getRenderState`, etc.). Each triggers a full entity filter / projection pass. Reinforces the iter-1 H-4 deferred fix.
- **Fix shape:** Same as iter-1 H-4: cache the projected list per-tick.

### [M2-16] ARCHITECTURE.md says `app/bootstrap/` hosts a "dev HTTP API used by browser tests" *(Codex)*

- **Theme:** docs
- **Where:** `docs/architecture/ARCHITECTURE.md:11`; `src/app/bootstrap/browserTestApi.ts:107-113`; `tests/browser/helpers/gameTestHelpers/snapshot.ts:10,18-19`
- **Finding:** The actual seam is an in-page `window.__AOE2_TEST__` API installed by `installBrowserTestApi(...)` and consumed via `page.evaluate(...)`. The "dev HTTP API" description is stale; misleads future test-harness work.

---

## Low / Nit

### [L2-1] `destroyUnitEntity` comment claims "drop the relic at the Monk's last cell" but body never repositions *(Claude — extends iter-1 L-2)*

- **Where:** `src/game/simulation/createSimulationBridge.ts:3087-3092`
- **Finding:** The relic ends up at the Monk's last cell because `prototypeMonkBehavior` glues the relic to the Monk every tick (`:5365-5379`). Comment misleads. Either delete the dead local + reword, or add an explicit `setPositionAndSyncOccupancy`. Iter-1 L-2 still standing.

### [L2-2] `handleLoadGame` re-installs the browser-test API but does not re-create the HUD controller *(Claude)*

- **Where:** `src/app/bootstrap/createApp.ts:33-41, 43-65`
- **Finding:** HUD facade arrows re-read the closure variable, so HUD keeps working — by accident. No `setBridge` symmetry with `scene.setBridge`. Document or expose.

### [L2-3] `cellBlockedByScenarioEntity` corridor reservation uses hard-coded extent *(Claude)*

- **Where:** `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts:323-356`
- **Finding:** Each invocation builds the closure around the *current* `start.townCenter`. With current TC layout no collision; future tighter TC layout could re-introduce wall-in. Either compute corridors against every player's TC or assert `corridorExtent < TC_distance / 2`.

### [L2-4] `getResearchOptions` doesn't enforce predecessor-tier completion *(Claude)*

- **Where:** `src/game/simulation/createSimulationBridge.ts:4006-4022`
- **Finding:** `isAtLeastAge(owner, 'castle-age')` flips true the tick the age-up applies; no check that every in-flight Castle-Age research has finished. Player can queue Castle-Age + Imperial-tier research at the same time. Probably acceptable for prototype.

### [L2-5] `wildlifeStates.targetEntityRef` skips `getEntityRef` re-resolution on load *(Claude)*

- **Where:** `src/game/simulation/saveSchema.ts:80-94`; bridge load path
- **Finding:** Other refs guarded by `refFromSerialized`. Mostly invariant under `World.deserialize`, but asymmetric with siblings. Same flavor as iter-1 M-3.

### [L2-6] Default-map "produces different scenarios for different seeds" test only checks `not.toEqual` *(Claude)*

- **Where:** `tests/simulation/mapGeneration/defaultMap.test.ts:22-26`
- **Finding:** Two scenarios that differ by a single tile pass the test but visually look identical. Strengthen by asserting at least one starting-resource cluster anchor differs by ≥2 cells.

### [L2-7] `isEdgePanEnabled` overly restrictive *(Gemini)*

- **Where:** `src/phaser/scenes/gameScene/cameraController.ts:168`
- **Finding:** Edge panning hard-disabled unless fullscreen or window is maximized. Frustrates large-windowed-mode players who expect canonical RTS edge-pan.
- **Note:** This was deliberately added in the 2026-04-23 devlog ("fullscreen-only edge-pan safeguard") so this finding is design-disagreement, not a bug. Worth a re-discussion with game design.

### [L2-8] Hardcoded targeting priorities (iter-1 M-9 still open) *(Gemini)*

- **Where:** `src/game/simulation/bridge/targetFindingOps.ts:167, 199`
- **Finding:** `targetPriority` and `buildingTargetPriority` are long `switch` statements. Iter-1 M-9 covered the bigger tech-tree case; this is the same shape applied to combat.

### [L2-9] `applyForestPatch` and `applyResourcePatch` order checks asymmetrically *(Gemini — re-reflagged from iter-1 L-1)*

- **Where:** `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts:64-86`
- **Finding:** Iter-1 L-1 still standing; no corruption today.

---

## Verified-not-bugs (do not re-investigate)

From Codex:

- The monk flip-flop fix is correct: `applyMonkConvert()` now checks `monkConvertProcessedThisTick` before resetting ownership; `prototypeMonkBehavior` clears the set once per tick at `createSimulationBridge.ts:5298`. The "first processed monk wins this tick" contract is intact (with the V2-2 nit on test strength).
- The garrison cross-reference fix is correct and appropriately fail-fast.
- The ARCHITECTURE.md `bridge/` topology refresh is accurate for the directory itself.

From Gemini:

- **AI villager rebalance with zero villagers** — silent no-op is intended (re-confirms iter-1's H-5 rejection).
- **`applyForestPatch` OOB access** — `setTerrainKind` has internal bounds checking; safe even if order is asymmetric (see L2-9).
- **`conversionState` cleanup** — `destroyUnitEntity(id)` correctly cleans entries where the dying unit is the *target* of conversion (keyed by `targetId`).

From Claude:

- **`destroyUnitEntity`'s relic-drop comment misleads but the relic actually does end up at the Monk's last cell** — `prototypeMonkBehavior` repositions the relic onto the Monk every tick. Death cleanup just needs to wipe the carry map (which it does). Comment fix only — do not add a redundant `setPositionAndSyncOccupancy`.
- **Production-queue `entry.kind === 'unit' && entry.unitType` short-circuit at line 5446 is not dead code** — defensive guard for save/load corruption that could carry `unitType: undefined`.
- **`currentRelicHoldingOwner` early-returns `null` when relics are in flight on a Monk** (`bridge/matchEndOps.ts:176-178`) — correct. A Monk carrying a relic mid-walk should not satisfy the relic-victory predicate.
- **`resolveSheepClaimOwner` tie-break** (`bridge/visibility.ts:200-213`) — handles `claimedOwner === null` correctly on first iteration via `claimedOwner ?? +Inf`.
- **`World.deserialize` preserves entity ids + generations** — the H-3 cross-reference check happens against valid `EntityRef`s. The asserted error path is the partial-blob scenario (corruption / drift / hand-edit), not normal save round-trip.
- **The `CELL_SIZE * 0.5` offsets in `cameraController.getScreenPointForCell`** are intentional cell-center alignment.
- **Monastery destruction relic-drop fallback "stack on anchor cell"** (`createSimulationBridge.ts:3196-3198`) — relics are resources without unit-occupancy; overlap is intended.

---

## Top issues to fix first (synthesized)

1. **[V2-1] Finish the H-1 seed fix** *(Codex + Claude — agreement)* — `getSeed: () => effectiveSeed` at `createSimulationBridge.ts:6894` and `seed: effectiveSeed,` at `:7314`. Widen `tests/simulation/saveLoad.test.ts` to assert both paths. Highest priority because (a) two reviewers caught it independently, (b) it breaks the determinism contract on the load → re-save path that's ARCHITECTURE.md-load-bearing.
2. **[H2-1] Tech double-research idempotency guard** *(Claude)* — one-line `if (hasTechnology(owner, type)) return;` at the top of `applyTechnology` in `bridge/technologyOps.ts`, plus a regression test that queues `'forging'` at two Blacksmiths and asserts `attackDamage` only gains `+1`.
3. **[H2-3] Black Forest stone loss** *(Codex)* — widen the carved start pocket so `STARTING_STONE` cells fit, and have `applyResourcePatch` (or the spawn-list helper) surface rejected adds to the bootstrap validator. Add a regression test that asserts the standard per-owner stone count on the Black Forest seed.
4. **[H2-2] Carried gather load preserved on temp path-block** *(Claude)* — guard `gatherer.carriedAmount = 0` behind "no carry exists"; otherwise `task = 'idle'`. Regression test: villager carrying wood + drop-off momentarily blocked + path reopens → load delivered, not lost.
5. **[M2-1] `findPreferredVisibleEnemyBuilding` footprint visibility** *(Gemini)* — replace anchor-cell `visibility.isVisible` with `isFootprintVisible` parity to `createProjector`. Regression test: large building with only non-anchor cells visible is still targetable.

`[M2-2]` (save-panel download fallback) and `[M2-3]` (AI villager-availability priority) are also small, isolated correctness fixes worth bundling with the same sprint if scope allows.

---

## Process notes for next iteration

- **Gemini quota issue:** `gemini-2.5-pro` and `gemini-3.1-pro-preview` were both quota-exhausted on this account when this iteration ran. Reset window was ~13 h. Fell back to `gemini-3-flash-preview` (probed via a `ping` test first). Flash is weaker on deep reasoning than pro/pro-preview but still produced the M2-1 footprint-visibility finding. **For iteration 3, retry pro-preview first; only fall back to flash if pro-preview is still rate-limited.**
- **Codex's PowerShell wrapper noise:** `codex exec` on Windows produces many `Cannot set property. Property setting is supported only on core types in this language mode.` warnings interleaved with its real output. These are harmless (PowerShell constrained-language mode rejecting Codex's `[Console]::OutputEncoding` setter) and the actual review is at the tail of the file. Worth a one-line note in `AGENTS.md` so reviewers don't worry about them.
- **Claude was again the most prolific** (204 lines vs Codex's ~50 lines of actual review content vs Gemini's ~50). Claude found 11 of the 16 medium findings and both new highs (H2-1, H2-2). Codex's strength was the verification pass — it caught the incomplete H-1 fix faster than Claude (Claude found it as well, but Codex flagged saveGameOps.ts:210 in addition to the HUD path).
- **Iteration 1's "explicit verified-not-bugs section" prompt change worked:** all three reviewers emitted that section this round. Keep for iteration 3.
