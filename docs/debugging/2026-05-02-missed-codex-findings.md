# Debug — Missed Codex findings across impls 16–24

## Symptom

Across 8 multi-CLI reviews this session (impls 16, 17, 18, 19, 20 — and 21/22/23/24 where Codex was "skipped" based on the same misdiagnosis), the REVIEW.md syntheses recorded "Codex unreachable" or "Codex skipped." A user-driven post-mortem (2026-05-02) revealed Codex was actually emitting findings; my `awk` extraction was capturing the prompt-echo (which contains the literal `===BEGIN-REVIEW===` marker as instructions to Codex) instead of the real review near the end of the file.

## Root cause

`codex exec --ephemeral` echoes the full stdin (prompt + diff + tool-call transcripts) into the output before printing the response. The prompt instructs Codex to bracket its review with `===BEGIN-REVIEW===` / `===END-REVIEW===`. Both literal strings appear in the prompt-echo. The naive `awk '/===BEGIN-REVIEW===/{p=1; next} /===END-REVIEW===/{exit} p' codex.txt` matches the FIRST occurrence — inside the prompt-echo — and exits at the FIRST `===END-REVIEW===` it finds (also inside the prompt-echo). The actual review lives after a `^codex^$` line at the bottom of the file.

Correct extraction:
```bash
sed -n '/^codex$/,$p' codex.txt | awk '/===BEGIN-REVIEW===/{p=1; next} /===END-REVIEW===/{exit} p'
```

Codified in `AGENTS.md` and `docs/learning/lessons.md`.

## Findings missed (re-extracted 2026-05-02)

### impl-16 — Phase 1C AI intention refactor (commit 4e48c02)

- **HIGH (Codex):** Same-tick production/research pushes can bypass the AI's queue cap. `aiSystem` snapshots `pendingTrainsByBuilding` once at tick start and does not update it after local pushes; it also ignores pending research in queue-length gates. Example: a TC with one queued item can push age research and still push a villager because `tcEffectiveQueueLength` only includes pending trains, not pending research. Handlers append both with no queue-cap recheck → queue length 3 where AI intended max 2.
  - **Status:** Partially mitigated by Gemini F2 fix (pickUnitMix loop now increments `pendingTrainsByBuilding` after each push). Research path still has the gap. **Action:** Phase 1C iter-2 fix needed — increment `pendingResearchKeys` after age-up push at TC.

- **HIGH (Codex):** Same-tick construction intentions can reuse the same villager and overwrite the first build command. The watch-tower path pushes a build intention BEFORE `ongoingBuilds` is computed. `pendingBuildsByOwner` was snapshotted at tick start, so the later wonder/nextBuild gate doesn't see the watch-tower push. `findAvailableVillager` only sees current `unitCommands`, and `startConstruction` doesn't reject a villager that already received an earlier same-batch build command. Result: second handler creates another foundation and replaces the villager's command, leaving the first construction stranded.
  - **Status:** Partially mitigated by my watch-tower `pendingBuildsByOwner` increment fix. But `findAvailableVillager` returning the SAME villager for two same-tick build pushes is still a real bug. **Action:** Phase 1C iter-2 fix needed — track per-tick assigned-villager set and exclude already-assigned villagers from `findAvailableVillager`.

### impl-17 — Phase 2A codec dispatch + accessor (commit c4a4ed8)

- **HIGH (Codex):** Shallow codecs break the dirty/flush boundary. `flatMapCodec.serialize` returns `Array.from(map)` which yields the SAME element references as the source Map. `flush()` stores that result via `world.setState`. civ-engine stores the same reference internally. So for slots with mutable object/array values (`playerResources`, `productionQueues`, `unitCommands`, `lastSeenStatic`), mutating a cached value via `accessor.get(codec).get(id).field = X` mutates `world.state` directly without dirty tracking. Replay/save snapshots depend on aliasing rather than the accessor contract.
  - **Status:** **NOT FIXED.** Real risk for any future slot whose value is a mutable object (e.g. ProductionQueueEntry, PlayerResources, MemoryEntry). **Action:** Phase 2A iter-2 fix needed — clone the JSON shape at the codec boundary, OR document the contract that values must be immutable / replaced wholesale.

