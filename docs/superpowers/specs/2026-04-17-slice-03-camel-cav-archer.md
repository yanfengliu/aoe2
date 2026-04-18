# Slice 3 — New Castle Age units: Camel and Cavalry Archer

Date: 2026-04-17.
Roadmap: `docs/superpowers/plans/2026-04-17-post-sheep-roadmap.md` (slice 3).

## Goal

Add two new Castle-Age train-menu units:

- **Camel** (Stable, Castle Age) — anti-cavalry bonus unit, no upgrade chain.
- **Cavalry Archer** (Archery Range, Castle Age) — mobile ranged unit, no upgrade chain.

Each unit ships as a new trainable type, becomes available in its producer's
train menu when the owner is at Castle Age (via the existing age gate), and
has a combat-bonus row where relevant.

## Stats

From `design/stats/units.csv`; if any row is missing, add it with canonical
AoE2 DE values:

- **Camel:** HP 100, attack 5 (melee), armor 0/0, move-speed ≈ same as Scout,
  vision 4, reload ≈ 2s (20 ticks). Anti-cavalry bonus: +9 vs cavalry (Knight,
  Light Cavalry, Scout) in addition to base damage. Camel is **not itself**
  classified as cavalry for the purpose of anti-cavalry bonuses (Pikeman /
  Spearman still target it for melee, but their anti-cav bonus does NOT apply).
- **Cavalry Archer:** HP 50, attack 6 (pierce), range 4, armor 0/0, reload
  ≈ 2s, vision 5. No special bonus-damage rules.

## Where in the code

- `src/game/simulation/createSimulationBridge.ts`
  - `UnitType` already accepts new values via `types.ts`; add `'camel'` and
    `'cavalry-archer'` there.
  - Stat switches: `unitMaxHp`, `unitAttackDamage`, `unitAttackRange`,
    `unitReloadTicks`, `unitTint`, `unitSize`, `unitVisionRadius`,
    `trainingCost`, `isUnitType`, HUD labels and icons.
  - `attackBonusAgainstUnit(attackerType, targetType)`: add Camel's +9
    bonus when `attackerType === 'camel'` AND `targetType` is one of the
    cavalry types (`knight`, `light-cavalry`, `scout`).
  - The Spearman/Pikeman anti-cavalry bonus should NOT apply when the
    target is a Camel — verify the current logic; add a negative check if
    the existing code auto-treats any `'camel'` as cavalry. Camels are
    **anti-cavalry**, not cavalry.
  - `getTrainOptions(owner, buildingType)`: when `buildingType === 'stable'`
    and owner age ≥ Castle, include `'camel'`. When
    `buildingType === 'archery-range'` and owner age ≥ Castle, include
    `'cavalry-archer'`.
- `src/ui/hud/createHudController.ts` — new `unitLabel` / `unitIcon` cases:
  `'camel' → 'Camel' / 'CA'` and `'cavalry-archer' → 'Cavalry Archer' / 'CH'`.
  (Pick short non-conflicting two-letter codes; if `CA` conflicts with
  Crossbowman's `CB`, use something else.)
- `design/stats/units.csv` — ensure rows exist for both types with stats
  matching the spec above. If a row needs editing, keep existing columns
  intact; do not remove or reshape other rows.

## Tests

New `tests/simulation/castleNewUnits.test.ts` (or append to
`tests/simulation/castleUpgrades.test.ts` if the file is under ~350 lines):

1. **Camel trainable in Castle Age** — reach Castle Age via the existing
   age-up progression fixture, assert `getTrainOptions(1, 'stable')`
   includes `'camel'`.
2. **Cavalry Archer trainable in Castle Age** — same for Archery Range.
3. **Camel anti-cavalry bonus** — have a Camel attack a Knight and a
   Light Cavalry; each hit removes `baseCamelAttack + 9 = 14` HP (minus
   cavalry armor, currently 0). Validate via `combatStates` after
   deterministic attack ticks.
4. **Camel does NOT trigger Spearman anti-cavalry bonus** — a Spearman
   attacking a Camel does base Spearman damage, not the anti-cavalry
   bonus damage.
5. **Cavalry Archer moves and fires** — train a Cavalry Archer, issue
   an attack on a distant target, assert the projectile connects and
   damage is dealt at range 4.

Browser test: extend `tests/browser/game.spec.ts` with a Castle-Age
case that researches Castle Age in the fixture, queues a Camel at the
Stable, advances, and asserts the HUD label reads "Camel".

## Plan (TDD)

### Task A: Content + types

1. Verify/extend `design/stats/units.csv` rows for Camel and Cavalry Archer.
2. Add `'camel'` and `'cavalry-archer'` to `UnitType` in `types.ts`.
3. Extend exhaustive switches in `createSimulationBridge.ts` (every place the
   TypeScript compiler flags a missing-case error after adding to the union).
4. Add `unitVisionRadius` entries (4 for Camel, 5 for Cavalry Archer).
5. Extend HUD label/icon switches.
6. Run `npx tsc --noEmit` — expect clean. Full vitest — expect unchanged pass.
7. Commit: `Add Camel and Cavalry Archer unit types and stat tables`.

### Task B: Train-menu gating

1. Extend `getTrainOptions` so Stable (Castle) includes `'camel'` and
   Archery Range (Castle) includes `'cavalry-archer'`.
2. Failing vitest: Stable train options at Castle include `'camel'`;
   same for Cavalry Archer on Archery Range.
3. Run new test — expect green. Full vitest green.
4. Commit: `Make Camel and Cavalry Archer trainable in Castle Age`.

### Task C: Camel anti-cavalry bonus

1. Failing vitest: Camel attacks Knight → damage delta equals
   `baseCamelAttack + 9`. Camel attacks Spearman → damage is just the
   base amount.
2. Extend `attackBonusAgainstUnit` with the Camel → cavalry bonus. Make
   sure existing Spearman/Pikeman logic does NOT treat Camel as cavalry
   (add a negative in its bonus list).
3. Run tests — expect green.
4. Commit: `Add Camel +9 anti-cavalry bonus and exclude Camel from the anti-cavalry bonus target list`.

### Task D: Cavalry Archer combat

1. Failing vitest: train a Cavalry Archer (or spawn via fixture), attack
   a distant target at range 4. Advance ticks; assert target HP decreases.
2. Cavalry Archer already picks up the existing ranged-attack pathway if
   stats are wired correctly. No new logic expected beyond content.
3. Run tests — expect green.
4. Commit: `Cover Cavalry Archer ranged combat with a regression test`.

### Task E: Browser coverage

1. Playwright: Castle-Age fixture, queue a Camel at the Stable, advance,
   assert HUD label "Camel" on the produced unit.
2. Run `npm run test:browser` — expect green.
3. Commit: `Cover Camel training through the Stable in browser tests`.

### Task F: Slice gate

1. Full four-step gate. Fix anything red.
2. Append devlog entry + update summary.
3. Commit: `Close Slice 3 with passing gate and updated devlog`.

## Out of scope

- Heavy Cavalry Archer upgrade (Imperial — Slice 7).
- Imperial Camel (Heavy Camel / Imperial Camel — Slice 7 if data-backed).
- Parthian Tactics-style bonuses. Civ unique techs live in the content
  pipeline but do not need simulation wiring in this slice.
