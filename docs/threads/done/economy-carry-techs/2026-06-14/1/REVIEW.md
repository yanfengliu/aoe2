# REVIEW — economy-carry-techs, iteration 1 (2026-06-14)

**Change:** add the AoE2 carry-capacity techs (Wheelbarrow Feudal ×1.25, Hand Cart Castle ×1.5; Town Center; stack to ×1.875) — closing more of campaign-5 finding #2 (tech-tree). Carry is resource-agnostic → helps food (Castle-Age bottleneck). Plus a refactor: the economy-tech-effect logic (iter-1 gather-rate fns + new carry fns) extracted into `src/game/simulation/economyTechEffects.ts` (prototypeEconomyRules.ts was at the 500-LOC budget). Movement-speed component deferred.

**Reviewers:** Codex (gpt-5.5 xhigh) · Claude (opus[1m]) · Gemini (gemini-3.1-pro). Diff via stdin; verify against codebase + technologies.csv.

## Verdicts — CONVERGENCE (3/3, no runtime defects)

| Reviewer | Verdict |
|---|---|
| Codex | No runtime correctness defects. 2 LOW (PLAN stale; no explicit validator test). |
| Claude | **Correct and complete, no bugs.** 8/8 points verified against live code. 1 non-blocking coverage note. |
| Gemini | **Verified and ready.** 8/8 confirmed. |

All three independently confirmed: extraction is behavior-preserving (moved fns byte-identical, importers repointed, no circular import, no dead code); carry correctness (`effectiveCarryCapacity = round(base × mult)`, ≥ base; both gather read-sites use one shared local — cannot desync); no-tech identity (round(10×1)=10, byte-identical); TC options offer age-up **and** carry techs (age-up not regressed; validator gates carry techs to the TC only); AI unaffected (researches only age-up; its non-age loop excludes the TC); CSV data fidelity; determinism (commutative product over the persisted researched-tech Set, integer round); LOC restored (prototypeEconomyRules 417, economyTechEffects 125).

## Findings & disposition

| ID | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | **MED (gate, not reviewer)** | full suite | `createSimulationBridge.ageUp.test.ts` (4 cases) asserted exact TC option lists; the TC restructure correctly adds Wheelbarrow/Hand Cart (Feudal/Castle, no building prereq) alongside age-up, so the expected lists were stale. | **Fixed** — updated the 4 assertions to include the carry techs (the tests' age-up-gating intent is preserved). Verified by re-running the age-up test (6/6 green). Reviewers didn't catch it (the test file wasn't in the reviewed diff) — the full suite did, before commit. |
| 2 | LOW | Codex | PLAN.md said the carry helpers live in `prototypeEconomyRules.ts`; they were extracted to `economyTechEffects.ts`. | **Fixed** — added an impl note to PLAN.md. |
| 3 | LOW | Codex | No explicit validator (`canResearchAt`) test for the carry techs; a `RESEARCHES_BY_BUILDING` regression wouldn't be caught. | **Fixed** — added a `canResearchAt` test in `economyResearchOptions.test.ts` covering all econ techs (right building accepts, wrong building rejects). |
| 4 | LOW (defer) | Claude | The gather-loop carry *application* (the two read-sites) is verified by inspection only — no executable test runs the system with a carry tech and asserts `carriedAmount` reaches the larger cap. | **Deferred (documented).** Same e2e gap as iter-1's L1; the wiring is one shared variable (reviewers confirmed it can't desync). Folds into the consolidated validation playtest + the standing bridge-fixture follow-up. Non-blocking. |

## Conclusion

Converged 3/3 with no runtime defects; the gate-caught age-up test staleness fixed and re-verified; Codex's LOW nits closed; Claude's coverage note deferred consistently. Outstanding follow-ups (carried from iter-1): a bridge/replay integration test binding the gather loop to the tech effects, and the consolidated validation playtest (validates gather-rate + carry end-to-end).
