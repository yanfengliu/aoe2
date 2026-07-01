# data-driven-combat-2b — Slice 2b-ii Review iteration 1

Change: replace the first-match attack-bonus ladder with an AoE2-accurate `ArmorClass` model + cross-class SUMMATION (new `prototypeUnitRules/armorClasses.ts`), adopting the CSV bonus values (v0.1.49, user-visible balance). Reviewers: Codex (gpt-5.5, xhigh) + Claude (opus[1m], read the codebase). Gemini unreachable (headless OAuth). Contamination audit: clean.

## Verdict: SHIP after fixes — model verified correct; converged doc/comment findings + one bombard-transcription HIGH addressed.

## Verified correct (Claude, cross-checked against units.csv + the 34-member UnitType union + damage sites)
- **Transcription exact:** spear line +15/+22/+32 cavalry + +7/+11/+16 camel; camel +10/+5, heavy-camel +18/+9; skirmisher +3 archer/+3 spearman; archer line +3/+2 vs spearman; siege +12 siege / scorpion +1-2 ram / ram +40 / siege-ram +65; building bonuses ram 125 / siege-ram 200 / bombard 200 / treb 250 / mangonel 35 / onager 45 / scorpion 2 / heavy-scorpion 4.
- **Class membership (all 34 correct):** camels are `camel` NOT `cavalry`; cavalry-archers are `archer`-only (correctly not `cavalry`); skirmisher in `archer`; rams `[siege,ram]`; monk `[]` (deferred).
- **Summation cannot double-count:** no attacker holds two bonuses that a single target's classes both match. Exhaustiveness compile-enforced by `satisfies Record<UnitType, ReadonlySet<ArmorClass>>`.
- **Damage sites unchanged** beyond intended values; tower fire untouched (raw attack, no bonus).
- **All 12 re-validated fixture assertions arithmetically correct** (base + bonus − armor).
- **Dead-code removal grep-clean** (isCavalryTarget, CAVALRY_TARGETS, LIGHT/HEAVY_CAVALRY_TARGETS, MANGONEL_INFANTRY_TARGETS).

## Findings and disposition

| # | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | HIGH (Codex) / note (Claude) | both | Bombard Cannon's anti-unit bonus is `{siege:40}` only; the CSV free-text "+40 siege/camels;+20 siege;+40 stone defense" also implies a camel bonus + extra siege. `attackBonusAgainstUnit('bombard-cannon','camel')` returns 0. | FIXED (conscious choice) — kept `{siege:40}` (the clear anti-siege value) and DOCUMENTED the deferral of the ambiguous camel/extra-siege/stone-defense fragments in a code comment. Real AoE2 bombards are not a notable anti-camel counter; the CSV column is unreliable free-text; no test covers it; the changelog doesn't claim to touch bombard's anti-unit bonus. Now explicit, not silent. |
| 2 | MEDIUM | both | Siege-vs-building blast sweep incomplete: `imperialSiege.test.ts` names/comments (+250 siege-ram, +80 bombard "two hits"), `siegeWorkshop.test.ts:107` name (+75), and `siege/mangonel.ts` fixture comments still stated OLD values (tests pass — they assert destruction, not exact HP — but the changelog advertises the new values). | FIXED — updated all stale names/comments to the shipped values (ram +125, siege-ram +200, bombard +200; mangonel base-only). |
| 3 | MEDIUM | Codex | Doc-state: changelog/PLAN referenced a not-yet-existent `done/` thread; devlog/summary not updated; PLAN's "keep the light/heavy split" open-question still open, contradicting the shipped flat model. | FIXED — summary/PLAN/roadmap/spec/changelog updated; PLAN open-question marked RESOLVED (superseded by spec §10.1/§10.3); detailed devlog written; thread moved current→done (makes the `done/` references accurate). |

## Convergence
Both reviewers independently confirmed the core model is correct (no double-count, no exhaustiveness gap, no wrong class assignment, all arithmetic right). The findings are transcription-completeness (bombard, now a documented choice) and doc/comment staleness — all fixed. No second full iteration needed (fixes are comments/docs + one documented data-scope decision; the full suite stays green at 1484/2).
