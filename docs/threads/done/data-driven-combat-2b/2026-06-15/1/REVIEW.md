# Data-driven combat Slice 2b-i — retire the attack-bonus if-ladder into data — Review iteration 1

Change under review: a BEHAVIOUR-PRESERVING refactor replacing the hard-coded `attackBonusAgainstUnit` 8-rule if-ladder + `attackBonusAgainstBuilding` switch with two declarative data tables (`UNIT_ATTACK_BONUS_RULES` first-match predicate table; `BUILDING_ATTACK_BONUS` map). Bonus VALUES unchanged. Parity unit test added. No version bump.

Reviewers: Codex (gpt-5.5, xhigh), Claude (opus[1m], --effort max), Gemini (gemini-3.1-pro-preview, plan mode). All three read the live codebase. Contamination audit: clean.

## Verdict: SHIP — UNANIMOUS APPROVE, no code findings

All three independently diffed the new tables against the old ladder (Claude via `git show HEAD:`) and confirmed EXACT behaviour preservation. Codex + Gemini APPROVE; Claude APPROVE ("a true no-op refactor"). Only doc-accuracy items, all fixed.

## Verified-correct (cross-checked by all three)
- **Behaviour preserved:** the 8 ladder branches map 1:1 onto the 7 attacker keys with identical predicates + values; building map == switch; `0` fallback preserved (`if (!rules) return 0` / `?? 0`).
- **First-match safe:** `LIGHT_CAVALRY_TARGETS = {scout, light-cavalry}` and `HEAVY_CAVALRY_TARGETS = {knight}` are DISJOINT, so the spearman/pikeman rule order cannot change results. The pre-existing quirk (spear-line only bonuses vs scout/light-cav/knight, not cavalier/paladin/hussar) is faithfully preserved.
- **Predicates reuse the same sets/functions** (`LIGHT/HEAVY_CAVALRY_TARGETS`, `isCavalryTarget`→`CAVALRY_TARGETS`, `isArcherLineUnit`→`ARCHER_LINE_UNITS`, `MANGONEL_INFANTRY_TARGETS`).
- **Hoisting safe:** `isCavalryTarget`/`isArcherLineUnit` are `export function` declarations (hoisted); the arrow predicates capture imported consts at call time. No TDZ.
- **Parity test adequate:** every rule asserted (both light/heavy branches, camel + heavy-camel each, all 4 building bonuses, no-match pairs). Full suite 1275 green (combat fixtures unchanged → end-to-end behaviour preservation).
- **Genuine seam, not churn:** moving attacker→bonus into data is a sound, pragmatic setup for 2b-ii's value adoption (new values = one-number edits; first-match→summation = change the loop).

## Findings and disposition (all doc-only)

| # | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | LOW | Codex | `summary.md` still said "retiring the hard-coded counter table" is next — stale once this lands. | FIXED — summary updated to note 2b-i retired the ladder into `UNIT_ATTACK_BONUS_RULES`/`BUILDING_ATTACK_BONUS`. |
| 2 | minor | Claude | The shipped 2b-i is LIGHTER than `PLAN.md`'s planned `ArmorClass` + `UNIT_ARMOR_CLASSES` model (predicate closures, not a class taxonomy). Claude judged the lighter version the BETTER call (YAGNI). | FIXED (note) — PLAN.md reconciled: the class model is deferred into 2b-ii where summation justifies it; 2b-i still achieves the data seam. |
| — | minor | Claude | Parity test doesn't assert mangonel-vs-non-infantry → 0 and only checks one of the 4 MANGONEL_INFANTRY_TARGETS. | No change — the generic no-bonus test covers the contract; adequate as a regression guard. |

## Carried forward
Slice 2b-ii (next, the big one): adopt the AoE2-accurate CSV bonus VALUES (skirm +3, spear-line vs-all-cavalry, eagle/siege bonuses where the unit exists) on this data seam, introduce the `ArmorClass`/`UNIT_ARMOR_CLASSES` model + cross-class summation, and re-validate every bonus fixture. Wide impact → version bump + changelog.
