# PLAN — Farm-upgrade Mill techs, v0.1.46

Implementation order (TDD: tests first, then make them pass).

## 1. Tests first

- `tests/simulation/farmUpgradeTechs.test.ts`:
  - PURE: `farmFoodCapacity` — base 175, +75/+125/+175 stacking to 550, unrelated techs no-op.
  - OPTIONS (pure `createOptionsRules`, mirroring `loomTech.test.ts`/`economyResearchOptions`): Horse Collar at Mill in Feudal not Dark; Heavy Plow needs Horse Collar + Castle; Crop Rotation needs Heavy Plow + Imperial; drop-once-researched; `getVisibleResearchOptions`.
  - VALIDATOR↔OPTIONS: `canResearchAt('mill', tech)` true; other buildings false.
  - COST/TIME tables.
  - GROUND-TRUTH BRIDGE (`farm-upgrade-techs-fixture`): farm built by HC owner = 250; all three = 550; reseed to upgraded cap; no-tech owner stays 175; save round-trip.

## 2. Implementation (make the change easy, then the easy change)

1. `types.ts`: extend `ResearchableTechnologyType` union (forces compile errors in the two research tables → completeness).
2. `economyTechEffects.ts`: `FARM_FOOD_TECH_BONUSES` + `farmFoodCapacity(researched)` (imports `FARM_FOOD_AMOUNT` from `entityCreateOps`, as `farmReseed` already does).
3. `prototypeEconomyRules.ts`: add the three to `RESEARCH_COSTS` + `RESEARCH_TIME_TICKS`.
4. `prototypeBuildingRules.ts`: add the `'mill'` `RESEARCHES_BY_BUILDING` row.
5. `optionsRules.ts`: `mill` branch in `getResearchOptions` + `getVisibleResearchOptions`.
6. `entityCreateOps.ts`: farm CREATE → `farmFoodCapacity(accessor.get(researchedTechnologiesCodec).get(owner) ?? EMPTY)`.
7. `farmReseed.ts`: farm RESEED → `farmFoodCapacity(owner set)` (still `Math.max` with existing maxAmount).
8. Fixture: `createFarmUpgradeTechsFixture` in `fixtures/farms.ts`, export in `fixtures/index.ts`, register in `dispatch.ts`.

## 3. Docs (no hard-wrap)

- `package.json` 0.1.45 → 0.1.46.
- `design/spec-final.md`: §6.5 (move the three from "unimplemented" to an implemented farm-food-tech table) + §6.6 (farm-upgrade techs implemented; capacities 250/375/550; reseed refills to current capacity; existing farm grows on reseed). Also correct §6.5/§6.6 deferred mentions.
- `design/stats/technologies.csv`: correct Heavy Plow food bonus +75 → +125 (data error fix).
- `docs/changelog.md`: 0.1.46 entry.
- `docs/devlog/summary.md`: PREPEND newest-first; COMPACT an older line to stay ≤ 50 lines.
- `docs/devlog/detailed/2026-06-12_2026-06-16.md`: full `##` entry at the TOP, reviewer line **[pending — main agent runs the multi-CLI review]**.
- `design/roadmap.md`: M1 farm-upgrade-techs done; Mill batch-reseed still deferred.

## 4. Four gates (all must pass)

`npm run typecheck`, `npm run lint`, `npm run build`, full `npm test` (run alone; re-run footprintVisibilityConsistency isolated if it flakes). Baseline 1454 passed / 2 skipped → baseline + new tests, no unrelated shifts.

## 5. Hand-off

Do NOT git commit. Report shipped techs, derived wiring, files+LOC, four-gate results + ground-truth farm-food check, reviewer claims. Main agent runs the multi-CLI review + commit.
