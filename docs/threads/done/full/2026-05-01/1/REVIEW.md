# Full Codebase Review — 2026-05-01 (Iteration 1, post Phase 2E)

**Date:** 2026-05-01 (HEAD `799e834`)
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max + Gemini `gemini-3.1-pro-preview` plan-mode
**Scope:** entire aoe2 working tree at HEAD `799e834` (Phase 2E fingerprint cache).
**Prior review:** `docs/threads/done/full/2026-04-26/2/REVIEW.md` (V5-1..V5-15). V5 fixes verified shipped.

## Cross-reviewer agreement

| Theme | Codex | Claude | Gemini |
|---|---|---|---|
| AI monk decisions bypass command stream | R2-C1 MAJOR | R2-D1 MEDIUM | — |
| saveGame doesn't flush Tier-3 | R2-C2 MAJOR | — | — |
| autoAggression race overwrites build commands | — | R2-M1 MAJOR | — |
| pruneOrphanEntityKeys only checks keys, not values | — | — | MAJOR |
| pushIntention contract drift (always-true return) | — | R2-M2 MAJOR | — |
| accessor flush silently drops uncached dirty marks | — | — | MEDIUM |
| Phase 1C test coverage doesn't pin no-direct-mutation | R2-C3 MEDIUM | R2-T1 MEDIUM | — |
| Doc discipline drift (ARCHITECTURE/drift-log/decisions/summary) | R2-C4 MINOR | R2-D2 MEDIUM | — |
| GameScene > 1000 LOC | — | R2-D3 MEDIUM | — |
| AI villager-train accumulator hole on TC | — | — | MINOR |

## Findings

### MAJOR

**R2-M1 (Claude). autoAggression race overwrites villager build commands.** `hasPendingUnitCommand(unitId)` at `wireBridgeOps.ts:461-469` only matches `unit.move` / `unit.attack`. When aiSystem pushes `building.placeConfirm` (data.builderId=villagerId) AND autoAggression then sees the villager as "idle, no pending command" within the same tick, both intentions get queued FIFO. At handler time, placeConfirm runs first → unitCommand:'build' → attack handler overwrites it → villager attacks instead of building, foundation is orphaned, resources spent. Same race exists for `unit.gather` and `unit.context*`.
- **Fix:** Extend `hasPendingUnitCommand` to also match `building.placeConfirm` (data.builderId), `unit.gather` (data.unitId), `unit.context*` (data.unitId). Add R2-T1 regression test.

**R2-M2 (Claude). pushUnitAttackIntention / pushUnitMoveIntention always return true.** Pre-1B, `issueUnitAttackCommand` returned false on stale targets. Post-1C, the deps binding routes to pushers that always return true (`wireBridgeOps.ts:444-454,476-479`). aiSystem's fallback chain at `aiSystem.ts:735-768` (`if (...issueUnitAttackCommand(...)) continue; // fallback to next target`) is dead in the rejection path: the early-out always succeeds, fallback branches never fire. Stale-target case (target killed by autoAggression THIS tick) used to retry; now silently no-ops at handler time, idling for one decision interval.
- **Fix:** (a) rename deps in aiSystem/autoAggression to `submit*Intention`, drop the `&& submit(...)` early-out idiom, OR (b) make pushers pre-validate. (a) is smaller.

**R2-C2 (Codex). saveGame() only flushes Tier-1 accessor, not Tier-3.** `saveGameOps.ts:66-68` calls `accessor.flush()` but Tier-3 writes (`aoe2.visibility`, `aoe2.matchState`) are isolated in `tier3SyncSystem.ts` (per-tick) and `bootstrapFlush.ts` (bootstrap). Schema-1 top-level `visibility`/`matchState` masks this today, but schema-2 (Phase 2F) will rely on `worldSnapshot.state` and crash. Save mid-tick before the next output phase: snapshot's `aoe2.visibility` is stale by N ticks.
- **Fix:** Add `flushBridgeStateToWorld()` helper that writes Tier-3 (visibility + matchState) AND calls `accessor.flush()`, called at save time before serialize.

