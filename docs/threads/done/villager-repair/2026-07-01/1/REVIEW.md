# villager-repair — Review iteration 1

Change: villagers repair friendly complete damaged buildings (v0.1.51, spec §8.1). New `repairCost`, `setUnitRepairCommandDirect`, a distinct `'repair'` UnitCommand, a build-loop repair branch, and the extracted `finalizeBuildingConstruction.ts`.

Reviewers: Codex (gpt-5.5, xhigh) + Claude (opus[1m], read the codebase). Gemini unreachable (headless OAuth). Contamination audit: clean.

## Verdict: SHIP after fix — Codex HIGH (free-repair exploit) fixed structurally; Claude no other bug + 3 notes all addressed; full suite green.

## Findings and disposition

| # | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | HIGH | Codex | Repair reused the `'build'` command, so an over-assigned builder's stale construction command became a FREE repair once the building completed + took damage (pre-change: complete-building build commands were cleared). A resource exploit, persisting across save/load. | FIXED — introduced a distinct `'repair'` UnitCommand type. The loop branches on type: `'build'` clears on complete (old behaviour restored), only `'repair'` repairs (and only its routing charges). The exploit is now impossible by construction. `SerializedUnitCommand.type` gains `'repair'` (additive save extension). |
| A | design note | Claude | Repair now precedes garrison in the context routing, so right-clicking a DAMAGED garrisonable building (TC/Castle/Tower) repairs (if affordable) instead of garrisoning. | KEPT as the deliberate AoE2-faithful choice (repair-on-right-click); documented in the changelog. |
| B | robustness note | Claude | The up-front charge fires before arrival/reachability is confirmed and re-charges on every re-issue (broader than "cancel doesn't refund"). | KEPT (slice-1 up-front-billing simplification); changelog wording made honest ("charged before the villager arrives; re-issuing re-charges; interrupted/unreachable not refunded"). |
| C | nit | Claude | `finalizeBuildingConstruction` mutates the construction codec but relied on the caller's earlier `markDirty` (now cross-file). | FIXED — it marks `constructionStatesCodec` dirty itself. |

## Verified correct (Claude, against live code)
`finalizeBuildingConstruction` is step-for-step behaviour-preserving (mark complete, round HP, renderable, vision, combat, population via deriveCap, onComplete — same order; deps were module imports before too). Repair predicate covers spawned (no construction state) + built (`isComplete`) buildings; routing branches mutually exclusive; full-HP buildings fall through with no charge; up-front charge exactly once; `repairCost` ceil/`max(0,…)` — no free/negative; charge/command gate atomic; deterministic; save-safe.

## Note on crossover coverage
The exploit's precondition (a `'build'` command on a complete building) can now only be produced by a stale multi-builder construction command, and the fix (distinct `'repair'` type) prevents it structurally — a `'build'` command can never enter the repair path. A dedicated regression test would require a post-completion building-damage mechanism (none exists cleanly without coupling to enemy combat); the type distinction + the green multi-builder construction tests cover the completion path.

## Convergence
Iter-1 converged: the one HIGH is fixed structurally (not a patch over the symptom), Claude's notes are addressed, and the full suite is green. No second iteration needed.
