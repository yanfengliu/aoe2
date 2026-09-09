# Phase 2D slot 18 review — `monkCarriedRelic` migration

Iteration 1, three CLIs, all converged on **APPROVE on the code**.

## Reviewers

- Codex (`gpt-5.5 xhigh`): approve on correctness; flagged doc-discipline + pre-existing 500-LOC violation
- Claude (`claude-opus-4-7[1m] max`): approve, "Ship it" — verified all 7 checklist items against the live codebase
- Gemini (`gemini-3.1-pro-preview` plan-mode): approve, no regressions observed

## Findings (severity-tagged)

- **MEDIUM (doc discipline) — `docs/devlog/summary.md` is stale.** Live summary still reads "Phase 2D: 7/35 Tier-1 slots migrated"; we are at 18/35. The gap predates slot 18 (commits 8–17 also landed without summary updates). Per AGENTS.md doc discipline this is a process regression. Disposition: catch up `summary.md` to "18/35" in the next commit (slot 19's bundle).
- **MEDIUM (pre-existing) — `unitCommandOps.ts` is 591 LOC, over the 500-LOC hard limit.** Slot 18 only adds one codec import and rewrites two read sites; it does not push the file over. Pre-existing violation already on the file-split queue. Disposition: tracked under file-size split list, not a slot-18 blocker.
- **NIT (pre-existing) — redundant delete in `applyMonkDeposit`.** `destroyResourceEntity(relicId)` already walks the carried-relic map and removes the depositing monk's entry by value-side scan; the explicit `accessor.mutate(monkCarriedRelicCodec, m => m.delete(monkId))` immediately after is therefore a no-op delete + one extra `markDirty` per deposit. Same redundancy existed pre-migration. Disposition: leave as-is — defensive belt-and-suspenders; will revisit if it surfaces in profiling.

## Verified by reviewers (no findings)

1. Read sites in `src/` all route through `accessor.get(monkCarriedRelicCodec)` — verified at unitCommandOps:483/492, monkAiSearchHelpers:69, monkTaskOps:146, matchEndOps:142, monkTaskAppliers:271, selectionStateOps:351, saveGameOps:184.
2. Write sites use `accessor.mutate` — verified at entityDestroyOps:132 + 269–275, monkTaskAppliers:253–260 + 283, hydrateFromSavedGame:157–161 + 381 + 424–429.
3. Hot loop in `monkBehaviorSystem.ts:164–187` correctly uses `accessor.get` once + local dirty bit + `markDirty` at end. Position-update branch correctly does NOT mark dirty (no carried-relic map mutation).
4. Save/hydrate symmetry preserved; `saveSchema.ts:118` field unchanged; both orphan-prunes wrapped in `accessor.mutate`.
5. Struct + initializer + wiring drops clean across `bridgeState.ts`, `createBridgeState`, `registerAllSystems.ts`.
6. `monkCarriedRelicCodec` registered in `TIER_1_CODECS` at slot index 18 and reachable via `SLOT_CODECS_BY_KEY`.

## Final disposition

Slot 18 ships as-is on commit `c39cb3e`. Doc-discipline catch-up folded into slot 19's commit.
