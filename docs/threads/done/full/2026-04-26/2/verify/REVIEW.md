# Iter-2 Verification Review — 2026-04-26

**Reviewers (verification round):** Codex (`gpt-5.4` xhigh, `--sandbox read-only --ephemeral`), Gemini (`gemini-3.1-pro-preview` `--approval-mode plan`), Claude (`opus` xhigh, with diff piped via stdin). Each got the iter-2 REVIEW.md plus the diff `8d20013..ce4e81a` (V5-1, V5-3, V5-4, V5-5, V5-6, V5-8 + docs/version commits) and was asked to verify each finding's disposition + flag any new issues introduced by the fix batch.

**HEAD reviewed:** `ce4e81a` on `agent/review-findings-2026-04-26-iter2-batch1`.

---

## Cross-reviewer convergence

All three reviewers agreed: **all 8 findings dispositioned correctly. No new issues of severity ≥ Medium introduced.** Two Low/Nit observations (Claude only).

| Finding | Codex | Gemini | Claude |
|---|---|---|---|
| V5-1 monksByOwner side map | OK | OK | OK |
| V5-2 villagerRebalance trap | REVERTED-VALID | REVERTED-VALID | REVERTED-VALID |
| V5-3 unitTypeMap extraction | OK | OK | OK |
| V5-4 save fallback download | OK | OK | OK |
| V5-5 doc reconciliation | OK | OK | OK |
| V5-6 throttle test strengthen | OK | OK | OK |
| V5-7 V4-14 missed-clear | REVERTED-VALID | REVERTED-VALID | REVERTED-VALID |
| V5-8 batch findIdleProducer | OK | OK | OK |

---

## V5-1 invariant verification (Claude — most thorough check)

Walked all 33 entries in `BridgeState`. Verified:

**Monk creation paths all funnel through `addUnitEntity`:**
- `entityCreateOps.addUnitEntity:152-159` — only `world.addComponent(_, 'unit')` call site in `src/`
- `scenarioSeedOps.ts:301` — calls addUnitEntity
- `productionQueueSystem.ts:99` — calls addUnitEntity
- `hydrateFromSavedGame.ts:303-312` — rebuilds side map post-load

**Monk destruction paths all funnel through `destroyUnitEntity`:**
- Combat damage paths (`playerCommandsSystem`, `towerCombatSystem`, `wildlifeCombatSystem`) all call `destroyUnitEntity`
- `entityDestroyOps.destroyBuildingEntity` cascade for garrisoned units
- Only `world.destroyEntity()` callers in `src/` are inside `entityDestroyOps.ts`

**Owner-mutation path (conversion):** `monkTaskAppliers.flipConvertedUnit:179-193` correctly removes from previousSet (deletes the key entirely if size becomes 0) AND adds to nextSet (creates if absent). The early-return in `applyMonkConvert:119` (target.owner === monk.owner) guarantees previousOwner ≠ monkUnit.owner when flipConvertedUnit is reached.

**Save/load determinism:** `monksByOwner` is NOT in `saveGameOps`. Rebuilt deterministically in `hydrateFromSavedGame:303-312` by iterating `world.query('unit')`. Iteration order is entity-id ascending, but values are owner-keyed Sets, so order does not affect Set membership.

---

## V5-8 batch-precomputation soundness (Claude)

**Result equivalence with prior closure-form findIdleProducer:**
- OLD walked `world.query('building')`, filtered by owner + type, applied same construction/queueLength filters and same load-balanced selection.
- NEW precomputes `ownerBuildingsByType` once via single `world.query('building')` walk, then per-type lookup applies identical filters.
- Iteration order is identical. Even if not, the `(queueLength === bestQueueLength && bestId !== null && id < bestId)` tiebreak makes the result order-independent (always lowest id wins on tie).
- V3-24 LEAST-LOADED-with-id-tiebreak contract preserved verbatim.

**Newly-constructed buildings within the same decision tick:**
- `aiSystem` precomputes `ownerBuildingsByType` BEFORE the build-target loop.
- `startConstruction` (creates incomplete building) might add a new building within the same tick, NOT in the precomputed map.
- `findIdleProducerLocal` would have filtered it out anyway via `if (construction && !construction.isComplete) continue` — same filter the old code applied.
- Buildings transition incomplete→complete only in the construction system, which runs in a separate phase — not within an AI's decision tick.
- `ownerBuildingsByType` is rebuilt per-owner inside the `aiStates` loop, so a later AI in the same world tick sees buildings the earlier AI created.

**Type/dep cleanup:** `findIdleProducer` fully removed from `aiDecisionOps`, `RegisterAllSystemsDeps`, `AiSystemDeps`, `registerAllSystems` call site. All 3 use sites in `aiSystem.ts` call `findIdleProducerLocal`. No dangling references.

---

## Low/Nit observations (Claude)

### [Low] `aiDecisionOps.AiDecisionDeps` still requires `state: BridgeState` but the factory body no longer destructures it.

The `state` consumers were `constructionStates` / `productionQueues`, both used only by the deleted `findIdleProducer`. The dep is dead but still required at the call site. Cleanup: drop `state` from `AiDecisionDeps` and the corresponding pass site.

**Fix shape:** ~5-line cleanup. Applied in commit `5cc7ed0` (sweep).

### [Low] `triggerBlobDownload(json)` runs even on success in `saveLoadPanel.handleSaveClick`

When localStorage succeeds, the toast still says "Game saved." but the download fallback ALSO fires (was already true pre-V5-4 — `triggerBlobDownload` was unconditional after the localStorage write). The "Game saved" toast text doesn't communicate the user is also getting a file download. Not a regression introduced by V5-4 (preserved from prior behavior), but worth noting.

**Fix shape:** Either change the success-path toast text to "Game saved (storage + downloaded)." OR gate the download fallback to only fire on storage failure. Not actioned in this batch — V5-4's contract is "always preserve the save." The existing dual-write is intentional (download is durable, localStorage is convenient).

---

## New issues (Codex + Gemini + Claude)

**None of severity ≥ Medium.** No type holes, save/load determinism breaks, or invariant regressions detected.

Spot-checks performed:
- V4-14 tick-tagged guard intact
- V3-8 orphan-key prune intact (`monksByOwner` correctly excluded — owner-keyed at top level, rebuilt from world)
- V3-24 load-balanced LEAST-LOADED producer contract preserved in `findIdleProducerLocal`
- V4-7 throttle field schema/save/load/orphan-prune all intact; round-trip now actually tested (V5-6)
- V4-12 intent (skip when no Monks) preserved via O(1) side-map; cost regression actually closed

---

## Verification gates (re-confirmed)

- `npx tsc --noEmit` clean
- `npm run lint` clean
- `npx vite build` clean (3.68 s)
- `npx vitest run` 51/51 files, 407 passed + 1 skipped, 0 failed (the 6 "Timeout calling onTaskUpdate" unhandled errors are the documented Windows birpc flake)

---

## Summary

The iter-2 batch is verified ready to merge. Three reviewers converge that all 8 findings landed correctly, the V5-1 invariant holds across the full BridgeState surface, the V5-8 precomputation preserves the V3-24 selection contract verbatim, and no new issues of any severity ≥ Medium were introduced.

The two Low/Nit Claude observations are: (a) a dead `state` dep in `AiDecisionDeps` (cleanup applied as `5cc7ed0`), (b) the dual save+download behavior on success path was already pre-existing — not actioned because the "always preserve the save" contract is intentional.

**Disposition:** branch `agent/review-findings-2026-04-26-iter2-batch1` is at the tip awaiting user authorization to merge to main.
