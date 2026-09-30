# Economy gather-rate techs — the stat-multiplier subsystem (v1: gather rate)

**Loop iteration:** playtest (campaign-5 findings, HIGH "technology-tree": only age-up research ever issued; ~12 economy techs are data-only) → roadmap enabler #1 (stat-multiplier subsystem) → fix.

**Goal:** Wire the AoE2 economy gather-rate techs so researching them actually speeds villager gathering. Build the minimal stat-multiplier layer as a *pure, derived* function of an owner's already-persisted researched-tech set — no new persisted state.

> **Iter-2 update — supersedes the round-cadence design below.** Review (Codex HIGH) found that `round(base / multiplier)` at AoE2's tiny base cadences (tree 5, gold/stone 6) collapsed the second-tier techs (Two-Man Saw, Shaft Mining) to no effect. The shipped model is per-tick **rate accumulation carrying the remainder** (`gatherProgressTicks += multiplier`; gather + `-= base` when `>= base`), modelled by the pure `ticksToGatherCarry`; the `effectiveGatherTicks` helper described below was removed. The Mining-Camp shaft base-tech prerequisite mentioned below was also dropped — the dataset encodes no inter-tech prerequisites (AoE2's linear chains are a deferred refinement). Authoritative current design: spec §6.5 + `2026-06-14/2/REVIEW.md`.

**Scope (this iteration):** the 7 pure "Work Rate ×N" gather techs:
- Lumber Camp (wood): `double-bit-axe` (Feudal ×1.2), `bow-saw` (Castle ×1.2), `two-man-saw` (Imperial ×1.1)
- Mining Camp (gold): `gold-mining` (Feudal ×1.15), `gold-shaft-mining` (Castle ×1.15)
- Mining Camp (stone): `stone-mining` (Feudal ×1.15), `stone-shaft-mining` (Castle ×1.15)

**Deferred (need other mechanics, later iterations):** Horse Collar/Heavy Plow (farm food — farms don't exist), Wheelbarrow/Hand Cart (carry + movement — per-entity carry mutation), Loom (villager HP/armor).

## Design (verified against the code)

- **Multiplier is derived, not stored.** `applyTechnology`'s idempotency guard already adds every researched tech to the persisted `researchedTechnologiesCodec` (per-owner `Set<ResearchableTechnologyType>`). So a pure `gatherRateMultiplier(researchedTechs, kind)` = product of factors for matching techs is the single source of truth. **No new codec, no save/load migration, no stacking/idempotency bug, no `applyTechnology` switch case** (the techs have no side-effect beyond being recorded).
- **Lever = cadence, not chunk size.** Multiplying `gatherAmountFor` is broken: carry capacity (10) binds, so `ceil(10/amount)` barely changes for small multipliers. The faithful lever is `gatherTicksFor(kind)` (ticks per gather cycle): `effectiveGatherTicks = max(1, round(gatherTicksFor(kind) / multiplier))` → fills carry ~N% faster → ~N% throughput. Integration point: `villagerEconomySystem.ts:362-364` (the `gatherProgressTicks >= gatherTicksFor(...)` threshold), which already has the gatherer `id` (→ owner) and `accessor` (→ researched set).
- **No AI change / no AI risk.** The AI only researches age-up techs (`aiSystem.ts:562 pickNextAgeResearch`); it never pushes non-age-up research. Adding econ options to `getResearchOptions` is invisible to the AI (confirmed) — serves the LLM agent + human. The age-up tests stay green.
- **Compiler-enforced completeness.** `RESEARCH_COSTS` and `RESEARCH_TIME_TICKS` are `Record<ResearchableTechnologyType, …>`, so adding the 7 ids forces their cost/time entries — TS catches omissions.

## Files

- `src/game/simulation/types.ts` — add 7 ids to `ResearchableTechnologyType`.
- `src/game/simulation/prototypeEconomyRules.ts` — `RESEARCH_COSTS` (+7, from CSV), `RESEARCH_TIME_TICKS` (+7, from CSV), new `GATHER_RATE_TECH_FACTORS` table + `gatherRateMultiplier(techs, kind)` + `effectiveGatherTicks(techs, kind)`.
- `src/game/simulation/bridge/optionsRules.ts` — `lumber-camp` + `mining-camp` research blocks in `getResearchOptions` (age-gated, `hasTechnology` dedup), mirroring the blacksmith pattern.
- `src/game/simulation/prototypeBuildingRules.ts` — extend the building→techs map (line ~245) with lumber-camp/mining-camp entries (verify its role first; it may gate research-at-building).
- `src/game/simulation/bridge/systems/villagerEconomySystem.ts` — apply `effectiveGatherTicks(researchedTechsForOwner, kind)` at the gather threshold; read `researchedTechnologiesCodec` once per `execute()`.
- `design/spec-final.md` — document the gather-rate tech rules (spec-persistence mandate).

## Tasks (TDD)

1. **types**: add the 7 ids. Run `npm run typecheck` → expect RED in `prototypeEconomyRules.ts` (missing Record entries) — that's the compiler enforcing the data.
2. **data**: add `RESEARCH_COSTS` + `RESEARCH_TIME_TICKS` entries (CSV values: double-bit-axe 50W/100F t25→ticks; bow-saw 100W/150F; two-man-saw 200W/300F; gold-mining 100F/75W; stone-mining 100F/75W; gold-shaft 200F/150W; stone-shaft 200F/150W — research-time ticks scaled like existing econ techs). typecheck green.
3. **helper (test-first)**: write `prototypeEconomyRules.test.ts` for `gatherRateMultiplier`/`effectiveGatherTicks` — no techs → 1.0 / base ticks; double-bit-axe → ×1.2 wood; bow-saw stacks → ×1.44; gold-mining → ×1.15 gold; wood techs don't affect gold; round/`max(1,…)`. Implement to green.
4. **gather integration (test-first)**: in a villager-economy fixture, a woodcutter with `double-bit-axe` in the owner's researched set fills its carry in fewer ticks than baseline; gold-mining speeds a gold miner; food unaffected. Implement the threshold change to green.
5. **research options (test-first)**: `optionsRules` — lumber-camp offers double-bit-axe (Feudal), +bow-saw (Castle), +two-man-saw (Imperial); mining-camp offers gold/stone-mining (Feudal) +shaft (Castle); each disappears once `hasTechnology`. Implement to green.
6. **spec**: add the gather-rate tech section to `design/spec-final.md`.
7. **gates**: typecheck, lint, build, affected tests, then full suite.
8. **review**: 3-CLI on the diff; synthesize REVIEW.md; address; re-review to convergence.
9. **docs + commit**: devlog detailed + summary; changelog + version bump (user-visible: new researchable techs with gameplay effect → bump `c`); spec already updated; commit + push; move thread to done.

## Verification / definition of done

- A researched gather tech measurably speeds the matching gather (test) and is offered at the right building/age (test). Unrelated kinds unaffected. Save/load preserves it (reuses `researchedTechnologiesCodec`). AI age-up tests unchanged. All gates green; reviewed; committed; pushed. Playtest re-run to confirm the agent uses them = next loop iteration's opener.
