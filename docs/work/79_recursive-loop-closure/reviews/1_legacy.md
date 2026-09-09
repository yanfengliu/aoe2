# Review — full-loop default (2026-07-08, iteration 1)

Diff: `playtest:recursive` defaults to the full loop (tri-state `apply: 'auto' | true | false`), episodic memory auto-chains the newest prior ledger, `parseArgs`/`defaultKnownFindings` exported with a guarded `main()`, `.d.mts` declarations, 7 test pins. Reviewers: Codex (gpt-5.5, xhigh) + Claude (opus[1m], max effort), both verifying against the live codebase.

## Findings

- **MEDIUM (Codex): rerun budget could exceed the pass budget.** The old `Math.max(0.5, costBudget - runSpend)` floor guaranteed the rerun a positive allowance even when the run had consumed the whole budget — contradicting the "one pass cannot spend 2x" contract, now on the DEFAULT path. Worse than the arithmetic: an underfunded rerun produces a near-empty bundle with no findings, which would FALSE-PROVE any candidate. **Fixed (TDD):** exported `planRerunBudget(costBudget, runSpend)` — returns the unspent remainder, or null below a $0.50 viability floor; the pass then finishes `fix-unproven` ("cost budget exhausted before the prove rerun") instead of running an unprovable rerun. 4 new test assertions.
- **MEDIUM (Claude): doc drift.** aoe2's `docs/devlog/summary.md` ("Proposal-only default") and the authoritative `docs/threads/current/recursive-loop-closure/DESIGN.md` (opt-in `--apply` flow, "auto-chaining is a follow-up") described the pre-flip behavior. **Fixed:** summary gains a superseding entry (old line annotated), DESIGN updated in place (decision paragraph, non-goals, state-machine step 4, episodic-memory section).
- **LOW (Claude):** `.d.mts` untracked (not load-bearing — typecheck passes without it via `allowJs`, verified by the reviewer by removing it). **Fixed:** committed with the change.

## Verified clean

Claude verified: tri-state handled at every read site (budget split, propose-only return, degrade-vs-hard-fail); `isMain` guard proven in both directions by the passing subprocess pins (+ import tests); `defaultKnownFindings` has no self-reference bug (the current pass's stamp dir exists at scan time but has no ledger yet); imported symbol shapes match. Codex verified: `main()` still executes under `npm run` and direct `tsx` on Windows; `defaultKnownFindings` handles missing dirs. Noted, accepted: in `'auto'` mode a degraded pass's proposal comes from a half-budget run (harmless).

## Disposition

All findings fixed pre-commit. Gates: full suite 1849 passed / 2 skipped (clean run), plus 7/7 script pins post-budget-fix, typecheck/lint/build green. The budget fix itself landed after both reviews; it is pinned by unit tests and implements Codex's finding directly. Ship.
