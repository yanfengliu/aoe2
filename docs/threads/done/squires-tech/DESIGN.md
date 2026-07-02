# Squires (Barracks, infantry +10% speed) — DESIGN

**Objective (v0.1.68):** the second consumer of the v0.1.66 movement-speed seam — Squires (Barracks, Castle Age, 200 food / 400 ticks, per `design/stats/technologies.csv:12` — `Squires, Age of Kings, Castle, Barracks, {"Food": 200}, 40, Infantry, Movement Rate * 1.1`), granting +10% movement speed to every INFANTRY unit.

## Design: a one-branch extension of the shared seam

The movement-speed executor (`moveUnitOneSubgridStep`) already reads `movementSpeedPercent(researchedSet(owner), unitType)` every tick and banks fractional entitlement in `UnitTransformComponent.moveCarryHundredths` (engaged only at percent ≠ 100). Squires needs no new plumbing — only a second branch in `movementSpeedPercent`:

```ts
if (researched.has('husbandry') && isMountedUnit(unitType)) return HUSBANDRY_SPEED_PERCENT;
if (researched.has('squires') && isInfantryUnit(unitType)) return SQUIRES_SPEED_PERCENT; // both = 110
return 100;
```

**No stacking, by construction:** Husbandry targets mounted units, Squires targets infantry — disjoint classes (no unit is both), so at most one branch fires and a flat return is correct. A code comment flags that a FUTURE same-class tech (the Wheelbarrow/Hand Cart villager speed halves, which DO stack on villagers) must switch this to percent multiplication rather than a flat return. That is the deliberate next-increment boundary, kept out of this slice (YAGNI).

`isInfantryUnit` (INFANTRY_UNITS = militia line + spear line) is the existing predicate the blacksmith/Sappers techs use — reused, single-sourced.

## Seam wiring (the proven tech-increment path)

`technologyTypes.ts` union → `prototypeEconomyRules.ts` cost `{food:200}` + time `400` (CSV 40 s × 10 TPS; two farm/monk time comments condensed to trailing form to hold the 500-LOC cap, landed 499) → `prototypeBuildingRules.ts` barracks RESEARCHES row → `optionsRules.ts` barracks Castle-age block (beside pikeman/long-sword upgrades; drops once researched) → `formatters.ts` label. Purely DERIVED — NO `applyTechnology` case, NO `combatStateFactory` change (movement is read at the executor, not stored as a stat).

## No save-format change

Squires adds nothing to any persisted structure — its effect is derived from the already-persisted researched-tech set, and the only movement state is the shared `moveCarryHundredths` field (from v0.1.66). Save/load and replay reproduce it for free.

## Validation

TDD: pure `movementSpeedPercent` tests (infantry → 110 with Squires; non-infantry → 100; cross-check that Husbandry never speeds infantry and Squires never speeds mounted; both-techs → each class gets its own +10%, villager 100) + integration on new barracks twin fixtures (a militia boosted, a knight as the non-infantry control): cost/time, barracks-only + Castle gating (offered-and-drops; not offered at a Feudal barracks via the existing feudal-spearman fixture), a live militia race (≥2 ticks faster over 20 cells), knight-control equality across twins, and a live-research race. Deterministic fixtures, not an LLM playtest.
