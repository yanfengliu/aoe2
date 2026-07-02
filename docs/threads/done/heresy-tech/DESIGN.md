# Heresy (Monastery, converted units die) — DESIGN

**Objective (v0.1.71):** the Monastery tech Heresy (`technologies.csv:66` — Castle, 1000 gold, 60s, "Converted units die"), the classic AoE2 counter to enemy monk play: when an enemy monk's conversion of one of YOUR units completes, the unit DIES instead of joining the converter.

## Design: change the conversion OUTCOME at the flip site

The conversion state machine (`monkTaskAppliers.applyMonkConvert`) accumulates progress and, at the flip threshold, calls `flipConvertedUnit` (transfers ownership). It already reads the TARGET owner's researched set there for **Faith** (which halves incoming progress). Heresy reuses that exact read — it is likewise keyed on the target's owner (your own tech makes your unit die):

```ts
const targetOwnerResearched = accessor.get(researchedTechnologiesCodec).get(targetUnit.owner) ?? EMPTY;
const resistance = monkConvertProgressMultiplier(targetOwnerResearched); // Faith
convState.progress += monkConvertProgressPerTick * resistance;
if (convState.progress >= monkConvertFlipThreshold) {
  if (convertedUnitDies(targetOwnerResearched)) {   // Heresy
    destroyUnitEntity(targetId);
    markOutOfBandRenderChange();
    return;
  }
  flipConvertedUnit(...);
  return;
}
```

`convertedUnitDies(researched) = researched.has('heresy')` — a new pure predicate in `monasteryTechEffects` (sibling of `monkConvertProgressMultiplier`). Heresy changes only the OUTCOME; it does NOT slow/prevent conversion (that's Faith), so the two compose (a Faith+Heresy unit takes twice as long to reach the flip, then dies).

## Why destroyUnitEntity is the clean primitive

`entityDestroyOps.destroyUnitEntity` (the combat-death path) is comprehensive: it decrements the owner's population, and clears combat state, monk tasks, **conversion state**, garrison side-maps, monksByOwner, selection, and destroys the entity. So the Heresy branch is a single call — no bespoke cleanup, no dangling conversion progress, correct population accounting. The converting monk's task points at the now-gone target; the monk behavior system already handles a target that dies mid-action (targets die in combat too), so it re-evaluates/idles gracefully.

`destroyUnitEntity` wasn't previously available to the monk layer, so it was threaded: `wirePostSeedOps` (has `entityDestroyOps`) → `monkTaskOps` deps → `createMonkTaskAppliers` deps.

## No save-format change / byte-identical existing conversions

The effect is derived from the persisted researched set; no new stored state. No existing fixture grants a unit's owner `heresy`, so every existing monk-convert test flips exactly as before (full suite green, 1633/0). Deterministic (destroy has no random/time); a save/loaded game reads the same `heresy` flag.

## Seam wiring

`technologyTypes` union → `prototypeEconomyRules` cost `{gold:1000}` + time `600` (CSV 60 s × 10 TPS; one farm comment folded to hold the 500-LOC cap, 499) → `prototypeBuildingRules` monastery RESEARCHES row → `monasteryTechOptions` Castle block → `formatters` label.

## Validation

TDD: pure `convertedUnitDies` + cost/gating (1000g/600t, monastery-only) + live destroy-vs-flip on twin scenarios — a real convert command (`select monk → issueContextCommandAtEntity(enemy)`) drives a monk to convert a militia: WITHOUT Heresy it flips to the monk's owner (baseline unchanged), WITH Heresy on the target owner the militia is GONE (owned by no one). New `monk-convert-heresy-fixture` = the convert fixture with `startingResearchedTechnologies:['heresy']` on the target owner.
