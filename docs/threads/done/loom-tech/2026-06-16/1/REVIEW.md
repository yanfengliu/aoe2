# Loom technology (v0.1.40) — Review iteration 1

Change under review: implement Loom (grounded in the campaign-10 playtest finding — verified data-only in `technologies.csv`). Researchable at the Town Center (Dark Age, 50 gold, 250 ticks); on completion every owned villager (existing + future) gains +15 max HP (FLAT on current+max, 25→40) + +1 armor. Built design-first (Option B chosen — single armor scalar, +1/+1, the +2 pierce deferred). The `case 'loom'` villager loop was extracted into `loomEffect.ts` to hold the 500-LOC budget. Implemented by a fresh-context subagent; reviewed + gated by the main agent.

Reviewers: Codex (gpt-5.5, xhigh, BEGIN/END), Claude (opus[1m], --effort max), Gemini (gemini-3.1-pro, plan). All read the live codebase. Contamination audit: `git diff` (unstaged) empty — no reviewer wrote to the tree.

## Verdict: APPROVE / SHIP — no HIGH/MEDIUM. Converged at iter-1.

A pre-review gate caught one real issue (the Loom additions pushed `technologyOps`/`optionsRules`/`types` over the 500-LOC hard limit) — FIXED before the 3-CLI review by extracting `loomEffect.ts` (`applyLoomToOwnedVillagers`, behavior-identical) + compacting pre-existing comments (all three now ≤500; re-verified behavior-preserving via `blacksmithProgression` + the full suite). The 3-CLI review then ran on the fixed code: Claude APPROVE/SHIP (all 9 scrutiny points verified against live code, incl. armor at ALL THREE damage sites — unit/tower/wildlife), Gemini APPROVE ("ready to ship"), Codex 0 HIGH/MEDIUM. All three confirmed: flat-HP (not ratio, not `upgradeOwnedUnits`); the double-research guard fires before the case; the single `CombatState.armor` +1 feeds both `effectiveMeleeArmor` and `effectivePierceArmor`; new/existing/non-villager gating correct; no save schema bump; options drop-once-researched + validator agreement; the ageUp/economyResearchOptions test updates correct (not masking a regression); determinism; file sizes ≤500. Gates: typecheck/lint/build clean; full suite 1340 passed / 2 skipped.

Findings were all LOW (doc/test polish), all fixed this commit.

## Findings and disposition

| # | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | LOW | Codex | DESIGN.md still described Option A (split `CombatState.armor`) as the chosen/recommended design, contradicting the shipped Option B (single scalar +1/+1). Thread DESIGN.md is authoritative. | FIXED — added a prominent "SHIPPED: Option B" banner to the DESIGN headline (Option A retained as the recorded analysis + the path M2 Slice 2b will take, clearly marked not-shipped). |
| 2 | LOW | Codex + Claude | The save-round-trip test was named "re-derives the bonus for a villager TRAINED after a load" but re-checks the *restored* seeded villager — it doesn't train one post-load. The mechanism is sound + indirectly covered (test #13 "created with Loom researched starts at 40/40" exercises the seed-time `createCombatState`; the tech persists), so it's a labeling/coverage gap, not a bug. | FIXED — renamed to "round-trips loom in the researched set + the boosted villager stats across save/load" + honest comment pointing the post-load re-derive to test #13; the changelog claim softened to match. |
| 3 | LOW (nit) | Claude | Test #9 local var `const militia = findFirstOwnedUnit(bridge, 1, 'villager')` named `militia` but holds a villager. | FIXED — renamed to `villager`. |
| — | LOW (info) | Claude | `types.ts` + `optionsRules.ts` sit at exactly 500 (the cap) — the next one-line edit to either trips fileSizeBudget. | No action — already acknowledged in the devlog; flagged for the next contributor (they were trimmed to exactly 500 to make room for Loom). |

## Notes
- The fileSizeBudget failure was caught by the main agent's own commit-gate suite run (the implementing subagent died silently on its final call before reporting it); the fix routed back to the same subagent (warm context) which extracted `loomEffect.ts` + re-verified 1340/2. The loop's gate + the silent-death detection (mtimes) both earned their keep here.
- The fixes are doc + test-naming only (no behavior change), so no iter-2 re-review was warranted; typecheck + loomTech (17/17) re-confirmed after the renames.
