I've gathered enough material. Let me compile the iteration 2 findings.

# Full Codebase Review — 2026-04-25 (Iteration 2)

**Reviewer:** Claude (Opus). Read-only audit of the working tree at HEAD `2e5283d`. Treats iteration 1's `REVIEW.md` as known prior art.

---

## Verification of iteration-1 fixes

### [V-1] H-1 fix is incomplete — `getHudState().seed` still leaks the outer constructor seed after load

- **Severity:** medium
- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:7314`
- **Finding:** Commit `7bba71e` correctly routes `effectiveSeed` to `createProjector` so `getRenderState().frame.seed` matches the loaded blob. But the same outer `seed` is still returned by `getHudState()` at line 7314 (inside the outer scope, not `createWorld`'s shadowed `seed`). Iteration 1 H-1 explicitly named "projector and HUD use outer seed". `HudState.seed` (`types.ts:413`) is part of the public bridge API; `__AOE2_TEST__.getHudState()` and any future debug-overlay or seed display will see the URL-param / default seed instead of the saved-blob seed. The new test (`saveLoad.test.ts:168-184`) only asserts on `frame.seed`, so the regression for `HudState.seed` lands green.

### [V-2] C-1 monk-conversion fix is correct only while `world.query('unit')` iteration order is stable across ticks

- **Severity:** low (probably-fine but worth noting)
- **Theme:** correctness
- **Where:** `src/game/simulation/bridge/monkTaskOps.ts:360-378`; `tests/simulation/monkConversion.test.ts:51`
- **Finding:** The fix prevents the per-tick flip-flop (the second-processed monk no longer wipes progress to zero in the same tick). But if `world.query('unit')` ever iterates monks in a different order on different ticks (e.g., across save/load — see iteration 1 M-7), the *first-processed monk* alternates owners and the `state.byOwner !== monkUnit.owner` reset fires every tick, so progress oscillates between 0 and `monkConvertProgressPerTick`. The regression test asserts a specific outcome (`expect(finalMilitia!.owner).toBe(1)`), which only passes because civ-engine's iteration happens to be stable. Consider asserting `toBeOneOf([1, 2])` or sorting the inner Monk loop by id so the contract is "deterministic-and-not-flipping" rather than "deterministic-because-iteration-stable".

### [V-3] H-3 garrison cross-reference check, H-1 projector seed, and M-16 ARCHITECTURE.md refresh — verified correct

- The H-3 invariant covers all three breakage modes the regression test exercises (`saveLoadIntegrity.test.ts:14-63`).
- ARCHITECTURE.md `bridge/` section now matches the on-disk topology; `drift-log.md` row added per AGENTS.md rules.
- The projector now consumes `effectiveSeed` so loaded matches' projected frames advertise the right seed. (See V-1 for the still-broken HUD path.)

---

## Critical

_None new beyond iteration 1's still-open clusters (C-2 enum validation, H-2 wider round-trip coverage, H-4/N-1 bridge size, etc.)._

---

## High

### [H2-1] Same technology can be researched twice if queued at two producer buildings simultaneously, doubling non-idempotent bonuses

- **Severity:** high
- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:3406-3409` (queue-in-this-building dedupe); `src/game/simulation/createSimulationBridge.ts:5467-5469` (production-queue completion); `src/game/simulation/bridge/technologyOps.ts:158-475` (no idempotency guard)
- **Finding:** `enqueueResearch` only blocks "already in *this* building's queue". `getResearchOptions` filters out *already-researched* techs via `hasTechnology(...)` — but at queue time, a tech in flight in Blacksmith A is *not* yet in `researchedTechnologies`, so the same tech can be queued at Blacksmith B. Both complete; both call `applyTechnology`. For idempotent cases like `'fletching'` (`combat.attackDamage = base + 1`) the double-fire is harmless. But every Blacksmith tier (`'forging'`, `'iron-casting'`, `'blast-furnace'`, `'bracer'`, `'chemistry'`, `'plate-mail-armor'`, `'plate-barding'`, `'scale-mail-armor'`, `'chain-mail-armor'`, `'chain-barding-armor'`, `'leather-archer-armor'`, `'padded-archer-armor'`, `'ring-archer-armor'`, `'bodkin-arrow'`, `'scale-barding-armor'`) uses `combat.attackDamage += 1` / `combat.armor += 1` — non-idempotent — so a player with 2+ Blacksmiths can race-queue the same tech and get +2 instead of +1. Multi-Blacksmith is uncommon in canonical AoE2, but the bug is real and the AI's build order does not preclude it. Either guard `applyTechnology` with an early-return if `hasTechnology(owner, technologyType)` is already true, or filter `getResearchOptions` to also exclude techs *currently in flight in any owned producer*.

