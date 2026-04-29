diff --git a/docs/changelog.md b/docs/changelog.md
index 879e58d..2cd987d 100644
--- a/docs/changelog.md
+++ b/docs/changelog.md
@@ -2,6 +2,12 @@
 
 User-visible behavior changes only. Pure refactors, doc sweeps, type-safety hardening, and efficiency wins with no observable effect are recorded in `docs/devlog/` instead.
 
+## 0.1.4 — 2026-04-26
+
+### Fixed
+
+- **Building HP now ramps from low at placement to full at construction completion (canonical AoE2).** Previously a freshly placed foundation spawned at full max HP, then completion was a no-op on the health bar. The foundation now starts at ~10% of max HP and gains `(maxHp − startHp) / totalBuildTicks` per construction tick, reaching exactly max HP when the builder finishes. Damage taken during construction is preserved (HP increments add to the current value rather than overwriting it). Affects every constructable building (House, Mill, Barracks, Castle, Wonder, …); doesn't apply to scenario-seeded `isComplete: true` buildings.
+
 ## 0.1.3 — 2026-04-26
 
 ### Fixed
diff --git a/docs/devlog/detailed/2026-04-26_2026-04-26.md b/docs/devlog/detailed/2026-04-26_2026-04-26.md
index 00ff125..2cb55c6 100644
--- a/docs/devlog/detailed/2026-04-26_2026-04-26.md
+++ b/docs/devlog/detailed/2026-04-26_2026-04-26.md
@@ -1,5 +1,27 @@
 # 2026-04-26
 
+## Building HP ramps from low to full during construction (0.1.4)
+
+**Action:** User reported that buildings under construction should have their health going from 0 to full as they are being built. Pre-fix, `addBuildingEntity` set `currentHp = buildingMaxHp(buildingType)` at creation regardless of `isComplete`, so foundations spawned at full HP and the per-tick build counter never touched the health bar. Canonical AoE2: foundation starts low (~10% of max HP) and ramps to full as construction completes; partially built foundations are vulnerable.
+
+**TDD:** New vitest case `ramps building HP from low at placement to full at construction completion` in `tests/simulation/createSimulationBridge.darkAge.test.ts`. Asserts a placed House (max HP 75) starts at `currentHp < 0.2 * maxHp`, mid-construction sits strictly between start and max, and finishes at exactly `{ currentHp: 75, maxHp: 75 }`. Test ran red against the old `currentHp: buildingMaxHp(buildingType)` placement, then green after the fix.
+
+**Implementation:**
+- `src/game/simulation/bridge/entityCreateOps.ts` (`addBuildingEntity`): when `!isComplete`, initial `currentHp = max(1, floor(maxHp * 0.1))`. When `isComplete` (scenario-seeded already-built or load-restored), still spawns at full HP.
+- `src/game/simulation/bridge/systems/playerCommandsSystem.ts` (build-command branch): each construction tick adds `(maxHp − startHp) / totalBuildTicks` to `currentHp`, clamped at `maxHp`. At completion the value is force-set to `maxHp` to absorb floating-point drift from the per-tick adds. Damage taken during construction is preserved because the per-tick increment adds to the live value rather than recomputing from progress.
+
+**Why ramp instead of `floor(maxHp * progress/total)`:** the additive form preserves damage taken during construction. If a Scout chips the foundation to 5/75 at 50% built, the next build tick adds ~0.57 HP — the foundation rebuilds from where the damage left it instead of jumping back to the formula's expected 41/75.
+
+**Render integration:** the existing health-bar renderer (`src/phaser/scenes/gameScene/worldLayers.ts:renderEntityHealthBars`) already paints any entity with a known `currentHp` / `maxHp` pair, so the foundation's ramping HP shows up on the existing bar with no changes. The bar fill color (green > 0.6, yellow > 0.3, red ≤ 0.3) means a fresh foundation is red until construction lifts it past 30%, which gives the player a visual cue that the foundation is fragile.
+
+**No `markOutOfBandRenderChange()` on per-tick HP updates.** Initial implementation called it on every construction tick, which slowed `ai-rush-fixture` past its 10s test timeout (the `RenderAdapter` already re-projects per tick, so the per-tick `currentHp` change flows through naturally; explicit out-of-band refresh is only needed for off-tick mutations). Dropping the call brought the AI fixture back inside its budget.
+
+**Save/load:** untouched — `buildingHealthStates` is already persisted in the `SaveBlob` (`src/game/simulation/saveSchema.ts:192`), so a save mid-construction round-trips the foundation's current HP value as-is.
+
+**Result:** All four gates green. `npx tsc --noEmit` clean, `npm run lint` clean, `npx vitest run` **52/52 files, 414 passed + 1 skipped, 0 failed** (6 pre-existing Windows `[vitest-worker]: Timeout calling "onTaskUpdate"` errors unrelated), `npm run build` clean (3.39s). Version 0.1.3 → 0.1.4 (non-breaking user-visible bug fix).
+
+**Notes:** No architecture / API surface change — same `getEntityHealth(id)` returns the new ramping value for foundations. No engine ask. No multi-AI review run on this single-file behavior fix; the existing test covers the contract end-to-end. Code reviewer subagents not dispatched per the AGENTS.md "subagent dispatch is a tool, not a mandate" guidance — single-file behavior change with TDD coverage stayed in the main thread.
+
 ## `/full-review` iteration 1 + batch-1 fixes (12+ findings, V4-1 → V4-19, V4-21)
 
 **Action:** First full-codebase multi-AI review of the day, after the 42-commit `createSimulationBridge.ts` shrink session merged to main earlier.
