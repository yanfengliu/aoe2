Now I have enough to write the verdict.

```
VERIFICATION REVIEW — agent/review-findings-2026-04-26-iter2-batch1 (8d20013 → ce4e81a)

═══════════════════════════════════════════════════════════════════════════
PER-FINDING VERDICTS
═══════════════════════════════════════════════════════════════════════════

V5-1  monksByOwner side map for AI monk skip-guard ............. OK
V5-2  villagerRebalance zero-target trap ............ REVERTED-VALID
V5-3  GameScene.ts ALL_UNIT_TYPES extraction ................... OK
V5-4  saveLoadPanel localStorage failure fallback .............. OK
V5-5  Doc reconciliation (ARCHITECTURE / AGENTS / summary) ..... OK
V5-6  V4-7 throttle test strengthened to use real id ........... OK
V5-7  V4-14 missed-clear test (no code change) ...... REVERTED-VALID
V5-8  Batch findIdleProducer per AI per decision tick .......... OK

Docs/version commits .................................. OK
  - package.json 0.1.1 → 0.1.2
  - docs/changelog.md 0.1.2 entry for V5-4 (only user-visible fix in batch)
  - docs/devlog/summary.md + detailed devlog updated
  - docs/architecture/drift-log.md row appended

═══════════════════════════════════════════════════════════════════════════
V5-1 INVARIANT VERIFICATION (33 BridgeState entries)
═══════════════════════════════════════════════════════════════════════════

Monk creation paths — ALL funnel through addUnitEntity:
  - entityCreateOps.addUnitEntity:152-159  (only world.addComponent(_, 'unit') call site in src)
  - scenarioSeedOps.ts:301        (calls addUnitEntity)
  - productionQueueSystem.ts:99   (calls addUnitEntity)
  - hydrateFromSavedGame.ts:303-312  (rebuilds side map post-load)
  ✓ no monk creation bypasses the side-map update.

Monk destruction paths — ALL funnel through destroyUnitEntity:
  - playerCommandsSystem.ts:220, towerCombatSystem.ts:118,
    wildlifeCombatSystem.ts:115  (combat damage paths)
  - entityDestroyOps.destroyBuildingEntity:138-140  (garrisoned units cascade)
  - Only world.destroyEntity() callers in src are inside entityDestroyOps.ts:131,228,264
  ✓ no monk destruction bypasses the side-map update.

Owner-mutation paths:
  - grep for `unit\.owner =` finds only monkTaskAppliers.flipConvertedUnit
  - flipConvertedUnit:179-193 correctly removes from previousSet (deletes the
    key entirely if size becomes 0) AND adds to nextSet (creates if absent)
  - Early-return in applyMonkConvert:119 guarantees previousOwner !== monkUnit.owner
    when flipConvertedUnit is reached, so the prior-owner-deleted edge case is
    well-defined (different keys; deleting one cannot affect the other).
  ✓ conversion path correct including the "prior owner's set deleted" case.

Save/load determinism:
  - monksByOwner is NOT in saveGameOps (verified — grep found no reference).
    Rebuilt deterministically in hydrateFromSavedGame:303-312 by iterating
    world.query('unit'). Iteration order is entity-id ascending, but values
    are owner-keyed Sets, so order does not affect Set membership.
  ✓ no determinism concern.

═══════════════════════════════════════════════════════════════════════════
V5-8 BATCH-PRECOMPUTATION SOUNDNESS
═══════════════════════════════════════════════════════════════════════════

Result equivalence with prior closure-form findIdleProducer:
  - OLD walked world.query('building'), filtered by owner + type, applied same
    construction/queueLength filters and same load-balanced selection.
  - NEW precomputes ownerBuildingsByType once via single world.query('building')
    walk, then the per-type lookup applies identical filters and selection.
  - Iteration order is identical (precomputed lists are pushed in
    world.query('building') order, filtered by owner). Even if not, the
    `(queueLength === bestQueueLength && bestId !== null && id < bestId)`
    tiebreak makes the result order-independent (always lowest id wins on tie).
  ✓ V3-24 LEAST-LOADED-with-id-tiebreak contract preserved verbatim.

Newly-constructed buildings within the same decision tick:
  - aiSystem precomputes ownerBuildingsByType BEFORE the build-target loop.
  - startConstruction (creates incomplete building) might add a new building
    within the same tick, NOT in the precomputed map.
  - But findIdleProducerLocal would have filtered it out anyway via the
    `if (construction && !construction.isComplete) continue` check — same
    filter the old code applied to the same building.
  - Buildings transition incomplete→complete only in the construction system,
    which runs in a separate phase — not within an AI's decision tick.
  - ownerBuildingsByType is rebuilt per-owner inside the aiStates loop, so a
    later AI in the same world tick sees buildings the earlier AI created.
  ✓ no missed buildings.

Type/dep cleanup:
  - findIdleProducer fully removed from aiDecisionOps.ts deps,
    RegisterAllSystemsDeps, AiSystemDeps, registerAllSystems.ts call site.
  - All 3 use sites in aiSystem.ts (line 397, 416, 435) call findIdleProducerLocal.
  - grep finds no dangling references.
  ✓ clean removal.

═══════════════════════════════════════════════════════════════════════════
GATES (verified just now)
═══════════════════════════════════════════════════════════════════════════

  - npx tsc --noEmit — clean (no output).
  - tests/simulation/aiPlayer.test.ts (20) + monkConversion.test.ts (1)
    + saveLoad.test.ts (10) — 31/31 passed.
  - The single Vitest "Timeout calling onTaskUpdate" unhandled error is the
    documented birpc flake unrelated to the diff.

═══════════════════════════════════════════════════════════════════════════
NEW ISSUES INTRODUCED BY THE FIX BATCH
═══════════════════════════════════════════════════════════════════════════

None of severity ≥ Medium. Two Low/Nit observations:

[Low] aiDecisionOps.AiDecisionDeps still requires `state: BridgeState` but the
factory body no longer destructures it (the `state` consumers were
constructionStates / productionQueues, both used only by the deleted
findIdleProducer). The dep is dead but still required at the call site.
Cleanup: drop `state` from AiDecisionDeps and the corresponding pass site.
Not a correctness issue — purely a dead-dep nit.
File: src/game/simulation/bridge/aiDecisionOps.ts:18-32, 58-59

[Low] V5-4 saveLoadPanel: when localStorage succeeds, the toast still says
"Game saved." but the download fallback ALSO fires (was already true pre-V5-4
— triggerBlobDownload was unconditional after the localStorage write). The
"Game saved" toast text doesn't communicate the user is also getting a file
download. Not a regression introduced by V5-4 (preserved from prior behavior),
but worth noting since the V5-4 commit makes the dual behavior more obvious by
putting the download outside the storage-success branch.

═══════════════════════════════════════════════════════════════════════════
INVARIANT REGRESSIONS FROM PAST ITERATIONS
═══════════════════════════════════════════════════════════════════════════

None detected. Spot-checked:
  - V4-14 tick-tagged guard (monkConvertProcessedThisTick, Map<id, tick>) —
    intact at monkTaskAppliers.ts:141-149, monkBehaviorSystem.ts:99-101.
  - V3-8 orphan-key prune in hydrateFromSavedGame.ts:323-330 still walks the
    same entity-id-keyed maps; monksByOwner correctly excluded (owner-keyed,
    not entity-id-keyed at the top level — Set values are entity-ids that are
    rebuilt from live world.query('unit')).
  - V3-24 load-balanced LEAST-LOADED producer with id-tiebreak — preserved
    in findIdleProducerLocal at aiSystem.ts:244-263.
  - V4-7 throttle field gathererDropOffStuckSinceTick — schema, save, load,
    and orphan-prune all intact; round-trip now actually tested (V5-6).
  - V4-12's intent (skip when no Monks) is preserved via O(1) side-map
    lookup; the cost regression that V5-1 closes is actually closed
    (no countOwnedUnits call remains for the Monk gate).

═══════════════════════════════════════════════════════════════════════════
SUMMARY
═══════════════════════════════════════════════════════════════════════════

All 8 findings dispositioned correctly. Six fixes (V5-1, V5-3, V5-4, V5-5,
V5-6, V5-8) land cleanly with sound design. Two non-fixes (V5-2, V5-7) are
correctly REVERTED-VALID with inline rationale documented in the relevant
source. Doc + version bump consistent with AGENTS.md scope (V5-4 is the only
user-visible fix in the batch, gets the 0.1.2 bump and the lone changelog
entry; the rest are pure cleanups / efficiency / test-strengthening).

The batch is ready to merge. The two Low/Nit observations are sweep-with-next-
batch material, not blockers.
```
