# Review iteration 2 — construction HP ramp + iter-1 fixes

Diff: `agent/construction-hp-ramp` (commit `e2f2ee7`) vs `main`. Reviewers: Codex (`gpt-5.4` xhigh), Gemini (`gemini-3.1-pro-preview` plan), Claude (`opus` xhigh). Raw outputs in `raw/{codex,gemini,opus}.md`.

## Convergence

All 3 reviewers verified iter-1 fixes landed correctly:
- **Completion damage preservation** — `min(maxHp, round(currentHp))` clamp absorbs only float drift, not damage. Verified clean by all 3.
- **Auto-aggression foundation pursuit** — `findPreferredEnemyBuildingInRadius` skip removed; no test breakage. Verified clean by all 3.
- **HUD floor display** — `Math.floor` is safe (the surrounding `if (selectionState.health)` guards null). Verified clean by all 3.
- **Save/load mid-construction test** — exercises real persistence contract via `hydrateFromSavedGame.ts:254-255` direct restore (not `addBuildingEntity`). Verified clean by all 3.

Anti-regression sweep (Claude, comprehensive): AI uses `findPreferredVisibleEnemyBuilding` not the radius variant, never had the skip in the first place — no AI regression. Villagers short-circuit out of building-target branch in `autoAggressionSystem.ts:115-117`. Multi-builder math is safe — same `buildingHealthStates` reference shared, completion early-exit at `playerCommandsSystem.ts:374` prevents double-finish.

## New findings (both doc-level)

- **Codex [MEDIUM]** — `docs/changelog.md:9` example overstated damage preservation. Said "chipped to 5/75 at 95% built finishes at the damaged value." Wrong: per-tick adds continue, so a foundation chipped to 5 with 6 ticks left would finish at ~5 + 6×0.567 ≈ 8.4 → 8, not 5. The fix preserves damage as an offset (no completion-tick heal), not as a freeze. Fix: rewrote the example with accurate math showing ~9/75 finish and clarifying "preserved as an offset rather than healed at completion."
- **Claude [LOW-MEDIUM]** — stale JSDoc at `targetFindingOps.ts:92-96` still claimed `findPreferredEnemyBuildingInRadius` filters out construction-incomplete buildings. The function body had the skip removed in iter-1 but the interface comment was untouched. AGENTS.md mandates docs in the diff match implementation. Fix: rewrote the JSDoc to reflect the new "foundations ARE valid targets" contract.

## Deferred

- **Claude residual coverage gap (low priority)** — no test in `tests/simulation/autoAggression.test.ts` asserts an idle military unit auto-engages an enemy foundation. Would require a new fixture (idle-military-near-enemy-foundation). Not adding this round; the iter-1 fix is correct-by-construction (drop one-line filter), and the existing auto-aggression suite covers the surrounding contracts. Worth adding next time the auto-aggression fixture file is touched.
- **Gemini magic-number 0.1 nit** — same as iter-1 nit-pile. Not addressed.

## Verdict

Reviewers nitpicking on doc precision rather than catching code bugs. Iter-2 converges. Both findings (Codex F1 + Claude F1) addressed in `targetFindingOps.ts` JSDoc + `changelog.md` example rewrite. Branch ready for merge after this commit.
