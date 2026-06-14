# REVIEW — economy-gather-techs, iteration 1 (2026-06-14)

**Change:** wire the 7 AoE2 economy gather-rate techs (Lumber Camp wood + Mining Camp gold/stone "Work Rate ×N") so researching them speeds villager gathering. Multiplier derived from the owner's researched-tech set; first implementation divided the gather cadence and rounded to integer ticks.

**Reviewers:** Codex (gpt-5.5 xhigh) · Claude (opus[1m]) · Gemini (gemini-3.1-pro). Diff via stdin; all prompted to verify against the codebase + `design/stats/technologies.csv`.

## Verdicts

| Reviewer | Verdict |
|---|---|
| Codex | **1 HIGH** (rounding collapses 3 techs) + coverage inadequate; everything else verified correct. |
| Claude | **APPROVE**, no correctness defect; same rounding flagged as a fidelity caveat + recommends a follow-up integration test. Verified all 8 checklist items + the integration chain by reading. |
| Gemini | **No issues**; flagged the rounding coarseness as a known fidelity characteristic. |

## Findings & disposition

| ID | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | **HIGH** | Codex (Gemini/Claude concur) | At the tiny integer base cadences (`tree:5`, `gold/stone:6`), `round(base/multiplier)` made **Two-Man Saw, Gold Shaft Mining, Stone Shaft Mining behaviorally inert** (round(5/1.44)=round(5/1.584)=3; round(6/1.15)=round(6/1.3225)=5) — techs that cost resources for zero gain — and overshot the nominal % on the first tier. Doc drift: spec/changelog claimed all factors raise throughput. | **Fixed in iter-2.** Replaced cadence-rounding with per-tick **rate accumulation carrying the remainder** (`gatherProgressTicks += multiplier`; complete + `-= base` when `>= base`). Over the ~10 cycles per carry the fractional rate differences accumulate, so every tier adds a real speedup and the realized factor tracks the multiplier. New `ticksToGatherCarry` pure helper + unit tests assert **every tier strictly reduces ticks-to-fill-carry** (the no-op-tier regression guard). Spec §6.5 updated to the accumulation model. |
| 2 | LOW (coverage) | Codex + Claude | No end-to-end test that a researched tech speeds *live* gathering; only the multiplier math + option surfacing + validator map were covered. | Partially addressed: the iter-2 `ticksToGatherCarry` monotonic test catches the no-op tiers (Codex's stated minimum bar), and the gather loop mirrors that helper tick-for-tick. A cheap bridge/replay integration test (seed `startingResearchedTechnologies`, advance N ticks, assert faster gather) is the **immediate follow-up**; the next LLM-playtest re-run is the end-to-end validation. |

## Verified correct (Codex + Claude, against live code)

- Derivation: `applyTechnology`'s idempotency guard records every researched tech in `researchedTechnologiesCodec`; the 7 econ techs need no switch case and no new persisted state; the system reads the owner's set; no double-application (product over a Set).
- AI untouched: the AI research loop iterates a hardcoded building list excluding lumber-camp/mining-camp (age-up is the separate `pickNextAgeResearch` path); new `getResearchOptions` branches are building-guarded → AI returns byte-identical.
- Both maps wired: `RESEARCHES_BY_BUILDING` (validator via `canResearchAt`) + `getResearchOptions` (surfacing) agree; shaft upgrades gated on base tech + Castle; each offered once, drops out once researched.
- Data fidelity: costs/research-times match `technologies.csv` (research seconds × 10 TPS); factors ×1.2/1.2/1.1 (wood), ×1.15 (gold/stone) correct, stack multiplicatively.
- Persistence (reuses the already-serialized `mapOfSetCodec`) + determinism (commutative product); no-tech path is byte-identical.

## Minor / forward-looking (Claude; no action this iteration)

- `GATHER_RATE_TECH_FACTORS` is `Partial` — a future gather tech forgotten here would be silently ineffective; add an exhaustiveness assertion when the table grows.
- Balance asymmetry: only the human/agent benefits (AI excluded by design); track when AI econ tuning is revisited.
- Micro-perf: per-villager-per-tick tech-set iteration is negligible at current scale.
