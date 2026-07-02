# Wheelbarrow / Hand Cart villager movement-speed halves — DESIGN

**Objective (v0.1.69):** complete the two economy carry techs with their AoE2 movement half. `technologies.csv:89/90` define Wheelbarrow and Hand Cart as "Movement rate * 1.1 and carrying capacity * 1.25/1.5"; the repo shipped only the carry half. This adds the +10% villager movement each, which STACK multiplicatively (×1.21 with both), matching the game.

## Design: the first same-class stacking branch on the movement-speed seam

The v0.1.66 seam already routes every commanded mover through `movementSpeedPercent(researchedSet, unitType)` at the executor, banking fractional entitlement in `moveCarryHundredths`. Husbandry (mounted) and Squires (infantry) each return a flat 110 because their classes have a single applicable tech. Villagers are the first class with TWO stacking techs, so the villager branch MULTIPLIES:

```ts
if (unitType === 'villager') {
  let percent = 100;
  if (researched.has('wheelbarrow')) percent = Math.round(percent * 110 / 100); // 110
  if (researched.has('hand-cart'))   percent = Math.round(percent * 110 / 100); // 121
  return percent;
}
```

100 → 110 → 121 are integer-exact; the carry accumulator handles any integer percent. This realizes the "future same-class techs must multiply" note the Husbandry design left in `movementSpeedPercent`. No new tech wiring — Wheelbarrow/Hand Cart already exist (union, cost, options, formatters) from the carry-tech work; this slice adds only the movement EFFECT + tests + docs.

## Why this is test-safe despite touching the core economy

Villager movement speed shifts gather-cycle timing, the classic "pervasive behavior change" risk. Verified empirically it is NOT triggered:
- No deterministic fixture seeds `wheelbarrow`/`hand-cart` in `startingResearchedTechnologies` (grep clean), and no live-sim test issues `queueResearch('wheelbarrow'|'hand-cart')` — the only references are the pure `economyCarryTechs` math and research-OPTION assertions, neither of which movement affects.
- The built-in AI's generic research loop iterates military buildings `[blacksmith, archery-range, barracks, stable, siege-workshop, castle]` — NOT the Town Center — so the AI never researches these techs and AI villagers stay at percent 100. AI-determinism (aiVsAi, aiPlayer) is byte-identical.

So every existing test's villagers lack these techs → percent 100 → the executor's byte-identical fast path → no behavior change. The effect only manifests for a human (or future AI) who researches them.

## No save-format change

The effect is derived from the already-persisted researched-tech set; the only movement state is the shared `moveCarryHundredths` field (from v0.1.66). Save/load and replay reproduce it for free.

## Validation

TDD: pure `movementSpeedPercent` tests (villager none/wheelbarrow/hand-cart/both → 100/110/110/121; the carry techs speed ONLY villagers; a full-compose test with all four speed techs giving each class its own multiplier) + live villager move races on new triple fixtures (baseline / wheelbarrow / both): a Wheelbarrow villager beats baseline by ≥2 ticks over 20 cells, the stacked villager is no slower than Wheelbarrow alone and both beat baseline — proving the effect reaches a real villager end-to-end through the executor (the "measured effect" the lessons.md movement lesson requires). Deterministic fixtures, not an LLM playtest.
