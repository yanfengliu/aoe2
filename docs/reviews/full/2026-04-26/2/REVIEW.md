# Full Codebase Review — 2026-04-26 (Iteration 2)

**Reviewers:** Codex (`gpt-5.4` @ `model_reasoning_effort=xhigh`, `--sandbox read-only`), Gemini (`gemini-3.1-pro-preview` @ `--approval-mode plan`), Claude (`opus` @ `--effort xhigh`). Each ran independently with read-only access to the working tree at HEAD `8d20013`. Iter-1 REVIEW.md (`docs/reviews/full/2026-04-26/1/REVIEW.md`) was loaded as context so previously-shipped V4-1 through V4-25 fixes are not re-flagged. Raw outputs in `raw/codex.md`, `raw/gemini.md`, `raw/opus.md`.

**Note on tool enforcement:** Claude's CLI ignored the explicit "DO NOT modify files" constraint and wrote a draft REVIEW.md to disk. The synthesized version below replaces that draft and folds in all three reviewers' findings.

---

## Executive summary

Iter-1's batch-1 sweep landed cleanly. Verified by direct file reads: V4-1 cast hole closed (`registerBridgeSystems.ts` types each ops factory, no `as RegisterAllSystemsArg` casts), V4-2 trebuchet signatures reconciled to `void`, V4-3 fog-memory delete path footprint-aware (regression test in `tests/simulation/footprintVisibilityConsistency.test.ts`), V4-7 throttle persisted (test gap — see V5-6), V4-8/V4-9/V4-10 efficiency fixes shipped, V4-11 conquest single-pass, V4-13 default branch, V4-14 tick-tagged guard, V4-15..V4-19 cleanliness, V4-22 versioning + `docs/changelog.md` reconciled (AGENTS.md scoped to user-visible). Plus Codex independently caught that **iter-3 V3-24 (multi-base AI `findIdleProducer` first-match)** has actually been fixed — `aiDecisionOps.ts:148-177` is now load-balanced ("LEAST-LOADED" producer with id-tiebreak, the comment at line 149-155 documents it). Claude's draft incorrectly carried V3-24 forward; corrected here.

This iteration surfaces **three new correctness/efficiency findings** (two of which two reviewers agreed on) and **two doc-discipline drift items** (also dual-agreement):

1. **[V5-1] V4-12's `assignAiMonkTasks` skip-guard regresses steady-state cost** *(Claude + Gemini — strongest cross-reviewer agreement)*. `countOwnedUnits(owner, 'monk')` itself walks `world.query('unit')`. AI with no Monks: 1 walk → 1 walk (no savings). AI with Monks (the common steady state): 1 walk → **2 walks**. The iter-1 fix took the cheaper code path that doesn't deliver the savings; the side-map alternative was the right one.
2. **[V5-2] `villagerRebalance` permanently traps villagers gathering a resource with zero-target** *(Gemini — verified real)*. The loop at `aiDecisionOps.ts:225-228` skips kinds with `desired <= 0` to avoid divide-by-zero, but villagers whose `desiredResource = stone` while AI's stone target = 0 (mid-game age transitions) never have their kind selected as the donor — they stay on stone forever, ignoring the build plan.
3. **[V5-3] `GameScene.ts` is 1,034 LOC — exceeds the strict 1,000-line ceiling** *(Claude — user-memory rule)*. Iter-4 V4-19's `buildingRenderer.ts` extraction shrunk it 1,176 → 1,034 but stopped 34 lines short of the strict ceiling.
4. **[V5-4] `saveLoadPanel.handleSaveClick` drops the save entirely if `localStorage.setItem` throws** *(Codex — real UX defect)*. JSON blob is already built and `triggerBlobDownload(json)` exists, but the catch returns early after a toast, never falling back to download. Private browsing / quota / security failures lose the save.
5. **[V5-5] Doc drift** *(Claude V5-3 + Codex Medium-2 — strong agreement)*. AGENTS.md mandates `docs/api-reference.md`, `docs/guides/<topic>.md`, `docs/README.md` — none exist. `ARCHITECTURE.md:11` still describes a "dev HTTP API used by browser tests" — actual seam is `window.__AOE2_TEST__` in-page API. `docs/devlog/summary.md:3` still says V4-22 "needs user input" but it was already shipped (`9094d10`, `package.json` is at `0.1.1`, `docs/changelog.md` exists).