### [H2-2] Carried gather amount silently lost when no drop-off path exists

- **Severity:** medium-to-high (player-experience visible)
- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:5694-5697`
- **Finding:** The `to-dropoff` branch resets `gatherer.carriedAmount = 0` and `carriedResource = null` whenever `findBuildingApproachPlan` returns `null` — even when the villager *has* carried resources. A temporarily blocked path (an enemy unit / fresh wall in the way) or a destroyed-then-rebuilding-but-incomplete drop-off site silently zeroes the player's load. Canonical AoE2 has the villager idle (preserving the load) until a path opens. Easy fix: only zero out when `carriedAmount === 0 || carriedResource === null`; if a load exists but there's no plan, set `task = 'idle'` and keep the carry intact for the next tick.

---

## Medium

### [M2-1] `applyShoreFishPatches` and `applyShoreFishPatchesProcedural` are byte-for-byte identical duplicates

- **Severity:** medium
- **Theme:** cleanliness
- **Where:** `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts:88-144` vs `:147-202`
- **Finding:** Both 56-line bodies do the same candidate scan, same `targetCount`/`startIndex`/`stride` math, same dedupe, same fallback. `diff` shows only the function name and a stripped blank line differ. Both are exported and both have callers (the procedural variant is used by the default map; the original by the alternate maps via `prototypeScenario.ts`). Pick one and re-export the other as an alias.

### [M2-2] Default-map procedural placement can collide forward-enemy spawns with player-2 forest cells, relying on the bridge bootstrap validator to crash boot

- **Severity:** medium
- **Theme:** correctness / design
- **Where:** `src/game/simulation/mapGeneration/defaultMap.ts:25-42`; `applyStandardPlayerOpening.ts:524-580` (`placeForestCluster`)
- **Finding:** `createDefaultMap` calls `paintDisc` to clear terrain at `FORWARD_ENEMY_HOUSE_POSITION (39, 18)` then `addBuildingSpawn` for the house — but the building spawn does **not** consult `spawns.isCellOccupiedByResource`, and forest-cluster placement at owner 2's TC (48, 24) at angle 1.25π reaches ring-12 cells around `(39.5, 15.5)`. With a `step ∈ [-4, 4]` walk per direction, individual tree spawns can land at `(39, 18)`. The result is a tree resource and a building anchored at the same cell; the bootstrap validator at line 1731-1733 throws `"resource at (x,y) overlaps a building footprint"`, which means *some seeds will refuse to boot*. Today only `aoe2-prototype` is exercised by the default-map tests and that seed happens to dodge the collision; switching seeds via `?seed=...` could surface an unexpected hard-crash. Either drive `placeForestCluster` through a "blocked by static landmarks" predicate that also excludes `FORWARD_ENEMY_HOUSE_POSITION`/`SCOUT_POSITION`/`DEFAULT_RELIC_POSITIONS`, or add a fuzz test that runs `createDefaultMap` against a seed corpus and asserts the bridge boots.

### [M2-3] AI `findAvailableVillager` treats actively-gathering villagers as "available", silently yanking them off resources

- **Severity:** medium
- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:3671-3680`
- **Finding:** "Available" is gated on `!unitCommands.has(id)`, but villager gathering does not flow through `unitCommands` — it's tracked only on `GathererComponent`. So every gathering villager qualifies as "available" alongside truly idle villagers; the first match in iteration order is returned. The AI build-order loop calls `findAvailableVillager` up to three times per decision tick (Watch Tower / Wonder / next-build), repeatedly disrupting gather progress. Canonical AoE2 prefers idle → unassigned → on-resource. Adding a `gatherer?.task !== 'idle' || hasExplicitGatherOrder` priority pass and falling back to `findOwnedUnit(owner, 'villager')` only as a last resort would match player expectations and tighten AI economy throughput.

