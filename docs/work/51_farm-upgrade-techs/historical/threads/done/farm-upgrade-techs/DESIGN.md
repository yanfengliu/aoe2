# DESIGN — Farm-upgrade Mill techs (Horse Collar / Heavy Plow / Crop Rotation), v0.1.46

## Summary / headline

The three AoE2 Mill farm-food techs raise how much food a Farm holds (and auto-reseeds to). They are MISSING today (named only as deferred follow-ups in spec §6.5/§6.6 and roadmap M1). This slice wires them as DERIVED stat techs — exactly the pattern the gather-rate and carry-capacity econ techs already use (`economyTechEffects.ts`): a pure helper computes a farm's food capacity from the OWNER's persisted researched-tech set, and the two farm-food write sites (farm CREATE-on-complete and farm RESEED) read that capacity instead of the bare `FARM_FOOD_AMOUNT` constant.

**No engine change. No save-format change. No schema bump. No new side map. No per-farm state.** The researched-tech set (`researchedTechnologiesCodec`) is already persisted, and the farm's `resource.amount`/`maxAmount` already serialize. The capacity is a pure function of an already-persisted set, so a save/load is unaffected by construction.

A farm BUILT (or reseeded) by a player who has the techs holds the upgraded cap; a farm whose owner has NOT researched them (the default) stays at 175 — so existing fixtures/tests are unaffected (minimal blast radius). A farm created BEFORE a tech is researched keeps its old stored amount until it reseeds (the reseed reads the then-current capacity), which is AoE2-ish and acceptable; it is NOT mutated on research (these are derived stat techs like gather/carry, not imperative like Loom).

## Values shipped (and the data reconciliation)

| Tech | Building | Earliest age | Tech prereq | Cost | Research time | Food bonus | Cumulative farm cap |
|---|---|---|---|---|---|---|---|
| Horse Collar | Mill | Feudal | — | 75 food, 75 wood | 200 ticks (20 s) | +75 | 250 |
| Heavy Plow | Mill | Castle | Horse Collar | 125 food, 125 wood | 400 ticks (40 s) | +125 | 375 |
| Crop Rotation | Mill | Imperial | Heavy Plow | 250 food, 250 wood | 700 ticks (70 s) | +175 | 550 |

Base farm food = 175 (`FARM_FOOD_AMOUNT`). Bonuses STACK additively. A Crop-Rotation farm = 175 + 75 + 125 + 175 = 550.

