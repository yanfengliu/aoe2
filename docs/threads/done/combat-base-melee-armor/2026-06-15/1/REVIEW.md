# Data-driven combat Slice 2a — base melee armor (v0.1.33) — Review iteration 1

Change under review: wire base MELEE armor from units.csv (`UNIT_MELEE_ARMOR` + `unitMeleeArmor`/`effectiveMeleeArmor`, the exact mirror of Slice 1's pierce side), reducing melee damage by base melee armor + the unit's armor-tech bonus at the two melee damage sites (unit→unit, wildlife bites). Four combat fixtures re-validated.

Reviewers: Codex (gpt-5.5, xhigh, read-only sandbox), Claude (opus[1m], --effort max, Read/Glob/Grep), Gemini (gemini-3.1-pro-preview, plan mode). All three read the live codebase. Gemini hit transient SSL errors and recovered. Post-run contamination audit: clean.

## Verdict: SHIP — converged, NO code findings

All three independently verified the code correct. Gemini: APPROVED ("high-quality and ready. No issues found."). Claude: ship-ready, "no code-correctness issues found." Codex: no code finding, one MEDIUM doc-accuracy item. The implementation is a clean, correct mirror of the Slice-1 pierce work with bounded, accurate fixture impact. The only findings are doc-accuracy, all fixed in the fold-in.

## Findings and disposition (all doc-only)

| # | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | MEDIUM / a | Codex + Claude | Fixture count understated — changelog/devlog/summary said "one fixture re-validated" (camel-vs-knight) but FOUR scenarios across three test files were re-validated. | FIXED — corrected to four (camel-vs-knight, pikeman+halberdier-vs-knight, halberdier-vs-cavalier, heavy-camel-vs-knight) in changelog/devlog/summary. |
| 2 | MEDIUM / b | Codex + Claude | Devlog said full suite `[pending]` while the changelog said "green". | FIXED — devlog filled with the real result (1272 passed, green). |
| 3 | MEDIUM / c | Codex + Claude | The referenced thread directory didn't exist (changelog → `done/`, devlog → `current/`, neither present). | FIXED — this REVIEW.md created directly under `done/combat-base-melee-armor/`; devlog reference reconciled to `done/`. |
| 4 | minor / d | Claude | "Most units (infantry line … keep 0)" — the champion is infantry and has 1 base melee armor. | FIXED — reworded to "the militia and spearman lines (bar the champion), archers, camels, and siege". |

## Verified-correct claims (cross-checked against the codebase by all three)

- **CSV values:** every `UNIT_MELEE_ARMOR` entry matches units.csv's `melee/pierce` column FIRST value (knight/cavalier/paladin 2, champion/treb/HCA 1, bombard 2, the rest 0). `Record<UnitType>` exhaustive over all 34 units.
- **Symmetry / independence:** `effectiveMeleeArmor` mirrors `effectivePierceArmor` (base + tech); base melee armor is NOT in CombatState (no save-format change) and does NOT leak into the pierce path; melee and pierce base values stay independent (they share only the single tech bonus, the documented pre-2b behaviour).
- **Site wiring:** unit→unit passes effectiveMeleeArmor + effectivePierceArmor (combatDamageAfterArmor picks by unitAttackType — no double-count); wildlife bites subtract effectiveMeleeArmor (null-safe); tower (pierce), unit→building (no armor), unit→wildlife (hunting) correctly untouched. Claude confirmed these are the complete set of `currentHp -=` sites.
- **Determinism:** pure lookups + direct mutation; no random/time/submitWithResult.
- **Fixture arithmetic:** all four (+2 each from the cavalry's 2 melee armor) verified against the real attack/bonus tables; anti-cavalry bonuses still apply; `halb(68) < pikeman(76)` intent preserved.

## Carried forward (Slice 2b)
The class-based bonus system stays deferred: all three confirmed the CSV `attack_bonus`/`armor_bonus` columns are free-text prose with no unit→armor-class membership (the armor column was simplified to melee/pierce), many bonuses target off-roster units, and values diverge from the hard-coded ladder — so 2b needs a parser + a class-membership map (reuse `is*Unit`/`*_TARGETS`) + careful fixture re-validation. Claude also noted heavy-camel uses +9 (same as camel) where the CSV has +18 — a 2b-territory ladder limitation, not a defect here.
