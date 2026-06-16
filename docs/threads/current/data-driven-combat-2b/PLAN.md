# Data-driven combat Slice 2b — class-based bonus damage — PLAN

## Goal
Retire the hard-coded `attackBonusAgainstUnit` / `attackBonusAgainstBuilding` ladders (`prototypeUnitRules.ts:176-217`) in favour of a declarative armor-CLASS model, so counters (spear↔cav, skirm↔archer, mangonel↔infantry, rams↔buildings, …) are data, not an `if`-ladder — and bring the bonus VALUES to AoE2 accuracy. This is structural-enabler #3 from the roadmap. Validated by the existing deterministic combat fixtures (decoupled from the LLM stall). Slices 1 (melee/pierce split) + 2a (base melee armor) shipped as v0.1.32 / v0.1.33.

## Current state (mapped 2026-06-15)
- `attackBonusAgainstUnit` is an 8-rule FIRST-MATCH if-ladder using the sets/predicates `LIGHT_CAVALRY_TARGETS`, `HEAVY_CAVALRY_TARGETS`, `CAVALRY_TARGETS` (`isCavalryTarget`), `isArcherLineUnit`, `MANGONEL_INFANTRY_TARGETS`. Values: spearman +12 light-cav / +15 heavy-cav; pikeman +19/+22; halberdier +28 cav; skirmisher +4 archer; camel & heavy-camel +9 cav; mangonel +10 vs {militia,spearman,pikeman,villager}.
- `attackBonusAgainstBuilding` is a 4-case switch: battering-ram 75, siege-ram 250, bombard-cannon 80, trebuchet 200.
- `combatDamageAfterArmor` already takes the summed `rawDamage = attackDamage + bonus`; the bonus is the only thing this slice changes.
- **CSV reality** (the key constraint): `units.csv` `attack_bonus`/`armor_bonus` are FREE-TEXT prose (`"+15 cavalry"`, `"+3 spearmen;+3 archers/hand cannon/skirms/conquistadors"`), the `armor` column was simplified to `melee/pierce` so unit→armor-CLASS memberships are NOT in the data, many bonuses target off-roster units (war elephants, eagles, ships, conquistadors), and the values DIVERGE from the hard-coded ladder (e.g. CSV skirmisher +3 vs hard-coded +4; CSV spearman +15 vs-all-cavalry vs hard-coded +12/+15 light/heavy split).

## Design
1. **Armor-class model (the infrastructure).** Define an `ArmorClass` union (e.g. `'light-cavalry' | 'heavy-cavalry' | 'cavalry' | 'infantry' | 'spearman' | 'archer' | 'eagle' | 'siege' | 'ram' | 'building'`) and `UNIT_ARMOR_CLASSES: Record<UnitType, ReadonlySet<ArmorClass>>` seeded from the EXISTING sets (`CAVALRY_TARGETS`, `LIGHT/HEAVY_CAVALRY_TARGETS`, `ARCHER_LINE_UNITS`, `INFANTRY_UNITS`, `MANGONEL_INFANTRY_TARGETS`). This is the durable, reusable piece.
2. **Bonus table.** `UNIT_ATTACK_BONUSES: Partial<Record<UnitType, ReadonlyArray<{ targetClass: ArmorClass; bonus: number }>>>` + a building variant. TRANSCRIBE roster-relevant values into the table (do NOT write a runtime free-text CSV parser — fragile; mirror how UNIT_PIERCE/MELEE_ARMOR were transcribed).
3. **Lookup.** `attackBonusAgainstUnit(attacker, target) = ` first/sum of the attacker's bonuses for classes the target is in. NOTE the semantics gap: the current ladder is FIRST-MATCH with mutually-exclusive light/heavy classes; AoE2 SUMS across classes. Keep first-match for 2b-i (behaviour-preserving); revisit summation for 2b-ii.

## Sub-slices (ship independently)
- **2b-i (behaviour-preserving, LOW risk, NO fixture shifts):** build `ArmorClass` + `UNIT_ARMOR_CLASSES` + `UNIT_ATTACK_BONUSES` populated with the EXISTING hard-coded values, and route `attackBonusAgainstUnit/Building` through the table. TDD asserts identical output for every (attacker,target) pair the ladder handled. Retires the if-ladder + ships the class infrastructure with zero behaviour change.
- **2b-ii (balance, WIDE fixture impact):** adopt the AoE2-accurate CSV values (skirm +3, spearman/pike/halb vs-all-cavalry, eagle/siege bonuses where the unit exists, etc.); switch first-match→summation if needed; flag each divergence from the old values as a deliberate balance choice in the devlog/changelog; re-validate EVERY bonus fixture. This is the user-visible "accurate counters" change.

## Validation
Per sub-slice: TDD (2b-i: parity with the old ladder; 2b-ii: the new accurate values), the deterministic combat/siege fixtures re-validated, four gates, multi-CLI review, devlog/changelog (2b-ii is user-visible → version bump; 2b-i is a pure refactor → no bump), and a spec §10 note for the class model.

## Open question for 2b-ii
The CSV light/heavy-cavalry handling differs from the ladder's explicit split. Decide whether to keep the ladder's split (more granular) or adopt the CSV's flat-vs-cavalry value. Recommend keeping the split (it's the more faithful AoE2 model — spear-line bonuses do differ by cavalry weight) and only adopting the CSV where it is strictly more accurate (e.g. skirmisher +3).