**Data reconciliation (a real conflict, resolved — flagged per the plan's "adjust only if you find it wrong, and say so"):** the project's authoritative `design/stats/technologies.csv` rows are:

```
Horse Collar,  Feudal,   Mill, {Food 75;  Wood 75},  20, Farm,         Food amount +75
Heavy Plow,    Castle,   Mill, {Food 125; Wood 125},  40, Farm;Farmers, Food amount +75 and Farmers carry +1 food
Crop Rotation, Imperial, Mill, {Food 250; Wood 250},  70, Farm,         Food amount +175
```

Two conflicts with the task brief's guessed values:
1. **Heavy Plow food bonus.** The CSV says "+75"; the task brief and BOTH spec §6.5/§6.6 say the cumulative capacities are **250 / 375 / 550**, which requires Heavy Plow = **+125** (250 + 125 = 375). The real AoE2 Heavy Plow is +125 food; the CSV "+75" is a data error (it duplicated Horse Collar's). I ship **+125** — it matches the spec's stated 250/375/550 contract, the task brief, and real AoE2. (If I shipped the CSV's +75, the cumulative would be 250/325/500, contradicting the spec text I'd otherwise leave in place.)
2. **Costs / times.** The task brief guessed Heavy Plow wood 40 and Crop Rotation wood 50; the CSV (and real AoE2) say Heavy Plow {125,125} and Crop Rotation {250,250}, with times 20/40/70 s. Per the task rule "use design/stats/ if they specify these," and because the CSV costs/times ARE the real AoE2 values, I ship the **CSV costs/times** (200/400/700 ticks via the project's `seconds × 10 TPS` convention). The food bonuses — the gameplay contract the spec pins — are unambiguous (250/375/550), so the only divergence from the brief is cost/time, taken from the authoritative source.

I also CORRECT the CSV's Heavy Plow bonus text to "+125" so the data file stops contradicting itself and the spec. (The "Farmers carry +1 food" clause of Heavy Plow is a carry-capacity effect, NOT a farm-food effect; it is OUT OF SCOPE for this farm-FOOD slice and noted deferred — it would belong in the carry-tech layer, mirroring Wheelbarrow/Hand Cart, and is not part of the 250/375/550 farm-food contract.)

## Investigation findings (cited, verified against live code)

### 1. How techs become researchable at a building (two cooperating surfaces the validator REQUIRES to agree)

- `RESEARCHES_BY_BUILDING` in `prototypeBuildingRules.ts:258-268` — the static building→techs registry. The `'mill'` row does NOT exist yet (mill has no research today). `canResearchAt` (`:368`) and `buildingsThatResearch` (`:406`) read it. ADD a `['mill', ['horse-collar','heavy-plow','crop-rotation']]` row.
- `getResearchOptions` / `getVisibleResearchOptions` in `optionsRules.ts:173-436` — the per-owner, age/prereq/researched-aware list. ADD a `buildingType === 'mill'` branch in both, gated by age + tech-prereq + not-already-researched, mirroring the lumber-camp/mining-camp blocks.

The `queue.research` validator (`queueResearchValidator.ts:63-75`) rejects unless BOTH `canResearchAt(...)` AND `getResearchOptions(owner, building).includes(tech)` pass, then charges `researchCost(tech)`. So adding the techs to the tables + the two option branches is sufficient — no validator/handler edit.

### 2. Cost / research-time tables (compile-enforced)

`prototypeEconomyRules.ts` holds `RESEARCH_COSTS` (`:121`) and `RESEARCH_TIME_TICKS` (`:233`), both NON-partial `Record<ResearchableTechnologyType, ...>` — adding the three to the union forces a TS error until both tables get all three keys. (Same for the `Record<BuildingType, ...>` building tables, but the new techs are not buildings, so only the two research tables + the tech union are affected.)

### 3. The DERIVED tech-EFFECT layer (the heart of this slice)

`economyTechEffects.ts` is PURE: each helper takes `researchedTechnologies: ReadonlySet<ResearchableTechnologyType>` and returns a number. ADD `farmFoodCapacity(researched): number = FARM_FOOD_AMOUNT + sum of researched farm-tech bonuses`. No per-farm state.

The two write sites both already receive `accessor` and the farm's owner:
- **Farm CREATE:** `entityCreateOps.ts` `onBuildingConstructionComplete` (`:247-253`) sets the new `resource` component's `amount`/`maxAmount` to `FARM_FOOD_AMOUNT`. Change to `farmFoodCapacity(owner's researched set)`. `owner` is already a parameter; read the set via `accessor.get(researchedTechnologiesCodec).get(owner)`.
- **Farm RESEED:** `farmReseed.ts` `tryReseedFarm` (`:58-59`) resets to `Math.max(resource.maxAmount, FARM_FOOD_AMOUNT)`. Change to reseed to `farmFoodCapacity(owner's set)` (still `Math.max` with the existing `maxAmount` so a fixture-seeded higher max is never lowered). `owner` is `resource.baseOwner` (already read at `:48`); `accessor` is already a param.

`FARM_FOOD_AMOUNT = 175` originally lived in `entityCreateOps.ts`. The first implementation kept it there and had `economyTechEffects.ts` import it — but `entityCreateOps.ts` already imports `farmFoodCapacity` BACK from `economyTechEffects.ts`, so that introduced a genuine bridge↔sim import cycle (both edges new — caught in the multi-CLI review; runtime-safe today but a layering violation + a latent TDZ trap). RESOLVED by MOVING `FARM_FOOD_AMOUNT` (and the shared `EMPTY_TECH_SET`) into `economyTechEffects.ts` — the farm-food module that is the sole consumer of the base. `entityCreateOps.ts` and `farmReseed.ts` now import both one-way from `economyTechEffects.ts`, and the sim-layer effect module no longer imports from the bridge layer. No cycle.

### 4. Why DERIVED (not imperative like Loom)

A farm's food capacity is a pure function of the owner's tech set and the base constant — there is no per-entity battle state to preserve (unlike `currentHp`, which Loom must bump imperatively because it is mutable combat state). Mirroring the gather/carry econ techs keeps the farm-tech effect in the same pure, no-new-state layer. The cost: a farm built before the tech keeps its current stored amount until it next reseeds (the reseed reads the then-current capacity). That is acceptable and AoE2-ish (an existing field doesn't magically grow; it grows as it is re-sown). It is explicitly NOT mutated on research.

### 5. Ground-truth wiring confirmation (engine-debug-tools rule)

The spawn path (`scenarioSeedOps.ts:293`) calls `addBuildingEntity(..., isComplete=true)` → `onBuildingConstructionComplete`, and `seedPlayerStarts` (which seeds `researchedTechnologiesCodec` from `startingResearchedTechnologies`, `:148-151`) runs BEFORE `seedScenarioEntities` (`:272` then `:274`). So a fixture with `startingResearchedTechnologies: ['horse-collar', ...]` + a complete `farm` spawn (no `farmFood` override) will boot with the farm at the UPGRADED capacity. This is the ground-truth bridge assertion (catches a wiring gap, not just a unit test of the pure helper): read the farm `resource`'s `amount`/`maxAmount` off the live bridge's economy snapshot and assert the upgraded value.

### 6. Save format

`researchedTechnologies` serializes via `researchedTechnologiesCodec` (already). The farm's `resource.amount`/`maxAmount` serialize with every resource. The capacity is DERIVED from the persisted set at create/reseed, so a round-trip is structurally unaffected — no schema work.

## Files the implementation touches

- `src/game/simulation/types.ts` — add `| 'horse-collar' | 'heavy-plow' | 'crop-rotation'` to `ResearchableTechnologyType`.
- `src/game/simulation/prototypeBuildingRules.ts` — add the `'mill'` row to `RESEARCHES_BY_BUILDING`.
- `src/game/simulation/prototypeEconomyRules.ts` — `RESEARCH_COSTS` + `RESEARCH_TIME_TICKS` entries for all three.
- `src/game/simulation/economyTechEffects.ts` — new `FARM_FOOD_TECH_BONUSES` table + `farmFoodCapacity(researched)` pure helper.
- `src/game/simulation/bridge/optionsRules.ts` — `mill` branch in `getResearchOptions` + `getVisibleResearchOptions` (age + prereq + drop-once-researched).
- `src/game/simulation/bridge/entityCreateOps.ts` — farm CREATE uses `farmFoodCapacity(owner set)`.
- `src/game/simulation/bridge/farmReseed.ts` — farm RESEED uses `farmFoodCapacity(owner set)`.
- `src/game/simulation/fixtures/farms.ts` + `fixtures/index.ts` + `prototypeScenario/dispatch.ts` — a `farm-upgrade-techs-fixture` (Imperial human, all three researched, one complete farm) for the ground-truth bridge test.
- Tests: `tests/simulation/farmUpgradeTechs.test.ts` (pure helper + options + cost/time + ground-truth bridge + reseed + no-regression + save round-trip).
- Spec + docs per AGENTS.md (see PLAN.md).

## Test plan (TDD)

Pure + options (no bridge):
1. `farmFoodCapacity(∅) === 175`; unrelated techs (e.g. `loom`, `double-bit-axe`) don't change it.
2. `farmFoodCapacity({horse-collar}) === 250`; `{horse-collar, heavy-plow} === 375`; `{horse-collar, heavy-plow, crop-rotation} === 550` (stacking).
3. `canResearchAt('mill', 'horse-collar') === true`; `canResearchAt('town-center'|'lumber-camp', 'horse-collar') === false` (validator↔options agreement).
4. Options: Horse Collar offered at the Mill in Feudal, NOT in Dark Age; Heavy Plow requires Horse Collar (only offered once HC researched, Castle+); Crop Rotation requires Heavy Plow (Imperial+); each drops once researched. `getVisibleResearchOptions` surfaces them.
5. Cost/time tables: `researchCost`/`researchTimeTicks` for all three.

Ground-truth bridge (engine-debug-tools rule):
6. A farm built by an owner with Horse Collar holds the upgraded food (250), stacking → 550 with all three (read the farm resource's `amount`/`maxAmount` off the live bridge).
7. A farm reseeds to the upgraded cap (a depleted upgraded farm refills to its upgraded max, not 175).
8. NO-REGRESSION: a farm owned by a player WITHOUT the techs stays at 175.
9. Save round-trip unaffected (researched set + upgraded farm persist).

## Risks / open questions

1. **Data reconciliation (resolved, flagged above).** Heavy Plow ships +125 (spec/AoE2), not the CSV's erroneous +75; CSV corrected. Costs/times from the CSV. The gameplay contract (250/375/550) is unambiguous across the brief + both spec sections.
2. **Existing farm not mutated on research (by design).** A pre-existing farm grows only on reseed. Documented; acceptable + AoE2-ish. The reseed path reading `farmFoodCapacity` is explicitly tested (item 7).
3. **Reseed `Math.max` with existing maxAmount.** Kept so a fixture that seeded a higher `maxAmount` is never lowered; with the techs, the upgraded capacity is ≥ 175 so the behavior is a strict raise. Tested.