diff --git a/docs/devlog/summary.md b/docs/devlog/summary.md
index 763e0b6..134e4a7 100644
--- a/docs/devlog/summary.md
+++ b/docs/devlog/summary.md
@@ -1,4 +1,5 @@
 ## 2026-04-26
+- **Building HP ramps from low to full during construction (canonical AoE2):** foundations now spawn at `max(1, floor(maxHp * 0.1))` and gain `(maxHp − startHp) / totalBuildTicks` per construction tick, clamped to `maxHp` and force-set at completion. Damage taken mid-build is preserved because the per-tick increment adds to the live value. Affects `addBuildingEntity` initial HP (`!isComplete` branch) and the build-command branch in `playerCommandsSystem`. Existing health-bar renderer (worldLayers.ts) picks up the change with no render-side edits — fresh foundations render in red and shift to yellow/green as construction passes the 30%/60% color thresholds. TDD: new case `ramps building HP from low at placement to full at construction completion` in `createSimulationBridge.darkAge.test.ts` (House max HP 75, asserts < 0.2× max at placement, mid-build strictly between start and max, exactly 75/75 at completion). One iteration round caught a 10s timeout regression in `ai-rush-fixture` from a stray `markOutOfBandRenderChange()` per build tick — dropped because `RenderAdapter` already re-projects per tick. Save/load round-trips through the existing `buildingHealthStates` save field. Version 0.1.3 → 0.1.4 (non-breaking user-visible bug fix). Final gates: `npx tsc --noEmit` clean, `npm run lint` clean, `npx vitest run` **52/52 files, 414 passed + 1 skipped, 0 failed** (6 pre-existing Windows `onTaskUpdate` worker warnings unrelated), `npm run build` clean (3.39 s).
 - **Engine fail-fast handler (deferred-item closeout):** `world.step()` now wrapped via new `bridge/tickHaltGuard.ts` helper (`createTickHaltState` + `tryTick`). Catches `WorldTickFailureError` (engine fail-fast since v0.4.0), captures `{tick, phase, code, systemName, message}` into `haltState.halted`, logs one-line `console.error`, halts further ticks for the session. New `HudState.engineHalted: EngineHaltDetails | null` field surfaces the halt to HUD/debug overlay. Does NOT call `world.recover()` — fail-fast intentional, recovery would mask logic bugs. Non-engine exceptions rethrow. Closes the gap noted in the 2026-04-25 `civ-engine` 0.5.3 migration entry; today's `/check-engine` audit confirmed it was the only outstanding item across 0.5.4 → 0.7.6 (current `node_modules/civ-engine`). TDD: 6-case test in `tests/simulation/tickHaltGuard.test.ts` (clean tick, halt with details + log, fallback to `failure.message` when `failure.error` null, null `systemName` preserved, post-halt no-op, non-engine rethrow). Save schema untouched. Version 0.1.2 → 0.1.3 (non-breaking user-visible). Final gates: `npx tsc --noEmit` clean, `npm run lint` clean, `npx vitest run` **52/52 files, 413 passed + 1 skipped, 0 failed** (7 pre-existing Windows `[vitest-worker]: Timeout calling "onTaskUpdate"` errors unrelated), `npm run build` clean (4.23 s).
 - **Iter-2 multi-AI review + batch-1 fixes:** ran the second `/full-review` of the day after iter-1 batch landed (`608048f` → `8d20013`). Reviewers Codex `gpt-5.4` xhigh, Gemini `gemini-3.1-pro-preview` `--approval-mode plan`, Claude `opus` xhigh. Synthesized to `docs/reviews/full/2026-04-26/2/REVIEW.md`. Fixed: V5-1 `monksByOwner` side map closes the V4-12 regression (`countOwnedUnits(owner, 'monk')` walked the same query the guard was meant to avoid; AI with monks did 2 walks instead of 1). V5-3 `GameScene.ts` 1034 → 994 LOC by extracting `ALL_UNIT_TYPES` to `gameScene/unitTypeMap.ts` (under the strict 1000 LOC ceiling). V5-4 `saveLoadPanel.handleSaveClick` falls back to `triggerBlobDownload` when `localStorage.setItem` throws (private browsing, quota); new browser regression test. V5-5 doc reconciliation: `ARCHITECTURE.md:11` HTTP API line, AGENTS.md `docs/api-reference.md`/`docs/guides/`/`docs/README.md` mandates relaxed (mirror V4-22), `summary.md:3` V4-22 carry-forward dropped. V5-6 strengthens V4-7 throttle test to use a real villager id (was schema-presence only). V5-8 batches `findIdleProducer` building lookups (single `ownerBuildingsByType` scan replaces 10-14 full-world building scans per AI per decision tick); drops unused `findIdleProducer` from `aiDecisionOps` and deps. Considered + dropped: V5-2 villagerRebalance zero-target trap (load-bearing for AI dark-age gold accumulation — fix breaks AI age progression), V5-7 V4-14 missed-clear test (correct-by-construction). Branch `agent/review-findings-2026-04-26-iter2-batch1`.
 - **`createSimulationBridge.ts` shrink — 42 commits, 7606 → 332 lines (96% reduction):** the Phase 4 (18 ECS systems extracted to `bridge/systems/*` plus 9 helper-ops modules under `bridge/`) + Phase 5 (9 more ops modules) extractions plus a follow-up sweep — `createWorld` moved to `bridge/createWorld.ts`, side-map ownership hoisted into `bridge/bridgeState.ts`, `wireBridgeOps` / `wirePostSeedOps` / `assembleBridgeApi` / `registerAllSystems` / `registerBridgeSystems` / `scenarioSeedOps` / `hydrateFromSavedGame` extracted, `monkTaskOps` split into `monkAiSearchHelpers` + `monkTaskAppliers`, render-state assembly extracted to `renderStateOps`, spatial finders extracted to `selectionFinders`. The remaining `createSimulationBridge.ts` is a thin facade. Pattern: flat dep-bag factory closing over the single `BridgeState` instance. Determinism preserved: 18 systems still register in the same order (driven by explicit `before`/`after` deps, not registration sequence). Branch `agent/split-simulation-bridge` (commits `46c7810` → `4cbc1bf`).
