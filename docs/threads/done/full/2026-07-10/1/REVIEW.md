# Full Codebase Review — 2026-07-10 (Iteration 1)

**Date:** 2026-07-10 (HEAD `605979d`, working tree at v0.1.133)
**Baseline:** `npm test` GREEN — 1957 pass / 2 skip (235 files) before any fix.
**Reviewers (independent lenses):**
- Codex `gpt-5.6-sol` / ultra ×2 — (1) core sim / persistence / concurrency; (2) playtest harness / efficiency / docs.
- Claude `opus[1m]` / max ×3 — (A) persistence & determinism; (B) gameplay sim & AI; (C) render / UI / graphics.
- 4 in-process Explore verifiers adversarially re-checked Codex-1's 15 findings against live code.

**Model note:** Claude **Fable 5 quota was exhausted** at review time ("reached your Fable 5 limit"), so all three Claude lenses ran on the `opus[1m]` fallback per the fleet runbook. Codex `gpt-5.6-sol`/ultra verified reading files in its read-only sandbox. Retry Fable next iteration.

**Prior full review:** `docs/threads/done/full/2026-05-01/1` (Phase 2E). All V-series fixes remain shipped; this review is a fresh whole-tree pass over the v0.1.60→133 gameplay + graphics + recursive-loop work.

## Method & headline

Every finding below was read in the live code. Adversarial verification materially changed the picture: **Codex-1 over-rated severity on ~half its findings**, and one (replay divergence detection) was **refuted outright** by the engine's admission guards. The most severe *real* bugs came from the Claude persistence lens (wildlife save-corruption, movePathCache replay divergence, crash-recovery) and the Codex harness lens (oracle under-reporting, budget-guard bypass). Two genuine reviewer disagreements were adjudicated by direct read (F5 confirmed; unit-facing refuted).

## Cross-reviewer agreement (corroborated findings)