- **MEDIUM (Codex):** `BridgeStateAccessor.flush()` silently drops dirty slots not present in `SLOT_CODECS_BY_KEY`. `inFlightTechByOwnerCodec` is exported but intentionally excluded from `TIER_1_CODECS`. So `accessor.mutate(inFlightTechByOwnerCodec, ...)` compiles, marks dirty, then loses the write at flush + clears the dirty flag.
  - **Status:** **NOT FIXED.** Latent bug if anyone ever calls accessor.mutate with the inFlightTech codec. **Action:** Phase 2A iter-2 fix needed — `flush()` should throw on unknown slot; or alternatively `markDirty(codec)` overload should reject codecs not in `SLOT_CODECS_BY_KEY`.

### impl-18 — Phase 2B output-phase tail (commit 5345187)

- **MAJOR (Codex):** `tests/replay/outputTail.test.ts` order test doesn't actually prove the required ordering. Because tier3 never writes to `trace`, a broken registration of `controlOutput → aoe2BridgeSnapshot → aoe2Tier3Sync` would still pass. Same finding as Claude F1 (already addressed inline).
  - **Status:** **FIXED INLINE** — tier3 now traces via `consumeIfDirty` wrap.

- **MAJOR (Codex):** Visibility no-op test doesn't verify the optimization. Same finding as Claude F4 (already addressed via reference-identity check).
  - **Status:** **FIXED INLINE.**

### impl-19 — Phase 2C bootstrapFlush integration (commit 14efffc)

- **MAJOR (Codex):** `aoe2.visibility` becomes stale after bootstrap. `wireBridgeOps` constructs a new `VisibilityCell`, registers the output tail, then `bootstrapFlush` consumes the cell's initial dirty flag. After that, the live visibility system mutates the raw `VisibilityMap` via `syncVisibilitySources`, but no production caller invokes `visibilityCell.markDirty()`. Recorder periodic/terminal snapshots after units move keep the tick-0 `aoe2.visibility`, so replay/load consumers opening from those snapshots get wrong fog/explored state.
  - **Status:** **NOT FIXED.** This is exactly Phase 2E's job (syncVisibilitySources fingerprint cache + markDirty), but it's a real bug shipped in 14efffc that will cause replay snapshots to have stale fog. The Phase 2C devlog acknowledged this as "Phase 2E work" but Codex correctly flagged it as ship-time bug. **Action:** Phase 2E must run before any replay-scrubber feature work that relies on visibility correctness.

### impls 20–24 — Phase 2D slot migrations

- impl-20 (villagerOrdinals): Codex no findings.
- impl-21 (gathererStuck): Codex was not dispatched (skipped due to bug).
- impl-22 (monkHealCounters): Codex was not dispatched.
- impl-23 (playerAges + playerCivilizations): Codex was not dispatched.
- impl-24 (overrides): Codex was not dispatched (test re-run in this session: "No findings").

**Action for skipped impls:** dispatch Codex retroactively against each diff, with the corrected extraction. Net cost = 4 review cycles.

## Process recovery

1. AGENTS.md extraction snippet corrected (this commit).
2. lessons.md entry added (this commit).
3. Each REVIEW.md from impls 16–24 should be amended with a post-mortem section noting the missed findings + fix status.
4. Real bugs in impl-16 (HIGH × 2) and impl-17 (HIGH + MEDIUM) need iter-2 fix commits before any further v0.1.6 work.
5. Phase 2E must land before Phase 3 to address impl-19's visibility staleness.

## Lesson generalized

Every multi-CLI review going forward should:
- Use the corrected `sed -n '/^codex$/,$p' | awk ...` extraction.
- Sanity-check Codex's "no findings" claim against the live tail of the file (`tail -50 codex.txt`).
- Treat persistent reviewer divergence (Gemini = N findings, Claude = M findings, Codex = 0) as a smell worth confirming, not a comfortable convergence to ACCEPT.
