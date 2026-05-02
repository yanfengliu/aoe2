# impl-26 multi-CLI review — Phase 1C iter-2 (Codex impl-16 HIGH × 2 retroactive fix)

**Date:** 2026-05-02
**Iterations:** 2
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `claude-opus-4-7[1m]` max, Gemini `gemini-3.1-pro-preview` plan-mode

## Summary

Retroactive fix for two Codex impl-16 HIGH findings that were missed at the original review (awk extraction matched the prompt-echo, not the review). Background in `docs/debugging/2026-05-02-missed-codex-findings.md`.

**Bug 1 — research-path queue-cap bypass.** `productionQueues[buildingId]` mixes train and research entries, but `tcEffectiveQueueLength` and `findIdleProducerLocal`'s queue-length gate only counted pending trains. A TC with 1 queued villager could accept (a) age-up research push and (b) another villager push in the same tick — landing 3 entries against the cap of 2. **Fix:** track `pendingResearchByBuilding` parallel to `pendingTrainsByBuilding`; include both in queue-length gates; gate the age-up push itself on the pre-push queue length.

**Bug 2 — same-tick villager double-assignment.** Three sites in aiSystem (watch-tower, wonder, nextBuild) called `findAvailableVillager(owner)`. Post-1C, building.placeConfirm intentions don't update `unitCommands` until the handler runs at next tick, so all three calls in the same decision tick could return the same villager id; later handlers overwrote each other's commands, stranding earlier foundations. **Fix:** `findAvailableVillagerForBuild` excludes a tick-scoped `claimedVillagers: Set<number>`; each successful push marks the villager claimed.

## Iteration log

**iter-1** — initial fix: `pendingResearchByBuilding` snapshot + post-push increment, `findAvailableVillagerForBuild` with `claimedVillagers`, comments, dropped `findAvailableVillager` from aiSystem.

| Reviewer | Finding |
|---|---|
| Codex HIGH | Age-up research push didn't gate on `tcEffectiveQueueLength` BEFORE the push. A TC already at cap 2 could still accept age-up research → length 3. |
| Gemini perf nit | `findAvailableVillagerForBuild` allocated per-player per-tick. Negligible; defer. |
| Claude LOW | `findAvailableVillager` had no remaining callers in src — dead code in `playerQueries`. |
| Claude NIT | Comment drift in aiSystem ("findAvailableVillager calls" → now `findAvailableVillagerForBuild`). |

**iter-2** — addressed all three:
- Hoisted `tcEffectiveQueueLengthBeforeAgeUp` calculation BEFORE the age-up gate; gate on it. Recompute post-push for the villager gate downstream.
- Dropped `findAvailableVillager` from `playerQueries` (interface, body, return literal); also dropped the unused `unitCommands` destructure.
- Updated comment to reference the three callsites + the renamed helper.

**iter-2 final review:** Codex "No findings." Gemini "No regressions found. Looks good to merge." Claude "APPROVE." Two non-blocking nits (style: `let` vs `const`; `// FUTURE:` marker) — skipped.

## Verification

- `npm run typecheck` ✓
- `npm run lint` ✓
- `npx vitest run tests/simulation/aiPlayer.test.ts tests/simulation/createSimulationBridge.combat.test.ts` (25 tests passed)
- `npm test` (706 passed + 1 skipped — full suite preserved)
- `npm run build` ✓

## Disposition

Both Codex impl-16 HIGH findings now addressed end-to-end. Reviewers converge to ACCEPT.