diff --git a/package.json b/package.json
index 802e44b..260f8cb 100644
--- a/package.json
+++ b/package.json
@@ -1,6 +1,6 @@
 {
   "name": "aoe2",
-  "version": "0.1.3",
+  "version": "0.1.4",
   "private": true,
   "type": "module",
   "scripts": {
diff --git a/src/game/simulation/bridge/entityCreateOps.ts b/src/game/simulation/bridge/entityCreateOps.ts
index af2873e..351037d 100644
--- a/src/game/simulation/bridge/entityCreateOps.ts
+++ b/src/game/simulation/bridge/entityCreateOps.ts
@@ -220,9 +220,10 @@ export function createEntityCreateOps(deps: EntityCreateOpsDeps): EntityCreateOp
       footprintHeight: footprint.height,
       visualVariant: isComplete ? 'complete' : 'construction',
     });
+    const fullHp = buildingMaxHp(buildingType);
     buildingHealthStates.set(entity, {
-      currentHp: buildingMaxHp(buildingType),
-      maxHp: buildingMaxHp(buildingType),
+      currentHp: isComplete ? fullHp : Math.max(1, Math.floor(fullHp * 0.1)),
+      maxHp: fullHp,
     });
 
     if (buildingType === 'town-center') {
diff --git a/src/game/simulation/bridge/systems/playerCommandsSystem.ts b/src/game/simulation/bridge/systems/playerCommandsSystem.ts
index a5bc87c..167b029 100644
--- a/src/game/simulation/bridge/systems/playerCommandsSystem.ts
+++ b/src/game/simulation/bridge/systems/playerCommandsSystem.ts
@@ -382,9 +382,21 @@ export function registerPlayerCommandsSystem(deps: PlayerCommandsSystemDeps): vo
         }
 
         construction.buildProgressTicks += 1;
