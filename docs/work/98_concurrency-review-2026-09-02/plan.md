# concurrency-review-2026-09-02

Status: complete
Owner: Claude coordinator, from Unknown (historical record; original ownership remains in the imported records) on 2026-10-15
Created: Unknown (historical record; the allocated ID records migration order)
Updated: 2026-10-15

## Problem and outcome

This entry groups the existing records for concurrency-review-2026-09-02. The imported documents retain the authored plans, findings and outcomes. This migration makes no new implementation or approval claim.

## Scope

- [docs/threads/current/concurrency-review-2026-09-02/REVIEW.md](reviews/0_legacy.md): the imported source, as it stood at the checkpoint. The owner thread, with the status blocks written after it, moved to `docs/threads/done/concurrency-review-2026-09-02/REVIEW.md` on 2026-10-15.

## Approach

Preserve existing work-unit grouping and every imported source. Review numbers use deterministic natural source-path order; the original paths retain the previous dates, stages and round identities. Unknown cross-stage timing is not presented as chronology.

## Acceptance criteria

- Preserve substantive source text and dissent.
- Record source provenance and verify imported file digests.
- Repair local Markdown link targets whose location changed.

## Implementation steps

The original planning documents linked above contain the historical implementation steps. This migration imported and checked their files; it did not repeat or approve the original work.

## Outcome

The September 6 status in the retained review says no review item closed. It retains the Codex review lane, save/load and instrument promotion, corpus/self-check work, and C2/C6/C8. The historical quota statement does not establish current tool availability.

The September 8 documentation migration preserves this open disposition and its source-backed maintenance date. It did not perform the outstanding product work or renew freshness. Original ownership remains as recorded in the retained source.

The current legacy thread remains the live owner record during consolidation; the active status and dated disposition above agree with that unchanged source. This import does not restart or complete its product task. Future work on this objective updates this permanent plan and the retained active thread together until its owner closes the transition.

## Status audit 2026-10-10

Read-only audit at `861d7a1a`: the retained owner review (last changed in `bc0a0bf1`) records no closure through September 22. The C1/C5 fixes remain in the cache and key test (`86262418`); the cache still returns its internal entry (C8). Later replay self-check cases exist in `tests/replay/resourceWorkerOccupation.test.ts` (`846652ab`), so absence of all CI self-check coverage is no longer a current claim; their gathering/save/replay bound does not establish acceptance of this review's whole cache class. Keep active: the Codex lane, save/load and instrument disposition, seed-2 corpus acceptance, and C2/C6/C8 need an item-by-item evidence review; no runtime checks or reviewer rerun occurred in this audit.

## Closure (2026-10-15, work 129 M1)

Complete. The review is done, its fixes shipped, and its remainder is carried as cards or dropped with a reason, so the plan closes and the owner thread moved to `docs/threads/done/concurrency-review-2026-09-02/` with a closure line, as local rules require when an objective ends. The pointer scan (`threadHygiene.test.ts`) finds no live path to the old location: the only others are in the exempt devlog and in this plan's import record.

- Shipped: E1, E2 and C1 fixed, and E7, C3, C7, C9 corrected, in v0.3.183 (the thread's 2026-09-02 status). The C1 and C5 fixes and the key test are still in the code (`86262418`). E8's relief gate was rebuilt on constructed geometry in v0.3.221. The repro tests that mattered were promoted: `movementTrafficStarvationClock.test.ts`, `convertedUnitGateReplan.test.ts`, `movementTrafficReplenishedJam.test.ts`, `movementPlanOpsCacheKey.test.ts` and `movementTrafficReliefSelfPlay.test.ts`.
- Cards in [work 106's queue](../106_de-parity-orchestration/plan.md): C2 and C8 together (the approach-plan cache keys carry no unit generation, and `ApproachPlanCache.get` returns the cache's own entry), under "Conversion and recycled ids"; C6 (a CI `SessionReplayer.selfCheck` over the cache class; the fingerprint runs cannot see the key's weakest legs) and E9 (`playtest-corpus.json` has no `seed-2` run of 20,000 ticks), under M7. Re-checked against the code on 2026-10-15: the keys in `movementPlanOps.ts` have no generation (C2), `get` returns `entry` (C8), and the corpus holds only the default-seed and boot-map runs (E9). For C6, `selfCheck` runs in five test files (shot generations, resource occupation, the Vietnamese reveal, damage types, siege base stats), and none is aimed at the cache class.
- Dropped: the Codex lane retry (Codex no longer works on aoe2, owner direction 2026-10-11, and the lane was never rerun after its usage limit lifted on 2026-09-06), and the save/load promotion and instrument tests, whose files (`tmp/review-runs/repro/{election,cache,saveload}.test.ts` and the instrument files) exist nowhere on this machine. The numbers they produced stand in the review's I1 to I4 lines.
- Not rerun: no runtime check and no reviewer ran for this closure; it rests on the thread's status blocks, the code reads above and `npm run ci:status` (main's CI GREEN on eight consecutive runs, latest `83b6ffa3`, 2026-10-15).