| Finding | Reviewers | Verdict |
|---|---|---|
| HUD RAF/listener leak on teardown (`hudController.destroy()` never called) | Codex-1 (#14), Codex-2, Claude-C | CONFIRMED — MEDIUM/LOW |
| IndexedDB flush drops batch on tx error/abort | Codex-1 (#3), Claude-A | CONFIRMED — MEDIUM(→HIGH w/ quota) |
| Minimap viewport quad is an oversized AABB diamond | Codex-1 (F15), Codex-2, render-verifier | CONFIRMED — LOW-MED |
| Building health bars pierce roof accents | Codex-1 (F16), Codex-2, render-verifier | CONFIRMED — LOW |
| Debug overlays paint in un-projected top-down space | Claude-C, Codex-2 | CONFIRMED — MED (debug-only) |
| Recursive `fixed-proven` ignores rerun verification + budget-death | Codex-1 (F9), Codex-2 | CONFIRMED — MEDIUM |
| AI builder fallback can abandon a foundation | Codex-1 (F13), Claude-B, ai-verifier | CONFIRMED — LOW-MED |
| Doc drift (ARCHITECTURE/spec/changelog/README/drift-log) | Codex-2, Claude-C | CONFIRMED — MEDIUM |

## Findings

### HIGH

**H1 — Wildlife HP & death not persisted (missing `markDirty(wildlifeStatesCodec)`). [Claude-A]** `playerCommandsSystem.ts:276-277` and `entityDestroyOps.ts:343-346` mutate the cached `wildlifeStates` value (currentHp / targetEntityRef / isAlive) but only `markDirty(combatStatesCodec)` — never the wildlife slot. `flush()` re-serializes only dirty slots, so `world.state` stays stale: **save a boar hunt → boar reverts to full HP on load; kill a boar (corpsePersists) → it resurrects `isAlive:true` and is huntable again**. Masked non-deterministically only when other wildlife acts that tick. **Fix:** `accessor.markDirty(wildlifeStatesCodec)` after both sites.

**H2 — Save during replay clobbers the player's live save. [Codex-1 #2, driver-confirmed]** In replay, `bridge` is the replay bridge (`createApp.ts:116`); `saveGame: () => bridge.saveGame()` → `makeReplayBridge.ts:255` → real historical blob (no throw). The HUD only disables the *replay-load* button in replay (`createHudController.ts:247`), NOT Save. Clicking Save in replay writes historical state over the single `aoe2-save-v1` key. **Fix:** disable/no-op Save while `replayController.mode === 'replay'` (gate `saveButton` like the replay-load button), or route to a separate slot.

**H3 — IndexedDB flush drops the whole batch on tx error/abort. [Codex-1 #3, Claude-A]** `IndexedDBMirror._flushNow` (`:322-343`) detaches `this._pending` before the tx and never restores it on `onerror`/`onabort`. Under `QuotaExceededError` this truncates the recording tail; under a transient abort it leaves a gap that later fails replay's `assertContiguousTickEntries`. Writes are idempotent keyed puts. **Fix:** merge `pending` back into `this._pending` on failure and retry.

**H4 — Crash-recovered recording sessions are frozen at `endTick==startTick` → non-replayable. [Claude-A]** `session_meta` is written once at first snapshot (`endTick=startTick`, `durationTicks=0`) and only corrected by `stop()→updateMeta`; `reconstructBundle` (`IndexedDBMirrorReads.ts:130`) returns it verbatim without recomputing from the persisted `ticks`. On refresh/crash (no `stop()`), the recovered bundle reports zero length → `openAt(t>startTick)` throws `too_high` and the panel's `replayEmptyAbnormal` gate disables Replay for every crashed session — defeating crash-recovery (this is the `endTick:0` recorder gremlin noted in `docs/learning/lessons.md`). **Fix:** for `closed:false` rows recompute `endTick`/`persistedEndTick` from `max(ticks.tick)`/`max(snapshots.tick)` and flag `incomplete`.

**H5 — `movePathCache` unserialized → replay re-simulation diverges. [Claude-A]** The per-unit A* path cache is bridge-side (absent from `TIER_1_CODECS`, never rehydrated) yet consulted every tick incl. replay. `SessionReplayer.openAt` re-simulates from the nearest periodic snapshot (interval 1000), so at scrub/inspect tick ≥1000 the cache starts empty while the recorded run had it populated → `resolveMovePlanFromCache`'s stale-route follow can't be reproduced → **silent wrong unit positions in the replay viewer and `replay-inspect` ground-truth** (which the self-improvement loop treats as authoritative). No divergence gate on `openAt`. **Fix:** add a codec for `movePathCache`, or make cached-route reuse recompute-equivalent. (Verify the observable-divergence claim before fixing; complex.)

**H6 — Advisory markers short-circuit and hide deterministic oracle findings. [Codex-2]** `extractImprovementFindingsFromRun` (`selfImprovementLoop.ts:166`) returns on the FIRST non-empty source (markers → envelope → oracle), so one low-severity LLM marker hides HIGH tick-failure / pinned-unit oracle findings from the ledger and recursive candidate selection. **Fix:** union + dedup all three sources, preserving provenance.

**H7 — Standalone oracle sweep skips the mandatory end-tick repair → under-reports. [Codex-2]** `scripts/run-oracles.mjs:20` calls `runOracles` directly, bypassing `bundleEndTick` repair that "every oracle pass must" run; on the campaign-4 bundle this yields **10 vs 32 findings** (22 pinned-unit findings silently dropped). **Fix:** centralize the end-tick repair inside the oracle entrypoint.

**H8 — Non-finite CLI numbers disable the LLM spend/tick bounds. [Codex-2]** `scripts/playtest-llm.mjs:74` passes numeric flags through `Number()` with no finite check; `--cost-budget nope` → `NaN` makes every budget/tick comparison false, removing all practical bounds. **Fix:** validate each numeric option is finite/in-range before starting a provider or browser.

**H9 — Recursive validation executes model-authored code before human review. [Codex-2]** `applyAndGate` applies a proposed diff and runs npm gates (`playtest-recursive.mjs`); a proposal can add lifecycle scripts or alter build/test config and execute arbitrary code with user privileges (never auto-merged, but executed). **Fix (targeted):** reject diffs that touch `package.json` scripts/deps, `package-lock.json`, or add npm lifecycle hooks / config files; longer-term, sandbox the gate. (Severity: security/defense-in-depth; models are trusted pins, so blast radius is bounded but real.)

### MEDIUM

**M1 — Debug overlays render in stale top-down `cell*cellSize` space. [Claude-C, Codex-2]** All four F-key world-space overlays (`debugOverlay.ts:74,93-96,123,137-140`) never call `worldToIso`, so selection-bounds / pathing / fog-state / coarse-vs-fine paint where the world isn't — breaking the introspection tools AGENTS.md says to reach for first (F2-debug-only, no player impact). **Fix:** project every corner/point through `worldToIso`.

**M2 — HUD teardown chain unreachable (RAF + window listeners leak). [Codex-1 #14, Codex-2, Claude-C]** `createApp.ts:373` disposes five controllers but never calls `hudController.destroy()` (the sole owner of `cancelAnimationFrame` + window mousemove/mouseup removal; its `destroyed` guard is only set inside that method). Exposure is test-isolation / HMR / future return-to-title (production never destroys the game). **Fix:** call `hudController.destroy()` in the destroy handler; also make the minimap `mousedown` handler removable.

**M3 — Stale auto-aggression overwrites a newer explicit player move. [Codex-1 F5, ai-verifier; driver-adjudicated over Claude-B]** A human move goes straight to the engine FIFO queue (`unitCommandOps.ts:212`); auto-aggression's guards (`autoAggressionSystem.ts:83,92`) only check state at tick K, before the move exists, and its attack intention drains into the engine queue AFTER the already-queued move → FIFO runs move then the unconditional attack handler (`unitCommandOps.ts:244`) → attack clobbers the move (one-tick loss of control near enemies; classic "unit won't retreat"). **Fix:** on an explicit human unit command, evict that unit's pending auto-aggression intention from `pendingCommands` (or tag + skip stale auto-aggression at drain).

**M4 — Save drops accepted-but-unexecuted human commands. [Codex-1 F4, persistence-verifier]** Human orders enter the engine's transient `commandQueue` (a plain array, not world state; `world.serialize()` omits it); an order issued in the ≤1-tick window before the game menu auto-pauses is silently dropped on save. **Fix:** route human commands through the persisted `pendingCommands` (as AI does) or drain/process the engine queue in `flushBeforeSerialize` before serialize.

**M5 — Fog-memory phantom building on entity-id recycle. [Claude-B]** `lastSeenStatic` is keyed by RAW entity id (no generation); civ-engine recycles ids, so `fogMemorySystem` cleanup's `stillExists = getComponent(id,'position')` stays true once the id is reused → a destroyed-under-fog building ghosts forever and survives save/load (Tier-1). `renderStore` keys by `id:generation` precisely to avoid this. **Fix:** store/compare `generation` (key `id:generation`) in the refresh + cleanup loops.

**M6 — Recursive selection + prove ignore eligibility and rerun verification. [Codex-1 F8/F9, Codex-2, harness-verifier]** `fixProposalInput.ts:30` filters only `classification.kind==='fix'`, ignoring `autoFixEligible` (which has ZERO consumers) — so `manualFix`/infra-fault findings reach apply+commit; and `playtest-recursive.mjs:394` proves `fixed` from finding-absence without checking `rerunLedger.verification.current.ok`, while `llmRunner.ts:294` maps `cost-budget-exceeded`→`stopWhen` which `oracles.ts:13` reads as a clean completion. **Fix:** require `autoFixEligible===true` (and exclude `match-completes`/infra stopReasons) before auto-apply; gate `fixed-proven` on `verification.current.ok===true` and a genuine completion (not budget death).

**M7 — Marker-list click resolves the wrong marker after one is added. [Claude-C]** Rows carry a positional `data-marker-index` into the re-sorted, re-allocated `recording.markers()`; a newly added marker prepends (latest tick) and shifts every index, and there's no marker-added re-render — so in the sub-second window a click pauses + pans/selects the wrong marker. **Fix:** look up by `row.dataset.markerId` via `.find(m=>m.id===id)` (mirror the replay branch); the index attribute is then vestigial.

**M8 — Minimap viewport quad is an oversized AABB diamond. [Codex-1 F15, Codex-2, render-verifier]** `cameraController.ts:333-355` collapses the 4 real view corners to a cell-space AABB, then `minimap.ts:104` re-projects the AABB → a ~2× circumscribing diamond instead of the true viewport rectangle (the iso transform is pure scale+translate, so the real viewport is axis-aligned). **Fix:** carry the 4 real corner cells straight to `cellToMinimap`; drop the min/max AABB.

**M9 — Replay fog-owner swap doesn't invalidate the minimap cache. [Codex-2]** Minimap redraw keys only on tick + camera signature; `ReplayController` can replace the bridge for a different fog owner at the same paused tick, so the minimap keeps showing the prior player's visibility until movement/tick advance. **Fix:** include bridge/projection identity in the invalidation signature.

**M10 — Building visual (roof/walls) lies outside the selection hitbox. [Codex-2; Claude-C confirms ground-plane hit-test is otherwise correct]** Clicks inverse-project to the ground plane and test top-down footprints (`entityHitTest.ts:92-113`), so clicking an elevated roof ridge maps behind the building and clears selection. **Fix:** depth-order hit-test the visible iso geometry before falling back to footprints. (Non-trivial; user-facing.)

**M11 — Steady-state per-tick full scans (perf). [Claude-B]** `wildlifeCombatSystem.ts:63` scans ALL resources every tick for a few wildlife; `towerCombatSystem.ts:74-112` runs full target acquisition every tick even while reloading (cooldown short-circuit is after the work); `villagerGatherAssignment.ts:97` does a full resource scan+sort per idle villager (O(V·R·logR) on mass-idle). **Fix:** iterate the wildlife side-map; hoist the cooldown `continue`; bucket resources by kind once/tick.

**M12 — TC reference not reselected on destroy. [Codex-1 F10, ai-verifier — PARTIAL]** `entityDestroyOps.ts:231` deletes the single per-owner TC ref without reselecting a surviving TC, and hydration doesn't rebuild it. Reachable only for a human's ref (AI never builds a 2nd TC), so the real effect is degraded AI *targeting/rally* vs the human — not "AI production" as Codex claimed. **Fix:** on TC destroy, re-scan for another surviving `town-center` and set the ref (mirror in hydration).

**M13 — Harness correctness: cost-exhaustion counted as match-completion; ticks counted after halt; conformance keyed by volatile tick-IDs; inert economy-oracle thresholds. [Codex-2]** `oracles.ts:12` accepts every `stopWhen`; `llmRunner.ts:210` increments `ticksRun` without comparing `tickAfter` (halted game keeps spending, false-greens `corpusRegression`); `visualPlaytestAdapter.ts:123` conformance IDs embed tick+index so the same defect at ticks 500/750 reads as resolved+introduced; `types.ts:63` exposes `economyByTick/MinVillagers/MinAge` that no oracle implements yet `corpusSchema` accepts. **Fix:** base completion on match outcome; derive termination from observed tick/halt/outcome; key conformance by a stable semantic signature; implement or remove the economy thresholds.

**M14 — Test/guardrail gaps. [Claude-A, Codex-2]** `snapshotEquivalence.test.ts:134-152` reads the "live" side off `world.state`, so it's blind to mutated-in-cache-but-never-flushed slots (why H1 escaped); `fileSizeBudget.test.ts:24` + `package.json` lint scope exclude `scripts/` (`content-lib.mjs` 633, `playtest-llm.mjs` 570 LOC). **Fix:** compare real `saveGame()` observable state vs restored world; extend the size/lint gates to `scripts/` or narrow the stated policy.

**M15 — Doc drift on canonical surfaces. [Codex-2, Claude-C]** `ARCHITECTURE.md:98` says the bridge facade is 332 LOC / 3 Tier-3 slots / 19 systems; live is ~500 LOC / 4 slots / 20 factories (incl. `scoreTimerSystem`). `spec-final.md` holds contradictory rules — §14.3 iso minimap vs §14.5 top-down; flat vs pitched roofs; deferred vs shipped death effects. `changelog.md` folds v0.1.129/128 under the `## 0.1.130` header. `README.md:56` says the LLM controls player 2 but `playtest-llm.mjs:14` defaults to player 1. `drift-log.md` is missing the 2026-07-09 file-size-split row. **Fix:** reconcile each to the code.

### LOW / nitpick

- **L1** Duplicate garrison IDs pass hydration validation (uniqueness unchecked); gameplay can't create one, only a corrupt save. Add a uniqueness assertion. [Codex-1 F11]
- **L2** `accessor.flush()` write phase isn't transactional after the pre-pass; only triggers under pre-existing `NaN`/`undefined` corruption. Stage serialize+clone for all slots first. [Codex-1 F12 — PARTIAL; Claude-A considers the pre-pass adequate]
- **L3** AI builder fallback can yank the sole builder of a foundation via the uncapped watch-tower path. Skip `type:'build'` villagers. [Codex-1 F13, Claude-B]
- **L4** Dead code: `buildPendingIntentionMaps` (`aiSystemGating.ts:33-88`, queue always empty there) with a misleading comment; `assignAiMonkTasks` (`monkTaskOps.ts:193`, zero callers, KAD-0008 re-wire trap). Delete or mark test-only. [Claude-B]
- **L5** Two wonders completing the same tick decide human victory by Map insertion order (strict `<`). Prefer `humanPlayerId` on tie. [Claude-B]
- **L6** `computeOccludedUnits` re-projects all building silhouettes ~60 fps while anything is selected. Cache like the terrain layer. [Claude-C]
- **L7** `hasCenteredOnBase` not reset in `resetForBridgeSwap` → camera doesn't reframe the base after load/replay (maybe intentional — make it deliberate). [Claude-C]
- **L8** IndexedDB mirror grows one row/tick unbounded (→ eventual quota → H3); `RecordingService` is effectively single-use. [Claude-A]
- **L9** `gatherTargetCounts` not decremented on the drop-off-complete path (benign, self-heals). [Claude-B]
- **L10** Harness clobbers concurrent uncommitted tree edits (`applyAndGate` reset --hard / add -A on the live tree, not an isolated worktree); clean-tree precondition bounds it. [Codex-1 F1]
- **L11** `tmp-occ-commit.txt` (the v0.1.133 commit-message body) was committed as a tracked file. Remove it. [driver]

### Refuted / not-a-bug

- **Replay divergence detection (Codex-1 F7)** — REFUTED. The engine rejects schema/cross-major/range/handler drift at admission (`session-replayer.ts:437-450`) and `selfCheck` is wired into the ledger path; only a deliberately-tampered same-major bundle plays false — not a realistic threat for a local single-player viewer.
- **Unit facing uses top-down angle (Codex-2)** — REFUTED. `unitFacingRadians` operates on projected/screen-space positions (`unitRenderer.ts:92-111`), computing `atan2` on projected deltas. Claude-C's "clean" verdict stands.
- **`renderStore` discards generation (Codex-2)** — the store itself keys by `id:generation` (`renderStore.ts:18-19`). Only the downstream interpolation/hit-flash caches key by raw id — a rarer same-tick-id-reuse visual aliasing (folded into M-tier consideration, verify at fix time), not the stated store-level defect.

## Disposition & fix plan (iteration 1 → fixes land, then iteration 2 re-review)

Order: correctness/data-loss first, then harness honesty, then render/UX, then perf, then docs, then nitpick. Each fix is TDD (red → green) and gated (`npm test`, typecheck, lint, build; browser suite explicitly when render is touched, compared to the known pre-existing floor). Commit per coherent change on `main`; version-bump only user-visible behavior changes.

1. H1 wildlife markDirty (+ M14 strengthen `snapshotEquivalence` so it would have caught it).
2. H2 gate Save in replay.
3. H3 IDB requeue-on-failure.
4. H4 crash-recovery endTick recompute.
5. H6/H7/H8 harness honesty (oracle union, end-tick repair centralization, finite-number validation) + M6/M13 (eligibility + prove gating + completion semantics).
6. M1 debug-overlay iso projection; M2 HUD teardown; M7 marker-id lookup; M8 minimap viewport; M5 fog-memory generation; M3 auto-aggression precedence; M4 human-command persistence.
7. M11 perf trio; M12 TC reselect; M9 minimap fog invalidation; F16/health-bar bounds; M10 hit-test (assess — may defer if too invasive).
8. H9 + L-tier harness/cleanup; M15 + doc reconciliation; L11 remove tmp file.
9. Complex/verify-first: H5 movePathCache (confirm observable divergence before changing determinism surface).

Re-review (iteration 2) will re-run the multi-CLI pass on the diff to verify each fix landed and introduced no regressions, considering this REVIEW.md + `docs/learning/lessons.md`.
