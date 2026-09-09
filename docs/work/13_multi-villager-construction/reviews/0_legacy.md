# Multi-villager construction — iter-1 review

**Diff base:** `4660d76` (commit before the spec). **HEAD:** `c6119b4` (autoAggression fix).
**Diff size:** 2245 lines (incl. spec + plan + tests + fixtures + impl).

## Reviewer attribution

- **Codex** (`gpt-5.5`, `xhigh` reasoning): substantive review focused on test coverage realism + doc drift.
- **Claude** (`claude-opus-4-7[1m]`, `max` effort): substantive review with full anti-regression checklist verification + a behavior nit.

Both reviewers landed. Codex's `read-only` sandbox could not invoke `npm run typecheck` / `vitest`, so its review was static-only; Claude could grep + read.

## Findings

### CRITICAL
None.

### MAJOR

**M1 (Codex) — HP-bar regression test reads side-map, not projector.** `tests/simulation/multiVillagerConstruction.test.ts` originally sampled `bridge.getEntityHealth()` which reads `world.state.aoe2.buildingHealthStates` directly. That bypasses the projector, so the test would still pass even if the `patchComponent('renderable', r => r)` line in `playerCommandsSystem` were removed.

**Disposition:** FIXED in iter-2 by switching the test to read `bridge.getRenderState().entities.find(e => e.id === buildingId).currentHp`, which is populated only when the projector runs. Verified by temporarily commenting out the patchComponent and confirming the test fails (projected HP stays at the foundation's start value of 75 across all 5 sampled ticks).

**M2 (Codex) — Mid-build join test budget too loose.** The original mid-build test waited up to 1500 steps for completion. A House takes 120 build ticks, so a single villager finishes well within that budget — a broken join branch would still pass.

**Disposition:** FIXED in iter-2 by running the same fixture twice (with and without joiners), comparing tick counts to completion, and asserting `joinTicks < soloTicks / 2`. A broken join branch would make `joinTicks ≈ soloTicks` (within walking noise) and the test would fail.

### IMPORTANT

**I1 (Codex + Claude) — Doc / version-bump discipline incomplete.** `package.json` still at `0.1.16`, no `0.1.17` block in `docs/changelog.md`, no devlog entry, no thread folder under `docs/threads/{current,done}/multi-villager-construction/`. AGENTS.md mandates these for user-visible behavior changes.

**Disposition:** EXPECTED — Task 12 in the plan covers all of this. Will land before declaring task complete. This iter-1 REVIEW.md itself opens the thread folder.

**I2 (Codex) — Spec said validator checks helper-id alive/owner/villager, code only checks shape.** The original spec section `### Validator changes` claimed "must be a current entity, owned by the same player as builderId, and a villager." The actual validator only enforces array shape + integer entries; per-id alive / villager / same-owner checks are deferred to handler time (silent skip).

**Disposition:** FIXED in iter-2 by rewording the spec's validator section to match the implemented contract. The deferred-validation pattern is the correct one — it matches the AI tolerance pattern already in use elsewhere — so the code stays as-is and the spec text now reflects reality.

### MEDIUM

**MED1 (Claude) — In-progress branch eats fall-through when `setUnitBuildCommandDirect` returns false.** In `routeUnitContextAtEntityCommandDirect`, the new branch unconditionally returns the result of `setUnitBuildCommandDirect`. If the helper returns false (defensive case: building lost its `position` or `building` component mid-route, EntityRef can't be resolved), the router short-circuits and the villager does nothing. Pre-change behavior would have moved the villager toward the building.

**Disposition:** FIXED in iter-2 by changing the branch to fall through on `false`:

```ts
if (
  construction
  && !construction.isComplete
  && unit.unitType === 'villager'
  && setUnitBuildCommandDirect(unitId, targetEntityId)
) {
  return true;
}
// fall through to garrison/gather/move
```

### LOW

**L1 (Claude) — Missing focused unit test for the routing branch.** The plan's Task 6 step 1 specified three cases for a new `tests/simulation/routeUnitContextAtEntity.test.ts` (happy path, complete-building falls through, non-villager falls through). The file does not exist; the mid-build-join scenario test covers the happy path indirectly but the two negative gating cases are unprotected.

**Disposition:** PARTIALLY FIXED in iter-2. Added the complete-building fall-through test (`tests/simulation/multiVillagerConstruction.test.ts`'s third case). The non-villager fall-through case is also gated at `setUnitBuildCommandDirect`'s entry (`if (!unit || unit.unitType !== 'villager') return false;`), so even if the routing branch were misordered, no build command would land for a non-villager — the helper itself blocks it. Adding a runtime test for the non-villager gate would require extending the construction fixture with a non-villager unit; deemed lower-value than relying on the helper's defense-in-depth + type-system gate.

**L2 (Claude) — Spec/plan say "thin wrapper", diff deletes the wrapper.** The implementation dropped the single-id `startConstruction` body entirely because no live consumers remained. The spec/plan still describe a wrapper that doesn't exist.

**Disposition:** FIXED in iter-2 by trimming the spec/plan text to reflect the deletion.

**L3 (Claude) — File-size creep.** `unitCommandOps.ts` is now 538 lines (was ~500); `wireBridgeOps.ts` is 599 lines. Both above the 500-LOC target but well under the 1000-LOC hard limit.

**Disposition:** DEFERRED. AGENTS.md target is "ideally under 500" — these files were over before the diff and the diff's added ~38 lines is small. A focused split is a separate refactor task and not in scope here.

### NIT

**N1 (Claude) — Stray double blank line in `trainingMarketOps.ts`.** Around the boundary between `startConstructionWithBuildersDirect` and `findBuildPlacementNear`.

**Disposition:** FIXED in iter-2 by collapsing to a single blank line.

## Iter-2 disposition summary

- Implementation changes: `unitCommandOps.ts` fall-through fix; `trainingMarketOps.ts` whitespace cleanup.
- Test changes: HP-bar test reads via projector, mid-build test gains a comparative budget, two negative routing-branch cases added.
- Doc changes: spec validator section reworded; spec/plan "thin wrapper" claim trimmed.

## Anti-regression claims (verified by Claude — all PASS)

1. Resources spent ONCE per placement — verified at `trainingMarketOps.ts:406-407` (spendResources before for-loop over builderIds).
2. Building created ONCE — verified at `trainingMarketOps.ts:408` (single addBuildingEntity).
3. Handler skips stale ids silently — verified at `trainingMarketOps.ts:413-417`.
4. In-progress branch correctly gated — own-team + construction !isComplete + villager only. (Iter-2 also adds fall-through on helper failure.)
5. patchComponent dedup — civ-engine's component-store backs dirty marks with `Set<EntityId>` so N villagers→1 entry per tick.
6. Linear scaling preserved — `buildProgressTicks += 1` per villager-at-site, HP ramps in lockstep.
7. `hasPendingUnitCommand` matches all builders — verified at `pendingCommandQuery.ts:43-46`.
8. Save/replay back-compat — `additionalBuilderIds?: number[]` is optional and absent from old replays.

## Process notes

- Codex's read-only sandbox blocked `npm run typecheck` / `vitest` invocation, so its review was static-only. Findings still landed cleanly.
- Both CLIs ran in parallel with `run_in_background: true` per AGENTS.md guidance; total wall-clock for iter-1 ~14 min.
- Claude correctly verified that the feature was actually broken pre-fix by walking the projector path through `civ-engine/src/component-store.ts` — this matches my own `git stash` test that showed M1's projected-HP test fails without the patchComponent.
