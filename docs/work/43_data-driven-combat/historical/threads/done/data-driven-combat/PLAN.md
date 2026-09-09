# Data-driven combat (M2) — PLAN

## Goal
Replace the prototype's single-`armor` + hard-coded type-pair counters with AoE2's armor-class + attack-bonus model, so counter-play (archers↔skirmishers, cavalry↔spear line, pierce-resistant buildings, etc.) is driven by data rather than a hand-maintained `if`-ladder. This is structural-enabler #3 from the roadmap and the core of AoE2 combat. It is validated by the existing deterministic combat/siege fixtures (no LLM needed), so it is decoupled from the LLM's Dark-Age stall.

## Current state (mapped 2026-06-15)
- **One armor value.** `CombatState.armor` (a single number; `combatStateFactory.ts` starts it at 0 + adds tech bonuses). No melee/pierce split, no armor classes.
- **Damage formula at ~4 sites**, all `Math.max(1, attack + bonus - armor)`:
  - `playerCommandsSystem.ts:217-218` (unit→unit, uses `attackBonusAgainstUnit`)
  - `playerCommandsSystem.ts:327-329` (unit→building, uses `attackBonusAgainstBuilding`)
  - `towerCombatSystem.ts:110-112` (tower→unit)
  - `wildlifeCombatSystem.ts:117` (wildlife→unit)
- **Hard-coded counters** in `prototypeUnitRules.ts:120-160`: `attackBonusAgainstUnit` (spearman/pikeman/halberdier/camel vs cavalry sets; skirmisher vs archer line; mangonel vs infantry) and `attackBonusAgainstBuilding` (ram/siege-ram/bombard-cannon/trebuchet).
- **CSV already has the data**: `design/stats/units.csv` columns `attack` (14), `armor` (15), `attack_bonus` (16), `armor_bonus` (17). Currently UNUSED by the combat code (values are hard-coded in `statTables.ts` + `prototypeUnitRules.ts`).
- **Affected fixtures** (assert specific HP outcomes): `combatMatchups/{rangedSkirmish,generalCombat,autoAggression,infantryAndCavalry/*}`, `siege/{ram,mangonel,scorpion,trebuchet,bombardCannon,workshop}`, `castleDefense/*`, `monastery/*`. Only PIERCE-attacker fixtures shift in Slice 1 (see below).

## Slices (ship independently; each its own commit + version bump + review)

### Slice 1 — melee/pierce armor split (foundation)
- Add `pierceArmor: number` to the combat stat model alongside `armor` (which becomes the MELEE armor; keep its current values so melee interactions are byte-unchanged). Add an attack-damage TYPE per attacker: `'melee' | 'pierce'` — pierce = archer line, skirmisher, scorpion, tower/castle/TC arrows, bombard tower; melee = infantry, cavalry, rams, monks-n/a. (Mangonel/onager: pierce in AoE2; bombard-cannon: pierce; trebuchet vs unit: pierce — confirm per unit from AoE2 data.)
- Branch the formula at the 4 sites: `armorUsed = attackType === 'pierce' ? target.pierceArmor : target.armor`; `Math.max(1, attack + bonus - armorUsed)`.
- Set per-unit `pierceArmor` from `units.csv` (parse col 15/17 — AoE2 stores armor as `melee/pierce` class values). Start with the base infantry/archer/cavalry/siege values; building pierce armor is high (resists arrows).
- **Fixture impact is bounded**: keeping `armor`=melee unchanged means only pierce-attacker fixtures move (rangedSkirmish, scorpion, tower/castle defense, archer matchups). Re-validate those; melee fixtures stay green untouched.
- TDD: a focused unit test of the damage helper (melee vs pierce armor applied correctly) FIRST, then the per-unit values, then re-validate the fixtures.

### Slice 2 — data-driven attack bonuses + armor classes (replaces the if-ladder)
- Parse `attack_bonus`/`armor_bonus` (CSV) into armor CLASSES per unit (cavalry, infantry, archer, spearman, building, ram, ...) and per-attack bonus-vs-class. Replace `attackBonusAgainstUnit`/`attackBonusAgainstBuilding` with a class-summation lookup (spec §10.1). Remove the hard-coded ladder once parity is shown.
- This is where the CSV becomes the source of truth; Slice 1's melee/pierce is the data-model foundation it extends.

## Validation (per slice)
TDD (helper test first), then the deterministic combat/siege fixtures re-validated, then the four gates, then multi-CLI review (the damage formula is core — reviewers must verify no regression in the unchanged melee path + correct pierce application), then spec §10 update + devlog/changelog + version bump.

## Notes
- Spec §10 is the authority for the class-summation formula; reconcile the implementation to it.
- Keep `combatStateFactory.ts` the single place that assembles a unit's combat stats (incl. tech bonuses) so melee/pierce + classes compose with the existing tech-bonus stacking.
