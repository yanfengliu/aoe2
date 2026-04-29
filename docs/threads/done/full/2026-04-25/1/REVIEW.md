# Full Codebase Review — 2026-04-25 (Iteration 1)

**Reviewers:** Codex (`gpt-5.4` @ `model_reasoning_effort=high`), Gemini (`gemini-2.5-pro` @ default thinking), Claude (`opus` @ `--effort high`). Each ran independently with read-only access to the working tree; raw outputs in `raw/codex.md`, `raw/gemini.md`, `raw/claude.md`.

**Scope:** ~47 kLOC across 155 TypeScript files in `src/` and `tests/`, plus `docs/architecture/`, `docs/devlog/summary.md`, and `AGENTS.md`. Each reviewer received the same `PROMPT.md` (in this directory) covering the five AGENTS.md review aspects: design, tests, correctness, cleanliness, docs.

**HEAD reviewed:** `3446387` on `main`.

---

## Executive summary

The three reviewers agreed on the project's two largest structural risks:

1. **`createSimulationBridge.ts` is still a 7,333-line god module.** Phase 1–3 extractions cut size but not responsibility concentration; ownership of scenario bootstrap, occupancy, selection, AI wiring, monk logic, save/load hydration, and render projection still lives in the same closure. Every reviewer flagged it independently as the top long-term risk.
2. **Save/load hydration is the most fragile correctness surface.** It does `JSON.parse` plus typed-string casts with no schema validation, the side maps are loaded independently with no cross-reference integrity check, and the round-trip test (`tests/simulation/saveLoad.test.ts`) only asserts a thin slice of state. Codex, Gemini, and Claude each flagged a different facet of this same load-path fragility; together they constitute the most actionable correctness cluster in the report.

Beyond those, **Claude was the only reviewer to surface a concrete gameplay bug (Monk conversion flip-flop, C-1)** — likely because Codex/Gemini stayed higher-level — and **Codex was the only one to catch the seed-mismatch on load (H-1)**. Both deserve verification before the next refactor pass.

---

## Cross-reviewer agreement

| Theme | Codex | Gemini | Claude |
|---|---|---|---|
| `createSimulationBridge.ts` god class | ✓ (high) | ✓ (critical) | ✓ (nit, but called load-bearing) |
| Save/load fragility (hydration / schema drift) | ✓ (medium, trebuchet) | ✓ (high) | ✓ (critical + high, multiple) |
| `getRenderState` / per-tick scans expensive | — | ✓ (high) | ✓ (high) |
| ARCHITECTURE.md docs drift | ✓ (medium) | — | ✓ (nit) |
| Hardcoded tech-tree / unit-rule switches | — | ✓ (medium) | — (not flagged) |
| Skipped / weak tests | ✓ (medium, overflow) | ✓ (nit, slow E2E) | ✓ (high, save coverage; medium, age-up) |

Anything below appears in only one reviewer unless noted.

---

## Critical

### [C-1] Monk conversion progress wipes when two enemy Monks share a target *(Claude)*

- **Theme:** correctness
- **Where:** `src/game/simulation/bridge/monkTaskOps.ts:360-376`
- **Finding:** When two Monks from different owners both target the same unit in a given tick, the `state.byOwner !== monkUnit.owner` branch resets `state.progress = 0` for the second-processed Monk *before* the per-tick guard returns. Net effect over many ticks: zero progress for either side. Worse than the documented "first writer wins" intent.
- **Verify before acting:** Claude marked this as a verified bug; no other reviewer reached this depth of `monkTaskOps`. Worth a quick fixture (two-Monk same-target test) to confirm before designing the fix.

### [C-2] Save loader casts JSON values to typed enums with no runtime validation *(Claude, partially Codex)*

- **Theme:** correctness / design
- **Where:** `src/game/simulation/createSimulationBridge.ts:1789, 1795, 1902, 1909, 1930, 1932, 1955`
- **Finding:** Load uses `as AgeType`, `as ResearchableTechnologyType`, `as TrainableUnitType`, `as MemoryEntry['entityType'/'visualVariant']`, `as AiPlan` directly on `JSON.parse` output. A hand-edited save, an older build re-loading a future save, or any blob that diverges from the current enum will silently install invalid strings into side maps and produce cascading downstream crashes far from the loader. `saveSchema.ts:5` itself notes cross-version migration is unsupported.

---

## High

### [H-1] Save/load: projector and HUD use outer `seed` while world uses `effectiveSeed = savedGame.seed` *(Codex)*

- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:7096-7141, 7270-7284`; `src/game/simulation/bridge/visibility.ts:34-37, 120-123`
- **Finding:** A loaded match simulates one seed while rendering / debug / reporting another. Breaks the save/load determinism contract documented in `ARCHITECTURE.md:82-88`.

### [H-2] No save/load round-trip coverage for the side maps that exist only on the side *(Claude)*

- **Theme:** tests
- **Where:** `tests/simulation/saveLoad.test.ts:12-50` (snapshot helper)
- **Finding:** `captureSnapshot` only checks tick, ages, resources, population, sorted ids, match outcome, win condition, and the two countdowns. Missing: `garrisonedByBuilding`, `garrisonedUnitVisionSources`, `monkTasks`, `monkCarriedRelic`, `conversionState`, `productionQueues`, `constructionStates`, `combatStates`, `wildlifeStates`, `trebuchetPackStates`, `aiStates`. Schema drift in any of these would currently land green.

### [H-3] Garrison side maps loaded independently, may desync on a partial blob *(Claude)*

- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:1915-1923`
- **Finding:** `garrisonedUnitToBuilding` and `garrisonedByBuilding` are hydrated by two independent loops. A blob with an id present in one but not the other boots into an inconsistent state — `ungarrisonBuilding` silently drops the orphan, vision sources may live forever. Add a cross-reference invariant check after hydration.

### [H-4] `getRenderState()` scans all entities every call (HUD RAF, scene, browser-test API) *(Claude, Gemini)*

- **Theme:** design / cleanliness / efficiency
- **Where:** `src/game/simulation/createSimulationBridge.ts:7187-7220+`
- **Finding:** Every consumer call runs `flushOutOfBandRenderChange()` then a full `liveEntities = liveEntitiesRaw.filter(...)`. The HUD RAF loop and every `getSnapshot` browser-test call hit this path. Cache projected list per-tick; the tick counter already gates re-projection elsewhere.

### [H-5] AI villager rebalance silently does nothing when total villagers = 0 *(Claude)*

- **Theme:** correctness
- **Where:** `src/game/simulation/bridge/aiDecisionOps.ts:214-262`
- **Finding:** With zero villagers, `worstRatio` / `bestRatio` never receive a finite value, the diff guard never fires, `bestKind` / `worstKind` stay null, and rebalance no-ops. AI cannot recover from a temporary villager wipe through redistribution.

### [H-6] `placementMode` cleared inconsistently across player-action surfaces *(Claude)*

- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:6614, 6644, 6659`; `src/game/simulation/bridge/placementOps.ts:174`
- **Finding:** `placementMode.current = null` is sprinkled across many player-action paths. No central "any non-placement player action clears placement" hook. A future regression that forgets the clear in one new path is invisible until production.

### [H-7] HUD listeners / RAF have no symmetric cleanup *(Claude)*

- **Theme:** cleanliness / correctness
- **Where:** `src/ui/hud/debugOverlay.ts` (F2 keydown), `src/ui/hud/createHudController.ts:424` (recursive RAF), `src/ui/hud/saveLoadPanel.ts` (button listeners)
- **Finding:** The F2 keydown attaches at HUD construction with no `removeEventListener` exposed; per-frame `requestAnimationFrame(update)` runs forever, including after match end and during paste-load (where a fresh bridge swaps in). Leaks under HMR/dev; wastes CPU after victory in prod. Return a `destroy()` from `createHudController`.

---

## Medium

### [M-1] Trebuchet hydration: missing `trebuchetPackStates` defaults to "not packed" / "not silent" *(Codex)*

- **Where:** `src/game/simulation/createSimulationBridge.ts:1887-1895`; `src/game/simulation/bridge/trebuchetState.ts:42-82`
- **Finding:** Load path comments claim missing state is safe for older saves, but runtime helpers treat missing state as "not packed / not silent." Older same-schema saves can hydrate trebuchets into the wrong live behavior.

### [M-2] Auto-aggression target-finding helpers don't enforce true LOS, only Manhattan radius *(Claude)*

- **Where:** `src/game/simulation/bridge/targetFindingOps.ts:408-486`
- **Finding:** `findPreferredEnemyUnitInRadius` / `findPreferredEnemyBuildingInRadius` only check Manhattan distance. A unit on the far side of a 4×4 Castle still aggros a target on the other side at radius+0 because terrain doesn't break the visibility cone. The doc comments imply "personal sight radius" — overpromised. Either rename or add a `visibility.isVisible` check parity with their `findPreferredVisibleEnemy*` siblings.

### [M-3] `monkCarriedRelic` loaded without verifying the relic id still resolves *(Claude)*

- **Where:** `src/game/simulation/createSimulationBridge.ts:1844-1846`
- **Finding:** Unlike `townCenterRefs`, `unitCommands`, `monkTasks`, etc. (all guarded by `refFromSerialized`), the `monkCarriedRelic` loader pushes raw ids in. A phantom relic carrier is harmless until the relic countdown could deadlock if it was the last "carried" relic. Add a `world.getEntityRef` validation at load.

### [M-4] `playerHasConquestPresence` runs two full ECS queries per call *(Claude)*

- **Where:** `src/game/simulation/bridge/matchEndOps.ts:204-220`
- **Finding:** Called every tick by the win-condition resolver. 150+ entity scan per player per tick late-game. Replace with an incremental count keyed by owner, piggy-backing on the same hooks that already maintain `population.current`.

### [M-5] HUD selection signature uses `JSON.stringify(selectionState)` per RAF tick *(Claude)*

- **Where:** `src/ui/hud/selectionPanel.ts:332`
- **Finding:** Full selection state — including option arrays and queue entries — is JSON-stringified each frame to detect change. A composite `tick + selectedEntityId` signature, or a stable signature exposed by the bridge, removes the per-frame allocation.

### [M-6] `displayNames.ts` and `GameScene.isUnitType` unit-type lists drift *(Claude)*

- **Where:** `src/phaser/scenes/GameScene.ts:1128-1160`; `src/ui/hud/displayNames.ts`
- **Finding:** `isUnitType` is a long `||`-chain of unit-type literals used to gate same-type double-click selection. Adding a new unit requires editing both the chain and `displayNames`; missing the chain silently disables double-click select-by-type. Replace with a `UnitType`-driven exhaustiveness check.

### [M-7] AI command order may depend on ECS query iteration order across save/load *(Claude)*

- **Where:** `src/game/simulation/createSimulationBridge.ts:4739-4746`; `src/game/simulation/bridge/aiDecisionOps.ts` (`findOwnedMilitaryUnits`)
- **Finding:** `state.attackGroup` is populated from a `world.query('unit')` walk; engine iteration order is not documented as stable across save/load cycles. Determinism contract risk. Either verify `world.serialize`/`deserialize` preserves entity creation order, or pre-sort query results by id at every consumption site.

### [M-8] Dependency-direction violation: bridge ops still import back from `prototypeScenario.ts` / `createSimulationBridge.ts` *(Codex)*

- **Where:** `src/game/simulation/bridge/pureHelpers.ts:8-12, 65-84`; `src/game/simulation/bridge/monkTaskOps.ts:31-36`; `src/game/simulation/bridge/saveGameOps.ts:24-28`
- **Finding:** The lower layer is not actually self-contained. Layering is only partially extracted. Future splits and isolated unit testing of `bridge/*` modules are harder than ARCHITECTURE.md implies.

### [M-9] `getTrainOptions` / `getResearchOptions` are large hardcoded `switch` statements *(Gemini)*

- **Where:** `src/game/simulation/createSimulationBridge.ts:3485-4078` (approx)
- **Finding:** Tech-tree and unit-line prerequisites are baked into simulation logic via long `if/else` and `switch` blocks. This couples game content to game code; every new unit/tech is an in-engine edit. Externalize into data tables (the project already has CSV-driven content for stats), then have the bridge consume them.

### [M-10] Tests assert hardcoded fixture cell coordinates coupled to map-gen drift *(Claude)*

- **Where:** `tests/simulation/createSimulationBridge.combat.test.ts:48-49, 63-64, 75-76`; `tests/simulation/sheepVision.test.ts:48, 82-83`
- **Finding:** Tests look for `building.x === 10 && building.y === 8` and `findSheepAtCell(bridge, 22, 10)`. The 2026-04-23 devlog already noted two tests had to be re-anchored after the procedural map switch. Same risk repeats here. Re-anchor by querying for the entity by type/owner first, then asserting position equals its initial position.

### [M-11] `aiPlayer.test.ts` "ages up through the ages" silently exits on early termination *(Claude)*

- **Where:** `tests/simulation/aiPlayer.test.ts:107-141`
- **Finding:** 8000-tick budget with a `break` on age advancement. If the AI never advances, the loop simply exits without telling the runner that the desired transition was not reached. Add an explicit `expect(reachedCastleAge).toBe(true)`.

### [M-12] Skipped overflow test on selection-activity HUD path *(Codex, Claude)*

- **Where:** `tests/simulation/selectionActivity.test.ts:505-511`
- **Finding:** The only test for the "cap at 5 tokens, report overflow" branch is skipped, even though it is rendered live in the HUD. Easy to regress with future activity-label work.

### [M-13] Compact multi-selection HUD path lacks end-to-end coverage for mixed (sheep + villager) selections *(Codex)*

- **Where:** `src/ui/hud/selectionPanel.ts:102-197`; `tests/browser/game-selection.spec.ts:423-569`
- **Finding:** Lower-level simulation/icon tests help, but a DOM/layout regression in the actual HUD would currently miss browser coverage.

### [M-14] `currentRelicHoldingOwner` lifecycle interaction with countdowns is uncovered *(Claude)*

- **Where:** `src/game/simulation/bridge/matchEndOps.ts:161-202`; `tests/simulation/winConditions.test.ts`
- **Finding:** Saw no test for "an enemy Monk grabs a free relic mid-countdown." The cancellation behavior is the spec, but it should be locked.

### [M-15] `saveLoadPanel` doesn't distinguish quota errors from private-mode rejection *(Claude)*

- **Where:** `src/ui/hud/saveLoadPanel.ts`
- **Finding:** Multi-MB JSON saves on a private-browsing Safari fail with a generic "storage unavailable" toast. Distinguish `QuotaExceededError` (offer download) from genuinely unavailable storage (private mode). `lastSeenStatic` map can grow unbounded for long sessions — clamp.

### [M-16] ARCHITECTURE.md `bridge/` topology is stale *(Codex, partially Claude)*

- **Where:** `docs/architecture/ARCHITECTURE.md:15-29`
- **Finding:** Still describes only the first extraction wave (`pureHelpers`, `visibility`, `trebuchetState`, `fogMemoryOps`). Codebase now also has `aiDecisionOps`, `matchEndOps`, `monkTaskOps`, `placementOps`, `saveGameOps`, `targetFindingOps`, `technologyOps`, plus top-level `worldOccupancy`, `selectionActivity`, `renderStore`. Documented topology weakens repo's own boundary rules.

### [M-17] `selectionActivity` allocates a fresh `Map` per `getSelectionActivityBreakdown` call *(Claude)*

- **Where:** `src/game/simulation/selectionActivity.ts:196`
- **Finding:** Per-RAF allocation when selection changes. Trivial GC pressure; verify before optimizing.

### [M-18] HUD tooltips ignore `window.scrollX/Y` *(Claude)*

- **Where:** `src/ui/hud/tooltips.ts:110-124`
- **Finding:** `getBoundingClientRect()` is viewport-relative; tooltip positions misplace under a scrolled HUD root. Low impact today (HUD isn't normally scrolled), but a one-line fix when next touched.

---

## Low / Nit

### [L-1] `applyForestPatch` and `applyResourcePatch` order checks asymmetrically *(Claude)*

- **Where:** `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts:64-86`
- **Finding:** No corruption today (`setTerrainKind` is internally bounds-checked), but a footgun for any future refactor that removes the inner guard. Make the helpers parallel.

### [L-2] Dead local `carriedRelicId` in `destroyUnitEntity` *(Claude)*

- **Where:** `src/game/simulation/createSimulationBridge.ts:3063-3068`
- **Finding:** `carriedRelicId = monkCarriedRelic.get(id)` is read into a local that is never used; the comment about dropping the relic at the Monk's last cell is misleading. Either remove the local + reword, or call `setPositionAndSyncOccupancy` so the comment matches the code.

### [L-3] `GameScene.update` passes raw Phaser delta into `bridge.step` *(Claude)*

- **Where:** `src/phaser/scenes/GameScene.ts:380-387`
- **Finding:** Tab unfocus produces a 5-minute delta; the bridge accumulator catches up correctly but inside one Phaser tick, freezing the UI thread for 3000+ ticks. Cap the catch-up step.

### [L-4] `currentEntityId` cast load-path drops generation mismatches silently *(Claude)*

- **Where:** `src/game/simulation/createSimulationBridge.ts:1779-1781`
- **Finding:** Correct behavior, but no log or counter; partially-corrupt saves load with no diagnostic. Surface drop count in debug snapshot.

### [L-5] `targetFindingOps.findPreferredEnemyBuildingInRadius` `default: return 5` swallows new building types *(Claude)*

- **Where:** `src/game/simulation/bridge/targetFindingOps.ts:213-215`
- **Finding:** Adding a new building type silently inherits the catch-all priority. Use a `const _: never = buildingType;` exhaustiveness check.

### [L-6] HUD camera signature uses `toFixed(2)` / `toFixed(3)` for change detection *(Claude)*

- **Where:** `src/ui/hud/createHudController.ts:405-406`
- **Finding:** Sub-pixel pans are dropped from the minimap update key. Acceptable; document the trade-off.

### [L-7] Devlog points readers at deleted `tests/browser/game.spec.ts` *(Codex)*

- **Where:** `docs/devlog/detailed/2026-04-19_2026-04-20.md:29, 32, 138, 142`
- **Finding:** Stale reference; the active suite has been split. Makes coverage history harder to audit.

### [L-8] AI top-level comment in `src/game/simulation/ai.ts` predates the `*Ops.ts` extraction *(Gemini)*

- **Finding:** Should now point at `bridge/aiDecisionOps.ts` for the decision-loop entry rather than `createSimulationBridge.ts`.

### [N-1] `createSimulationBridge.ts` is still 7,333 lines after Phase 1–3 extractions *(All three reviewers)*

- **Where:** `src/game/simulation/createSimulationBridge.ts` whole-file
- **Finding:** Combat systems (~lines 4900–5200), production-queues system (~5378+), gather/dropoff loop, and sheep-ownership update are the largest in-file surfaces left. The drift-log entry noting "Phase-3 selection+command commit was skipped because dep-bag exceeded 15 fields" is worth revisiting now that combat alone could be split off.

### [N-2] Long-timeout E2E tests up to 180_000ms slow the suite *(Gemini)*

- **Where:** `tests/simulation/aiPlayer.test.ts` and similar
- **Finding:** Symptom rather than cause; addressed by the underlying per-tick scan optimizations (H-4, M-4).

### [N-3] Command-rejection mechanism uses raw strings *(Gemini)*

- **Where:** `src/game/simulation/createSimulationBridge.ts:6961-6967`
- **Finding:** `enqueueRejection('Target not visible.')` raw strings; prone to typos. A shared enum or string-constant module would tighten type safety.

---

## Verified-not-bugs

Claude's review explicitly verified and rejected several tempting "bugs" during the audit. Calling these out so they don't get cargo-culted:

- `movePathCache` does not leak on unit death — `clearUnitCommand(id)` in `destroyUnitEntity` deletes from the cache.
- `selectionPanel` rerender does not accumulate listeners — `el.innerHTML = …` detaches the prior buttons before `querySelectorAll` selects fresh ones.
- `worldOccupancy.isPlacementBlocked` correctly catches OOB footprints — `getCellStatus` returns a `bounds`-blocked status.
- `monkConvertProcessedThisTick` is correctly omitted from saves — it is per-tick scratch state cleared at `prototypeMonkBehavior.execute` start.
- `garrisonedUnitVisionSources` does not leak on garrisoned-unit death — `destroyUnitEntity` deletes it.
- `issueMoveCommand` does not need `flushOutOfBandRenderChange` — move commands only mutate `unitCommands`, no render-affecting state.

---

## Top issues to fix first (synthesized)

1. **[C-1] Monk conversion flip-flop** *(correctness, isolated, gameplay-visible)* — small fix once the test fixture is built.
2. **[C-2] Save loader has no enum validation** + **[H-2] No round-trip coverage for side maps** + **[H-3] Garrison cross-reference integrity** — one cluster, one pass through the load path adds runtime validation, widens `captureSnapshot`, and lands a cross-reference invariant.
3. **[H-1] Seed mismatch on load** — fix is small (route effective seed through projector + HUD), but the determinism implication is large.
4. **[H-4] `getRenderState` per-call full scan** — hot path; per-tick memo is cheap and removes a scaling allocation.
5. **[N-1] Continue draining `createSimulationBridge.ts`** — combat subsystem is the next obvious extraction; cited by every reviewer.

`[H-5]` (AI villager-zero rebalance) and `[H-6]` (placementMode central clear) are also small, isolated correctness fixes worth bundling with the save-load cluster sprint.

---

## Process notes for next iteration

- The `AGENTS.md` Codex/Gemini flag table was updated in this iteration. If the next iteration's CLIs return version mismatches, re-probe — these CLIs change every release.
- **Gemini's first run wrote findings to `code-review-findings.md` in the project root** even though the prompt said to print them, because plan mode forced it through a write_file call. Output was moved to `raw/gemini.md` by hand; for next iteration, drop `--approval-mode plan` and rely on read-only `--output-format text` alone, or pre-create an empty `raw/gemini.md` so it lands in the right place.
- Claude's review was the most thorough by a wide margin (188 lines vs Codex's 46 vs Gemini's 70), and it included a "verified-not-bugs" section. Worth replicating in the prompt for next iteration: explicitly ask each reviewer to return both flagged-as-bug findings and examined-but-not-bug claims.
