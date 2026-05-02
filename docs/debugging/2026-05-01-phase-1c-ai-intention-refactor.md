# Debugging session — Phase 1C AI intention refactor

## Symptom

Replacing aiSystem's direct `enqueueTraining` / `enqueueResearch` / `startConstruction` calls with `pushQueueTrainIntention` / `pushQueueResearchIntention` / `pushBuildingPlaceConfirmIntention` (push to `state.pendingCommands`) breaks 2 AI integration tests:

- `tests/simulation/aiPlayer.test.ts > preserves baseline barracks-rush behavior: AI builds a Barracks and trains Militia on ai-rush-fixture` — `aiBarracksComplete = true`, but `aiMilitiaSpawned = false` after 3000 ticks.
- `tests/simulation/createSimulationBridge.combat.test.ts > lets the AI build a Barracks and kill a human villager` — same shape (AI builds barracks, fails to spawn militia).

## Expected vs actual

- Expected: AI behavior identical to pre-1C — barracks builds, militia spawns ~150 ticks after barracks completes.
- Actual: barracks builds fine, no militia ever appears. Either (a) AI never pushes `queue.train` for militia, or (b) every push silent-no-ops at handler time.

## Reproduction

`npm test -- tests/simulation/aiPlayer.test.ts -t "barracks-rush"` after re-applying the Phase 1C refactor.

Quick repro of the underlying class of bug — same shape applies to all 3 commands:

