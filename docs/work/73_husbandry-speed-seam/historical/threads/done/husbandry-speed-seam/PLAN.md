# Husbandry + movement-speed seam — PLAN (as-built)

> Executed inline by the main agent (sequential focused work). TDD per task; four gates before commit. Version bump 0.1.66 (non-breaking user-visible feature).
>
> **Mid-task revision:** the plan originally specified a stateless tick-derived surge schedule ("no save-format change" was a global constraint). The RED→GREEN cycle DISPROVED that design — the per-cell waypoint clamp absorbed the entire +10% (40 = 40 ticks measured; see DESIGN.md "First attempt (disproven)") — so Tasks 1/3 were revised to the shipped per-unit carry accumulator, and the save-format constraint was relaxed to "additive optional field only, no schema bump". This file reflects what shipped; the discovery narrative lives in DESIGN.md and docs/learning/lessons.md.

**Goal:** Husbandry researchable at a Castle-Age Stable (250f, 500 ticks) making every mounted unit (cavalry + cavalry archers) move +10% faster via a per-unit carry accumulator inside `moveUnitOneSubgridStep`.

**Global constraints:** save-format changes limited to ADDITIVE optional fields (no schema bump); no civ-engine change; `prototypeEconomyRules.ts` stays ≤ 500 LOC (condensed comments to compensate — landed at 499); baseline (speed percent 100) movement byte-identical and the carry field never materialized there; sheep's explicit `stepUnits = 1` untouched; docs per AGENTS.md discipline.

### Task 1: pure movement-tech module (TDD) ✅

**Files:** created `src/game/simulation/movementTechEffects.ts` (sappersTechEffects' sibling — NOT under bridge/); created `tests/simulation/movementTechEffects.test.ts`; modified `src/game/simulation/prototypeUnitRules/statTables.ts` (MOUNTED_UNITS = CAVALRY_UNITS ∪ {cavalry-archer, heavy-cavalry-archer}) + `src/game/simulation/prototypeUnitRules.ts` (isMountedUnit).

Shipped surface: `HUSBANDRY_SPEED_PERCENT = 110`; `MOVE_CARRY_CAP_HUNDREDTHS = 300`; `movementSpeedPercent(researched, unitType)` → 110 iff husbandry ∧ mounted; `movementEntitlement(carryHundredths, baseStepUnits, speedPercent)` → `{ grantedSteps: floor((carry + base×pct)/100), entitledHundredths }`; `settleMovementCarry(entitledHundredths, movedSteps)` → `clamp(entitled − moved×100, 0, cap)`. Tests: scope table (10 mounted → 110, 9 non-mounted → 100, no-tech/unrelated-tech → 100), pct-100 identity (grant = base, carry stays 0), the unobstructed 2,2,2,2,3 grant pattern (Σ = 22/10 ticks), clamped-shortfall banking, cap/non-negative bounds, and the waypoint-walk simulation reproducing the executor's per-leg clamp semantics (80 fine units: 40 ticks at 100%, 36-38 at 110%) — the regression pin for the quantization trap.

### Task 2: tech-seam wiring for `husbandry` (TDD) ✅

**Files:** `technologyTypes.ts` ('husbandry' union entry), `prototypeEconomyRules.ts` (cost `{ food: 250 }`, time `500` — CSV 50 s × 10 TPS; two standalone comments condensed to trailing comments to hold the cap), `prototypeBuildingRules.ts` (stable RESEARCHES row), `bridge/optionsRules.ts` (stable Castle-age offer beside bloodlines, drops once researched), `src/ui/hud/displayNames/formatters.ts` ('Husbandry' label — exhaustive switch, typecheck-forced); `tests/simulation/husbandry.test.ts` part 1 (cost/time values, canResearchAt stable-only, offered-and-drops on `imperial-stable-fixture`, not offered at a Feudal stable). `applyTechnology` needs NO case (purely DERIVED — sappers pattern).

### Task 3: speed-aware step executor + live movement races (TDD) ✅

**Files:** `bridge/transformOps.ts` (`moveUnitOneSubgridStep`: explicit `stepUnits` bypasses the model; otherwise derive percent from the unit component + `researchedTechnologiesCodec` via the accessor; percent ≠ 100 → entitle before the step and settle on the ACTUAL pre/post fine-unit deltas after `clampUnitTransformToMap`); `types.ts` (`UnitTransformComponent.moveCarryHundredths?: number` — additive, `?? 0`, pierceArmorBonus precedent); new `fixtures/husbandry.ts` (hermetic twins: knight (10,13) + militia (10,16) on open grass lanes, Castle-age stable + 1000 food, both AIs disabled, `startingResearchedTechnologies: ['husbandry']` on the researched twin) registered in `fixtures/index.ts` + `prototypeScenario/dispatch.ts`.

Tests (RED measured 40 = 40 before the executor wiring): the 20-cell knight race (researched arrives ≥2 ticks earlier), militia arrival identical across twins, a knight commanded AFTER a live 500-tick research cycle outraces an unresearched control, the carry-field hygiene guard (un-teched world never materializes `moveCarryHundredths`; on the researched twin the boosted knight banks it while the moving militia stays clean — added from review finding), and a genuine MID-WALK test (research queued at t0, walk commanded at t460 over 30 cells, completion lands ~2/3 in; arrival strictly earlier than the control — added from review finding).

### Task 4: docs + adversarial review + ship ✅

Spec §12.5 (implemented mechanism + rules) + §11.9 (Husbandry entry beside Bloodlines) + §6.5 stale-framing refresh; `docs/changelog.md` 0.1.66 + `package.json` bump; devlog summary + detailed entry; `design/roadmap.md` M1 (seam shipped; Squires/Wheelbarrow-speed/base-speeds unblocked; scout-wander gap noted); `docs/learning/lessons.md` waypoint-quantization lesson. ARCHITECTURE.md intentionally NOT touched (a pure helper + one executor branch + one optional field — no new subsystem/boundary per its own update rules). Adversarial review: in-process Workflow (5 dimension finders + 1 refuting verifier per finding, live-code-grounded) — REVIEW.md in this thread. Commit + push; thread → done/.

### Follow-ups queued (separate increments)

- **Bloodlines conformance** per `technologies.csv:78`: Feudal-age gate (shipped: Castle) + mounted-unit scope (shipped: cavalry-only) — verify against the AoE2 wiki first, then TDD + bump.
- **Speed-seam consumers:** Squires (Barracks, infantry ×1.1), Wheelbarrow/Hand Cart villager speed halves (×1.1 each, stacking percents), per-unit-TYPE base speeds from units.csv `movement_rate` (own fixture-churning iteration), and the AI scout-WANDER path bypass (fold into the base-speed slice).
