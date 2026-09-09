# Bloodlines conformance fix — adversarial review, iteration 1 (2026-07-02)

**Reviewer:** in-process Workflow (AGENTS.md default; multi-CLI reserved for high-risk changes): 3 dimension finders (correctness/blast-radius, AoE2/data conformance, tests/docs) + 1 refuting verifier per finding, all grounding claims in the live uncommitted tree. 9 agents, ~0.64M tokens.

**Verdict: ZERO code defects. 6 confirmed findings — 4 are the same stale-comment item found by multiple finders, plus one test-header staleness and one test-hardening gap; 0 refuted.** The correctness finder specifically cleared: the restructured Feudal/Castle option branch semantics, the AI-researches-earlier determinism question (per-seed deterministic; full suite + AI corpus green), no other site using cavalry semantics for bloodlines, and NO retro-application on save-load (the imperative pass runs only at research completion — the changelog's save-behavior sentence is accurate).

## Confirmed findings and dispositions (all fixed same-iteration)

1. **[LOW ×3 finders] technologyOps.ts:456 — the `case 'bloodlines':` dispatch comment still said "every owned cavalry unit".** The one comment in src/ the sweep missed (every other scope comment was updated). **Fixed:** comment now says MOUNTED (cavalry + cavalry archers, csv:78). The `applyBloodlinesToOwnedCavalry` NAME is deliberately kept (spec §11.9 quotes it; renaming is cosmetic churn).
2. **[MEDIUM→LOW per verifier] bloodlines.test.ts:15-21 — the test file's contract header still stated the pre-fix contract** (CAVALRY scope, Castle gate), contradicting the tests beneath it; the `derived +20 cavalry HP` describe title likewise. **Fixed:** header rewritten (mounted, Feudal, csv:78, shared-predicate note); describe retitled "derived +20 mounted HP".
3. **[LOW] No negative test pinned `light-cavalry-upgrade` out of the Feudal stable** after the branch restructure — the verifier confirmed a surgical hoist of it into the Feudal block would ship with zero failing tests (husbandry's Castle gate IS negatively pinned; this tech wasn't). **Fixed:** the Feudal-stable gate test now also asserts `not.toContain('light-cavalry-upgrade')`.

## Post-fix state

bloodlines.test.ts 9/9 green; typecheck + lint green. The full four-gate run (typecheck, lint, build, full suite **1608 passed / 2 skipped**, incl. the AI corpus with the AI now able to research Bloodlines in Feudal) ran on this change BEFORE the fix round; the fix round's delta is one comment line + test text + one added negative assertion — semantically identical production code — so the full-suite gate stands as run. Zero code defects across both this and the parent husbandry review; convergence criterion met (reviewers surfacing only comment/test-hardening items).