**Gemini MAJOR. pruneOrphanEntityKeys leaks dead entity IDs in map VALUES.** `hydrateFromSavedGame.ts` near line 240 only validates map keys. Maps with entity IDs in values (`garrisonedByBuilding` arrays, `garrisonedUnitToBuilding` target IDs, `monkCarriedRelic` resource IDs) keep dead entries. Cross-reference invariant runs BEFORE pruning, allowing silent orphans on the current load. After pruning, maps stay desynced in memory. NEXT save-load fails the invariant and crashes — load N succeeds, save N+1 / load N+2 fails.
- **Fix:** Deep-cleanse maps with entity IDs in values BEFORE the cross-reference invariant check.

### MEDIUM

**R2-D1 (Claude) / R2-C1 (Codex). Monk decisions still mutate state directly from aiSystem.** `aiSystem.ts:687-692` calls `assignAiMonkTasks(owner)`; `monkTaskOps.ts:128-175` body mutates `state.monkTasks` directly via `setMonkTask`. PLAN v4 §1C and DESIGN v17 §6.5 specify `monkBehaviorDecisionSystem` (push intentions) split from `monkBehaviorResolutionSystem`. Today: not catastrophic because `monkTasks` is not yet a migrated Tier-1 slot — but Phase 2D's next migration will conflict.
- **Fix:** Either (a) add `monk.assignTask` command + dispatch via intentions, or (b) document as KAD-0006 deviation with explicit Phase 2D-blocker on `monkTasks` migration.

**Gemini MEDIUM. BridgeStateAccessor silently drops uncached dirty marks.** `bridgeStateAccessor.ts:144`: if `markDirty(slot)` runs without prior `get(codec)`, `_cache.has(slot)` is false → `flush()` hits `if (native === undefined) continue;` and silently clears the dirty flag without serializing. Footgun during Phase 2D migration where developers might expect markDirty to suffice.
- **Fix:** In `flush()`, throw a descriptive error when a dirty slot is missing from `_cache`. Symmetric with the Phase 2A iter-2 unknown-slot fix.

**R2-C3 / R2-T1. Phase 1C tests don't structurally prove AI avoids direct mutation.** Current coverage is generic dispatcher behavior + outcome-level AI monk tests. No focused test asserts "after aiSystem.execute, pendingCommands has the expected intentions AND state.monkTasks is unchanged until next tick".
- **Fix:** Add `tests/ai/aiSystem.intentions.test.ts` for monk intention; add `tests/simulation/autoAggressionRace.test.ts` for R2-M1.

**R2-D2 (Claude). Doc drift across ARCHITECTURE.md / drift-log.md / decisions.md / summary.md.**
- ARCHITECTURE.md missing 8 new bridge files + dispatcher.ts + commands.ts.
- drift-log missing entries for Phase 2A-2E.
- decisions.md missing KAD for Tier-1 codec + accessor + tick-end flush + dirty-tracking pattern.
- summary.md is 112 lines (over the 50-line ceiling).
- **Fix:** ARCHITECTURE update + 5 drift-log rows + KAD-0006 + summary.md compaction (one commit).

**R2-D3 (Claude). GameScene.ts is back at 1018 LOC over the 1000-LOC strict ceiling.** V5-3 fix dropped to 994; Spec 2 annotation-ui regrew to 1018.
- **Fix:** Extract worldlayer/debug-overlay/interpolation glue. Add `tests/architecture/file-size-budget.test.ts`.

**R2-T2 (Claude). No test gates non-migrated Tier-1 slots staying absent from world.state.** A future accidental `accessor.markDirty(combatStatesCodec)` (codec exists, slot not migrated) would write to world.state while save still uses direct Map. Silent divergence.
- **Fix:** Add complementary test that walks `TIER_1_CODECS` MINUS migrated set, asserts `world.getState(codec.slot)` is undefined.

**R2-D4 (Claude). aiSystem deps name `issueUnitAttackCommand` misleads about contract.** Bound function is push-intention, not facade-issue. Same for autoAggression's `issueUnitAttackCommand`.
- **Fix:** Rename to `submitUnitAttackIntention` in deps signatures + call sites. Cosmetic but lowers footgun.

### MINOR

**R2-C4 (Codex). Devlog summary.md compaction discipline drift.** Currently 112 lines, AGENTS.md mandates compaction at >50.

