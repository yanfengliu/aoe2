# REVIEW — economy-gather-techs, iteration 2 (2026-06-14)

**Change under review:** the iter-1 HIGH fix — replace the round-the-cadence gather-rate model with per-tick **rate accumulation carrying the remainder** (`gatherProgressTicks += multiplier`; gather + `-= base` when `>= base`), modelled by the new pure `ticksToGatherCarry`; `effectiveGatherTicks` removed. Plus the converged iter-1 nitpicks.

**Reviewers:** Codex (gpt-5.5 xhigh) · Claude (opus[1m]) · Gemini (gemini-3.1-pro). Full diff via stdin; prompt focused on the fix's correctness, **determinism** (fractional `gatherProgressTicks` is serialized), and the approach-timer coupling.

## Verdicts — CONVERGENCE (3/3)

| Reviewer | Verdict |
|---|---|
| Codex | **Convergence** — "no substantive correctness, determinism, save/load, coupling, or throughput bug." 1 LOW: stale `effectiveGatherTicks` refs (src + PLAN). |
| Claude | **CONVERGENCE — "ship it."** All 6 points confirmed against live code; exhaustive determinism analysis holds end-to-end. 1 substantive nit (L1, test-design) + doc nits, none blocking. |
| Gemini | **Approved (convergence)** — fix verified, determinism + coupling safe. Nits: stale comments, lumber/mining consistency. |

The fix is confirmed correct: every tier now adds a real speedup (Two-Man ≈32 vs Bow Saw ≈35 ticks/carry on tree; Gold/Stone Shaft ≈46 vs base-mining ≈53 on gold/stone — both collapsed to identical integers under the old `round()`), the first tier no longer overshoots, and the no-tech path is byte-identical.

### Determinism (the load-bearing concern) — cleared by all three
- Per-component independent accumulators; identical op order on record vs replay (entity-id-ordered `query`).
- `gatherRateMultiplier` is a product over the researched-tech **Set**; insertion order is deterministic live **and preserved across save/load** (`mapOfSetCodec` serializes `Array.from`/rebuilds `new Set`), so the order-sensitive float product is bit-identical on every leg.
- Component serialization is a lossless JSON round-trip for finite doubles (`cloneJsonValue`); the accumulator is bounded (< base + maxMult < 8) so never non-finite; `deepEqualWithPath` compares with `Object.is` (exact) → replay self-check passes.
- No integer coercion of `gatherProgressTicks` anywhere (verified by grep + all three reviewers).

### Coupling (approach timer reuse) — cleared
`gatherProgressTicks` doubles as the to-resource approach timer, but is reset to 0 on every state entry (`:216` into to-resource, `:296` into gathering, `:458` on arrival); the carried remainder (< multiplier < 1.6) can never approach the 80-tick give-up threshold. No leak.

## Findings & disposition

| ID | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | LOW | Codex, Gemini | Stale `effectiveGatherTicks` comments in `villagerEconomySystem.ts` (3,59,238) + `types.ts` (125). | **Fixed** — repointed to `gatherRateMultiplierForKind` / `ticksToGatherCarry`. `grep effectiveGatherTicks src tests design` → 0 hits. |
| 2 | LOW | Gemini | Lumber Camp showed all age-eligible techs while Mining Camp gated Shaft on its base tech — inconsistent. | **Fixed** — dropped the Mining-Camp base-tech gate (age-gated independent stacking, consistent with Lumber Camp). The dataset (`technologies.csv`) encodes **no** inter-tech prerequisites; AoE2's actual linear chains are a deferred fidelity refinement (would need a prereq column in the dataset). Options test updated. |
| 3 | LOW (defer) | Claude (L1), Codex (iter-1) | `ticksToGatherCarry` is a parallel reimplementation of the loop's accumulation; tests exercise the helper, not the loop — a loop-only regression would still pass. Currently the two impls are verified-identical. | **Deferred (documented).** A shared accumulation primitive collides with the 500-LOC ceiling (`prototypeEconomyRules.ts` at 491); the bridge-fixture integration test is the standing follow-up. The next LLM-playtest re-run is the end-to-end validation. Non-blocking per both reviewers. |
| 4 | LOW | Codex | `PLAN.md` still describes the round-cadence model. | **Fixed** — added an iter-2 supersession note pointing to spec §6.5 + this REVIEW (the PLAN body remains a historical planning artifact). |
| — | nit | Claude | `types.ts` (492) and `prototypeEconomyRules.ts` (491) sit ~9 lines under the 500 ceiling. | Noted for future; both files split-by-role candidates when next touched. |

## Conclusion

Converged: all three reviewers ship-it, zero correctness/determinism bugs, iter-1 HIGH fixed, nitpicks addressed. Outstanding follow-up: bind the gather loop to `ticksToGatherCarry` (shared primitive or bridge integration test) and AoE2 linear prerequisite chains (dataset change) — both tracked, both non-blocking.
