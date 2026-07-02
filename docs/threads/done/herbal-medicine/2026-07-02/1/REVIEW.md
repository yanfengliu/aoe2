# Herbal Medicine (4× garrison heal) — adversarial review, iteration 1 (2026-07-02)

**Reviewer:** in-process Workflow (AGENTS.md default), 2 dimension finders (system-correctness of the garrisonHealSystem change; AoE2-conformance + tests + docs + seam wiring), each grounding claims in the live tree (34 and 40 tool calls). Model opus-4-8. Multi-CLI not warranted — a derived tech + one contained system edit, no persistence/security/concurrency surface.

**Verdict: ZERO findings.** Both finders returned empty after reading the actual files. The system-correctness finder specifically checked the load-bearing bits: the base path is byte-identical (rate = 0.4 × 1 = 0.4, unchanged guards/markDirty), the per-owner `rateByOwner` cache can't leak a wrong rate across owners, the `owner === undefined` fallback and `researchedTechnologies.get(owner) ?? NO_RESEARCHED_TECHS` are safe, the multiplied 1.6 rate still respects the cap/dead/full guards, and determinism holds (no random/time). The conformance finder confirmed the CSV values (350 gold / 35 s → 350 ticks / 4× / Castle / Monastery), consistent seam wiring, the full fixture-registration chain, the ≤500-LOC cap (499), and that the live 4×-gain test truly discriminates 4× from 1×/2× over a shared pre-cap window.

Convergence on the first pass. This extends the well-reviewed v0.1.63 garrison-heal system with a small derived multiplier, following the established monasteryTechEffects pattern.

## Post-review state

All four gates green (typecheck, lint, build, full suite — exit 0; garrison-heal suite 7/7 including the 3 new Herbal Medicine tests). No production-code changes required by the review. Committed as v0.1.70.