Plus six tail items (test gaps + lower-priority efficiency + nit-grade).

---

## Cross-reviewer agreement

| Theme | Codex | Gemini | Claude |
|---|---|---|---|
| **V4-12 `assignAiMonkTasks` regresses steady-state cost** | — | ✓ (V5-1) | ✓ (V5-2) |
| **`villagerRebalance` traps villagers on zero-target resource** | — | ✓ (V5-2) | — |
| **`GameScene.ts` over 1,000 LOC** | — | — | ✓ (V5-1) |
| **Save-flow drops save on `localStorage.setItem` failure** | ✓ (Med-1) | — | — |
| **Doc drift — AGENTS.md mandates absent / ARCHITECTURE stale / summary stale** | ✓ (Med-2) | — | ✓ (V5-3) |
| **V4-7 throttle test is presence-check, not contract** | — | — | ✓ (V5-4) |
| **V4-14 tick-tagged guard has no regression test** | — | — | ✓ (V5-5) |
| **AI `findIdleProducer` called 7+ times per AI per decision tick** | — | ✓ (V5-3) | — |
| **`getSelectableEntitiesAtCell` walks full queries per click** | — | — | ✓ (V5-6) |
| **AI `attackGroup` duplicate scans** | — | ✓ (V5-4) | — |

---

## Verified iter-1 fixes

All 11 iter-1 batch-1 commits verified landed correctly via direct read of the post-fix files.

| Iter-1 ID | Commit | Site | Verdict |
|---|---|---|---|
| V4-1 cast hole | `608048f` | `registerBridgeSystems.ts:35-98` | **OK** — typed dep-bag, no `as RegisterAllSystemsArg` casts |
| V4-2 trebuchet signature | `608048f` | `registerAllSystemsTypes.ts:105-106` | **OK** — both `=> void` |
| V4-3 fog-memory delete | `0307397` | `fogMemorySystem.ts:107-124` | **OK** — `isFootprintVisible` w/ regression test |
| V4-7 throttle save/load | `15faac2` | `saveGameOps.ts:279`, `hydrateFromSavedGame.ts:289-295` | **OK shape** — but test gap (V5-6) |
| V4-8 lazy scenario gen | `0c32253` | `createWorld.ts:88` | **OK** — `savedGame ? null : createPrototypeScenario(seed)` |
| V4-9 inline filter | `0c32253` | `villagerEconomySystem.ts:116-128` | **OK** |
| V4-10 inline bbox filter | `0c32253` | `selectionInputOps.ts:217-227` | **OK** |
| V4-11 conquest single-pass | `8d20013` | `conquestOutcomeSystem.ts:46-71` | **OK** — single reverse scan, early-exit |
| V4-12 monk skip | `0c32253` | `aiSystem.ts:414-416` | **Implementation regresses steady-state cost** — see V5-1 |
| V4-13 default branch | `2309942` | `humanInputOps.ts:249-254` | **OK** |
| V4-14 tick-tagged guard | `380e741` | `monkTaskAppliers.ts:77,140,148`, `bridgeState.ts:75-83`, `monkBehaviorSystem.ts:96-101` | **OK shape** — but test gap (V5-7) |
| V4-15 occupancy log | `2309942` | `transformOps.ts:159-169` | **OK** |
| V4-16 dead `void` markers | `2309942` | `wirePostSeedOps.ts`, `registerAllSystems.ts` (closed); `cellPassability.ts:146-147` retained — see V5-13 |
| V4-17 `Map.entries()` clone | `2309942` | `playerCommandsSystem.ts:144` | **OK** |
| V4-18 dead re-exports | `2309942` | `wirePostSeedOps.ts:14-19` | **OK** |
| V4-19 `sharedTypes.ts` | `fbfcf40` | `bridge/sharedTypes.ts` (44 LOC) + facade re-export | **OK** |
| V4-21 fog-memory comment | `3aa5b89` | `fogMemorySystem.ts:69-95` | **OK** |
| V4-22 versioning + changelog | `9094d10` | `package.json:3` (`0.1.1`), `docs/changelog.md`, AGENTS.md scope | **OK** |
| V4-23 AGENTS.md CLI flags | `3aa5b89` | AGENTS.md "Code review" | **OK** |
| V4-25 EOF formatting | `3aa5b89` | bridge files | **OK** |
| **V3-24 multi-base AI `findIdleProducer`** *(carry-forward, now resolved)* | (earlier) | `aiDecisionOps.ts:148-177` | **OK** — load-balanced, "LEAST-LOADED" producer with deterministic id-tiebreak |