**Gemini MINOR. AI villager-train accumulator hole on TC.** `aiSystem.ts:~380` pushes villager-train intention to TC but doesn't update `pendingTrainsByBuilding[tcId]`. Harmless today (single TC per owner, single decision-tick eval) but breaks if multi-TC or multi-pass enabled later.
- **Fix:** Mirror military / research pattern — increment `pendingTrainsByBuilding` after the villager train push.

**R2-N1 (Claude). aiSystem.ts grew 497 → 774 LOC.** Watch list. Approaches 1000-LOC strict ceiling.

**R2-N2 (Claude). dispatcher.drainPendingCommands has no try/catch.** If submitWithResult ever throws, queue is half-drained and next call double-submits.
- **Fix:** Wrap loop in try/finally with `queue.length = 0` in finally, OR per-command try/catch.

**R2-N3 (Claude). monkConvertProcessedThisTick clear loop walks the whole map every tick.** O(n) where n is recently-targeted units. Bounded and small. Defer.

**R2-N4 (Claude). BridgeStateAccessor lacks `clearDirty(slot)` recovery.** Typo'd markDirty wedges the bridge until `reset()`. Deliberate fail-fast design choice; defer.

## Disposition

iter-1 dispatched 2026-05-01. Reviewer outputs in `tmp/review-runs/full/2026-05-01/1/{codex,claude,gemini}.txt` (cleaned up post-fix).

**Iter-2 plan (correctness first):**
1. R2-M1 fix + R2-T1 test (autoAggression race)
2. Gemini MAJOR fix (pruneOrphanEntityKeys value-side pruning)
3. R2-C2 fix (saveGame Tier-3 flush)
4. Gemini MEDIUM fix (accessor flush throws on uncached dirty)
5. R2-M2 fix + R2-D4 rename (pushIntention contract)
6. R2-D1/R2-C1 — KAD-0006 documenting deviation + Phase 2D blocker note (option b — code split deferred per MEDIUM severity)

**Iter-3 plan (discipline):**
7. R2-D2/R2-C4 — ARCHITECTURE update + drift-log rows + KAD-0007 + summary.md compaction
8. R2-T2 — non-migrated slots negative test
9. Gemini MINOR — TC villager pendingTrainsByBuilding fix
10. R2-D3 — GameScene LOC extraction + budget test

**Iter-4 plan (robustness):**
11. R2-N2 — dispatcher try/finally
12. R2-N1 — aiSystem decomposition (if it crosses ceiling during iter-3)

Per /yolo: process all of iter-2 in this session.

## Iter-2 outcome

Iter-2 dispatched. Reviewer findings:

| Theme | Codex | Claude | Gemini |
|---|---|---|---|
| accessor.flush partial-write atomicity gap | MEDIUM (cache-presence check inside loop, not pre-pass) | MEDIUM (placement asymmetric vs unknown-slot) | ACCEPT |
| saveLoadValuePrune.test.ts uses dead-pair which key-side prune already cleans | — | MEDIUM (test gap — needs half-dead case) | ACCEPT |
| hasPendingUnitCommand uses `default: break` — silent miss on new GameCommands variants | — | MINOR (recommend exhaustive switch) | ACCEPT |

All three real findings addressed inline:

- **Accessor flush atomicity** — Cache-presence check moved into the pre-pass loop alongside the unknown-slot check. True atomicity: a partial-flush is now impossible.
- **Test strengthening** — `saveLoadValuePrune.test.ts` gained a half-dead case that picks a real bootstrap building id and pairs it with a fabricated dead unit value. The new case fails pre-fix (live key + dead value would survive both `pruneOrphanEntityKeys` and the cross-ref invariant) and passes post-fix.
- **Exhaustive switch** — `hasPendingUnitCommand` enumerates every GameCommands variant and uses `assertNever(cmd)` — adding a new variant without a case is a TS compile error here.

iter-2 + iter-3 strengthening all pass: 725 tests passed + 1 skipped + 0 failed. Build clean. typecheck/lint clean. Reviewer convergence target reached.

R2-D1/R2-C1 (monk decision split) and items 7-12 deferred to follow-up commits per /yolo throughput; folder will move to `done/` only after the full-review thread closes (after iter-3 / discipline pass).
