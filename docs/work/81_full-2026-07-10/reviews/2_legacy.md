# Full Codebase Review — 2026-07-10 (Iteration 3: convergence verification + one more deferred fix)

**Date:** 2026-07-10. **Scope:** verify the iteration-2 fixes are complete, and close out a tractable deferred finding (H7).
**Reviewer:** in-process adversarial Explore verifier (a refuting pass over the iter-2 diff against the live files + tests + pre-fix code via `git show`). The multi-CLI diff review had already run in iteration 2 (Codex substantive; Claude opus[1m] hung and delivered nothing).

## Convergence verification (iteration-2 fixes)

The verifier tried to refute each iter-2 fix and reported all three **COMPLETE**:

- **H3 (idempotent flush requeue):** COMPLETE. The `settled` flag is set synchronously with no intervening await; `fail()` and `oncomplete` are symmetrically guarded, so resolve cannot race a fail and requeue+reject run exactly once; the `try/catch` covers the synchronous-throw path. `_requeuePending` order + meta-merge is correct under repeated failures. The tests refute the OLD code (double-event → 2 requeues; sync-throw → `SessionNotFound` on reconstruct).
- **H4 (crash-recovery reachability):** COMPLETE. `listSessions`'s `!closed` `endTick` recompute equals `reconstructBundle`'s, so the panel gate and the bundle agree; both gate directions are tested; no "ticks-but-no-snapshot" hole (recordMeta always writes the initial snapshot). One non-blocking nuance: the recompute uses `getAll` to take a max where a reverse key-cursor would be O(1) — crash-only + user-initiated, acceptable (matches the code comment).
- **H8 (CLI arg extraction):** COMPLETE. Byte-identical defaults + preserved per-flag validation vs the original inline parser (verified via `git show`); in fact strictly stricter (empty-string now rejected; value-flags route through `requireValue` instead of a bare `argv[++i]` crash). Exit-2 contract intact; `instanceof` is single-import safe.

**Verdict: the H1–H4 / H8 fix-loop has CONVERGED** — the re-review found no remaining incompleteness or regression, only a non-blocking perf nuance.

## Additional deferred fix closed this iteration

- **H7 (Codex-2, harness): the oracle end-tick repair is now centralized in `runOracles`.** `scripts/run-oracles.mjs` was the one caller that skipped `repairBundleEndTick`, so a frozen-`endTick:0` bundle blinded the range-scanning oracles (10 vs 32 findings on campaign-4). Moving the idempotent repair into the single entrypoint means no caller can forget it. Tests added. No version bump (harness).

## Also this iteration

- **Fixed a flaky test I introduced in iter-2:** tightening the H1 corpse assertion to a strict `currentHp===0` was wrong — a dead `isAlive:false` carcass projects `currentHp:null`, so the strict form flaked (the iter-2 suite observed 0, a later run observed null). Restored `?? 0` while keeping the missing-corpse guard. This is a render-layer representation detail (0 vs null for a dead corpse), not a simulation-determinism issue — saves/replays use sim state, where `currentHp` is a deterministic 0.

## Remaining deferred findings (unchanged; for follow-up iterations)

Documented in iter-1 `REVIEW.md`, none worsened by the iter-1/2/3 diffs. Grouped by why they were deferred:
- **Delicate / need care or user input on approach:** M3 (auto-aggression vs explicit player order — touches the command-precedence model), H5 (movePathCache replay divergence — replay-semantics risk; verify observable divergence first), M5 (fog-memory id-recycle — fix is small but a proper red test needs a destroy-out-of-vision + id-recycle harness the bridge doesn't cheaply expose).
- **Harness robustness (lower user impact):** H6 (union marker/oracle finding sources), H9 (recursive-loop sandbox for model-authored diffs), M6/M13 (recursive prove-fixed gating + completion semantics), F8/F9 (already partly covered by H7's repair + verification wiring).
- **Cosmetic / visual (LOW-MED):** F16 (health-bar/roof-accent overlap), M1 (debug overlays in top-down space — F2-debug-only), M9 (replay fog-owner minimap invalidation), M12 (TC-ref reselect on destroy — AI targeting only).
- **Perf (no observable effect):** M10 (visual hit-test), M11 (per-tick full scans), and the LOW-tier efficiency notes.
- **LOW nitpicks:** L1 (garrison-id uniqueness), L2 (accessor write-phase atomicity), L4 (dead code), L5 (wonder tie-break), L8 (unbounded IDB growth), L10 (harness clobbers concurrent tree edits).

Recommendation: tackle these in prioritized follow-up passes; M3 and H5 in particular benefit from an explicit design decision before implementation.
