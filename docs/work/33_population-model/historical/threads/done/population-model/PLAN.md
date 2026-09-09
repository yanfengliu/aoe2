# Implementation plan — population-model

TDD; affected tests while iterating, full gates before commit.

1. **Test** (`tests/simulation/populationModel.test.ts`): pin `buildingPopulationProvided` values — Town Center 5, House 5, Castle 20; non-housing 0. ✅
2. **Values** (`prototypeBuildingRules.ts`): Town Center 0→5, Castle 0→20. ✅
3. **Base** (`bridgeConstants.ts`): `STANDARD_POPULATION_CAP` 5→0 (cap fully building-derived; starting TC supplies the opening 5). ✅
4. **Regression**: bootstrap/darkAge tests confirm opening cap 5 and +House → 10 (caught the seed-order issue that forced base 0). ✅
5. **Spec §6.10** precise (values + the 200 limit noted as a not-yet-enforced follow-up); changelog 0.1.23; version bump; roadmap M1 split into "supply done / limit follow-up". ✅
6. Full gates → multi-CLI review (Codex + Gemini) → commit. ✅
7. (deferred) 200 population limit with raw-supply tracking — roadmap M1 follow-up.
