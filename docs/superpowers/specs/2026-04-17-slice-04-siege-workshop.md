# Slice 4 — Siege Workshop and 3 siege units

Date: 2026-04-17.
Roadmap: `docs/superpowers/plans/2026-04-17-post-sheep-roadmap.md` (slice 4).

## Goal

Add the first siege workshop and three siege units:

- **Siege Workshop** — new building placeable by villagers in Castle Age.
- **Mangonel** — long-range siege, heavy single-target damage (area of effect
  simplified to single-target bonus vs infantry in v1).
- **Scorpion** — long-range bolt, high pierce damage single-target.
- **Battering Ram** — slow, anti-building melee. Deals bonus damage to
  buildings (+75 or so, canonical). Low damage vs units.

Each siege unit trains from the new Siege Workshop. Villagers can construct a
Siege Workshop once their owner is at Castle Age.

## Stats (AoE2 DE canonical)

If rows are missing in `design/stats/units.csv` or `design/stats/buildings.csv`,
add them:

- **Siege Workshop:** HP 2000, 3×3 footprint, cost: 200 wood. Requires Castle
  Age.
- **Mangonel:** HP 50, attack 40 pierce, range 7 (min range 3), reload 6s
  (60 ticks), armor 0/6, vision 9, move-speed slow. Cost: 160 wood, 135 gold.
- **Scorpion:** HP 40, attack 12 pierce, range 7, reload 3.5s (35 ticks),
  armor 0/7, vision 9. Cost: 80 wood, 60 gold.
- **Battering Ram:** HP 175, attack 2 melee, range 1, reload 5s (50 ticks),
  armor 0/180, vision 3, move-speed slow. Cost: 160 wood, 75 gold.
  **+75 damage vs buildings** is the headline bonus.

## Where in the code

- `src/game/simulation/types.ts` — add `'siege-workshop'` to
  `BuildableBuildingType` / `BuildingType`; add `'mangonel' | 'scorpion' |
  'battering-ram'` to `UnitType`; add `'siege-workshop'` to any building enum
  that's exhaustive.
- `src/game/content/` (or wherever building footprints live) — add a 3×3
  footprint entry for Siege Workshop.
- `src/game/simulation/createSimulationBridge.ts`
  - All the unit stat switches (same set as Slice 3 added Camel / Cavalry
    Archer to) — add three new cases each.
  - Building footprint and health helpers — add Siege Workshop row.
  - `buildBuildingPlacementOptionsForVillager(owner)`: include
    `'siege-workshop'` when the owner is at Castle Age or later.
  - `getTrainOptions(owner, buildingType)`: `'siege-workshop'` → the three
    siege units when in Castle Age or later.
  - `attackBonusAgainstUnit` does NOT cover buildings. The engine's combat
    model must learn "damage vs buildings". Simplest approach: introduce a
    parallel `attackBonusAgainstBuilding(attackerType)` helper returning a
    number, and in the building-target combat path, add
    `targetBuildingHealth -= attackerDamage + attackBonusAgainstBuilding(attackerType)`.
    For v1, only Battering Ram returns >0 (return 75).
  - Mangonel AoE is simplified to single-target for v1 — leave the
    "scaling vs infantry group" design note in the devlog.
  - Siege workshop shares the defensive-arrow / tower combat layer logic as
    a producer, nothing new.
- `src/ui/hud/createHudController.ts` — new building label /icon for Siege
  Workshop, and new unit labels / icons for the three siege units. Suggested
  icons: `SW` for Siege Workshop, `Mg` for Mangonel, `Sc` for Scorpion,
  `Rm` for Battering Ram.

## Tests

New `tests/simulation/siegeWorkshop.test.ts`:

1. **Siege Workshop is placeable in Castle Age** — once at Castle Age,
   `getPlacementOptions(owner, 'villager')` includes `'siege-workshop'`.
2. **Siege Workshop trains Mangonel, Scorpion, Ram** — `getTrainOptions`
   returns the three unit types.
3. **Mangonel ranged attack** — Mangonel attacks a spearman target 5 cells
   away; spearman takes `unitAttackDamage('mangonel')` - `unitArmor('pierce', 'spearman')`.
4. **Scorpion ranged attack** — similar.
5. **Battering Ram anti-building bonus** — Ram attacks a House; building
   HP decreases by `baseRamDamage + 75`. Ram attacks a villager; HP
   decreases by only `baseRamDamage - pierce/melee armor`.
6. **Ram does NOT trigger anti-cavalry bonus** — Pikeman vs Ram deals
   only base damage. (Adds a negative check mirror of the Camel rule.)

Browser test: extend `tests/browser/game.spec.ts` with a Castle-Age
fixture that places a Siege Workshop, trains a Mangonel, and asserts
the HUD label reads "Mangonel".

## Plan (TDD tasks)

### Task A: Content + types

1. Add `'siege-workshop'` and unit types to the enums in `types.ts`.
2. Add footprint (3×3) and placement rules.
3. Extend all exhaustive switches flagged by tsc (stat tables, HUD labels,
   etc.).
4. Pull stats from CSV or add rows with the canonical values above.
5. Commit: `Add Siege Workshop and siege unit types + stat tables`.

### Task B: Villager placement gating

1. Failing vitest: at Castle Age, villager placement options include
   `'siege-workshop'`.
2. Implementation: add the age-gated placement option.
3. Commit: `Allow villagers to place Siege Workshop in Castle Age`.

### Task C: Train menu

1. Failing vitest: Siege Workshop in Castle Age shows three unit train
   options.
2. Implementation: add the producer → units mapping.
3. Commit: `Make Mangonel / Scorpion / Battering Ram trainable from Siege Workshop`.

### Task D: Ranged combat for Mangonel and Scorpion

1. Failing vitest: Mangonel attacking a distant unit deals the expected
   damage after reload ticks.
2. Should fall through the existing ranged-attack path using the stats
   from Task A. If min-range behavior matters, verify or add the check.
3. Same test for Scorpion.
4. Commit: `Cover Mangonel and Scorpion ranged combat`.

### Task E: Battering Ram anti-building bonus

1. Introduce `attackBonusAgainstBuilding(attackerType): number` — returns
   75 for `'battering-ram'`, 0 otherwise.
2. Wire into the building-target combat path so the bonus is added.
3. Failing vitest: Ram attacks a House, HP drops by base + 75. Ram
   attacks a villager, HP drops only by base.
4. Commit: `Add Battering Ram +75 bonus vs buildings`.

### Task F: Counter-exclusions

1. Ensure Pikeman / Spearman anti-cav bonus does NOT apply to Battering
   Ram (it's siege, not cavalry) — add a regression test.
2. Camel +9 anti-cav also does NOT apply to Battering Ram.
3. Commit: `Exclude Battering Ram from anti-cavalry bonus target list`.

### Task G: Browser coverage

1. Playwright: reach Castle Age, build a Siege Workshop, train a
   Mangonel, assert HUD label.
2. Commit: `Cover Siege Workshop construction and Mangonel training in browser tests`.

### Task H: Slice gate

1. Full four-step gate.
2. Devlog entry + summary update.
3. Commit: `Close Slice 4 with passing gate and updated devlog`.

## Out of scope

- True area-of-effect damage (Mangonel splash). Deferred — Slice 7 can
  revisit with an AoE-damage system if Onager/Siege Onager ship then.
- Manual siege packing/unpacking.
- Siege Onager, Heavy Scorpion, Capped Ram / Siege Ram upgrades (Imperial
  tier — Slice 7).
- Ram garrison (infantry inside Ram for speed). Future slice.
