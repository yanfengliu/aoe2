# Wheelbarrow/Hand Cart villager speed halves — adversarial review, iteration 1 (2026-07-02)

**Reviewer:** in-process Workflow (AGENTS.md default), 2 dimension finders (correctness + the load-bearing test-safety claim; AoE2-conformance + tests + docs), each grounding claims in the live tree (32 and 26 tool calls). Model opus-4-8. Multi-CLI not warranted — derived tech, no persistence/security/concurrency surface.

**Verdict: ZERO findings.** Both finders returned empty after reading the actual files. Notably, the correctness finder was explicitly tasked to RIGOROUSLY verify the safety claim behind touching villager (economy) movement — it confirmed against `aiSystem.ts` that the AI's research loop iterates only military buildings (not the Town Center), so the AI never researches Wheelbarrow/Hand Cart and AI villagers stay at percent 100 (AI determinism byte-identical), and that no fixture/live-sim test researches these techs. The multiplication (100→110→121, integer-exact), the disjoint-class branch ordering (villager is neither mounted nor infantry), and the end-to-end executor path for a villager move command all checked out; the conformance finder confirmed the CSV movement clause (technologies.csv:89/90) and that the tests pin the exact stacked 121 (so an additive 120 mistake would fail the pure test).

This is the convergence bar on the first pass. The change is the third consumer of the well-reviewed movement-speed seam, and the only novel element — the same-class multiplication branch — is small and directly tested.

## Post-review state

All four gates green (typecheck, lint, build, full suite 1624/2, +5 tests). No production-code changes required by the review. Committed as v0.1.69.