1. AI decision tick T: pushes `queue.train` intention. `productionQueues.get(buildingId).length` is still 0 (handler hasn't run).
2. `dispatcher.drainPendingCommands` runs at end of tick → submits via `submitWithResult`. Validator passes. Command is now in civ-engine's queue.
3. AI decision tick T+1 (same `aiSystem.execute` cadence): `findIdleProducerLocal(buildingType)` checks `productionQueues.get(id)?.length ?? 0`. Still 0 because the handler runs at the START of `processCommands` of THIS tick — but `aiSystem.execute` runs in the `update` phase, AFTER `processCommands`. So `productionQueues` was just updated this tick.
4. **But the AI's check happens BEFORE the handler that ran THIS tick had its effect on `productionQueues`?**

Actually let me re-check civ-engine's tick lifecycle:

- `processCommands` (executes handlers from queue submitted last tick).
- `executeSystems` (phase: update).

So at the start of `aiSystem.execute` on tick T+1:
- Last tick (T)'s pushed intention has been drained by `drainPendingCommands` (between T and T+1).
- The handler ran at start of T+1's `processCommands` BEFORE `aiSystem.execute`.
- So `productionQueues` HAS been updated when `aiSystem.execute` runs.

So the timing should work. The AI's gate `productionQueues.length >= 2` should see the 1 entry from last tick's intention by the time it decides this tick.

Hmm. Then why is the test failing?

## Hypotheses

- [ ] **H1** — AI's decision-tick interval (`decisionIntervalTicks`) is large enough that within ONE decision tick, the AI pushes multiple intentions for the same building (e.g., villager training + militia training). All push at the same time. By the time the FIRST handler runs, the second intention has the post-spend stockpile, but the validator already approved both pre-spend. B2 silent no-op kicks in.
  - Confirm: log AI pushes per tick + observe handler outcomes.
- [ ] **H2** — The AI never reaches the militia training site. Maybe the `findIdleProducerLocal('barracks')` returns null because the barracks construction takes more than the AI's decision interval, and the AI moves on to other priorities.
  - Confirm: log `findIdleProducerLocal('barracks')` return value across decision ticks during the test.
- [ ] **H3** — The `dispatcher.drainPendingCommands` isn't being called between ticks for the AI's intentions. Maybe the dispatcher runs in a different order than I assumed.
  - Confirm: log `pendingCommands.length` before/after `world.step()`.
- [ ] **H4** — `pickUnitMix` returns `[{ unitType: 'militia', producer: 'barracks' }]` for dark age. AI's loop calls `findIdleProducerLocal('barracks')`, gets the barracks ID (post-construction), `canAfford(food=200, militia cost=60+20)` = true, `getTrainOptions(...).includes('militia')` = true, pushes `pushQueueTrainIntention(barracksId, 'militia')`. Should fire.
  - Need to verify each predicate against actual fixture state.
- [ ] **H5** — Re-pushing every decision tick over-spends. Pre-1B: enqueueTraining synchronously appended → next AI tick saw queueLength=1 → skipped. Post-1C: pushIntention → productionQueues stays 0 until next tick → AI on next decision tick STILL sees length=0 → pushes another intention. After M decision ticks, M intentions queued. Validator pre-spend approves all. Handlers spend resources sequentially; once stockpile is empty, remaining handlers no-op. **This means food gets drained by overpush BEFORE militia even gets a chance, OR enough militia push but the resources weren't there to actually train them.**
  - Confirm: instrument `productionQueues.length` + `pendingCommands` size + `playerResources` per AI decision tick.

## Investigation log

- 2026-05-01 16:35 — Wrote initial Phase 1C refactor (3 push helpers + 8 aiSystem call sites changed). Ran full test suite. 2 AI tests failed.
- 2026-05-01 16:40 — Reverted Phase 1C changes via `git checkout HEAD -- ...`. 667 passed, clean state.
- 2026-05-01 16:50 — User asked for full Phase 1C fix. Re-implementing with pending-aware gates per H5 hypothesis (most likely root cause).
- 2026-05-01 17:00 — Added `pendingCommands` dep to aiSystem. Added per-tick lookup tables (`pendingTrainsByBuilding` / `pendingResearchKeys` / `pendingBuildsByOwner`). About to update gate sites.

## Root cause (provisional, pending verification)

H5: aiSystem's existing gates (`queueLength >= 2` / `inFlightTechByOwner.has(tech)` / `ongoingBuilds < maxConcurrentBuilds`) read state that lags pendingCommands by 1 tick. Without folding pending intentions into the gates, AI re-pushes every decision tick; the overpush drains the stockpile across the silent-no-op B2 surface, starving subsequent intentions of resources.

## Fix (in progress)

1. Add `pendingCommands` to aiSystem's deps interface + destructure (DONE).
2. Inside `aiSystem.execute`, build per-tick lookups: `pendingTrainsByBuilding` (Map<buildingId, count>), `pendingResearchKeys` (Set<`${owner}:${tech}`>), `pendingBuildsByOwner` (Map<owner, count>) (DONE).
3. Update gate sites to fold pending counts:
   - `findIdleProducerLocal`: `effectiveQueueLength = persistedLength + (pendingTrainsByBuilding.get(id) ?? 0)`. Compare against the existing >=2 threshold.
   - Age-up research: skip if `pendingResearchKeys.has(`${owner}:${nextAgeTech}`)`.
   - Per-building research loop: skip techs whose key is in `pendingResearchKeys`.
   - Villager training: include pending count in `tcQueue.length < 2` check.
   - `ongoingBuilds`: add `pendingBuildsByOwner.get(owner) ?? 0`.
4. Replace 8 call sites: `enqueueTraining` → `pushQueueTrainIntention`, `enqueueResearch` → `pushQueueResearchIntention`, `startConstruction` → `pushBuildingPlaceConfirmIntention`.
5. wireBridgeOps adds the 3 push helpers (analogous to `pushUnitAttackIntention`).
6. registerBridgeSystems + registerAllSystems plumbing updates.
7. Re-run failing AI tests in isolation. Iterate until green. Then full suite.

## Diagnosis from trace (2026-05-01 18:15)

After adding pending-queue gates AND reserved-resource gating, militia still fails to spawn. Trace at ai-rush-fixture (3000-tick budget):

- Tick 240: BARRACKS COMPLETE on the SAME tick AI's decision runs. AI sees `constructionState.isComplete=false` because construction increment runs AFTER aiSystem in the update phase. So at tick 240, AI never pushes militia.
- Tick 270: barracks visible as complete. tc-q=1 (one slot open). With reserved gating, AI pushes villager (food reserved 100→50), then militia gates fail (canAfford(50, 60) FAILS).
- Without reserved gating, AI would push BOTH villager and militia. Validators see food=100 and approve both. Handler runs villager FIRST (FIFO), spends 50 food, then militia handler runs canAfford(50, 60) → FAIL → silent no-op. Same outcome: no militia.

**Pre-1B's accidental success at tick 240** depended on: (a) barracks complete VISIBLE at tick 240 (synchronous startConstruction at tick 0, no +1 handler delay), (b) tc-q FULL (villager skipped), (c) food preserved for militia. Post-1C loses (a) due to the +1 handler delay shifting barracks completion alignment.

## Real root cause

The AI's logic relies on incidental timing collisions to train military. When food is sufficient for either villager OR militia (but not both), villager wins because it's processed first in the AI's decision order AND because the FIFO handler order matches the push order.

For a barracks-rush AI, military should be the EXPLICIT priority. The structural fix is to reorder the AI: pickUnitMix BEFORE villager training. This:
1. Makes the AI's barracks-rush strategy explicit (not dependent on accidental timing).
2. Pushes militia first → handler processes militia first → food spent on military when both are affordable.
3. Removes brittle dependence on +0/+1 tick offsets.

## Fix (revised)

Plus the existing pending-queue gates from earlier:
8. Reorder aiSystem.execute: pickUnitMix loop runs BEFORE villager training. Per-building research and monk training stay where they are (no resource competition with villager).
9. Drop reserved-resource gating; rely on the over-acceptance + handler silent-no-op pattern (DESIGN v17 §6.4 B1/B2). The pending-queue gates already prevent re-pushing the same intention while pending.

## Verification

- `npm run typecheck` ✓
- `npm run lint` ✓
- `npm run build` ✓
- `npm test -- tests/simulation/aiPlayer.test.ts` (20 tests) ✓
- `npm test -- tests/simulation/createSimulationBridge.combat.test.ts` (5 tests) ✓
- Full suite: 667 passed + 1 skipped (matches Phase 1B baseline; the 7 worker-timeout "errors" are the FU8 Windows vitest RPC flake documented in `vitest.config.ts`, not test failures).
- Bumped `tests/simulation/createSimulationBridge.ageUp.test.ts` per-test timeout from `40_000` → `60_000` on the three long age-up tests. Pre-1C they ran ~33 s in isolation; post-1C ~32 s. Under full-suite parallelism on Windows the variance pushed past the 40 s ceiling — the bump absorbs the FU8 RPC contention without changing the test logic.

## Lesson surfaced

A test that passes in isolation but fails under full-suite parallelism is not a flake to ignore — it usually means a per-tick cost change pushed cumulative duration past a tight per-test timeout. Cross-check pre-change duration in isolation against the timeout ceiling; if the margin is less than ~20 %, bump the timeout proactively (or optimize the per-tick cost) rather than committing and letting CI flake later. Filed in `docs/learning/lessons.md`.