### [M2-4] Conquest resolver: simultaneous mutual annihilation silently grants human "defeat" instead of a draw

- **Severity:** medium
- **Theme:** correctness / design
- **Where:** `src/game/simulation/createSimulationBridge.ts:6232-6240`
- **Finding:** The order is "if human has no presence → defeat (early return); else if all enemies have no presence → victory". A tick that destroys both sides' last unit/building reaches the human-presence check first and stamps `defeat`. There's no draw outcome, no logged-tie, and no "the AI cleared the board on the same tick the trebuchet ended" message. AoE2 supports draws; the prototype's `MatchState.outcome` only allows `'running' | 'victory' | 'defeat'`, so this is partly schema-driven. Either widen `MatchState.outcome` to include `'draw'` and resolve simultaneous extinction as such, or document the human-loses-on-tie semantics in the win-condition spec so it is not surprise behavior.

### [M2-5] AI gates Watch-Tower defensive response on Blacksmith, so the response only fires once a player has already aged into Castle-prep

- **Severity:** medium
- **Theme:** game design / AI behavior
- **Where:** `src/game/simulation/createSimulationBridge.ts:4503-4514`
- **Finding:** The AI's "saw an enemy near the base, build a Watch Tower" response is wedged behind `hasCompletedBuilding(owner, 'blacksmith')`. In canonical AoE2, Watch Tower unlocks in Feudal as soon as a Lumber Camp + Mining Camp exist — well before the typical Blacksmith. The artificial blacksmith gate means the AI cannot wall up against early Feudal aggression even though it has the resources and the option. Either drop the Blacksmith requirement (matches canonical Feudal Watch Tower availability) or make the gate explicit in the AI tuning constants so future edits do not mistake it for accidental.

### [M2-6] HUD controller never returns a `destroy()`, so the F2 listener and the recursive `requestAnimationFrame(update)` outlive every match

- **Severity:** medium (still iteration-1 H-7)
- **Theme:** cleanliness / correctness
- **Where:** `src/ui/hud/createHudController.ts:76-82, 424, 429-433`; `src/ui/hud/debugOverlay.ts:170-173`
- **Finding:** Iteration 1 flagged this as deferred. `debugOverlay.ts:170` already implements a `destroy()` method, so the inner controller is ready — but `HudController` (lines 76-82) does not export `destroy`, and `createHudController` returns just `{ getDebugOverlayMode, cycleDebugOverlayMode }`. The recursive RAF `update()` and the window keydown listener remain attached forever. Worth bundling with the load-flow refactor: `handleLoadGame` already replaces the bridge cleanly; teaching `createApp` to also tear down the prior HUD controller before constructing the next one closes the leak.

### [M2-7] `applyMonkConvert` per-tick guard path can store a stale default `{byOwner: monkB, progress: 0}` after a same-tick flip

