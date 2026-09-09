# Economy carry-capacity techs — Wheelbarrow + Hand Cart (stat-multiplier v2)

**Loop iteration 2:** continues closing campaign-5 finding #2 (HIGH "tech-tree": no economic upgrade ever researched — names Loom, **Wheelbarrow**, Double-Bit Axe, Horse Collar). Iteration 1 did the gather-rate techs (wood/gold/stone); this adds the **carry-capacity** techs, which speed gathering of **all** resources including food — directly relieving the validated Castle-Age food bottleneck.

**Goal:** researching Wheelbarrow / Hand Cart raises villager carry capacity, derived (pure) from the owner's researched-tech set, applied where `carryCapacity` is read — same architecture as iter-1, no new persisted state.

> **Impl note (supersedes the "prototypeEconomyRules.ts" placement below):** the carry helpers (`carryCapacityMultiplier` / `effectiveCarryCapacity`) AND the moved iter-1 gather-rate helpers landed in a NEW `src/game/simulation/economyTechEffects.ts`, not `prototypeEconomyRules.ts` — the latter was at the 500-LOC budget, so the cohesive tech-effect logic was extracted into its own module. Authoritative current design: spec §6.5 + `2026-06-14/1/REVIEW.md`.

**Scope:** `wheelbarrow` (Feudal, Town Center, ×1.25 carry), `hand-cart` (Castle, Town Center, ×1.5 carry). Effects stack multiplicatively (×1.875 with both). **Deferred:** the movement-speed ×1.1 component of both techs (separate unit-movement system; documented) and Loom (villager HP/armor — a combat-stat tech, not economy).

## Design (reuses iter-1)

- `carryCapacityMultiplier(techs)` — product of the carry factors for researched carry techs (1.0 if none); `effectiveCarryCapacity(techs, baseCarry) = round(baseCarry × multiplier)`. Mirrors `gatherRateMultiplier` / `gatherRateMultiplierForKind`.
- Apply at the two `carryCapacity` read sites in `villagerEconomySystem` (gather clamp `:392`, full-carry check `:406`), reading the owner's researched set already fetched once per `execute()` (iter-1). `entityCreateOps:191` keeps the stored base `carryCapacity: 10`.
- Surface + gate at the Town Center: restructure `getResearchOptions` TC block to collect age-up **and** the carry techs (age-gated, drop-once-researched); mirror in `getVisibleResearchOptions` (the agent reads it via `buildingOptionsOps`). Add `wheelbarrow`/`hand-cart` to `RESEARCHES_BY_BUILDING['town-center']` (validator).
- Costs/times from `technologies.csv` (Wheelbarrow 175F/50W, t75→750 ticks; Hand Cart 305F/200W, t55→550 ticks). Compiler-forced via the `Record<ResearchableTechnologyType,…>` maps + `formatTechnologyName`.
- AI untouched (still researches only age-up).

## Files

- `types.ts` — add `wheelbarrow`, `hand-cart` to `ResearchableTechnologyType`.
- `prototypeEconomyRules.ts` — RESEARCH_COSTS (+2), RESEARCH_TIME_TICKS (+2), `CARRY_CAPACITY_TECH_FACTORS` + `carryCapacityMultiplier` + `effectiveCarryCapacity`.
- `bridge/systems/villagerEconomySystem.ts` — apply `effectiveCarryCapacity(ownerTechs, gatherer.carryCapacity)` at `:392` + `:406`.
- `bridge/optionsRules.ts` — TC `getResearchOptions` + `getVisibleResearchOptions` restructure.
- `prototypeBuildingRules.ts` — `RESEARCHES_BY_BUILDING['town-center']` += carry techs.
- `ui/hud/displayNames/formatters.ts` — display names.
- `design/spec-final.md` §6.5 — move carry techs from "not yet implemented" to implemented (carry effect; movement-speed noted deferred).

## Tasks (TDD)

1. types + compiler-forced cost/time/display data; typecheck green.
2. `carryCapacityMultiplier` / `effectiveCarryCapacity` test (none→1.0/base; wheelbarrow→×1.25; +hand-cart→×1.875; round) → implement.
3. Gather-loop integration: extend `ticksToGatherCarry`-style reasoning — a villager with Wheelbarrow fills a *larger* carry, fewer trips; assert effective carry rises. (Reuse `ticksToGatherCarry(techs, kind, effectiveCarryCapacity(...))` in a test.) Implement the two read-site changes.
4. Options test: TC offers age-up + wheelbarrow (Feudal) + hand-cart (Castle); drop once researched; both `getResearchOptions` + `getVisibleResearchOptions`.
5. spec §6.5; gates (typecheck/lint/build/affected, then full suite); 3-CLI review to convergence; changelog + bump (0.1.26→0.1.27); commit + push; thread→done.

## Verification / done

Researching a carry tech raises effective carry (test) + is offered at the TC by age (test); all resources benefit (carry is resource-agnostic); save/load via the existing researched-tech codec; AI age-up tests unchanged; gates green; reviewed; committed; pushed. End-to-end (agent uses it) folds into the consolidated validation playtest.
