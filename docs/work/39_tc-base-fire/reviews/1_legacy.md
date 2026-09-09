# TC base-fire — Review iteration 2 (Claude + Gemini re-review, queued from iter-1)

Iter-1 shipped v0.1.29 with Codex SHIP (no findings) while Claude + Gemini were throttle-unreachable. This iteration re-ran both standalone (after a recovery gap) on the committed diff (`git diff HEAD~1 HEAD` of b1661bd).

## Reviewers — both SHIP-WITH-FIXES, converged on one real finding

- **Claude (`opus[1m]`, --effort max) — SHIP-WITH-FIXES.** Codebase-grounded (file:line). Confirmed the one-liner, the firing path, geometry preservation across all relocated fixtures, the AI-fixture mechanisms (ai-planner `humanTownCenterId` null via spawn-only `townCenterRefs`; disableAi honored), and doc accuracy. **Real finding:** three *unmoved* auto-aggression "enemy engaged" fixtures lose test isolation — `IdleMilitiaInVision` (spearman@15,8, footprint-dist 4), `VillagerAdjacent` (@13,8, dist 2), `SequentialTargets` (@13,8/14,8, dist 2/3) keep the home TC at (8,8) in range of the enemy, and each asserts only that enemy HP drops / enemies die, so the now-firing empty TC satisfies the assertion independently of the unit under test → a future auto-aggression regression would still pass. Plus nits: stale fixture comments (workshop/heal/mangonel coords) and the ai-planner lone-villager comment citing a browser test that actually boots ai-rush.
- **Gemini (`gemini-3.1-pro-preview`, plan mode) — SHIP-WITH-FIXES.** Codebase-grounded (file:line). Independently reached the same root finding, naming `VillagerAdjacent` (a subset of Claude's three) as a "Test Integrity Flaw" for the identical reason. Plus nit: mangonel comment drift ("validator-compliant y=13" now y=20). Confirmed one-liner, relocations, AI fixtures, and docs otherwise correct.
- (Iter-1 **Codex** was SHIP/no-findings — it verified geometry preservation but did not flag the test-isolation semantics; the two re-reviewers caught it. This is the value of multi-CLI.)

Contamination audit after Gemini: clean (only the intended fix files changed).

## Disposition — finding addressed (test-only)

- Moved the human TC out of range (y=28) in all **3** flagged fixtures (`IdleMilitiaInVision`, `VillagerAdjacent`, `SequentialTargets`) — the superset of Claude's + Gemini's findings — so each "enemy engaged" assertion again depends on the *unit* engaging (the unit auto-aggros off its own vision, unaffected). `OutOfVision` (x20, dist 9) and `ArcherPursuit` (x18, dist 7) were correctly already safe and left at (8,8).
- Fixed the stale comments (mangonel/workshop/heal coords now reflect the y=20/19/17 moves) and rewrote the ai-planner villager comment (the browser kill-test uses ai-rush, not ai-planner; the age-up/5-military assertions don't depend on the villager dying).
- `fileSizeBudget` caught the comment additions pushing `autoAggression.ts` to 518 LOC; rewrote it leaner (one file-level isolation note + concise per-fixture comments) → 494 LOC.

Gates: full suite **1255 passed**, typecheck/lint/build clean. autoAggression 10/10 in isolation (the units engage without TC help, proving isolation restored).

This is the convergence point — after the fix the reviewers' remaining items are nits, not bugs. **Disposition: SHIP (folds into v0.1.29; test-only, no version bump).**