- **Severity:** medium-low
- **Theme:** correctness
- **Where:** `src/game/simulation/bridge/monkTaskOps.ts:360-370`
- **Finding:** When the first-processed Monk (owner A) hits `state.progress >= flipThreshold`, the code calls `conversionState.delete(targetId)` inside the flip block (line 438) — but `monkConvertProcessedThisTick.add(targetId)` already fired (line 378) before the flip. A second-processed Monk (owner B) on the same tick re-enters: `state = conversionState.get(targetId) ?? { byOwner: monkB.owner, progress: 0 }` resolves to the default; the per-tick guard hits; `conversionState.set(targetId, state)` writes the stale default for owner B against a target that just became owner A's. The `targetUnit.owner === monkUnit.owner` early-return at line 355-359 cleans it up next tick, so it is self-healing — but the in-between state is misleading. Move the `monkConvertProcessedThisTick.add` *after* the flip block (or skip the `set` when the existing entry is missing).

### [M2-8] No fuzz test exercises `createDefaultMap` across multiple seeds; the validator-throws path is uncovered

- **Severity:** medium
- **Theme:** tests
- **Where:** `tests/simulation/mapGeneration/defaultMap.test.ts:15-100`
- **Finding:** Every test pins `'aoe2-prototype'` or one alternate seed (`alt-seed-one`). The "guarantees every starting resource kind near every player base" + "canonical per-owner counts" assertions are strong, but neither covers "boots cleanly through `createSimulationBridge` into a running scenario". Combined with M2-2 above, an arbitrary `?seed=` on the URL is one collision away from a hard crash that the suite cannot catch. Add a small seed corpus (10-20 names) and assert the bridge constructs successfully for each.

### [M2-9] `seedToNumber` walks Unicode code points but indexes by code-unit `charCodeAt(0)`, so non-ASCII seeds compute the wrong hash

- **Severity:** low-medium (latent — only matters if a non-ASCII seed name appears)
- **Theme:** correctness
- **Where:** `src/game/simulation/mapGeneration/sharedTerrainHelpers.ts:20-26`
- **Finding:** `for (const character of seed)` iterates over code points (so an emoji is one iteration), but `character.charCodeAt(0)` returns the *first UTF-16 code unit* of that code point — for a surrogate-pair character that is the high surrogate. The hash for `'foo🦌'` is determined by the UTF-16 high surrogate of the deer, which collides with a different deer-shaped seed that happens to share the same high surrogate. Today the only seeds in play are ASCII fixture names + the URL-input seed; users typing kanji or emoji into `?seed=` would get unintuitive map collisions. Replace the loop body with `hash = (hash * 31 + character.codePointAt(0)) >>> 0` or just iterate by index (`seed.charCodeAt(i)`).

### [M2-10] AI `findIdleProducer` returns the first match; cross-base AI with two of the same building always trains at the first one

- **Severity:** low-medium
- **Theme:** game design / AI behavior
- **Where:** `src/game/simulation/bridge/aiDecisionOps.ts:162-179`
- **Finding:** Iteration order across `world.query('building')` is essentially "creation order". An AI with a forward Barracks placed second never trains there until the home Barracks fills its 2-entry queue — and even then, the SECOND match in iteration is the next miss. Net effect: the forward Barracks rarely trains, blunting expansion play. Canonical AoE2 AI distributes the queue across producers (round-robin or by distance to threat). Worth a min-distance-to-target tie-break, or at minimum a load-balancing pass that prefers the *least-loaded* producer rather than the first.

### [M2-11] The C-1 regression test asserts `finalMilitia!.owner === 1` rather than "consistently one owner"; passes only because of stable iteration order

- **Severity:** low-medium
- **Theme:** tests
- **Where:** `tests/simulation/monkConversion.test.ts:51`
- **Finding:** See V-2. A future engine change to entity iteration order (or any save/load deserialization that reorders entities — iteration 1 M-7) would flip the asserted owner from 1 to 2, failing the test even though the bug is still fixed. Recommend `expect([1, 2]).toContain(finalMilitia!.owner)` plus a separate assertion that the militia is *no longer owned by player 3* (the actual contract).

---

## Low / Nit

### [L2-1] `destroyUnitEntity` comment claims "drop the relic at the Monk's last cell" but the body never repositions the relic

