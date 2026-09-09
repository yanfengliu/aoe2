# agent-affordances — impl iteration 1 (+ iter-2 fix verification)

Diff: working tree vs a3906c3 (27 modified + 6 new files, ~2.5k diff lines). Reviewers: Claude (`claude-fable-5[1m]`, full tool access — load-bearing), Codex (`gpt-5.5` xhigh — quota recovered, read the tree), Gemini (`gemini-3.1-pro-preview` plan-mode — structural signal only). All three ran on the same enriched prompt (behavior-preservation + reason-engine correctness + fog/determinism + wiring + per-decision cost + doc accuracy focus).

## Verdicts

- **Claude:** no HIGH; 2 LOW hardening + 2 doc-sync + 1 by-design note. "The core of the change — message-only validator enrichment, the shared reason engine, and the fog-gated affordance surfaces — is correct as shipped." Verified byte-identical validator decisions by diffing all three validators against HEAD; traced the full wiring chain and the engine d.ts contracts (VisibilityMap.isVisible OOB-throw ordering vs the scan's bounds-check-first).
- **Codex:** 1 HIGH (process), 1 MEDIUM (doc-sync), "No concrete runtime defect found in the validator accept/reject paths, research reason ordering, placement fog gating, replay/live wiring, or per-snapshot cost path."
- **Gemini:** approve, no findings (prompt-only).

## Findings + dispositions

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| Codex-1 | HIGH (process) | changelog 0.1.21 cites `docs/threads/done/agent-affordances/` while the thread was still in `current/` with no REVIEW.md — broken audit trail if committed as-was. | FIXED by sequencing: this REVIEW.md written + thread moved `current/` → `done/` in the same commit the changelog lands in. |
| Codex-2 / Claude-L3 | MEDIUM/LOW | Thread DESIGN.md/PLAN.md drifted from shipped shape (`getBuildingOptionsForOwner` vs `getAgentBuildingOptions`; positional vs opts-object `findOpenPlacementAnchors`; `string \| null` + 7 deps vs `string` + 4 deps on the reason engine). | FIXED — both docs synced to shipped signatures; iter-2 grep confirms zero stale names repo-wide. |
| Claude-L1 | LOW | `AGE_ADVANCE_REQUIRED_COUNT` was display-only — `canAdvanceTo*` still hardcoded `>= 2`, so a future rule change would make every rejection message lie. | FIXED — all three gates consume the constant (playerQueries.ts:202/212/222); behavior unchanged (constant = 2, pinned by test). |
| Claude-L2 | LOW | `getAgentBuildingOptions` called the get-or-create `inFlightTechSetFor`, inserting empty sets into the Tier-2 cache on a nominally pure read path (publicly reachable for arbitrary owners). | FIXED — dep replaced with NON-creating `inFlightTechsFor` probe built in wirePostSeedOps (`accessor.get(codec).get(owner) ?? NO_IN_FLIGHT`). Iter-2 verified the wiring is the only construction site, so no path can insert. |
| Claude-L4 | INFO | Changelog header overstated the HUD pass-through scope; thread-path link (same as Codex-1); drift-log devlog pointer pre-dating the entry. | FIXED — header re-scoped (then tightened again after iter-2 noted `in_flight_tech` is HUD-reachable through the same toast slot and ALSO improves); thread move resolves the link; the devlog entry lands in the referenced file in this commit. |
| Claude-L5 | INFO (by design) | `placement_blocked` cause-naming can be probe-spammed into fog to detect enemy structure types at the targeted footprint. | ACCEPTED — DESIGN.md adjudicates this as the honest minimum (the engine already rejected the command; real AoE2 shows the red footprint too). Iter-1 verified the exposure is exactly the documented one: anchor suggestions ARE owner-visibility-gated (test-pinned) and the cause never enumerates cells beyond the attempted footprint. |

## Iter-2 (fix verification, Claude)

All five fixes VERIFIED with file:line evidence; no new issues introduced (typecheck clean, 27 covering tests pass, `ReadonlySet` substitution sound, shared empty set never mutated). Remaining note was the changelog-wording nuance above — nitpick-level → **CONVERGED**.

## Verified-clean highlights (iter-1, Claude depth)

Validator accept/reject decisions byte-identical (only message construction changed; extra work on rejection paths only). Reason-engine branch order correct for every reachable state ("you have N" can never render when N ≥ 2 because the options gate already admits those). Ring scan deterministic, bounds-checked BEFORE visibility probes (`VisibilityMap.isVisible` throws OOB), visibility checked BEFORE occupancy (unseen cells can't influence results). Wiring chain complete at all six layers; no runtime import cycles; wireBridgeOps sits exactly at its 605 pin. Per-snapshot cost O(#buildings × #types) at ~250-tick cadence; anchor search worst-case ~625 candidates × footprint probes, twice per snapshot. Fog rules hold under `--omniscient` (flag widens what the agent sees, not where it may be told to build).
