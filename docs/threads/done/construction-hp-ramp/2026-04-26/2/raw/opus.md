Verification complete. Here are my findings.

---

## Iter-2 Review — `agent/construction-hp-ramp`

### (a) Completion replaces force-set with `min(maxHp, round(currentHp))` — VERIFIED, damage preserved end-to-end

`playerCommandsSystem.ts:394-402` is correct. End-to-end trace:
- Per-tick add (`buildingHealth.currentHp + hpPerTick`) is additive on the live value, not recomputed from progress, so any combat damage applied to `buildingHealthStates` (e.g. `playerCommandsSystem.ts:321` `targetHealth.currentHp -= …`) survives subsequent build ticks.
- Completion clamp `min(maxHp, round(currentHp))` only collapses sub-1 fractional drift; it cannot revive damage. Worst case is a ≤0.5 HP "free heal" from rounding the fractional construction-tick adds when damage was integer — not material at AoE2 damage granularity.
- Combat path `playerCommandsSystem.ts:280-332` has no `isComplete` check on the building-attack branch, so foundations take damage during construction normally.
- `destroyBuildingEntity` (`entityDestroyOps.ts:135`) cleans `constructionStates`, `buildingHealthStates`, `buildingCombatStates`, garrison, etc. unconditionally — destroying a foundation mid-construction is safe.

### (b) `findPreferredEnemyBuildingInRadius` skip removed — VERIFIED, but stale JSDoc not updated (REAL FINDING)

The function body change at `targetFindingOps.ts:459-465` is correct. The companion `findNearestDropOffBuilding` (line 352-355) intentionally keeps its `!isComplete` skip, which is correct — you cannot drop resources at a foundation.

**However, the interface JSDoc at `targetFindingOps.ts:92-96` is now stale:**

```
  // Personal-LOS variant of `findPreferredVisibleEnemyBuilding`. Same
  // contract as `findPreferredEnemyUnitInRadius` for buildings, with
  // construction-incomplete buildings filtered out (you cannot attack
  // a partially-built building anyway and they are an off-by-one
  // gameplay footgun for auto-aggression).
  findPreferredEnemyBuildingInRadius(
```

The diff for `targetFindingOps.ts` only removed the function-body filter; it did not touch this JSDoc. The comment now lies about the helper's behavior on the `TargetFindingOps` interface (the canonical "API contract" for this module). AGENTS.md's documentation-discipline section explicitly mandates the multi-CLI review verify "docs in the diff match implementation; flag any stale signatures, removed APIs still mentioned" — this is exactly that case. Severity: LOW-MEDIUM. Fix: update the JSDoc to drop the "filtered out" sentence and reflect that foundations are now valid auto-aggression targets per the canonical-AoE2 ruling.

(Note: `docs/superpowers/specs/2026-04-24-aggressive-military-design.md:90` also says "construction-complete" but that's a date-stamped historical design spec, not living documentation per AGENTS.md's canonical-surface list. Not flagging it.)

No test/invariant breakage from removing the filter: I scanned `tests/simulation/` and there is no test that asserts the previous "skip foundations" contract (it was never test-covered, only commented).

### (c) `selectionPanel` floors `selectionState.health.current` — VERIFIED, safe

`selectionPanel.ts:266` `${Math.floor(selectionState.health.current)} / ${selectionState.health.max}` is correct. `current` is the only fractional surface (the per-tick ramp produces e.g. `41.857…` for a House); `max` is integer by construction (`buildingMaxHp` returns ints). Floor on display only, bridge value stays raw, health-bar fill ratio stays smooth as the devlog claims.

### (d) New save/load mid-construction test — VERIFIED, exercises the contract

`createSimulationBridge.darkAge.test.ts` (the new "preserves mid-construction HP across save/load round-trip" case) properly:
- Places a House foundation, steps until `buildProgressTicks` is in the 30%-70% window (a band wide enough that single-builder progress-per-tick of 1 always lands inside it).
- Captures `savedHealth` from the live bridge.
- Round-trips through `saveGame()` / `createSimulationBridge(DEFAULT_SEED, { savedGame: blob })` (which uses `hydrateFromSavedGame`, not `addBuildingEntity`, per the iter-1 verification).
- Asserts `restoredHealth.currentHp === savedHealth.currentHp` and `maxHp` match, and `buildProgressTicks` round-trips.

The test contract matches the persistence path: `saveGameOps.ts:235-238` does `{...state}` which preserves the float; JSON round-trip handles the IEEE-754 double exactly. The `expect(savedHealth.currentHp).toBeGreaterThan(7)` floor matches `startHp = max(1, floor(75 * 0.1)) = 7`.

The companion ramp test is also well-formed: `placed.isComplete === false` → `initialHealth.currentHp < 20% maxHp` → mid-build health monotonically increases → `finalHealth = {currentHp: 75, maxHp: 75}` exact equality (which holds because `min(75, round(74.999…)) = 75` even with float drift in the per-tick adds).

### Anti-regression — AI / villager / multi-builder

- **AI:** no regression. `aiSystem.ts:518` calls `findPreferredVisibleEnemyBuilding` (the visible-LOS variant), which has *never* filtered by `isComplete` (verified by reading `targetFindingOps.ts:289-334`). AI was already capable of attacking visible foundations; the HP ramp simply makes them die faster, which is the intended behavior change.
- **Villager:** no regression. `autoAggressionSystem.ts:115-117` short-circuits villagers out of the building-target branch, so the iter-1 change cannot derail a villager. Villager *builders* mutate the shared `buildingHealthStates.get(buildingId)` reference — multiple builders see the same object, so there is no torn-write hazard.
- **Multi-builder:** no regression. Each builder in the same tick increments `construction.buildProgressTicks` and adds `hpPerTick` to the shared `buildingHealth` object reference (`Map.get` returns the same `{currentHp, maxHp}` reference for every caller). Once any builder triggers the completion path (sets `isComplete = true` and applies the round-clamp), subsequent builders' iterations hit the `construction.isComplete` early-exit at `playerCommandsSystem.ts:374` and clear their commands. Correct sequencing.

### Coverage gap (residual from iter-1, not a new finding)

`tests/simulation/autoAggression.test.ts` does not contain any case asserting that an idle military unit auto-engages an enemy foundation. The iter-1 fix added a save/load coverage gap fix but did not add an auto-aggression-vs-foundation regression test. I'm noting this only because the iter-1 review explicitly listed "thin coverage" as a finding and this slice of the contract is the one most likely to silently regress later (e.g. if someone re-introduces the skip thinking it's a guard against off-by-one bugs).

### No issues on

- Iter-1 fix to `entityCreateOps.ts` (`fullHp` factored, `isComplete` ternary correct on both branches).
- `hydrateFromSavedGame.ts` direct `buildingHealthStates.set` round-trip (still verified against the new save/load test).
- Per-tick `markOutOfBandRenderChange` is correctly *absent* from the construction-tick HP write (the `RenderAdapter` re-projects per tick, so no explicit refresh needed; explicit refresh is reserved for the off-tick completion-tint mutation at `playerCommandsSystem.ts:408`).
- Changelog 0.1.4 entry, devlog detailed entry, and `summary.md` head entry all match the implementation.

### Bottom line

One real new finding: **stale JSDoc at `targetFindingOps.ts:92-96`** — the interface comment still claims foundations are filtered out. Iter-1 fixes otherwise landed cleanly with no regressions on AI / villager / multi-builder paths. Reviewers can nitpick from here; nothing else is bug-class.
