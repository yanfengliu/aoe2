# Motion continuity external review — iteration 3

## Scope and execution

The complete committed range `81dbb5f..13ce014` was reviewed after the user explicitly authorized disclosure of that exact AoE2 source diff to OpenAI Codex and Anthropic Claude. Both reviewers were instructed to verify claims against the live codebase, treat occupancy/save/replay reconstruction as high risk, inspect tests for false positives, and verify documentation accuracy. Codex ran `gpt-5.6-sol` at ultra reasoning in a read-only sandbox. Claude Fable 5 rejected the first launch because its quota was exhausted, so the canonical fallback `opus[1m]` ran at maximum effort with read-only review instructions. Repository status was audited after Claude and showed only the driver's intended boar-hunting work.

## Findings

**OpenAI Codex:** no substantive bug, security issue, or performance regression in the supplied range.

**Anthropic Claude:** approved with no substantive correctness, security, or performance defect after reading the live occupancy, movement, save/load, replay, animation, engine dirty-tracking, tests, and documentation paths and running 34 focused tests. It verified immutable fine-transform publication, numeric-slot-first reconstruction, explicit-overflow restoration, bounded freed-slot convergence, exact-slot command completion, blocked-scout movement bounds, the shared 250 ms live/replay cap, shortest-arc facing, the unchanged presented silhouette picker, and the exact reachable Voxel 0.1.4 pin.

Claude recorded two non-blocking observations: `worldOccupancy.placeUnitForSpawn` remains a pre-existing future-facing surface with no production call site, and one movement dirty-diff assertion could become fixture-coupled if a future scenario leaves the scout exactly settled and fully blocked. Live grep confirmed both scopes; neither is introduced by this range or a current failure, so no motion-continuity code change is warranted.

## Disposition

Approved. The previously policy-blocked external review completed under explicit authorization, both independent providers found no substantive issue, and no follow-up implementation change was required.