- **Severity:** low (cosmetic, behavior is correct)
- **Theme:** docs / cleanliness
- **Where:** `src/game/simulation/createSimulationBridge.ts:3087-3092`
- **Finding:** The relic actually ends up at the Monk's last cell because `prototypeMonkBehavior` glues the relic position to the Monk position every tick (`createSimulationBridge.ts:5365-5379`). So the relic *happens* to be in the right place when the Monk dies. The local `carriedRelicId` is read but never used (iteration 1 L-2 still standing). Either delete the dead local + reword the comment to "the relic is already at the Monk's last cell from `prototypeMonkBehavior`", or call `setPositionAndSyncOccupancy` here so the comment matches the code.

### [L2-2] `handleLoadGame` re-installs the browser-test API but does **not** re-create the HUD controller, leaving the prior controller attached to the prior bridge facade

- **Severity:** low
- **Theme:** cleanliness
- **Where:** `src/app/bootstrap/createApp.ts:33-41` plus `:43-65`
- **Finding:** The HUD facade closes over a `let bridge: SimulationBridge` that gets reassigned on load (line 35), so the HUD does keep working after a load. But the bridge *facade arrows* (`getHudState: () => bridge.getHudState()` at line 48) re-read the closure variable on every call, so this works by accident — there is no `setBridge`-style explicit update on the HUD side. If a future caller passes the bridge directly instead of via the facade, the load flow will silently keep using the dead bridge. Document the closure-read contract or expose an explicit HUD `setBridge` for symmetry with `scene.setBridge`.

### [L2-3] `cellBlockedByScenarioEntity` corridor reservation is per-TC with hard-coded extent (13); it does not consider the *other* player's TC

- **Severity:** low (no current breakage, footgun for future map-config changes)
- **Theme:** design
- **Where:** `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts:323-356`
- **Finding:** Each invocation of `applyStandardPlayerOpeningProcedural` builds a `cellBlockedByScenarioEntity` closure around the *current* `start.townCenter`. Owner 1 places its resources first; owner 2's clusters later avoid only owner 2's corridors. With the current `(8, 8)` ↔ `(48, 24)` TC layout the distances are too large for a collision, but a future map config that brings TCs closer (or scales the map down) would have owner 1's resources walk over owner 2's exit corridors and silently re-introduce the very wall-in bug the corridors were added to fix. Either compute corridors against *every* player's TC or assert that `corridorExtent < (TC distance / 2)` at boot.

### [L2-4] `getResearchOptions` allows starting an Imperial-Age option as soon as the Castle Age check fires; the previous tier may still be in flight