---

## Critical

*(none — iter-1's deferred clusters C-2 enum validation, H-2 wider round-trip, H-4 partial cache sweep remain explicitly out of scope. No new critical issues.)*

---

## High

### [V5-1] V4-12 `assignAiMonkTasks` guard regresses steady-state cost — `countOwnedUnits` walks the unit query the guard was meant to avoid *(Claude + Gemini — strongest agreement)*

- **Theme:** efficiency, design (regression introduced by an iter-1 fix)
- **Where:** `src/game/simulation/bridge/systems/aiSystem.ts:414-416` (the guard); `src/game/simulation/bridge/playerQueries.ts:99-114` (the implementation of `countOwnedUnits`)
- **Finding:** The iter-1 fix reads:
  ```ts
  if (countOwnedUnits(owner, 'monk') > 0) {
    assignAiMonkTasks(owner);
  }
  ```
  `countOwnedUnits` walks `world.query('unit')` exactly as `assignAiMonkTasks` does internally. Cost analysis:
  - AI has no Monks (pre-Castle-Age, no Monastery): `countOwnedUnits` walks once → returns 0 → skip. **1 walk** (was 1 walk through `assignAiMonkTasks`'s body — no improvement).
  - AI has Monks (Castle/Imperial mid-late game, the common steady state): `countOwnedUnits` walks once → returns >0 → `assignAiMonkTasks` walks again. **2 walks** (was 1 walk — net regression).

  The fix's inline comment claims "no Monks: ~250 component lookups → 0," which is technically true for the no-Monks case but obscures the 2× regression in the much more common with-Monks case. With 4 AIs × 60-tick decision interval × 2 walks instead of 1 = the steady-state cost is doubled.

  Iter-1 reviewers explicitly flagged the alternative ("or maintain an `ownedMonksByOwner` side map"); the shipped fix took the cheaper-to-implement path that doesn't deliver the savings.
- **Fix shape:** Either (a) maintain `ownedMonksByOwner: Map<owner, Set<monkId>>` in `bridgeState.ts`, updated in `entityCreateOps.addUnitEntity` (when `unitType === 'monk'`), `entityDestroyOps.destroyUnitEntity`, and `monkTaskAppliers.flipConvertedUnit` (move between owners on conversion); guard becomes O(1) `ownedMonksByOwner.get(owner)?.size ?? 0 > 0`. Or (b) revert V4-12 — `assignAiMonkTasks`'s inner loop already filters to `unitType === 'monk'`, so its no-Monks no-op is one component read per unit.

### [V5-2] `villagerRebalance` permanently traps villagers gathering a resource with zero-target *(Gemini)*

- **Theme:** correctness, AI economy
- **Where:** `src/game/simulation/bridge/aiDecisionOps.ts:179-261` (specifically the loop at lines 224-238 with the `if (desired <= 0) continue;` skip at lines 225-228)
- **Finding:** `villagerRebalance` builds `actualByKind` by counting all gathering villagers (line 208 — `actualByKind[resource] += 1` for every `gatherer.desiredResource`), then in a separate loop computes the worst-served (deficit) and best-served (donor) kind by `actual / desired` ratio. The ratio loop skips kinds with `desired <= 0` to avoid divide-by-zero (line 226-228), which is correct for the `actual === 0 && desired === 0` case. **But for `actual > 0 && desired === 0`** (common when an AI's build plan drops a resource target — e.g., stopping stone gathering after Castle Age once the Castle is built), those villagers' kind never enters the donor candidacy. They are effectively quarantined from the rebalance loop and continue gathering the zero-target resource forever, ignoring the AI's intended distribution.
- **Fix shape:** Replace the skip with a ratio of `Number.POSITIVE_INFINITY` when `desired <= 0 && actual > 0` so that kind reliably becomes `bestKind` (donor). Or, before the ratio loop, explicitly reassign any villager on a zero-target kind to the worst-served deficit kind. The first form is one line and preserves the existing rebalance semantics.

### [V5-3] `GameScene.ts` is 1,034 LOC — exceeds the strict 1,000-line ceiling *(Claude — user-memory rule)*

- **Theme:** design, file-size discipline
- **Where:** `src/phaser/scenes/GameScene.ts` (1,034 lines)
- **Finding:** AGENTS.md "Code review" line says "No file > 500 LOC." User-memory `feedback_500_line_target.md` records the stricter follow-up: "every code file ideally under 500 lines, strictly under 1000." Today's only file in the working tree exceeding 1,000 LOC is `GameScene.ts` at 1,034. Iter-4 V4-19's `buildingRenderer.ts` extraction shrunk it from 1,176 → 1,034 (saving 142 LOC) but did not cross the 1,000-line strict-ceiling line. Bite-size extractions visible in the file: the F2 / debug-overlay-mode plumbing, the keyboard / input plumbing, or the entity-display projection plumbing currently coupled to `interpolateProjectedEntities`. Any single such extraction would put the file under 1,000.
- **Fix shape:** Extract one cohesive subsystem from `GameScene.ts` into `scenes/gameScene/<topic>.ts` to break the 1,000 ceiling. The extraction pattern is well-established by `buildingRenderer.ts`, `cameraController.ts`, etc.

---

## Medium

### [V5-4] `saveLoadPanel.handleSaveClick` drops the save entirely if `localStorage.setItem` throws *(Codex)*

- **Theme:** correctness, UX
- **Where:** `src/ui/hud/saveLoadPanel.ts:148-168`; coverage gap in `tests/browser/game-combat-and-meta.spec.ts:403-451`
- **Finding:** The Save flow builds the JSON blob at line 152, then attempts `localStorage.setItem` at line 159. On failure (private browsing, quota exhaustion, security context), it logs, toasts "Save failed (storage unavailable)", and returns at line 163 — never reaching `triggerBlobDownload(json)` at line 165. The user loses the save even though the blob is built and the download mechanism exists. The browser test only exercises the happy-path localStorage save/load flow, so this branch is uncovered.
- **Fix shape:** In the catch block, fall through to `triggerBlobDownload(json)` before showing the toast (or replace the toast text with "Save unavailable in storage; download triggered."). Add a browser/unit test that forces `localStorage.setItem` to throw and asserts the download trigger fires.

### [V5-5] Doc drift across AGENTS.md / ARCHITECTURE.md / devlog summary *(Claude V5-3 + Codex Medium-2 — strong agreement)*

- **Theme:** docs (multi-site drift)
- **Where:** `AGENTS.md` "Documentation discipline" section; `docs/architecture/ARCHITECTURE.md:11`; `docs/devlog/summary.md:3`; absent files `docs/api-reference.md`, `docs/guides/`, `docs/README.md`; `README.md` Feature Overview / Public Surface
- **Finding:** Three specific drift instances:
  1. **AGENTS.md mandates files that don't exist.** "Always update if the change introduces or removes API surface" → `docs/api-reference.md` mandatory. "Update if applicable to the change's topic" → `docs/guides/<topic>.md` (resources, systems-and-simulation, spatial-grid, rts-primitives, ai-integration, map-generation, building-a-game, getting-started). "`docs/README.md` — index links the new guide if one is added." None of these files exist; the directory `docs/guides/` does not exist. Doctrine has been live since 2026-04-17 and never been satisfiable. V4-22 took the same kind of doctrine-vs-reality reconciliation for versioning + changelog (relaxed AGENTS.md to user-visible scope) — same reconciliation overdue here.
  2. **`ARCHITECTURE.md:11` describes a stale seam.** "`app/bootstrap/` — app startup, dev HTTP API used by browser tests" — the actual mechanism is `window.__AOE2_TEST__`, an in-page test API installed by `installBrowserTestApi(...)` in `src/app/bootstrap/browserTestApi.ts:89-120,239`. There is no HTTP API; the line was carried forward from an earlier prototype.
  3. **`docs/devlog/summary.md:3` is stale on V4-22.** The line says "V4-22 versioning + `docs/changelog.md` (needs user input)" but `9094d10` shipped the reconciliation: `package.json:3` is `0.1.1`, `docs/changelog.md` exists with the `0.1.1` entry, AGENTS.md is scoped to user-visible bumps. The "needs user input" phrase is no longer accurate.
- **Fix shape:** (a) Reconcile AGENTS.md "Documentation discipline" to match the actual doc layout — drop the api-reference / guides / docs-README mandates; keep ARCHITECTURE.md / drift-log / decisions / devlog / changelog as the canonical surface. (b) Update `ARCHITECTURE.md:11` from "dev HTTP API used by browser tests" to "in-page `window.__AOE2_TEST__` test API installed by `installBrowserTestApi`". (c) Edit `docs/devlog/summary.md:3` to drop the "needs user input" carry-forward (V4-22 has shipped).

### [V5-6] Iter-1 V4-7 throttle round-trip test only verifies the schema field's presence, not the actual contract *(Claude)*

- **Theme:** tests (weak coverage on a fix that landed)
- **Where:** `tests/simulation/saveLoad.test.ts:235-262` (the `persists the gatherer drop-off retry throttle field (review V4-7)` case)
- **Finding:** The test boots a fresh bridge, steps 1000 ticks, saves, asserts `blob.sideMaps.gathererDropOffStuckSinceTick` is defined and an array, then mutates the blob to inject `[fakeId, fakeTick] = [999_999, 12_345]`, JSON-roundtrips, loads the modified blob into a new bridge, and re-saves; the final assertion expects an *empty* result (`toEqual([])`). The "expected empty" comment explicitly notes that iter-3 V3-8's orphan-key prune deletes the fake entry because `fakeId` doesn't resolve via `world.getEntityRef`. So the test never actually proves the round-trip preserves a real throttle entry — it proves the orphan prune removes a fake entry. The actual V4-7 contract — a stuck villager whose throttle was set on tick T survives save+load and continues respecting the 30-tick window from T — is not tested.
- **Fix shape:** After step(1000), find an existing villager id from `bridge.getEconomyState().units`, inject `[realVillagerId, world.tick - 10]` into the throttle map, JSON-roundtrip, load, and assert the post-load `saveGame().sideMaps.gathererDropOffStuckSinceTick` contains `[realVillagerId, world.tick - 10]` (orphan-prune leaves it because the entity exists).

### [V5-7] Iter-1 V4-14 tick-tagged guard has no regression test for the failure mode it was meant to defend against *(Claude)*

- **Theme:** tests
- **Where:** `tests/simulation/monkConversion.test.ts` (only one case, exercises C-1 flip-flop); the V4-14 fix at `monkTaskAppliers.ts:140-148` and `bridgeState.ts:75-83`
- **Finding:** V4-14's commit message says the tick-tag protects against "a future caller invoking applyMonkConvert from a different system phase" leading to a stale-tick entry surviving across a tick boundary. The existing C-1 test verifies that two enemy Monks targeting one militia accumulate progress for the first-processed Monk — but that test passes both before and after V4-14 because `prototypeMonkBehavior` always clears before each tick's `applyMonkConvert` calls. The specific failure V4-14 prevents has no test. If V4-14 were silently reverted to `Set<number>` + missed `.clear()`, the existing tests would still pass.
- **Fix shape:** Add a regression test that: (a) directly seeds `monkConvertProcessedThisTick.set(targetId, oldTick)` simulating a missed clear, (b) advances 1 tick, (c) issues a real Monk convert and asserts conversion progress accumulates because `monkConvertProcessedThisTick.get(targetId) !== activeWorld.tick` (tick-tag is stale, not blocking).

### [V5-8] AI `findIdleProducer` called ~7+ times per AI per decision tick, scanning all buildings each time *(Gemini)*

- **Theme:** efficiency
- **Where:** `src/game/simulation/bridge/systems/aiSystem.ts:354-364` (the `pickUnitMix` loop calling `findIdleProducer` per unit type); `src/game/simulation/bridge/aiDecisionOps.ts:148-177`
- **Finding:** The AI loops over each unit type in `pickUnitMix(currentAge)` and calls `findIdleProducer(owner, producer)` for each — barracks, archery-range, stable, siege-workshop, castle, etc. Each call walks `world.query('building')` (line 158) and filters by owner + buildingType. With 6-7 unit-type iterations per decision tick × 4 AIs × full-world building scan each = ~28 building scans per decision tick (every 60 ticks). Plus tech-research queuing iterates similarly. Although the function is now O(N×log N) load-balanced (V3-24 fix preserved), the redundant repeated full-world scans are pure waste — every call sees the same world state.
- **Fix shape:** Compute a single `ownedBuildingsByType: Map<BuildingType, number[]>` per owner once at the top of the AI's decision tick, pass it (or a closure over it) into the `findIdleProducer` equivalents. Or maintain `buildingsByOwnerAndType` as a side map, updated in `entityCreateOps`/`entityDestroyOps`.

---

## Low / Nit

### [V5-9] `getSelectableEntitiesAtCell` walks the entire unit + building + resource queries per click — uses no spatial primitive *(Claude)*

- **Theme:** efficiency (per-click only, lower priority)
- **Where:** `src/game/simulation/bridge/selectionInputOps.ts:142-187`
- **Finding:** Three loops (lines 145, 153, 173) each walk the full world query for their component and check `position.x === x && position.y === y` (or `buildingOccupiesCell` for buildings). At ~200 entities per query × 3 queries = ~600 component lookups per click. `civ-engine`'s `queryInRadius` (used elsewhere in `visibility.ts:181`) would let this be O(local) instead of O(world). Per-tick cost is zero, only per-click.
- **Fix shape:** Switch each of the three loops to `world.queryInRadius(x, y, R, '<component>')` where R covers the largest footprint dimension (4 for castle). Defer if not a hot path.

### [V5-10] AI `attackGroup` assembly performs duplicate full-world unit scans *(Gemini)*

- **Theme:** efficiency, cleanliness
- **Where:** `src/game/simulation/bridge/systems/aiSystem.ts:360-366`
- **Finding:** `ownedMilitaryUnitIds(owner)` is called to filter dead units from the attack group, then `findOwnedMilitaryUnits(owner)` is called immediately after to enumerate available military for assignment. Both helpers do a full `world.query('unit')` scan with the same `isAiMilitaryUnit` predicate. One pass would suffice.
- **Fix shape:** Consolidate into a single helper that returns both the `Set<number>` (for fast filtering) and the `Array<{id, position}>` (for the assignment loop). Or build the Set inline from the array result.

### [V5-11] `assembleBridgeApi.AssembleBridgeApiDeps` Omit list duplicates the override re-implementation *(Claude)*

- **Theme:** cleanliness, design
- **Where:** `src/game/simulation/bridge/assembleBridgeApi.ts:8-25`
- **Finding:** The factory's deps include "everything from CreateWorldResult except five fields it overrides." That list lives in two places: the `Omit<CreateWorldResult, 'world' | ... >`, and the body's `return { ...rest, getPopulationState: ..., getPlayerResources: ..., getMatchState: ..., isSelected: ..., consumeOutOfBandRenderChange: ... }`. Adding a sixth override means updating both. Tiny redundancy; if a sixth field is added to one place but not the other, the spread will dump the wrong (raw) version into the result.
- **Fix shape:** Extract `OVERRIDDEN_FIELDS = [...] as const` and derive both the deps Omit and the body re-implementation from it. Or accept the duplication (5 entries, easy to spot).

### [V5-12] `pruneOrphanEntityKeys` uses `Map<number, unknown>` — typing erases value type *(Claude)*

- **Theme:** typing precision
- **Where:** `src/game/simulation/bridge/hydrateFromSavedGame.ts:307-313`
- **Finding:** `const pruneOrphanEntityKeys = (sideMap: Map<number, unknown>): void => { ... }` — typing every passed map as `Map<number, unknown>` is a small concession that the function is generic over the value type. A `<V,>(sideMap: Map<number, V>) => void` generic would express the contract precisely without erasing the value type at the call site. No runtime change.
- **Fix shape:** Use a generic: `const pruneOrphanEntityKeys = <V,>(sideMap: Map<number, V>): void => { ... }`.

### [V5-13] `cellPassability.isCellPassableForUnit` still a pass-through to `isCellPassableForSpawn` *(Claude — V4-16 partial deferred)*

- **Theme:** dead code, design
- **Where:** `src/game/simulation/bridge/cellPassability.ts:140-149`
- **Finding:** Iter-1 V4-16 deferred this. The function takes `(unitId, x, y, activeWorld)`, discards `unitId` and `activeWorld` (`void unitId; void activeWorld;`), and forwards to `isCellPassableForSpawn(x, y)`. ~15 call sites pass real arguments — the seam is wired but the implementation never uses them. Either the function gains per-unit semantics (flying units, amphibious units) or it should be inlined.
- **Fix shape:** Decide and document. Add `// TODO(per-unit): flying / amphibious terrain rules` if the per-unit branch is planned, or inline + drop the dep.

### [V5-14] `aiStates.delete(owner)` never called — eliminated AIs keep their `AiState` entry forever *(Claude)*

- **Theme:** memory hygiene (low impact at single-match scale)
- **Where:** `src/game/simulation/bridge/bridgeState.ts:73`; no destructor anywhere clears it for an eliminated owner.
- **Finding:** When an AI player is eliminated, `aiStates.get(owner)` is still populated. The `prototypeAi` system's `for (const [owner, state] of aiStates)` loop keeps invoking the planner for them. The body is no-op every tick (no buildings, no units), but iteration cost grows linearly with eliminated-AI count. Minor at single-match scope; defer.
- **Fix shape:** When `finalizeMatchEnd('defeat', 'conquest', ...)` finalizes the match, optionally clear `aiStates` for owners with zero presence; or short-circuit `if (!playerHasConquestPresence(owner)) continue;` at the top of the AI tick loop.

### [V5-15] File-size watch list — 10 bridge files cluster within 80 LOC of the 500-line ideal *(Claude)*

- **Theme:** file size proximity (no immediate action)
- **Where:** `targetFindingOps.ts` 497, `aiSystem.ts` 497, `technologyOps.ts` 481, `pureHelpers.ts` 474, `movementPlanOps.ts` 450, `scenarioSeedOps.ts` 437, `optionsRules.ts` 430, `trainingMarketOps.ts` 426, `selectionInputOps.ts` 426, `playerCommandsSystem.ts` 424. Plus `prototypeScenario.ts` 869 (cosmetic dispatcher).
- **Finding:** Any one growing further crosses the AGENTS.md 500-line line. Worth flagging so the next feature growth gets routed to a new factory rather than added to a near-ceiling file.
- **Fix shape:** Track. Route new bridge growth to fresh factories.

---

## Verified-not-bugs

These patterns were specifically checked and concluded fine — recording so the next iteration knows what's been audited.

- **Side-map ownership coverage** — Walked every `Map<...>` field in `bridgeState.ts:45-92`. Every entity-id-keyed map is either covered by `pruneOrphanEntityKeys` in `hydrateFromSavedGame.ts:314-333`, self-cleaning during normal flow, per-tick cleared, or intentionally outlives entities (`lastSeenStatic` for fog memory). Owner-keyed maps correctly excluded.
- **`destroyUnitEntity` symmetric cleanup** — `entityDestroyOps.ts:88-123` removes the unit from BOTH `garrisonedUnitToBuilding` AND `garrisonedByBuilding`'s value list. The post-load garrison invariant at `hydrateFromSavedGame.ts:202-218` won't throw on a properly maintained world.
- **V4-3 fog-memory delete path** — `fogMemorySystem.ts:107-124` correctly uses `isFootprintVisible` over the stored entry's footprint. Regression test `footprintVisibilityConsistency.test.ts:103-154` exercises end-to-end.
- **V4-11 conquest single-pass** — `conquestOutcomeSystem.ts:46-71` correctly seeds `remainingOwners = playerResources.keys()` then deletes each owner with any unit or building. Mutual annihilation → draw matches iter-3 V3-12. Wildlife are resources, not units, so don't pollute the unit query.
- **V4-13 default branch** — `humanInputOps.ts:249-254` exhaustive.
- **V4-14 tick-tagged guard shape** — `monkTaskAppliers.ts:140-148` checks `monkConvertProcessedThisTick.get(targetId) === activeWorld.tick`; stale-tick entries are inert. Correct-by-construction even if the periodic delete misses a tick.
- **V4-19 `sharedTypes.ts` extraction** — `bridge/sharedTypes.ts` (44 LOC) hosts the four shared types. Facade re-exports for external consumers. All bridge children import from `sharedTypes.ts`.
- **V4-22 reconciliation correctness** — `package.json:3` is `0.1.1`. `docs/changelog.md` exists with the 0.1.1 entry. AGENTS.md "Versioning" section scopes bumps to user-visible. Doctrine and reality match.
- **`createSimulationBridge.ts` (305 LOC)** — Genuine facade. Delegates to `createWorld`, wires the projector/render adapter, exposes thin bridge wrappers.
- **Multi-base AI `findIdleProducer`** *(Codex caught — corrects Claude's draft)* — `aiDecisionOps.ts:148-177` is now load-balanced ("LEAST-LOADED" producer with id-tiebreak for save/load determinism). V3-24 was actually fixed; carrying it forward in iter-1 V4-24 was incorrect.
- **Wonder / FU2 display names** *(Codex)* — `displayNames.ts:98,127,133,135,231,260,266,268,514,573` all populated.
- **Mutual annihilation draw** — Explicit in `conquestOutcomeSystem.ts:15,74-77`.
- **Unicode seed-hash collision** — `sharedTerrainHelpers.ts:28-29` uses full code points.
- **HUD/browser-test teardown** — `createHudController.ts:89,271,289` exposes `destroy()`; `browserTestApi.ts:120-239` uses dynamic bridge thunk.
- **Multiple monks converting same target** *(Gemini)* — One monk's `conversionState.delete(targetId)` doesn't break another monk's conversion; the second monk's owner-mismatch correctly resets and starts fresh.
- **V3-7 Monk LOS interrupt** *(Gemini)* — `!isVisibleToOwner(...)` correctly halts ticks while preserving progress.
- **V4-7 throttle semantics** *(Gemini)* — `villagerEconomySystem.ts:283-331` cycle preserves the 30-tick gap; save+load preserves `world.tick` and the throttle entry. (The test gap is V5-6, not the implementation.)
- **`hydrateFromSavedGame.ts:202-218` H-3 invariant ordering** — Runs BEFORE `pruneOrphanEntityKeys`. Intentional: an orphan unit-ID in `garrisonedByBuilding`'s value list IS a cross-reference corruption that the prune wouldn't catch. Order is correct.

---

## Top issues to fix first

Ordered by impact and ease of remediation. None are critical — the codebase is healthy.

1. **[V5-1]** Replace V4-12's `countOwnedUnits`-based guard with an `ownedMonksByOwner` side map (or revert V4-12). *(High; the iter-1 fix made the steady-state cost slightly worse, not better; cross-reviewer agreement)*
2. **[V5-2]** Fix `villagerRebalance` so kinds with `desired = 0 && actual > 0` enter donor candidacy. *(High; correctness — villagers ignore AI build plan)*
3. **[V5-3]** Extract one cohesive subsystem from `GameScene.ts` to break the 1,000 LOC strict ceiling. *(High; user-rule violation; one-commit fix)*
4. **[V5-4]** Wire `triggerBlobDownload(json)` fallback in `handleSaveClick` when localStorage throws. *(Medium; correctness/UX — save data preservation)*
5. **[V5-5]** Reconcile AGENTS.md doc mandates + fix `ARCHITECTURE.md:11` HTTP API stale line + drop `summary.md:3` "needs user input" carry-forward. *(Medium; cross-reviewer agreement; ~30 minute sweep)*
6. **[V5-6]** Strengthen the V4-7 throttle test to use a real-villager id and assert round-trip preserves the entry.
7. **[V5-7]** Add a regression test for V4-14's specific failure mode (stale-tick entry surviving a missed clear).
8. **[V5-8]** Batch `findIdleProducer` building lookups per AI decision tick.
9. **[V5-9..V5-15]** Tail nits — per-click selection efficiency, attack-group dedupe, Omit-list duplication, `pruneOrphanEntityKeys` typing, `isCellPassableForUnit` decision, eliminated-AI cleanup, near-ceiling files watch list. Sweep with the next docs/cleanliness commit.

Out of scope:
- **C-2** full enum validation, **H-2** wider save/load round-trip coverage, **H-4** partial cache sweep — iter-1 deferred clusters; would need a new angle to revisit.
