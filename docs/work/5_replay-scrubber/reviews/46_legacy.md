# Phase 2D slot 20 review — `lastSeenStatic` migration

Iteration 1, three CLIs, all converged on **APPROVE on the code**.

## Reviewers

- Codex (`gpt-5.5 xhigh`): APPROVE — verified each migration step against the live tree; flagged pre-existing 500-LOC violation on `wireBridgeOps.ts` (588 LOC) and a perf note about per-tick re-serialization (design tradeoff, not a bug).
- Claude (`claude-opus-4-7[1m] max`): APPROVE — explicit "no real bugs found"; observed (1) future footgun if a caller bypasses `getOrCreateMemoryMap` and writes via `accessor.get(codec).get(playerId).set(...)` directly (would silently lose dirty bit) — same documented contract as `bridgeStateAccessor.ts:60-64`; (2) steady-state re-serialize cost since `lastSeenStaticCodec` is dirty every tick fog memory updates.
- Gemini (`gemini-3.1-pro-preview` plan-mode): APPROVE — verified all migration patterns. Same perf observation as Codex/Claude.

## Findings (severity-tagged)

- **NIT (pre-existing) — `wireBridgeOps.ts` 500-LOC violation.** 588 LOC; this diff touches the file again. Already on the file-split queue. Disposition: handled in the file-split phase after slot migrations complete.
- **OBSERVATION (design tradeoff, not a bug)** — Steady-state per-tick re-serialization cost. `lastSeenStaticCodec` flips dirty every tick the fog memory system runs writes (which is essentially every tick during normal play), so the entire mapOfMap re-serializes on every flush. Pre-Phase-2D, this serialize was only paid at `saveGame()` time; now it's part of the per-tick cost. Acceptable for the v0.1.6 milestone — the benefit is replay scrubber correctness, and fog memory was always going to be the hottest write surface. Recorded for future profiling if save/snapshot cost surfaces in benchmarks.
- **OBSERVATION (future footgun, not a bug today)** — Mutate-inner-map-without-going-through-helper would silently lose the dirty bit. The contract is documented at `fogMemoryOps.ts:18–21` and matches the general accessor mutation footgun called out at `bridgeStateAccessor.ts:60–64`. No live caller bypasses the helper today; flagged for future review prompts.

## Verified by reviewers (no findings)

1. `fogMemorySystem.ts:31` calls `getOrCreateMemoryMap(humanPlayerId)` on every execute before any `set`/`delete` — dirty bit fires unconditionally per tick.
2. `fogMemoryOps.ts:50–56` always calls `accessor.mutate(lastSeenStaticCodec, ...)` — even when the player sub-map already exists. No early-return short circuit.
3. `BridgeStateAccessor.mutate()` marks the slot dirty after the callback returns; `flush()` re-serializes the cached object — so later in-place writes to the returned inner Map are captured by the bridgeSnapshotSystem flush at end of tick.
4. Read-only fog-memory paths (`getFogMemoryEntities`, `getHumanFogMemorySize`) use `accessor.get(lastSeenStaticCodec)` without dirty marking. Correct.
5. Save uses `[...accessor.get(lastSeenStaticCodec).entries()]` and serializes inner maps; hydrate wraps the entire `blob.lastSeenStatic` rebuild in `accessor.mutate(lastSeenStaticCodec, outer => { ... })`.
6. `wireBridgeOps.ts` no longer destructures `lastSeenStatic` from state; passes `accessor` into `createFogMemoryOps`.
7. `bridgeState.ts` removed the field + initializer + `MemoryEntry` import.
8. `lastSeenStaticCodec` is a `mapOfMapCodec` registered in `TIER_1_CODECS`.

## Final disposition

Slot 20 ships as-is on commit `7731848`. No follow-up findings to address.
