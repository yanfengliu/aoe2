# mangonel-blast — Review iteration 1

Change: blast/splash damage for the mangonel line (v0.1.50, spec §10.7). New `bridge/blastDamage.ts` (`computeBlastDamage` pure + `applyUnitBlast` + `resolveUnitAttackOnUnit`), `UNIT_BLAST_RADIUS` (mangonel 1, onager 1.25), wired into playerCommandsSystem's unit- and building-target paths. Restores mangonel anti-infantry (removed as a fake bonus in 2b-ii).

Reviewers: Codex (gpt-5.5, xhigh) + Claude (opus[1m], read the codebase + ran the suite). Gemini unreachable (headless OAuth). Contamination audit: clean.

## Verdict: SHIP after fixes — Claude no correctness/security bug; Codex 1 MEDIUM + 1 LOW; both converged findings addressed.

## Verified correct (Claude, cross-checked against live code + stat tables; ran suite 21/21)
- `resolveUnitAttackOnUnit` is behaviour-preserving vs the old inline block: same damage formula/arg-order, cooldown set once, markDirty+markRender same order, death → addKill/destroy/clearCommand. The only new behaviour is the interposed blast.
- Splash geometry: inclusive Euclidean (`distanceSquared <= radius^2`) — a `<` would splash NOTHING at radius 1; orthogonal-only for radius 1/1.25 (diagonal √2 excluded). Matches CSV `blast_radius`.
- Determinism (id-sorted), correct exclusion (attacker + primary), no double-application, no iterator invalidation (candidates materialized before any destroy). Friendly fire damages own units but does NOT score.
- All exact HP assertions correct against the stat tables.

## Findings and disposition

| # | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | MEDIUM | Codex + Claude | Blast fired only on the unit-vs-unit path; a mangonel shelling a BUILDING did not splash nearby units — contradicting spec §10.7's "impact cell" wording. | FIXED — wired `applyUnitBlast` into the building-target branch (impact = building position) + added a `mangonel-vs-building-splash` fixture and integration test. |
| 2 | LOW | Codex | The friendly-fire-no-score rule had no regression guard. | FIXED — added an `applyUnitBlast` unit test with a fake world: an enemy blast-kill scores (owner credited), a friendly-fire kill does not. |
| 3 | doc | Claude | Missing mandatory devlog entry. | FIXED — detailed devlog entry written (with these reviewer notes). |
| 4 | minor | Claude | Fixture comment said "Manhattan distance 1" but the blast metric is Euclidean (a diagonal at √2 would NOT splash). | FIXED — comment corrected to "orthogonal / Euclidean distance 1" with the diagonal caveat. |
| — | note | Claude | Wildlife (boar/wolf) live in a separate codec, so they are not splashed. | No change — negligible divergence, left as documented scope. |

## Debugging note
The building-splash integration test first failed with the splashed spearman DYING (not surviving at 5). Ground-truth `tsx` trace + a temporary `applyUnitBlast` log proved the blast fired exactly once for 40 (correct) — the extra damage was the owner-1 Town Center's base arrow (§10.8) finishing the 5-HP spearman, an incidental fixture confound. Moved the scene far from both TCs; the blast was never buggy. (Per AGENTS: measure, don't guess — a synthetic "fix" would have chased a non-bug.)

## Convergence
Both reviewers independently confirmed the core mechanism + refactor correct. The one substantive gap (building-path splash) is fixed + tested; the LOW scoring guard + doc items are closed. No second iteration needed (fixes are additive: a building branch call + two tests + doc; full sim suite stays green).