- **Severity:** low
- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:4006-4022`
- **Finding:** `isAtLeastAge(owner, 'castle-age')` flips true *the tick the age-up applies*. There is no check that *every* in-flight Castle-Age research has finished. So during a tight build you could queue Castle-Age + a follow-up Imperial-tier research at the same time; the queue order is preserved but the tracker doesn't enforce the prerequisite — the player just gets the Imperial-tier tech as soon as its ticks finish, even before the Castle-Age tier completes. Probably acceptable for the prototype, but worth a one-line "the predecessor tier must also be completed" guard if the team wants strict canonical AoE2 progression.

### [L2-5] `wildlifeStates` save round-trip stores `targetEntityRef: SerializedEntityRef | null` but the load path does not re-resolve via `getEntityRef`, so a stale ref boots intact

- **Severity:** low
- **Theme:** correctness
- **Where:** `src/game/simulation/saveSchema.ts:80-94`; bridge load path for `wildlifeStates`
- **Finding:** Other refs (e.g., `townCenterRefs`, `unitCommands.targetEntityRef`) are guarded by `refFromSerialized` / `world.getEntityRef`. `wildlifeStates.targetEntityRef` is just lifted in. If the wildlife targeted an entity that the engine deserialized with a different generation, the boar attacks a phantom. Mostly invariant under `World.deserialize` (it preserves ids+generations), but the asymmetry is a footgun for future schema work. Same flavor as iteration 1 M-3 (`monkCarriedRelic`).

### [L2-6] Default-map test "produces different scenarios for different seeds" doesn't actually verify a meaningful difference, only `not.toEqual`

- **Severity:** nit
- **Theme:** tests
- **Where:** `tests/simulation/mapGeneration/defaultMap.test.ts:22-26`
- **Finding:** Two scenarios that differ by a single tile fail `not.toEqual` and pass the test, but visually look identical. Strengthen by sampling spawn positions from each and asserting at least one starting-resource cluster anchor differs by more than 2 cells.

---

## Verified-not-bugs (do not re-investigate)

- **`destroyUnitEntity`'s relic-drop comment misleads but the relic actually does end up at the Monk's last cell** — `prototypeMonkBehavior` (`createSimulationBridge.ts:5365-5379`) repositions the relic onto the Monk every tick, so death cleanup just needs to wipe the carry map (which it does). Do not add a redundant `setPositionAndSyncOccupancy` call thinking it's broken — only adjust the comment.
- **Production-queue `entry.kind === 'unit' && entry.unitType` short-circuit at line 5446 is not dead code** — queue entries can in theory carry a `unitType: undefined` from save/load corruption; the guard is defensive, not unreachable.
- **`currentRelicHoldingOwner` early-returns null when relics are in flight on a Monk** (`bridge/matchEndOps.ts:176-178`) — this is correct: a Monk carrying a relic mid-walk should not satisfy the relic-victory predicate. No off-by-one.
- **`resolveSheepClaimOwner` tie-break (`bridge/visibility.ts:200-213`) handles `claimedOwner === null` correctly on first iteration** via `claimedOwner ?? +Inf`. Looked tempting; iteration 1 didn't flag it; verified deterministic across all reachable cases.
- **`World.deserialize` preserves entity ids + generations**, so the H-3 cross-reference check happens against valid `EntityRef`s. The asserted error path is the *partial blob* scenario (corruption / drift / hand-edit), not a normal save round-trip.
- **The `CELL_SIZE * 0.5` offsets in `cameraController.getScreenPointForCell`** are intentional cell-center alignment — looked off-by-one, isn't.
- **Monastery destruction relic-drop fallback "stack on anchor cell"** (`createSimulationBridge.ts:3196-3198`) — relics are resources without unit-occupancy, so overlap is intended. Comment is accurate.

---

## Top issues to fix first

1. **[H2-1] Tech double-research via simultaneous queueing in two producers** — `applyTechnology` needs an `if (hasTechnology(owner, type)) return;` guard. One-line correctness fix; protects every non-idempotent tier (forging / iron-casting / blast-furnace / bracer / chemistry / armor chain / etc.).
2. **[V-1] Finish the H-1 fix at `createSimulationBridge.ts:7314`** — change `seed,` to `seed: effectiveSeed,` in `getHudState()`. Mirror in any other site `grep "\bseed\b" src/game/simulation/createSimulationBridge.ts` flags as outer-scope.
3. **[H2-2] Stop zeroing carried gather load when the drop-off path is briefly null** at `createSimulationBridge.ts:5694-5697`. Keep the load; just stay in `to-dropoff` (or transition to `idle`) and retry next tick.
4. **[M2-1 + M2-2 + M2-8]** — Map-gen cleanup cluster: dedupe the two `applyShoreFishPatches*` bodies, harden the forward-enemy-house anchor against forest collisions, and add a 10-20 seed fuzz test that boots the bridge for each. One sprint, three findings closed.
5. **[M2-3] AI villager "available" predicate prefers gathering villagers over idle ones** at `createSimulationBridge.ts:3671-3680`. Single-pass priority (idle first, then anything) tightens AI economy and matches AoE2 expectations; cheap.

`[M2-4]` (draw outcome) and `[M2-5]` (Watch-Tower Blacksmith gate) are good game-design follow-ups but lower-priority than the correctness cluster.
