# Phase 2D slot 19 review — `trebuchetPackStates` migration

Iteration 1, three CLIs, all converged on **APPROVE on the code**.

## Reviewers

- Codex (`gpt-5.5 xhigh`): APPROVE on code; flagged MEDIUM test-coverage gap in `snapshotEquivalence.test.ts`; flagged MEDIUM missing detailed-devlog entry; LOW pre-existing 500-LOC violation on `wireBridgeOps.ts` (561 LOC).
- Claude (`claude-opus-4-7[1m] max`): APPROVE — explicitly verified `accessor.markDirty(trebuchetPackStatesCodec)` at lines 51/61/70 (mutating ops) and confirmed the two read-only ops do NOT call markDirty. Same MEDIUM doc finding (missing detailed entry) + MINOR housekeeping (devlog file END_DATE drift).
- Gemini (`gemini-3.1-pro-preview` plan-mode): APPROVE — verified all 8 conventions including the doc-discipline catch-up to 19/35.

## Findings (severity-tagged)

- **MEDIUM (test coverage) — Codex.** `tests/replay/snapshotEquivalence.test.ts` only listed the original 7 migrated codecs. Without the newer codecs in the round-trip + Map-instance tests, a silent regression that drops one of the three `markDirty(trebuchetPackStatesCodec)` calls in `trebuchetState.ts:51/61/70` (or any other slot's dirty-bit) would not be caught at the schema-2 serialization boundary. Disposition: addressed in slot 21 commit — extended the test to 20 codecs via a single `MIGRATED_CODECS` const that drives both the round-trip and the Map-instance check. New slots only need to add one entry.
- **MEDIUM (doc discipline) — Codex + Claude.** No per-task entry in the latest detailed devlog for slot 19 (or for slots 8–18 either — the gap dates back to 2026-05-01). `summary.md` was correctly bumped 7/35 → 19/35 in slot 19's commit. Disposition: addressed in the slot 21 commit — single consolidated entry covers slots 8–20 in `docs/devlog/detailed/2026-05-02_2026-05-02.md` (new active file).
- **MINOR (housekeeping) — Claude.** Devlog active file's END_DATE last touched 2026-05-01; today is 2026-05-02. Disposition: started a fresh `2026-05-02_2026-05-02.md` file rather than `git mv` the prior file (its last entry is correctly dated 2026-05-01 — END_DATE accurate as-is).
- **NIT (pre-existing) — `wireBridgeOps.ts` is 561–587 LOC, over the 500-LOC hard limit.** Slot 19's diff was net-negative on this file (dropped one destructure entry, replaced two raw-map blocks with `{ accessor }`). Already on the file-split queue; not a slot-19 blocker.

## Verified by reviewers (no findings)

1. `trebuchetState.ts` factory takes `BridgeStateAccessor`; three mutating ops call `accessor.markDirty(trebuchetPackStatesCodec)` exactly once after in-place mutation; two read-only ops do not.
2. `trebuchetPackValidator` + `trebuchetUnpackValidator` deps interfaces hold `accessor: BridgeStateAccessor`; read sites use `deps.accessor.get(trebuchetPackStatesCodec).get(data.unitId)`.
3. Tests rewritten via `freshAccessorWithPackStates` helper that constructs a real `BridgeStateAccessor` over a fresh World; all 19 test cases pass.
4. `entityCreateOps` line 157 uses `accessor.mutate(trebuchetPackStatesCodec, m => m.set(entity, {...}))`.
5. `entityDestroyOps` line 135 uses `accessor.mutate(trebuchetPackStatesCodec, m => m.delete(id))`.
6. Save/hydrate symmetry preserved; `saveSchema.ts:146–149` field unchanged → save format compatibility.
7. `wireBridgeOps.ts` no longer destructures the slot from state and threads `accessor` to both validator deps + the trebuchetState factory.
8. `selectionStateOps.ts:355` projects `accessor.get(trebuchetPackStatesCodec)` into `activitySources` (boundary preserved — the `selectionActivity` consumer still types it as `Map<number, TrebuchetPackState>`).
9. `tests/simulation/computeUnitActivityMonkCarry.test.ts:41` still passes raw `Map<number, TrebuchetPackState>` directly to the pure helper — correct: the helper's contract is "give me a Map", and the bridge is responsible for the projection. No migration debt on the test side.
10. `bridgeState.ts` field declaration replaced with phase-2D comment marker; createBridgeState initializer entry dropped; `TrebuchetPackState` import removed.

## Final disposition

Slot 19 ships as-is on commit `0154045`. Codex's MEDIUM test-coverage finding addressed in slot 21's commit (snapshotEquivalence.test.ts extended). MEDIUM doc finding addressed in same commit (consolidated devlog entry covering slots 8–20).