+        const buildingHealth = buildingHealthStates.get(buildingId);
+        if (buildingHealth && construction.totalBuildTicks > 0) {
+          const startHp = Math.max(1, Math.floor(buildingHealth.maxHp * 0.1));
+          const hpPerTick = (buildingHealth.maxHp - startHp) / construction.totalBuildTicks;
+          buildingHealth.currentHp = Math.min(
+            buildingHealth.maxHp,
+            buildingHealth.currentHp + hpPerTick,
+          );
+        }
         if (construction.buildProgressTicks >= construction.totalBuildTicks) {
           construction.buildProgressTicks = construction.totalBuildTicks;
           construction.isComplete = true;
+          if (buildingHealth) {
+            buildingHealth.currentHp = buildingHealth.maxHp;
+          }
 
           const renderable = activeWorld.getComponent<RenderableComponent>(buildingId, 'renderable');
           if (renderable) {
diff --git a/tests/simulation/createSimulationBridge.darkAge.test.ts b/tests/simulation/createSimulationBridge.darkAge.test.ts
index cd3ce66..7c9b5fa 100644
--- a/tests/simulation/createSimulationBridge.darkAge.test.ts
+++ b/tests/simulation/createSimulationBridge.darkAge.test.ts
@@ -2,7 +2,7 @@ import { describe, expect, it } from 'vitest';
 
 import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
 import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
-import { placeBuildingNearTownCenter } from './createSimulationBridge.helpers';
+import { placeBuildingNearTownCenter, stepBridgeUntil } from './createSimulationBridge.helpers';
 
 describe('createSimulationBridge dark age economy progression', () => {
   it('queues a villager at the Town Center and increases population when training completes', () => {
@@ -109,6 +109,55 @@ describe('createSimulationBridge dark age economy progression', () => {
     });
   }, 20_000);
 
+  it('ramps building HP from low at placement to full at construction completion', () => {
+    const bridge = createSimulationBridge(DEFAULT_SEED);
+
+    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
+    const housePosition = placeBuildingNearTownCenter(bridge, 'house');
+
+    const findHouse = () =>
+      bridge
+        .getEconomyState()
+        .buildings.find(
+          (building) =>
+            building.owner === 1
+            && building.buildingType === 'house'
+            && building.x === housePosition.x
+            && building.y === housePosition.y,
+        );
+
+    const placed = findHouse();
+    expect(placed).toBeDefined();
+    expect(placed!.isComplete).toBe(false);
+
+    const initialHealth = bridge.getEntityHealth(placed!.id);
+    expect(initialHealth).not.toBeNull();
+    expect(initialHealth!.maxHp).toBe(75);
+    expect(initialHealth!.currentHp).toBeGreaterThan(0);
+    expect(initialHealth!.currentHp).toBeLessThan(initialHealth!.maxHp * 0.2);
+
+    const totalTicks = placed!.totalBuildTicks;
+    expect(
+      stepBridgeUntil(
+        bridge,
+        () => (findHouse()?.buildProgressTicks ?? 0) >= totalTicks * 0.5,
+        { maxSteps: 600 },
+      ),
+    ).toBe(true);
+    const midHouse = findHouse()!;
+    expect(midHouse.isComplete).toBe(false);
+    const midHealth = bridge.getEntityHealth(midHouse.id)!;
+    expect(midHealth.currentHp).toBeGreaterThan(initialHealth!.currentHp);
+    expect(midHealth.currentHp).toBeLessThan(midHealth.maxHp);
+
+    expect(
+      stepBridgeUntil(bridge, () => findHouse()?.isComplete === true, { maxSteps: 600 }),
+    ).toBe(true);
+    const finishedHouse = findHouse()!;
+    const finalHealth = bridge.getEntityHealth(finishedHouse.id);
+    expect(finalHealth).toEqual({ currentHp: 75, maxHp: 75 });
+  }, 20_000);
+
   it('redirects a selected villager to gather gold through an explicit context order', () => {
     const bridge = createSimulationBridge(DEFAULT_SEED);
 
