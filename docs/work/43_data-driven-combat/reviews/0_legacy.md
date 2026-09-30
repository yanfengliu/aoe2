# Data-driven combat Slice 1 — melee/pierce armor split (v0.1.32) — Review iteration 1

Change under review: split combat damage into melee vs pierce — pierce attackers (archers/skirmishers/siege/gunpowder + tower/TC/castle arrows) are reduced by the target's pierce armor, melee attackers by its melee armor. New `UNIT_PIERCE_ARMOR` (from units.csv) + `combatDamageAfterArmor`/`unitAttackType`/`unitPierceArmor`/`effectivePierceArmor`; 2 unit-target damage sites wired; 5 combat fixtures re-validated.

Reviewers: Codex (gpt-5.5, xhigh, read-only sandbox), Claude (opus[1m], --effort max, Read/Glob/Grep), Gemini (gemini-3.1-pro-preview, plan mode). All three read the live codebase. Gemini hit transient SSL `ERR_SSL_SSLV3_ALERT_BAD_RECORD_MAC` and recovered after backoff. Post-run contamination audit: clean.

## Verdict: SHIP — converged (one real finding, fixed)

Gemini APPROVED. Claude: ship — implementation correct, one IMPORTANT behavior/disclosure item. Codex: 1 HIGH + 1 MEDIUM. The HIGH and the IMPORTANT are the SAME finding (armor-tech-vs-pierce). All three verified the formula, the melee/pierce classification (all 34 units), the site wiring + null-safety, the 34 CSV pierce values, the save-format safety, determinism, and the fixture arithmetic as correct.

## Findings and disposition

| # | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | HIGH / IMPORTANT | Codex + Claude | `CombatState.armor` accumulates blacksmith armor-tech bonuses (padded/leather/ring archer armor, mail, barding). Pre-split, BOTH damage sites subtracted it, so pierce hits were reduced by teched armor. The static `unitPierceArmor` dropped that — armor techs became inert vs arrows (a regression, ≤3 HP/hit; runs counter to the changelog headline). | FIXED (not disclosed) — added `effectivePierceArmor(unitType, armorTechBonus) = unitPierceArmor + the unit's tech armor (CombatState.armor)`, used at both pierce sites. Blacksmith armor again mitigates arrows, AND base pierce armor is added (more AoE2-accurate than pre-split). Fixtures research no armor techs (`armor`=0) so they stay green. Regression-guard unit test added (`combatArmor.test.ts`). The melee-vs-pierce tech SPLIT (a single tech bonus currently feeds both, matching pre-split) is explicitly scoped to Slice 2. |
| 2 | MEDIUM / minor | Codex + Claude | Docs ahead of reality: changelog claimed "full suite green" + linked `docs/threads/done/data-driven-combat/` while the thread was under `current/` and the devlog said pending. | FIXED — this REVIEW.md written, thread moved `current/`→`done/`, devlog reviewer-comments + suite-status placeholders filled. The suite is green, so the changelog claim now holds. |
| 3 | minor | Claude | Changelog/devlog said "tower/castle arrows" but `towerCombatSystem` handles the Town Center too (the scout fixture exercises TC pierce). | FIXED — wording now "tower / Town Center / castle arrows" in the changelog + the towerCombatSystem comment. |

## Verified-correct claims (cross-checked against the codebase by all three)

- **Formula** (`combatDamageAfterArmor`): `Math.max(1, attackTotal − matching armor)`; always ≥1, no NaN/negative/overflow; equivalent to spec §10.1's single-component case.
- **Classification** (`unitAttackType` via `MELEE_UNITS`): all 19 melee units (infantry/cavalry/rams/villager) classified melee; all 15 ranged/siege/gunpowder classified pierce; `Record<UnitType>` guarantees completeness; monk (attack 0) harmless.
- **Site wiring**: unit→unit uses the attacker's type + target melee/pierce armor; tower passes `'pierce'`; wildlife→unit (melee) and unit→building (no armor) correctly untouched; null tower-target safe.
- **CSV values**: every `UNIT_PIERCE_ARMOR` entry matches units.csv's `melee/pierce` column (skirmisher 3, ram 180, knight 2, paladin 3, militia line 1, mangonel/scorpion 6, onager/heavy-scorp 7, bombard 5, treb 150, scout-line/cavalier 2, archers/spears/camels 0).
- **Save format**: `CombatState` unchanged → no save-format break; pierce derived at the site.
- **Determinism**: pure lookups + direct mutation; no `submitWithResult`/random/time.
- **Fixtures**: cav-archer 34→35, mangonel-vs-knight 60→62, tower-vs-mangonel 45→49, castle-vs-champion ×1/4/5 → 60/30/20, TC-vs-scout window 80→120 (scout still dies) — all arithmetic correct, intent preserved.

## Note on Slice 2 (carried forward)
Class-based bonus damage is still lumped into `rawDamage` and reduced by the single matching armor; per-class summation (spec §10.1) + splitting melee-tech vs pierce-tech armor (the CSV armor classes) is Slice 2, where a full integration regression test (teched unit vs a pierce attacker) should also land.
