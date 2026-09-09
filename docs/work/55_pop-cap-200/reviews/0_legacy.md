# pop-cap-200 (v0.1.37) — Review iteration 1

Change under review: enforce the standard AoE2 200 population ceiling correctly. Adds `rawSupply` (the honest unclamped housing sum) to `PopulationState`; derives `cap = deriveCap(rawSupply) = min(200, max(0, rawSupply))` at every cap-mutation site; removes the old `Math.max(current, cap-provided)` don't-evict floor (so `current > cap` on housing loss is now reachable — AoE2-correct); bespoke `populationCodec` migrates legacy saves (`rawSupply = cap` default + reclamp). Designed (design-first, approved) + implemented by a fresh-context subagent; reviewed + gated by the main agent.

Reviewers: Codex (gpt-5.5, xhigh, BEGIN/END markers), Claude (opus[1m], --effort max), Gemini (gemini-3.1-pro, plan mode). All read the live codebase. Contamination audit after the batch: `git diff` (unstaged) empty — no reviewer wrote to the tree.

## Verdict: APPROVE — converged at iter-1. No HIGH/MEDIUM correctness defect.

Claude verified all 8 scrutiny points against the live code (and ran the affected suites + `tsc` clean) → APPROVE. Gemini verified all 8 → APPROVE ("flawless migration, no state drift"). Codex found no correctness bug (1 MEDIUM that is a documentation-of-intent ask + 2 LOW). All three independently confirmed: `deriveCap` at all four cap sites + the seed + the codec + the schema-1 hydrate (no surviving inline `200`, no surviving `Math.max(current,…)` floor); the over-housing regression is fixed (the honest `rawSupply`, not the clamped cap, is decremented); the codec is additive + round-trips; the floor removal evicts nothing (over-cap is already tolerated via monk conversion, which increments `current` past `cap` unclamped); determinism; `types.ts` held at exactly 500 with no semantic loss in the comment trims.

The migration semantic was the only substantive discussion and it converged to correct-as-written; the applied fixes are doc/comment-only, so no iter-2 re-review was warranted.

## Findings and disposition (all addressed this commit)

| # | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | MEDIUM | Codex | **Legacy migration grandfathers a possibly floor-inflated cap.** `rawSupply = cap` on load; but the OLD destroy floor (`max(current, cap-provided)`) could leave `cap` above true housing, so a floored old save migrates with `rawSupply` preserving that inflation (and it wouldn't self-correct). | RESOLVED — accepted as an INTENTIONAL grandfather (documented in the codec comment + devlog). It is behavior-preserving (a loaded old save keeps its exact cap; `deriveCap(cap)=cap` for cap≤200) and exact whenever the floor never fired. Reconstructing true supply from buildings on load would instead DROP a loaded cap / strand the player over-cap, and is unneeded for any reachable save (game can't field high pop yet; internal-only, no external saves). Claude independently classified the migration behavior-preserving for all reachable saves (cap≤200); Gemini "flawless" — so the migration is correct, only the documentation of intent was owed. Reconstruct-from-buildings deferred. |
| 2 | LOW | Codex + Claude | Stale `tests/simulation/populationModel.test.ts` comment said the 200 limit is "a planned follow-up … not asserted here yet" — now contradicts `populationCap.test.ts`. | FIXED — comment updated (the limit shipped in v0.1.37; `populationCap.test.ts` covers the clamp/over-housing/destruction). |
| 3 | LOW | Claude | Devlog said the `types.ts` field was offset by condensing "three" comment blocks; it was TWO (`UnitType` + `ProjectedEntityView.isMemory`). | FIXED — corrected to two (with the block names). |
| 4 | LOW | Codex + Claude | Close-out docs forward-looking (changelog/roadmap point to `done/`, thread still `current/`, DESIGN.md "awaiting review", devlog `[pending]`). | FIXED in close-out — thread moved `current/`→`done/`, devlog reviewer section filled, DESIGN.md status updated. |
| 5 | LOW (informational) | Claude | Pre-v0.1.37 REPLAY bundles that destroyed a pop-providing building while `current > cap-provided` will diverge on replay (the destroy formula changed). | No action — inherent to the intended gameplay-rule change; affects only recorded replays. Persistent saves are migrated + behavior-preserving for any reachable legacy save (cap≤200). |

## Notes
- Gemini ran clean (no transient errors this batch). It and Claude both rated the migration sound, while Codex asked for the intent to be documented — convergence by substantive-finding count: the migration is correct, the doc was the gap.
- Verified-against-code by the main agent before acting: all five `deriveCap` call sites (incl. the construction-flow `playerCommandsSystem:483`), the absence of any surviving `max`-floor, `types.ts` = 500, and the over-cap-via-monk-conversion precedent that de-risks the floor removal.
