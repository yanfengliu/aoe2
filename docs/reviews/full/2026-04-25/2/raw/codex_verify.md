Reading additional input from stdin...
OpenAI Codex v0.121.0 (research preview)
--------
workdir: C:\Users\38909\Documents\github\aoe2
model: gpt-5.4
provider: openai
approval: never
sandbox: read-only
reasoning effort: high
reasoning summaries: none
session id: 019dc802-22d3-72b3-9e15-29896a7399c2
--------
user
You are verifying a small batch of fixes that address findings from
`docs/reviews/full/2026-04-25/2/REVIEW.md` (iteration 2 of a multi-AI
full-codebase review).

Five fixes shipped on branch `agent/review-findings-2026-04-25-iter2-batch1`,
each as a separate commit:

1. **[V2-1]** `getHudState()` returns saved-game seed, not outer constructor seed (commit 7d63e00). Fix is one line in `src/game/simulation/createSimulationBridge.ts:7314` (`seed,` → `seed: effectiveSeed,`). Two new regression tests in `tests/simulation/saveLoad.test.ts`.

2. **[H2-1]** Tech research is idempotent across multiple producer buildings (commit f54c55d). Adds `if (researchedTechnologies.get(owner)?.has(...)) return;` guard at the top of `applyTechnology` in `src/game/simulation/bridge/technologyOps.ts`. New `double-blacksmith-race-fixture` + regression test that race-queues Forging at two Blacksmiths and asserts attackDamage gains +1 not +2.

3. **[H2-2]** Gather: preserve carried load when no drop-off path (commit af4c559). Splits the `to-dropoff` branch in `src/game/simulation/createSimulationBridge.ts:5694-5710` so an empty carry still resets to idle, but a non-empty carry stays in `to-dropoff` instead of being zeroed. New `villager-no-wood-dropoff-fixture` + regression test.

4. **[H2-3]** Black Forest: widen base-pocket radius (commit 7687b82). Bumps `POCKET_RADIUS` from 6 to 7 in `src/game/simulation/mapGeneration/blackForestMap.ts`. Existing Black Forest test extended to assert per-owner stone / gold / boar counts of 4 / 4 / 2.

5. **[M2-1]** Building target finding uses footprint visibility (commit 0dc7cd7). Replaces anchor-cell visibility check with `isFootprintVisible` parity to `createProjector`. Widens the parameter type of `isFootprintVisible` in `src/game/simulation/bridge/pureHelpers.ts` from `VisibilityMap` to a structural `IsVisibleQuery` interface. New unit tests on the helper directly.

# What we want from you

For each fix:

1. Did the fix actually land on the right file and line?
2. Is the fix complete? Are there other call-sites or related code paths that should have been updated?
3. Does the fix introduce a new defect (off-by-one, infinite loop, scope leak, type narrowing failure, etc.)?
4. Is the regression test strong enough (catches the specific bug, not a tangential symptom)?

End with a tight verdict per fix: `OK` / `OK with caveats: <one-liner>` / `NEEDS CHANGE: <what to fix>`.

# Aspects we still want flagged

If you happen to spot anything UNRELATED to these five fixes that you think is high or critical severity, mention it briefly under "Out-of-scope follow-ups" — but stay terse; the goal of this pass is verification, not full re-review.

# Validation already done

- `npx tsc --noEmit` clean
- `npm run lint` clean
- `npx vitest run` 50/50 files, 400 passed + 1 skipped, no test failures
- `npx vite build` clean

So you can focus on logic / completeness rather than build/test mechanics.

# Output format

Plain text or markdown. Do NOT modify files.

<stdin>
diff --git a/src/game/simulation/bridge/pureHelpers.ts b/src/game/simulation/bridge/pureHelpers.ts
index bf0e5ad..4d02fe7 100644
--- a/src/game/simulation/bridge/pureHelpers.ts
+++ b/src/game/simulation/bridge/pureHelpers.ts
@@ -393,8 +393,15 @@ export function buildingFootprint(buildingType: BuildingType): { width: number;
   return getBuildingFootprint(buildingType);
 }
 
+// Structural visibility query — only `isVisible` is needed here. The
+// authoritative VisibilityMap satisfies this; so do the lighter
+// `VisibilityQuery` mocks in targetFindingOps + tests.
+interface IsVisibleQuery {
+  isVisible: (playerId: number, x: number, y: number) => boolean;
+}
+
 export function isFootprintVisible(
-  visibility: VisibilityMap,
+  visibility: IsVisibleQuery,
   playerId: number,
   anchorX: number,
   anchorY: number,
diff --git a/src/game/simulation/bridge/targetFindingOps.ts b/src/game/simulation/bridge/targetFindingOps.ts
index 8a5d255..439e01c 100644
--- a/src/game/simulation/bridge/targetFindingOps.ts
+++ b/src/game/simulation/bridge/targetFindingOps.ts
@@ -26,8 +26,10 @@ import type {
 } from './pureHelpers';
 import {
   distanceFromBuildingFootprint,
+  isFootprintVisible,
   manhattanDistance,
 } from './pureHelpers';
+import { getBuildingFootprint } from '../../content/buildingFootprints';
 
 interface CombatStateLike {
   currentHp: number;
@@ -307,6 +309,11 @@ export function createTargetFindingOps(deps: TargetFindingDeps): TargetFindingOp
   }
 
   function findPreferredVisibleEnemyBuilding(viewerOwner: number, origin: Position): number | null {
+    // Iter-2 M2-1: visibility check goes through the building footprint,
+    // not just the anchor cell, so partially-visible large buildings
+    // (Castles, Town Centers, Wonders) are targetable as soon as ANY
+    // cell of the footprint is in fog. Mirrors the contract createProjector
+    // already uses to decide whether to render the building.
     const candidates = [...world.query('position', 'building')]
       .map((id) => ({
         id,
@@ -316,11 +323,24 @@ export function createTargetFindingOps(deps: TargetFindingDeps): TargetFindingOp
       .filter(
         (
           entry,
-        ): entry is { id: number; position: Position; building: BuildingComponent } =>
-          entry.position !== undefined
-          && entry.building !== undefined
-          && entry.building.owner !== viewerOwner
-          && visibility.isVisible(viewerOwner, entry.position.x, entry.position.y),
+        ): entry is { id: number; position: Position; building: BuildingComponent } => {
+          if (
+            entry.position === undefined
+            || entry.building === undefined
+            || entry.building.owner === viewerOwner
+          ) {
+            return false;
+          }
+          const footprint = getBuildingFootprint(entry.building.buildingType);
+          return isFootprintVisible(
+            visibility,
+            viewerOwner,
+            entry.position.x,
+            entry.position.y,
+            footprint.width,
+            footprint.height,
+          );
+        },
       )
       .sort((left, right) => {
         const priorityDelta =
diff --git a/src/game/simulation/bridge/technologyOps.ts b/src/game/simulation/bridge/technologyOps.ts
index c8424ab..c416049 100644
--- a/src/game/simulation/bridge/technologyOps.ts
+++ b/src/game/simulation/bridge/technologyOps.ts
@@ -156,7 +156,18 @@ export function createTechnologyOps(deps: TechnologyDeps): TechnologyOps {
   }
 
   function applyTechnology(owner: number, technologyType: ResearchableTechnologyType): void {
-    researchedTechnologies.get(owner)?.add(technologyType);
+    // Idempotency guard (iter-2 H2-1): enqueueResearch only dedupes
+    // within the same building's queue, so two producer buildings can
+    // race-queue the same tech and reach this completion path twice.
+    // Many cases below use += increments (forging, iron-casting,
+    // blast-furnace, bracer, every armor tier, ...) so the second call
+    // would silently double the bonus. Skip if the tech is already
+    // applied for this owner.
+    const ownerSet = researchedTechnologies.get(owner);
+    if (ownerSet?.has(technologyType)) {
+      return;
+    }
+    ownerSet?.add(technologyType);
 
     switch (technologyType) {
       case 'feudal-age':
diff --git a/src/game/simulation/createSimulationBridge.ts b/src/game/simulation/createSimulationBridge.ts
index bab0441..9dd3631 100644
--- a/src/game/simulation/createSimulationBridge.ts
+++ b/src/game/simulation/createSimulationBridge.ts
@@ -5691,10 +5691,21 @@ function createWorld(
             ? null
             : findBuildingApproachPlan(id, dropOffId, 1, activeWorld);
 
-          if (!dropOffPlan || gatherer.carriedResource === null || gatherer.carriedAmount <= 0) {
+          // Iter-2 H2-2: only zero out the carry when there is genuinely
+          // nothing to deliver (empty resource type or amount). When the
+          // villager IS carrying a load but the path / drop-off building
+          // is momentarily unreachable (enemy unit on the path, drop-off
+          // mid-rebuild, or no owned drop-off at all), preserve the load
+          // and re-evaluate next tick. Canonical AoE2 idles the
+          // villager holding its carry until the path reopens.
+          const carriedResource = gatherer.carriedResource;
+          if (carriedResource === null || gatherer.carriedAmount <= 0) {
             gatherer.task = 'idle';
             gatherer.carriedAmount = 0;
             gatherer.carriedResource = null;
+          } else if (!dropOffPlan) {
+            // Stay in 'to-dropoff' so the next tick re-checks for a
+            // newly-available drop-off; do not touch the carry.
           } else if (isUnitAtTarget(id, dropOffPlan.destination, activeWorld)) {
             const stockpile = playerResources.get(unit.owner);
             // Slice 10: AI difficulty modifies the gather-rate via a
@@ -5707,7 +5718,7 @@ function createWorld(
             const multiplier = aiState ? gatherMultiplier(aiState.difficulty) : 1;
             const deposited = Math.round(gatherer.carriedAmount * multiplier);
             if (stockpile) {
-              stockpile[gatherer.carriedResource] += deposited;
+              stockpile[carriedResource] += deposited;
             }
             // Slice 8: track every unit of dropped-off resource toward the
             // end-of-match score. A small per-unit weight keeps the score
@@ -7311,7 +7322,7 @@ export function createSimulationBridge(
         tickDurationMs,
         fpsTarget: TPS,
         worldSize: `${MAP_WIDTH}x${MAP_HEIGHT}`,
-        seed,
+        seed: effectiveSeed,
         currentAge: getPlayerAge(HUMAN_PLAYER_ID),
         playerResources: getPlayerResources(HUMAN_PLAYER_ID),
         population: getPopulationState(HUMAN_PLAYER_ID),
diff --git a/src/game/simulation/fixtures/ageProgression.ts b/src/game/simulation/fixtures/ageProgression.ts
index 42d97cc..8b5f07e 100644
--- a/src/game/simulation/fixtures/ageProgression.ts
+++ b/src/game/simulation/fixtures/ageProgression.ts
@@ -38,4 +38,5 @@ export {
 
 export {
   createBlacksmithProgressionFixture,
+  createDoubleBlacksmithRaceFixture,
 } from './ageProgression/blacksmith';
diff --git a/src/game/simulation/fixtures/ageProgression/blacksmith.ts b/src/game/simulation/fixtures/ageProgression/blacksmith.ts
index dc2bf63..90bfa67 100644
--- a/src/game/simulation/fixtures/ageProgression/blacksmith.ts
+++ b/src/game/simulation/fixtures/ageProgression/blacksmith.ts
@@ -142,3 +142,77 @@ export function createBlacksmithProgressionFixture(seed: string): PrototypeScena
     ],
   };
 }
+
+// Iter-2 H2-1 regression: two Blacksmiths owned by player 1, plus one
+// Militia to observe the Forging stat bump. Both Blacksmiths must
+// accept a Forging research order so the test can exercise the
+// double-research race; without an idempotency guard in
+// applyTechnology, a player with two Blacksmiths gets +2 attack
+// instead of +1 because the production-queue completion path fires
+// twice.
+export function createDoubleBlacksmithRaceFixture(seed: string): PrototypeScenario {
+  return {
+    seed,
+    width: MAP_WIDTH,
+    height: MAP_HEIGHT,
+    terrain: createGrassFixtureTerrain(),
+    starts: [
+      {
+        owner: 1,
+        townCenter: { x: 8, y: 8 },
+        startingAge: 'imperial-age',
+        startingResources: {
+          food: 8000,
+          wood: 1000,
+          gold: 8000,
+          stone: 200,
+        },
+      },
+      {
+        owner: 2,
+        townCenter: { x: 40, y: 8 },
+        startingAge: 'imperial-age',
+      },
+    ],
+    spawns: [
+      {
+        kind: 'town-center',
+        x: 8,
+        y: 8,
+        owner: 1,
+        baseOwner: 1,
+        vision: { playerId: 1, radius: 7 },
+      },
+      {
+        kind: 'blacksmith',
+        x: 4,
+        y: 6,
+        owner: 1,
+        baseOwner: 1,
+      },
+      {
+        kind: 'blacksmith',
+        x: 16,
+        y: 6,
+        owner: 1,
+        baseOwner: 1,
+      },
+      {
+        kind: 'militia',
+        x: 12,
+        y: 13,
+        owner: 1,
+        baseOwner: 1,
+        vision: { playerId: 1, radius: 3 },
+      },
+      {
+        kind: 'town-center',
+        x: 40,
+        y: 8,
+        owner: 2,
+        baseOwner: 2,
+        vision: { playerId: 2, radius: 7 },
+      },
+    ],
+  };
+}
diff --git a/src/game/simulation/fixtures/economyBasics.ts b/src/game/simulation/fixtures/economyBasics.ts
index f3da777..315c036 100644
--- a/src/game/simulation/fixtures/economyBasics.ts
+++ b/src/game/simulation/fixtures/economyBasics.ts
@@ -92,6 +92,77 @@ export function createMiningCampFixture(seed: string): PrototypeScenario {
   };
 }
 
+// Iter-2 H2-2 regression: player 1 has a villager + a tree, but the
+// only owned building is a Mill (food drop-off only). The villager
+// fills its carry from the tree and the to-dropoff branch finds no
+// owned wood drop-off building. Without the fix, the gather-system
+// silently zeroes the load every tick. With the fix, the load
+// persists until a wood drop-off becomes reachable.
+export function createVillagerNoWoodDropoffFixture(seed: string): PrototypeScenario {
+  return {
+    seed,
+    width: MAP_WIDTH,
+    height: MAP_HEIGHT,
+    terrain: createGrassFixtureTerrain(),
+    starts: [
+      {
+        owner: 1,
+        townCenter: { x: 8, y: 8 },
+        startingResources: {
+          food: 200,
+          wood: 200,
+          gold: 100,
+          stone: 200,
+        },
+      },
+      {
+        owner: 2,
+        townCenter: { x: 24, y: 8 },
+        // Disable the AI planner for player 2 so it doesn't train its
+        // own villagers and steal-gather from player 1's lone tree
+        // (which would corrupt this regression test's measurements).
+        disableAi: true,
+      },
+    ],
+    spawns: [
+      // Player 1's only owned building is a Mill — accepts food only,
+      // not wood. Intentionally NO Town Center and NO Lumber Camp.
+      {
+        kind: 'mill',
+        x: 8,
+        y: 8,
+        owner: 1,
+        baseOwner: 1,
+        vision: { playerId: 1, radius: 4 },
+      },
+      {
+        kind: 'villager',
+        x: 11,
+        y: 8,
+        owner: 1,
+        baseOwner: 1,
+        vision: { playerId: 1, radius: 4 },
+      },
+      {
+        kind: 'tree',
+        x: 13,
+        y: 8,
+        owner: null,
+        baseOwner: 1,
+        amount: 200,
+      },
+      {
+        kind: 'town-center',
+        x: 24,
+        y: 8,
+        owner: 2,
+        baseOwner: 2,
+        vision: { playerId: 2, radius: 7 },
+      },
+    ],
+  };
+}
+
 export function createFishFixture(seed: string): PrototypeScenario {
   const terrain = createGrassFixtureTerrain();
   for (let y = 7; y <= 9; y += 1) {
diff --git a/src/game/simulation/fixtures/index.ts b/src/game/simulation/fixtures/index.ts
index 79f9d72..0320823 100644
--- a/src/game/simulation/fixtures/index.ts
+++ b/src/game/simulation/fixtures/index.ts
@@ -16,6 +16,7 @@ export {
 export {
   createMiningCampFixture,
   createFishFixture,
+  createVillagerNoWoodDropoffFixture,
   createResourceDepletionFixture,
   createMoveTargetUnblocksFixture,
   createNarrowCorridorFixture,
@@ -46,6 +47,7 @@ export {
   createImperialSiegeFixture,
   createImperialBlacksmithFixture,
   createBlacksmithProgressionFixture,
+  createDoubleBlacksmithRaceFixture,
   createImperialCastleFixture,
   createFeudalMarketFixture,
   createFeudalSpearmanFixture,
diff --git a/src/game/simulation/mapGeneration/blackForestMap.ts b/src/game/simulation/mapGeneration/blackForestMap.ts
index 5c36d5d..8159ef3 100644
--- a/src/game/simulation/mapGeneration/blackForestMap.ts
+++ b/src/game/simulation/mapGeneration/blackForestMap.ts
@@ -27,8 +27,16 @@ export function createBlackForestMap(seed: string): PrototypeScenario {
   const spawns = createSpawnList();
 
   // Carve out a base pocket (grass) around each start so the Town Center,
-  // villagers, and resource offsets all have valid terrain.
-  const POCKET_RADIUS = 6;
+  // villagers, and resource offsets all have valid terrain. Iter-2 H2-3:
+  // the prior radius of 6 cleared starting villager / sheep / berry
+  // offsets but missed STARTING_STONE (1, 6) at distance ≈ 6.08,
+  // STARTING_GOLD (6, 0) at distance 6, and STARTING_BOARS (4, -5) at
+  // distance ≈ 6.40. Those cells stayed forest and got a tree spawn in
+  // the seeding loop below; applyStandardPlayerOpening then silently
+  // dropped the standard resource spawn at first-write-wins time. A
+  // radius of 7 covers every starting offset without changing the
+  // dense-forest character of the map.
+  const POCKET_RADIUS = 7;
   for (const start of starts) {
     paintDisc(terrain, start.townCenter, POCKET_RADIUS, 'grass');
   }
diff --git a/src/game/simulation/prototypeScenario.ts b/src/game/simulation/prototypeScenario.ts
index 3bb2632..1d0b62b 100644
--- a/src/game/simulation/prototypeScenario.ts
+++ b/src/game/simulation/prototypeScenario.ts
@@ -48,6 +48,7 @@ import {
   createChampionVsHalberdierFixture,
   createConquestDefeatFixture,
   createConquestVictoryFixture,
+  createDoubleBlacksmithRaceFixture,
   createDoubleClickSelectionFixture,
   createFeudalAgeFixture,
   createFeudalBlacksmithFixture,
@@ -58,6 +59,7 @@ import {
   createFeudalStableFixture,
   createFeudalWatchTowerFixture,
   createFishFixture,
+  createVillagerNoWoodDropoffFixture,
   createFogMemoryFixture,
   createFu3CastleEdgeRangeFixture,
   createFu3CastleFiveArchersFixture,
@@ -417,6 +419,10 @@ export function createPrototypeScenario(seed = DEFAULT_SEED): PrototypeScenario
     return createBlacksmithProgressionFixture(seed);
   }
 
+  if (seed === 'double-blacksmith-race-fixture') {
+    return createDoubleBlacksmithRaceFixture(seed);
+  }
+
   if (seed === 'champion-vs-halberdier-fixture') {
     return createChampionVsHalberdierFixture(seed);
   }
@@ -750,6 +756,10 @@ export function createPrototypeScenario(seed = DEFAULT_SEED): PrototypeScenario
     return createFishFixture(seed);
   }
 
+  if (seed === 'villager-no-wood-dropoff-fixture') {
+    return createVillagerNoWoodDropoffFixture(seed);
+  }
+
   if (seed === 'boar-aggro-fixture') {
     return createBoarAggroFixture(seed);
   }
diff --git a/tests/simulation/gatherCarryPreservation.test.ts b/tests/simulation/gatherCarryPreservation.test.ts
new file mode 100644
index 0000000..ecc6c66
--- /dev/null
+++ b/tests/simulation/gatherCarryPreservation.test.ts
@@ -0,0 +1,78 @@
+import { describe, expect, it } from 'vitest';
+
+import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
+import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';
+
+type Bridge = ReturnType<typeof createSimulationBridge>;
+
+function findOwnedVillager(bridge: Bridge, owner: number) {
+  return bridge.getEconomyState().villagers.find((v) => v.owner === owner);
+}
+
+function findTree(bridge: Bridge) {
+  return bridge.getEconomyState().resources.find((r) => r.resourceType === 'tree');
+}
+
+describe('iter-2 H2-2 — gather carry preserved when no drop-off path exists', () => {
+  it('villager carrying wood does not zero its load and re-gather forever when no wood drop-off is owned', () => {
+    // Player 1 has only a Mill (food drop-off) and a single tree. The
+    // villager picks up wood, transitions to `to-dropoff`, and finds no
+    // owned wood drop-off building. Without the fix the gather-system
+    // zeroes the carry every tick — and shouldMaintainGatheringOrder
+    // re-targets the same tree, so the villager farms the tree from
+    // 200 → 0 for nothing. With the fix the load persists and the
+    // villager idles holding the 10-wood carry; the tree stops at 190.
+    const bridge = createSimulationBridge('villager-no-wood-dropoff-fixture');
+
+    const villager = findOwnedVillager(bridge, 1);
+    expect(villager).toBeDefined();
+    expect(villager?.carriedAmount).toBe(0);
+
+    const initialTree = findTree(bridge);
+    expect(initialTree).toBeDefined();
+    expect(initialTree?.amount).toBe(200);
+    expect(
+      bridge
+        .getEconomyState()
+        .buildings.filter(
+          (b) =>
+            b.owner === 1
+            && (b.buildingType === 'town-center' || b.buildingType === 'lumber-camp'),
+        ),
+    ).toHaveLength(0);
+
+    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
+    expect(bridge.issueContextCommand(initialTree!.x, initialTree!.y)).toBe(true);
+
+    // Wait for at least one gather to land — sample tree amount and
+    // wait until it drops below 200 (the villager has chopped at least
+    // one wood off).
+    expect(
+      stepBridgeUntil(
+        bridge,
+        () => {
+          const t = findTree(bridge);
+          return !!t && t.amount < 200;
+        },
+        { maxSteps: 600 },
+      ),
+    ).toBe(true);
+
+    // Step a generous tail past the point where the villager fills its
+    // 10-wood carry. With the bug, the villager would zero the carry
+    // and re-target the tree on the next tick, so the tree's amount
+    // would keep decreasing past 190 toward 0. With the fix the carry
+    // stays at 10 and the villager idles in `to-dropoff`; tree never
+    // drops past 190.
+    for (let i = 0; i < 800; i += 1) {
+      bridge.step(100);
+    }
+
+    const treeAfter = findTree(bridge);
+    expect(treeAfter).toBeDefined();
+    expect(treeAfter!.amount).toBeGreaterThanOrEqual(190);
+
+    // Stockpile didn't grow — there was no drop-off to deposit at.
+    expect(bridge.getEconomyState().playerResources[1].wood).toBe(200);
+  }, 30_000);
+});
diff --git a/tests/simulation/prototypeScenario.test.ts b/tests/simulation/prototypeScenario.test.ts
index e39a084..071c876 100644
--- a/tests/simulation/prototypeScenario.test.ts
+++ b/tests/simulation/prototypeScenario.test.ts
@@ -502,6 +502,31 @@ describe('createPrototypeScenario', () => {
           (spawn) => spawn.baseOwner === owner && spawn.kind === 'berry-bush',
         ).length,
       ).toBe(6);
+
+      // Iter-2 H2-3: standard opening seeds 4 stone, 4 gold, 2 boar
+      // for every player, but the Black Forest carve-pocket was only
+      // radius 6 — so cells like STARTING_STONE (1, 6) (distance ≈
+      // 6.08), STARTING_GOLD (6, 0) (distance 6), and STARTING_BOARS
+      // (4, -5) (distance ≈ 6.40) fell into forest cells that were
+      // already seeded as a tree, and the standard-opening
+      // applyResourcePatch silently dropped the rejected resource
+      // spawn. Lock the per-owner counts so the regression cannot
+      // come back.
+      expect(
+        left.spawns.filter(
+          (spawn) => spawn.baseOwner === owner && spawn.kind === 'stone-mine',
+        ).length,
+      ).toBe(4);
+      expect(
+        left.spawns.filter(
+          (spawn) => spawn.baseOwner === owner && spawn.kind === 'gold-mine',
+        ).length,
+      ).toBe(4);
+      expect(
+        left.spawns.filter(
+          (spawn) => spawn.baseOwner === owner && spawn.kind === 'boar',
+        ).length,
+      ).toBe(2);
     }
   });
 
diff --git a/tests/simulation/saveLoad.test.ts b/tests/simulation/saveLoad.test.ts
index bb95e7e..3a9d88a 100644
--- a/tests/simulation/saveLoad.test.ts
+++ b/tests/simulation/saveLoad.test.ts
@@ -199,4 +199,36 @@ describe('Slice 9 — save/load round-trip', () => {
 
     expect(economy2.ages).toEqual(economy1.ages);
   });
+
+  it('reports the saved-game seed via getHudState() after load (review V2-1 follow-up)', () => {
+    // Companion to the H-1 projector-seed test above: getHudState().seed
+    // is the seed surface the HUD + browser test snapshot consume. After
+    // load it must equal `savedGame.seed`, not the outer constructor seed.
+    const savedSeed = 'conquest-victory-fixture';
+    const otherSeed = 'aoe2-prototype';
+    expect(savedSeed).not.toBe(otherSeed);
+    const bridge1 = createSimulationBridge(savedSeed);
+    bridge1.step(1000);
+    const blob = bridge1.saveGame();
+
+    const loadedBridge = createSimulationBridge(otherSeed, { savedGame: blob });
+    expect(loadedBridge.getHudState().seed).toBe(savedSeed);
+  });
+
+  it('writes the saved-game seed (not the outer constructor seed) when re-saving a loaded match (review V2-1 follow-up)', () => {
+    // Re-saving a loaded match must not silently rebrand the blob with
+    // the outer constructor seed; that breaks the determinism contract
+    // for the load → re-save round-trip.
+    const savedSeed = 'conquest-victory-fixture';
+    const otherSeed = 'aoe2-prototype';
+    expect(savedSeed).not.toBe(otherSeed);
+    const bridge1 = createSimulationBridge(savedSeed);
+    bridge1.step(1000);
+    const firstBlob = bridge1.saveGame();
+    expect(firstBlob.seed).toBe(savedSeed);
+
+    const loadedBridge = createSimulationBridge(otherSeed, { savedGame: firstBlob });
+    const secondBlob = loadedBridge.saveGame();
+    expect(secondBlob.seed).toBe(savedSeed);
+  });
 });
diff --git a/tests/simulation/targetFindingFootprintVisibility.test.ts b/tests/simulation/targetFindingFootprintVisibility.test.ts
new file mode 100644
index 0000000..6bb2c5b
--- /dev/null
+++ b/tests/simulation/targetFindingFootprintVisibility.test.ts
@@ -0,0 +1,155 @@
+import { describe, expect, it } from 'vitest';
+
+import { createTargetFindingOps } from '../../src/game/simulation/bridge/targetFindingOps';
+import type { BuildingComponent } from '../../src/game/simulation/types';
+
+// Mock minimal civ-engine world + visibility surfaces. The
+// targetFindingOps factory only touches `query`, `queryInRadius`, and
+// `getComponent` for unit/building lookups, plus `visibility.isVisible`.
+function createMockWorld(entities: {
+  buildings: Array<{
+    id: number;
+    x: number;
+    y: number;
+    owner: number;
+    buildingType: BuildingComponent['buildingType'];
+    footprint: { width: number; height: number };
+  }>;
+}) {
+  const buildings = new Map<number, BuildingComponent>();
+  const positions = new Map<number, { x: number; y: number }>();
+  for (const b of entities.buildings) {
+    positions.set(b.id, { x: b.x, y: b.y });
+    buildings.set(b.id, {
+      buildingType: b.buildingType,
+      owner: b.owner,
+      footprint: b.footprint,
+    } as unknown as BuildingComponent);
+  }
+
+  return {
+    *query(...components: string[]) {
+      const wantsBuilding = components.includes('building');
+      for (const id of buildings.keys()) {
+        if (wantsBuilding && positions.has(id)) {
+          yield id;
+        }
+      }
+    },
+    *queryInRadius() {
+      // Unused for findPreferredVisibleEnemyBuilding; left as a noop
+      // generator so the type checker is happy if anything probes it.
+    },
+    getComponent<T>(id: number, component: string): T | undefined {
+      if (component === 'position') {
+        return positions.get(id) as T | undefined;
+      }
+      if (component === 'building') {
+        return buildings.get(id) as T | undefined;
+      }
+      return undefined;
+    },
+  } as unknown as Parameters<typeof createTargetFindingOps>[0]['world'];
+}
+
+function createMockVisibility(visibleCells: Set<string>) {
+  return {
+    isVisible(_playerId: number, x: number, y: number): boolean {
+      return visibleCells.has(`${x},${y}`);
+    },
+  };
+}
+
+describe('iter-2 M2-1 — findPreferredVisibleEnemyBuilding uses footprint visibility', () => {
+  it('returns a 4x4 castle when a non-anchor cell is visible but the anchor is not', () => {
+    // Player-1 castle (4x4) anchored at (10, 10) — occupies (10,10) to
+    // (13,13). Viewer (player 2) has visibility on (12, 12) only — a
+    // non-anchor cell. createProjector treats this footprint as visible
+    // (matches what the player sees on screen). The buggy
+    // findPreferredVisibleEnemyBuilding only checked the anchor cell
+    // visibility, so it would return null even though the building is
+    // rendered.
+    const world = createMockWorld({
+      buildings: [
+        {
+          id: 1001,
+          x: 10,
+          y: 10,
+          owner: 1,
+          buildingType: 'castle',
+          footprint: { width: 4, height: 4 },
+        },
+      ],
+    });
+    const visibility = createMockVisibility(new Set(['12,12']));
+
+    const ops = createTargetFindingOps({
+      world,
+      visibility,
+      combatStates: new Map(),
+      constructionStates: new Map(),
+      buildingHealthStates: new Map(),
+    });
+
+    const result = ops.findPreferredVisibleEnemyBuilding(2, { x: 16, y: 12 });
+    expect(result).toBe(1001);
+  });
+
+  it('returns null when no cell of the building footprint is visible', () => {
+    // Sanity case: viewer has no visibility on any cell of the castle.
+    // Should return null both before and after the fix.
+    const world = createMockWorld({
+      buildings: [
+        {
+          id: 1001,
+          x: 10,
+          y: 10,
+          owner: 1,
+          buildingType: 'castle',
+          footprint: { width: 4, height: 4 },
+        },
+      ],
+    });
+    const visibility = createMockVisibility(new Set(['25,25']));
+
+    const ops = createTargetFindingOps({
+      world,
+      visibility,
+      combatStates: new Map(),
+      constructionStates: new Map(),
+      buildingHealthStates: new Map(),
+    });
+
+    const result = ops.findPreferredVisibleEnemyBuilding(2, { x: 16, y: 12 });
+    expect(result).toBeNull();
+  });
+
+  it('still returns a building when only the anchor cell is visible (regression for the fix)', () => {
+    // Confirm the fix does not break the prior happy path — anchor-cell
+    // visibility was the only path the original code accepted.
+    const world = createMockWorld({
+      buildings: [
+        {
+          id: 1001,
+          x: 10,
+          y: 10,
+          owner: 1,
+          buildingType: 'castle',
+          footprint: { width: 4, height: 4 },
+        },
+      ],
+    });
+    const visibility = createMockVisibility(new Set(['10,10']));
+
+    const ops = createTargetFindingOps({
+      world,
+      visibility,
+      combatStates: new Map(),
+      constructionStates: new Map(),
+      buildingHealthStates: new Map(),
+    });
+
+    const result = ops.findPreferredVisibleEnemyBuilding(2, { x: 16, y: 12 });
+    expect(result).toBe(1001);
+  });
+});
diff --git a/tests/simulation/technologyIdempotency.test.ts b/tests/simulation/technologyIdempotency.test.ts
new file mode 100644
index 0000000..44742dc
--- /dev/null
+++ b/tests/simulation/technologyIdempotency.test.ts
@@ -0,0 +1,67 @@
+import { describe, expect, it } from 'vitest';
+
+import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
+import { stepBridgeUntil } from './createSimulationBridge.helpers';
+
+type Bridge = ReturnType<typeof createSimulationBridge>;
+
+function findOwnedMilitia(bridge: Bridge, owner: number) {
+  return bridge
+    .getEconomyState()
+    .units.find((unit) => unit.owner === owner && unit.unitType === 'militia');
+}
+
+describe('iter-2 H2-1 — research idempotency across multiple producer buildings', () => {
+  it('Forging only grants +1 attack even when both Blacksmiths complete the same research', () => {
+    // Two Blacksmiths owned by player 1 race-queue Forging at the same
+    // tick. Without an idempotency guard in applyTechnology, the
+    // production-queue completion path fires twice and the +1 increment
+    // doubles to +2. Canonical AoE2 caps the bonus at the per-tier value.
+    const bridge = createSimulationBridge('double-blacksmith-race-fixture');
+
+    const baseMilitia = findOwnedMilitia(bridge, 1);
+    expect(baseMilitia).toBeDefined();
+    expect(baseMilitia?.attackDamage).toBe(4);
+
+    // Confirm the fixture really has two Blacksmiths.
+    const blacksmiths = bridge
+      .getEconomyState()
+      .buildings.filter((b) => b.owner === 1 && b.buildingType === 'blacksmith');
+    expect(blacksmiths).toHaveLength(2);
+
+    // Queue Forging at Blacksmith A.
+    expect(bridge.selectEntityAtCell(4, 6)).toBe(true);
+    expect(bridge.getSelectionState().selectedEntityType).toBe('blacksmith');
+    expect(bridge.queueResearch('forging')).toBe(true);
+
+    // Queue Forging at Blacksmith B. Today this returns true because
+    // enqueueResearch only dedupes within the same building's queue;
+    // both researches will run to completion. The fix ensures
+    // applyTechnology is idempotent so the second completion is a
+    // no-op.
+    expect(bridge.selectEntityAtCell(16, 6)).toBe(true);
+    expect(bridge.getSelectionState().selectedEntityType).toBe('blacksmith');
+    expect(bridge.queueResearch('forging')).toBe(true);
+
+    // Step until at least one completion fires.
+    expect(
+      stepBridgeUntil(
+        bridge,
+        () => {
+          const militia = findOwnedMilitia(bridge, 1);
+          return !!militia && militia.attackDamage > 4;
+        },
+        { maxSteps: 600 },
+      ),
+    ).toBe(true);
+
+    // Step a generous tail so the second-completing Blacksmith also
+    // runs through applyTechnology.
+    for (let i = 0; i < 200; i += 1) {
+      bridge.step(100);
+    }
+
+    const finalMilitia = findOwnedMilitia(bridge, 1);
+    expect(finalMilitia?.attackDamage).toBe(5);
+  }, 30_000);
+});
</stdin>
codex
Reviewing the five claimed fixes against the branch diff and surrounding code paths. I’m starting with the repo instructions and the targeted source/test context so the verdicts are based on the actual contracts, not just the summary.
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content C:\\Users\\38909\\.codex\\plugins\\cache\\openai-curated\\superpowers\\421657af\\skills\\using-superpowers\\SKILL.md" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content C:\\Users\\38909\\.codex\\skills\\programming-best-practices\\SKILL.md" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content docs/devlog/summary.md' in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content C:\\Users\\38909\\.codex\\memories\\MEMORY.md | Select-String -Pattern 'aoe2|review-findings|2026-04-25|full-codebase review' -Context 1,2" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content docs/architecture/ARCHITECTURE.md' in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-Content AGENTS.md' in C:\Users\38909\Documents\github\aoe2
2026-04-26T04:18:24.612505Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content C:\\Users\\38909\\.codex\\memories\\MEMORY.md | Select-String -Pattern 'aoe2|review-findings|2026-04-25|full-codebase review' -Context 1,2"` rejected: blocked by policy
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content C:\\Users\\38909\\.codex\\memories\\MEMORY.md | Select-String -Pattern 'aoe2|review-findings|2026-04-25|full-codebase review' -Context 1,2"` rejected: blocked by policy
 succeeded in 385ms:
# Architecture

This document describes the structural boundaries of the project. Update it only for
structural changes (new modules, shifted boundaries, new build or data pipelines). Do
not update it for UI tweaks, bug fixes, refactors, or test-only work. When it does
change, also append a row to `drift-log.md` and mention the update in the devlog.

## Repository layout

- `src/` ƒ?" game code (TypeScript)
  - `app/bootstrap/` ƒ?" app startup, dev HTTP API used by browser tests
  - `game/` ƒ?" gameplay rules, scenarios, content
    - `content/` ƒ?" shared content tables (e.g., building footprints)
    - `simulation/` ƒ?" simulation bridge, scenario setup, command handlers.
      Top-level siblings of `createSimulationBridge.ts` include
      `worldOccupancy.ts` (the `OccupancyBinding` adapter that keeps the
      authoritative blocker/crowding contract), `selectionActivity.ts`
      (structured activity payload for the HUD selection panel), and
      `renderStore.ts` (the per-tick render-message store the projector
      writes into).
      - `bridge/` ƒ?" helper modules factored out of `createSimulationBridge.ts`
        to keep the entry file from drifting back into god-class shape.
        Each module either exports plain helpers or a dep-bag factory whose
        side-map ownership still lives in `createWorld` so save/load and
        destroy-entity hooks share the same references:
        - `pureHelpers.ts` ƒ?" pure helpers (clamp, grid/coordinate
          transforms, economy/resource helpers, footprint and projection
          comparators) plus the shared `GameEvents` / `GameCommands` /
          `GameComponents` / `GameWorld` type aliases and the
          `UNIT_SUBGRID_*` / `UNIT_CELL_SLOT_OFFSETS` / `MARKET_BASE_RATE`
          constants.
        - `visibility.ts` ƒ?" `createProjector` (RenderAdapter projection),
          `syncVisibilitySources`, and the sheep claim / ownership helpers
          plus `SHEEP_VISION_RADIUS` / `MAX_HERDABLE_CLAIM_RADIUS`.
        - `trebuchetState.ts` ƒ?" `createTrebuchetStateOps` factory wrapping
          the Trebuchet pack/unpack transition over `trebuchetPackStates`.
        - `fogMemoryOps.ts` ƒ?" `createFogMemoryOps` factory bundling
          `getOrCreateMemoryMap`, `getFogMemoryEntities`,
          `getHumanFogMemorySize`.
        - `monkTaskOps.ts` ƒ?" `createMonkTaskOps` factory for the Monk
          heal / convert / pickup / deposit lifecycle, including AI-side
          task assignment and human-side context-click routing.
        - `technologyOps.ts` ƒ?" technology / upgrade application (research
          completion, per-unit / per-building stat propagation, civ
          unique-tech handling).
        - `matchEndOps.ts` ƒ?" match-end / score / win-condition resolution
          (conquest, Wonder, relic timers, score tally).
        - `aiDecisionOps.ts` ƒ?" Slice-10 AI decision helpers (villager
          retargeting, attack-group forming, plan transitions).
        - `placementOps.ts` ƒ?" placement preview + building placement
          confirmation (footprint validation, occupancy reservation).
        - `saveGameOps.ts` ƒ?" `createSaveGameOps` factory: serializes the
          world snapshot, visibility, match state, and every side map into
          a `SaveBlob`.
        - `targetFindingOps.ts` ƒ?" target-priority tables and helpers for
          finding visible enemies, nearest drop-offs, and nearest wildlife.
        `createSimulationBridge.ts` imports from `bridge/` rather than
        re-declaring any of this.
      - `mapGeneration/` ƒ?" deterministic procedural map generators and the
        spawn-list helper that enforces one-resource-per-cell. Hosts the
        default + Black Forest + Arena generators plus the shared terrain
        helpers (`paintDisc`, `createBaseTerrain`, etc.) and the starting
        offset tables (`STARTING_SHEEP`, `FOREST_PATCHES`, ƒ?İ).
      - `fixtures/` ƒ?" per-category modules that export every vitest-driven
        fixture factory (conquest, economy basics, age progression, combat
        matchups, siege, monastery, castle defense, AI, wonder/relic,
        selection, sheep, scenario validation). The `fixtures/index.ts`
        barrel is the single place the `prototypeScenario.ts` dispatcher
        imports from.
  - `phaser/` ƒ?" Phaser-specific scenes and render projection. Hosts
    `scenes/GameScene.ts` (scene class wiring lifecycle, input, and
    projection-driven render orchestration) plus a `scenes/gameScene/`
    subdirectory for the dep-bag renderer factories factored out of the
    scene file: `debugOverlay.ts` (world-space debug-mode overlays),
    `worldLayers.ts` (health-bar + fog-of-war paints), `selectionLayers.ts`
    (selection ring + placement preview + marquee paints), and
    `cameraController.ts` (per-frame update, middle-drag pan, edge-pan,
    zoom/scroll clamp, HUD-facing camera queries).
  - `ui/` ƒ?" DOM HUD controller
- `tests/` ƒ?" Vitest unit/integration tests and Playwright browser tests
- `scripts/` ƒ?" content and build scripts
- `design/` ƒ?" game design spec, stat CSVs, implementation plan
- `generated/` ƒ?" build-time content output (`generated/content/content.json`)
- `docs/` ƒ?" architecture, devlog, engine feedback, learning, debugging

## Runtime layers

The runtime is layered and the boundaries are intentional.

```
DOM HUD  ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ-§ Phaser scene (render + input) ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ-§ Simulation bridge ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ-§ civ-engine World
                                                       ƒ",
                                                       ƒ""ƒ"?ƒ"? content tables (design/stats ƒ+' generated/content.json)
```

- `civ-engine` owns authoritative simulation state and deterministic ticking. All
  gameplay rules, combat, economy, progression, and AI policy live behind this
  boundary through ECS systems, queries, and commands.
- The simulation bridge (`src/game/simulation/`) owns repo-specific systems and
  scenario setup. It runs on top of `civ-engine` primitives and exposes a stable
  surface to the Phaser scene and HUD.
- Phaser is view and input only. It consumes render frames projected through
  `civ-engine`'s `RenderAdapter` and issues commands back into the simulation. No
  gameplay state lives in Phaser scenes.
- The DOM HUD is a pure consumer of render frames and selection state. It emits
  commands through the same seam as right-click orders from the scene.
- Content flows one-way: design CSVs under `design/stats/*.csv` are normalized at
  build time into `generated/content/content.json`, which the simulation loads.
  The generated file is not committed.

## Determinism contract

- Seeds are reproducible from `?seed=<name>` URL parameters for fixtures.
- Commands and fixed-step ticks are the only sources of state change.
- Render interpolation is a display concern; it does not feed back into simulation
  state. Click hit-testing prefers the displayed entity so the player's perceived
  target matches the authoritative target.

## Test boundaries

- Vitest (`npx vitest run`) covers simulation, content normalization, and scenario
  behavior. These tests drive simulation directly; they do not start Phaser.
- Playwright (`npm run test:browser`) drives the built preview app and asserts
  render-state and command flow end-to-end. Fixture seeds keep runs deterministic.
- `npx tsc --noEmit` and `npx vite build` gate type and build health.

## Where new work belongs

- A new gameplay rule, unit behavior, or AI change ƒ+' simulation bridge or
  `civ-engine` (flag an engine gap in `docs/engine-feedback/current.md` if the
  engine lacks the primitive).
- A new render treatment or input control ƒ+' Phaser scene with a render-state seam
  so browser tests can assert on the rendered output.
- A new HUD element ƒ+' `src/ui/` consuming render frames and selection state.
- New content ƒ+' `design/stats/*.csv` plus any normalizer work in `scripts/`.
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 383ms:
## 2026-04-25
- **`civ-engine` 0.5.3 migration ƒ?" in-place renderable mutations need explicit refresh:** `civ-engine` rolled forward today through three breaking-change waves (0.4.0 ƒ+' 0.5.0 ƒ+' 0.5.3); `node_modules/civ-engine` reports 0.5.3. Audited the aoe2 surface against `../civ-engine/docs/changelog.md`. Two sites had been silently relying on the now-removed auto-detection of in-place component mutations: `createSimulationBridge.ts:5239-5243` (construction-complete `renderable.visualVariant = 'complete'`, fixed earlier today as `d0af9cb` before realizing the engine bump was the root cause) and `bridge/technologyOps.ts:upgradeOwnedUnits` (tech-upgrade mutates `unit.unitType` + `renderable.tint`/`size` + `visionSource.radius` in place ƒ?" fixed in `87d4d9f`). All other 0.4.0 / 0.5.0 / 0.5.1 / 0.5.2 / 0.5.3 breaking changes either don't apply (aoe2 doesn't call `getDiff`, `getEvents`, `setMeta`, `world.emit`, or import `GameLoop`) or already match the new contract (positions go through `setPosition`, save schema is repo-side and independent of engine snapshot v5). Defensive gap noted: `world.step()` doesn't handle the new fail-fast `WorldTickFailureError`; tests don't trigger this path, deferred. Engine is still healthy ƒ?" no new engine asks. New regression test "reflects the upgraded unit type in render state" in `tests/simulation/castleUpgrades.test.ts` would have caught the upgrade bug; existing 14 cases all asserted on `getEconomyState()` and missed the projector-side regression. Final gate: `npx tsc --noEmit` clean, `npm run lint` clean, `npx vitest run` **47/47 files, 393 passed + 1 skipped, 0 failed**.
- **Full multi-AI review iteration 1 + batch-1 fixes:** ran the `/full-review` slash command for the first time on this repo ƒ?" Codex (`gpt-5.4` @ `model_reasoning_effort=high`) + Gemini (`gemini-2.5-pro`) + Claude (`opus` @ `--effort high`) each reviewed the full ~47-kLOC TypeScript tree independently; raw outputs in `docs/reviews/full/2026-04-25/1/raw/{codex,gemini,claude}.md`; synthesized 281-line report at `docs/reviews/full/2026-04-25/1/REVIEW.md`. All three reviewers independently agreed on `createSimulationBridge.ts` god-class persistence (still 7,333 lines after Phase 1ƒ?"3 extractions) and save/load hydration fragility as the two top structural risks; Claude was the only reviewer to find the Monk conversion flip-flop bug, Codex was the only one to catch the projector seed mismatch on load. Then addressed four findings as separate commits on `agent/review-findings-2026-04-25-batch1`: `3f413e2` **[C-1] Monk conversion flip-flop** (`bridge/monkTaskOps.ts:348-376` reset was running before the per-tick guard, so two enemy Monks targeting the same unit in one tick wiped each other's progress to zero ƒ?" fix moves the per-tick guard above the reset so the first-processed Monk wins the increment), `7bba71e` **[H-1] Save-load projector seed** (one-line fix passing `effectiveSeed` to `createProjector` so a loaded match's projector matches the world seed), `bfce2c7` **[H-3] Garrison side-map cross-reference invariant** (post-load mirror check between `garrisonedByBuilding` and `garrisonedUnitToBuilding`, throws on mismatch), and `6b37c62` **[M-16] ARCHITECTURE.md `bridge/` topology refresh** (catches the doc up to all 11 ops modules + 3 top-level siblings; drift-log row added). Verified H-5 ("AI villager rebalance with zero villagers no-ops") as a non-bug ƒ?" silent no-op is correct since rebalance has nothing to redistribute. Larger items (C-2 full enum validation, H-2 wider save/load round-trip coverage, H-4 `getRenderState` memoization, N-1 further bridge extraction) deferred to separate sprints. Plus one out-of-scope fix `d0af9cb`: pre-existing `darkAge` render-state test was already failing on `main` (construction-complete mutates `renderable` in place, RenderAdapter doesn't see in-place mutations ƒ?" added the missing `markOutOfBandRenderChange()` call). Validation: `npx tsc --noEmit` clean, `npm run lint` clean, `npx vite build` clean, `npx vitest run` 47/47 files, 392/392 passed + 1 skipped (full-suite gate green for the first time after fixing the latent darkAge regression). AGENTS.md "Code review" CLI flags refreshed to current working flag landscape; `reference_review_clis.md` user-memory file updated.
- **AGENTS.md Gemini-CLI note corrected:** the "Code review" Gemini line previously claimed `gemini-3.1-pro-preview` 404s on this account. Empirical probe (gemini-cli 0.39.1) shows bare 3.x IDs (`gemini-3-pro`, `gemini-3.1-pro`, `gemini-3-flash`) 404 ƒ?" no GA endpoint ƒ?" but the `-preview` suffixed variants (`gemini-3-pro-preview`, `gemini-3.1-pro-preview`, `gemini-3-flash-preview`) all work; the prior 2026-04-23 devlog had separately observed `gemini-3.1-pro-preview` `RESOURCE_EXHAUSTED`/`QUOTA_EXHAUSTED` (quota, not 404). Updated note to (a) bump CLI version 0.39.0 ƒ+' 0.39.1, (b) explain the `-preview` requirement and list working IDs, (c) note the quota fallback to `gemini-2.5-pro`. Default-model command unchanged. Doc-only; no tests run.

## 2026-04-24
- **Auto-aggression ƒ?" idle military pursues, idle villagers defend (canonical AoE2):** added the `prototypeAutoAggression` simulation system in `src/game/simulation/createSimulationBridge.ts`. Each tick it scans every owned, non-garrisoned, non-monk, non-busy unit and issues an attack-command against the highest-priority enemy in personal LOS via two new helpers `findPreferredEnemyUnitInRadius` / `findPreferredEnemyBuildingInRadius` in `bridge/targetFindingOps.ts` (queryInRadius + existing `targetPriority` tables). Military units use their live `visionSource.radius` (so tech upgrades + fixture vision overrides flow through unchanged); villagers are radius 1 (Defensive Stance: melee-adjacent only) and short-circuit when their `GathererComponent` is busy so explicit gather orders are never silently dropped. Phase ordering is `prototypeAi` ƒ+' `prototypeAutoAggression` ƒ+' `prototypePlayerCommands` so AI/player commands set first take precedence. New `disableAi: boolean` on `PlayerStartSpec` skips both the planner and AA for fixture-passive enemies (the AA gate reads `aiStates.has(owner)`, which the seeding site at `start.disableAi` already drives). 7 new fixtures in `fixtures/combatMatchups/autoAggression.ts` plus `auto-aggro-monk-skip-fixture` + `auto-aggro-villager-gathering-fixture`; 10 new tests in `tests/simulation/autoAggression.test.ts` lock the contract: pursue-in-vision, ignore-out-of-vision, archer-pursuit-then-fire, player-move-overrides, villager-adjacent-defense, villager-no-pursuit, villager-gather-honored, monk-skip, sequential-targets-after-kill, save/load mid-engagement. Two regressions caught and fixed inline: the `moving-enemy-attack-fixture` got `disableAi: true` so its wandering enemy scout stays on its path until the player issues a command; the AA radius read was switched to the unit's live `visionSource.radius` so the Mangonel/Onager min-range fixtures (whose enemy spearmen are spawned with `vision: radius 1`) keep their passive-enemy intent. One round of code-review iteration via the in-environment `superpowers:code-reviewer` subagent (gather-honor + monk-skip test + `disableAi` cross-ref). Validation: `npx vitest run` **45/45 files, 385 passed + 1 skipped** on the post-implementation run; `npm run test:browser` **81/82 passed** (1 flaky pre-existing wolf-aggro test passed in isolation; wolves are resources, not units ƒ?" AA never targets them); `npx tsc --noEmit`, `npx vite build`, `npm run lint` clean. Spec at `docs/superpowers/specs/2026-04-24-aggressive-military-design.md`.
- **Sheep show up in the selection panel icon grid for multi-selections:** the panel's `renderSelectionIcons` only iterated `economyState.units` when classifying selected ids, so owned sheep ƒ?" which live in `economyState.resources` ƒ?" silently fell out of the grid. Four sheep selected ƒ+' empty icon grid; mixed villager + sheep ƒ+' only the villager chip. Fix: added `id: number` to the `EconomyState.resources` entry, threaded it through `getEconomyState` + the `isEconomyResourceEntry` type guard, and rewrote `renderSelectionIcons` (`src/ui/hud/selectionPanel.ts`) to also build a `sheepById` map and emit chips via the entity-helpers (`formatEntityIcon` / `formatEntityIconAccent` / `formatEntityName` already supported sheep). Single non-unit selections keep using the existing `data-selection-entity-icon` big-chip path so the browser-test contract for single-sheep / single-building stays intact. Exposed `selectUnitsInBox` on `__AOE2_TEST__` so capture scripts can drive mixed selections without panning the viewport. Regression coverage: `tests/simulation/selectionPanelIcons.test.ts` (4 cases ƒ?" 4-sheep, mixed, single-sheep, 3-villager). Visual proof: `docs/devlog/artifacts/2026-04-24-sheep-selection-{before,after,diff}.png` (35.81% pixel change; panel grew from 301 px to 312 px when the `SH A-3` chip was added next to the `V` chip). Validation: `npx tsc --noEmit` clean, `npx vitest run` **44/44 files, 377 passed + 1 skipped**, `npm run test:browser` **82/82 pass**, `npx vite build` clean.
- **Default-map narrow-path fix (villagers no longer walled in):** the procedural resource-cluster placer in `applyStandardPlayerOpeningProcedural` could walk a cluster all the way around a ring and meet an adjacent cluster's arc, sealing the starting villagers into a pocket. On seed `aoe2-prototype` the berry arc `(5,7)ƒ+'(9,5)` met the sheep cluster at `(5,8)(5,9)(6,10)` and the water/forest strip to the west, so `findGridPath` returned null for any west-target move and the command was silently cleared. Fix: `cellBlockedByScenarioEntity` now reserves four guaranteed-clear cardinal exit corridors ƒ?" a 2-row horizontal corridor at `y = TC.y` and `y = TC.y + 1` (spanning `|x ƒ^' (TC.x + 1)| ƒ% 13`) and a 2-column vertical corridor at `x = TC.x + 1` and `x = TC.x + 2` (spanning `|y ƒ^' (TC.y + 1)| ƒ% 13`). The extent (13 cells) reaches past the outermost forest ring (12), so no ring walker can close a continuous arc around the base. Regression coverage: `tests/simulation/defaultMapNarrowPath.test.ts` (4 cases asserting each starting villager reaches each cardinal near-base target ƒ?" before the fix, west+north timed out stuck; after, all pass in 1.3 s) and `tests/simulation/narrowCorridorMovement.test.ts` (4 hand-crafted tree-corridor cases locking the "friendlies do not block A*" contract). New fixture `narrow-corridor-fixture` in `fixtures/economyBasics.ts`. Debug session at `docs/debugging/2026-04-24-narrow-corridor-pathfinding.md`. Validation: `npx tsc --noEmit` clean, `npx vitest run` **43/43 files, 373 passed + 1 skipped** (the 6 pre-existing Windows `onTaskUpdate` worker warnings remain), `npx vite build` clean. No architecture change; no engine ask (`civ-engine` pathfinding + `OccupancyBinding` both behaved as documented ƒ?" the bug was repo-side map-gen only).

## 2026-04-23
- **Final 800+-line file splits (move-only):** six files above 800 lines all trimmed below 550 lines via barrel re-exports. `fixtures/castleDefense.ts` (**984**) ƒ+' `castleDefense/{fletching,fu3Walls,fu3Archers,towerAndCastle}.ts` (**188 / 234 / 373 / 273** lines) behind a **31**-line barrel. `fixtures/combatMatchups.ts` (**962**) ƒ+' `combatMatchups/{infantryAndCavalry,rangedSkirmish,generalCombat}.ts` (**505 / 125 / 348** lines) behind a **28**-line barrel. `fixtures/monastery.ts` (**858**) ƒ+' `monastery/{heal,convert,relic}.ts` (**219 / 336 / 319** lines) behind a **25**-line barrel. `fixtures/ageProgression/imperial.ts` (**817**) ƒ+' `imperial/{ageUp,upgrades,castle}.ts` (**131 / 504 / 198** lines) behind a **23**-line barrel. `tests/browser/game-progression-and-production.spec.ts` (**847**, 21 tests) ƒ+' four themed specs (`game-progression-{ageup,upgrades,production}.spec.ts` ƒ?" **93 / 138 / 322** lines with 3 / 3 / 8 tests ƒ?" plus trimmed remainder **303** lines / 7 tests = 21). `tests/browser/helpers/gameTestHelpers.ts` (**820**) ƒ+' `gameTestHelpers/{types,snapshot,camera,command,selection,hud,placement}.ts` (**55 / 25 / 172 / 68 / 190 / 275 / 54** lines) behind a **71**-line barrel re-exporting all 45 previous names. All move-only; barrel files preserve every public export so zero downstream import changes. Validation per commit: `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npx.cmd vite build` clean; targeted vitest runs green (castle/monastery/imperial/combat subsets all pass). Final `npm.cmd run test:browser` **82/82** pass across all split specs. Architecture: new sub-directories logged in `docs/architecture/drift-log.md`.
- **Trim the last three >1,000-line files via mechanical splits:** `fixtures/ageProgression.ts` (**1,868 lines** / 25 factories) splits into `fixtures/ageProgression/{feudal,castle,imperial,blacksmith}.ts` (**694 / 241 / 817 / 144 lines**) behind a 41-line barrel; `fixtures/siege.ts` (**1,090 lines** / 18 factories) splits into `fixtures/siege/{mangonel,scorpion,ram,bombardCannon,trebuchet,workshop}.ts` (**383 / 65 / 289 / 119 / 127 / 147 lines**) behind a 40-line barrel; and `tests/simulation/createSimulationBridge.core.test.ts` (**1,019 lines** / 31 tests) splits into `createSimulationBridge.{bootstrap,unitMovement,gatheringAndDropoff,wildlifeAndSheep}.test.ts` (**535 / 191 / 160 / 160 lines** ƒ?" 17 / 6 / 4 / 4 tests = 31). All move-only; no behavior change; fixture factory names and test seeds/assertions preserved. Validation: `npx.cmd tsc --noEmit` / `npm.cmd run lint` / `npx.cmd vite build` clean per commit; targeted vitest runs green between commits (age-progression 141/141, siege 39/39, split test files 31/31). Architecture: `fixtures/ageProgression/` + `fixtures/siege/` subdirectories logged in `docs/architecture/drift-log.md`.
- **Shrink `GameScene.ts` via `gameScene/` extraction:** four move-only commits factor renderer + controller chunks out of the 1,737-line scene file into `src/phaser/scenes/gameScene/`: `debugOverlay.ts` (**184 lines**, five world-space debug-mode overlays), `worldLayers.ts` (**185 lines**, per-entity health bars + fog of war paint), `selectionLayers.ts` (**211 lines**, selection ring + placement preview + drag-selection marquee), and `cameraController.ts` (**369 lines**, camera per-frame update / middle-drag pan / edge-pan / zoom + scroll clamp / HUD camera queries). `GameScene.ts` drops from **1,737 ƒ+' 1,161 lines** (ƒ^'33.2%); new `gameScene/` modules total **949 lines**. Move-only; no runtime behavior change; public API surface (CameraState export, `getCameraState` / `centerCameraOnWorldPosition` / `getScreenPointForCell` / `getSelectionBoxState` / `getPlacementPreviewState` / `getBuildingVisualStates` / `getEntityHealthBarStates` / `getDisplayedEntities` / `getPlacementPreviewVisualState` / `selectEntityAtWorldPosition` / `issueContextCommandAtWorldPosition` / `setBridge`) preserved. Validation per commit: `npx.cmd tsc --noEmit` / `npm.cmd run lint` / `npx.cmd vite build` clean; `npx.cmd vitest run tests/phaser/` green (**13/13**) between commits.
- **Phase-3 bridge extractions:** three more move-only commits factor placement preview + building placement (`bridge/placementOps.ts` **204 lines**), the full-game save serializer (`bridge/saveGameOps.ts` **410 lines**), and the target-finding priority tables + visible-enemy / nearest-drop-off / nearest-wildlife helpers (`bridge/targetFindingOps.ts` **396 lines**) out of `createSimulationBridge.ts`. The planned 4th commit (selection + command dispatch) was skipped because its dep-bag would have exceeded 15 fields (~25+), which the brief treats as the wrong boundary. `createSimulationBridge.ts` drops from **7,705 ƒ+' 7,214 lines** (ƒ^'6.4%); cumulative phase-1+phase-2+phase-3 shrink is **9,519 ƒ+' 7,214 (ƒ^'24.2%)**; `bridge/` totals **11 modules, 3,548 lines**. Validation per commit: `npx.cmd tsc --noEmit` / `npm.cmd run lint` / `npx.cmd vite build` clean; targeted vitest subsets green between commits (placement: 13/13; save: 6/6; target-finding: 27/27). Final full vitest: **38/38 files, 365 passed + 1 skipped** (6 pre-existing Windows `onTaskUpdate` worker warnings, not test failures). Commits `9ac7ff1` ƒ+' `6193686` ƒ+' `584727a` (+ docs commit).
- **Phase-2 bridge extractions:** four more move-only commits factor the Monk task subsystem (`bridge/monkTaskOps.ts` **646 lines**), technology/upgrade application (`bridge/technologyOps.ts` **471 lines**), match-end + score (`bridge/matchEndOps.ts` **230 lines**), and the Slice-10 AI decision helpers (`bridge/aiDecisionOps.ts` **273 lines**) out of `createSimulationBridge.ts`. Same flat dep-bag factory pattern as phase 1; side-map ownership stays in createWorld. `createSimulationBridge.ts` drops from **8,792 ƒ+' 7,705 lines** (ƒ^'12.4%); cumulative phase-1+phase-2 shrink is **9,519 ƒ+' 7,705 (ƒ^'19.1%)**; `bridge/` totals **8 modules, 2,538 lines**. Validation per commit: `npx.cmd tsc --noEmit` / `npm.cmd run lint` / `npx.cmd vite build` clean; targeted vitest subsets green between commits (monk: 62/62; tech: 124/124; match-end: 18/18 after one 10s-flake retry; AI: 20/20). Commits `1f8702d` ƒ+' `f62c41a` ƒ+' `b0b8f82` ƒ+' `302067e` (+ docs commit).
- **Shrink `createSimulationBridge.ts` via `bridge/` extraction:** four move-only commits factor safe helper chunks out of the 9,519-line god-file into `src/game/simulation/bridge/`: `pureHelpers.ts` (30 pure helpers ƒ?" clamp, grid/coordinate transforms, resource/position helpers, footprint comparator, etc., plus shared `GameEvents`/`GameCommands`/`GameComponents`/`GameWorld` type aliases and the `UNIT_SUBGRID_*`/`UNIT_CELL_SLOT_OFFSETS`/`MARKET_BASE_RATE` constants), `visibility.ts` (`createProjector`, `syncVisibilitySources`, sheep claim/ownership helpers + `SHEEP_VISION_RADIUS`/`MAX_HERDABLE_CLAIM_RADIUS`), `trebuchetState.ts` (`createTrebuchetStateOps` factory wrapping `advanceTrebuchetTransition`/`beginTrebuchetUnpack`/`beginTrebuchetPack`/`isTrebuchetStationary`/`isTrebuchetSilent` around the shared `trebuchetPackStates` side map), and `fogMemoryOps.ts` (`createFogMemoryOps` factory wrapping `getOrCreateMemoryMap`/`getFogMemoryEntities`/`getHumanFogMemorySize` around `{ fogMemory, humanPlayerId, visibility }`). `createSimulationBridge.ts` drops from **9,519 ƒ+' 8,792 lines** (ƒ^'7.6%); new `bridge/` modules total **918 lines**. Move-only; no runtime behavior change. Validation per commit: `npx.cmd tsc --noEmit` clean, `npm.cmd run lint` clean, `npx.cmd vite build` clean; targeted vitest runs across 10 simulation files (88 cases: core 31, combat 5, production 4, fogMemory 5, trebuchetPackUnpack 3, saveLoad 6, scenarioValidation 7, imperialSiege 13, sheepMovement 12, sheepVision 2) all pass. Commits `63777d4` ƒ+' `e4b9b11` ƒ+' `e9c3431` ƒ+' `a4f9f9f` on `agent/shrink-createSimulationBridge`. Architecture: new `bridge/` subdirectory documented in `docs/architecture/ARCHITECTURE.md` + `docs/architecture/drift-log.md`.
- **Selection panel compact-icon grid for multi-unit selections:** reclaimed panel vertical space so every selected unit type stays visible even with many types selected. Single-unit selections keep the big labelled chip (icon + name); multi-unit selections now route to a wrapping icon-only grid (`repeat(auto-fill, minmax(48px, 1fr))`) with a small `x<count>` footnote under each icon (omitted when count is 1). Full unit name moves to the HUD tooltip for each icon. Panel height for a 3-type selection drops from `299 px` to `180 px` (~40% reclaim) before accounting for overflow cases where the old layout would have scrolled. Before/after + pixel diff at `docs/devlog/artifacts/2026-04-23-selection-panel-{before,after,diff}.png`. Existing `data-selection-unit-icon/chip/count/label` selectors preserved. Added `tests/browser/_captureSelectionPanel.spec.ts` as a dev-only capture tool (Playwright `testIgnore: ['**/_*.spec.ts']`). Validation: `npx tsc --noEmit`, `npm run lint`, `npx vite build` clean; `npm run test:browser` **82/82 pass**.
- **Split the 9,968-line `prototypeScenario.ts` god-file:** extracted every pure terrain helper, offset table, player-opening routine, and map generator into dedicated `mapGeneration/` modules (`constants`, `sharedTerrainHelpers`, `startingOffsets`, `applyStandardPlayerOpening`, `blackForestMap`, `arenaMap`); pulled every ~120 fixture factory into 13 category modules under `src/game/simulation/fixtures/` with `fixtures/index.ts` as the single barrel the dispatcher imports from; deleted the ~130-line unreachable default-seed fallback body that the top-of-function `DEFAULT_SEED` short-circuit had made dead code. `prototypeScenario.ts` retains the public types (`PrototypeScenario`, `ScenarioSpawnSpec`, `PlayerStartSpec`, `Offset`, `TerrainCellSpec`), constants (`MAP_WIDTH`, `MAP_HEIGHT`, `TPS`, `DEFAULT_SEED`, `HUMAN_PLAYER_ID`), helper re-exports, and the seed ƒ+' factory dispatcher; final size **789 lines** (from 9,968). Largest new files: `fixtures/ageProgression.ts` (**1,868**), `fixtures/siege.ts` (**1,090**), `fixtures/castleDefense.ts` (**984**), `fixtures/combatMatchups.ts` (**962**), `fixtures/monastery.ts` (**858**), `mapGeneration/applyStandardPlayerOpening.ts` (**567**). No runtime behavior change: same seeds ƒ+' same scenarios. Validation: `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npx.cmd vite build` all clean; affected `prototypeScenario.test.ts` (10), `createSimulationBridge.core.test.ts` (31), `createSimulationBridge.darkAge.test.ts` (4), `createSimulationBridge.barracks.test.ts` (1) all pass (46/46 on affected-test run). Commits `41ac704` ƒ+' `07f86a1` ƒ+' `9796216` ƒ+' `2824782`. Architecture: `fixtures/` subdirectory documented in `docs/architecture/ARCHITECTURE.md` + `docs/architecture/drift-log.md`.
- **Resource cell exclusivity + procedural default map:** fixed the tree-on-stone stacking visible in `npm run dev` (root cause: `STARTING_STONE` offsets `(0..1, 5..6)` exactly overlapped `FOREST_PATCHES[2]` `(-2..1, 5..6)`, so each player's stone cells also carried a tree every game). Added a first-write-wins spawn-list helper (`src/game/simulation/mapGeneration/spawnList.ts`) and a procedural default-map generator (`src/game/simulation/mapGeneration/defaultMap.ts`) that picks per-base cluster directions from the seed and guarantees the canonical per-owner counts (sheep 4, boar 2, berry 6, gold 4, stone 4, tree 24) and per-base resource-kind coverage within a 10-cell radius. Routed `applyResourcePatch` / `applyForestPatch` / `applyShoreFishPatches` through the helper so every existing generator inherits the one-resource-per-cell invariant. Added a bridge-boot resource-on-resource validator alongside the existing building/unit/resource-on-building passes, plus a new `slice12-validation-resource-on-resource-fixture` that proves it throws with the seed name. Re-anchored two coordinate-dependent tests that were coupled to the old hand-crafted layout (`createSimulationBridge.core.test.ts` scout movement, `createSimulationBridge.darkAge.test.ts` house placement) to query live positions instead. Visual verification: before/after screenshots + pixel diff at `docs/devlog/artifacts/2026-04-23-default-map-{before,after,diff}.png` ƒ?" `59,144` of `480,000` pixels changed (`12.32%` of `800x600`). Final vitest suite: **38/38 files, 365 passed + 1 skipped + 13 new tests**; `npx tsc --noEmit` / `npx vite build` clean; `npm run test:browser` run as part of the close-out. `npm test` still exits non-zero only because of the documented pre-existing vitest-worker `onTaskUpdate` warnings on Windows. Commits `a088ca1` ƒ+' `a13a022`. Architecture: new subdirectory `src/game/simulation/mapGeneration/` logged in `docs/architecture/drift-log.md`.
- **Selection info panel now shows activity:** new line under the selection name tells the player what the selected entity is actively doing ƒ?" single labels like `Gathering wood`, `Building House`, `Attacking Scout Cavalry`, `Training Villager`, `Researching Forging`, `Under construction`, `Idle`, `Packing`/`Unpacking` (Trebuchet), `Dropping off wood`, `Retrieving relic` / `Carrying relic` (Monk); multi-selection rolls up to a coarse-verb breakdown sorted by semantic priority tier (combat first, idle last) and capped at 5 tokens with an overflow marker. Architectural seat: the simulation bridge emits a structured `{ verb, target: { kind, type } | null }` payload via a new dedicated module `src/game/simulation/selectionActivity.ts` (extracted ~150 LOC out of the 9.6k-line bridge) and the HUD's `formatActivityLabel` in `selectionPanel.ts` composes the human-readable string through the existing `displayNames.ts` single source of truth. Coverage: 23 new vitest cases in `tests/simulation/selectionActivity.test.ts` (1 overflow case skipped because no six-distinct-activity fixture exists yet), two new browser cases in `tests/browser/game-selection.spec.ts` (single-unit `Gathering wood` and multi-select `N idle`). Review iteration landed 5 review rounds (Gemini + Claude CLI + Codex in two passes, plus the persistent team's architect/designer/researcher on the spec+plan) ƒ?" caught and fixed: the dead `unitCommands['move']` gather/return branches, the unreachable garrisoned-unit branch (garrisoned units aren't selectable through the panel), the coupling where `coarseVerbForUnit` parsed human labels with `startsWith`, the kebab-to-title fallback that would have silently diverged `Scout` from `Scout Cavalry`, and the bridge god-class risk (extraction restored the file-size invariant). Game-designer driven polish: `Returning wood` ƒ+' `Dropping off wood`, monk `Depositing relic` split into `Carrying relic` (transit) vs `Retrieving relic` (pickup), multi-selection ordering reshuffled from pure count-desc-alphabetical to tier-first so combat surfaces first and idle always lands last. Engine-feedback: none ƒ?" all state used was already tracked in existing bridge maps (`unitCommands`, `monkTasks`, `trebuchetPackStates`, `productionQueues`, `constructionStates`, `GathererComponent`). Final validation: `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` passed; `npm.cmd run test:browser` passed with **82/82** browser tests. Affected vitest file runs **23/24** passing + 1 skipped overflow case; full `npm.cmd test` exits non-zero on this Windows setup from the pre-existing `[vitest-worker]: Timeout calling "onTaskUpdate"` warnings but the last completed full suite before the final refactor pass reported **36/36** files and **352/353** tests passing. Commits: `c4df9b8` (spec) through `fb97891` (designer polish). AoE2-authenticity note from `game-researcher`: this HUD line is a NEW feature relative to canonical AoE2 (the source game surfaces activity via economy-panel profession counts and an idle-villager counter, never as prose in the selection panel) ƒ?" the spec frames it as an enrichment, not a reproduction.
- **`prototypeScenario.ts` artifact cleanup:** removed the lingering mixed-line-ending worktree artifact from `src/game/simulation/prototypeScenario.ts` by restoring the file exactly to `HEAD` with no content change. Re-ran the full validation gate afterward: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, and `npm.cmd run test:browser` passed (`80/80` browser tests). `npm.cmd test` again finished with **35/35** files and **327/327** tests passing, but still exits non-zero because of the pre-existing `[vitest-worker]: Timeout calling "onTaskUpdate"` unhandled errors on this Windows setup; this rerun surfaced **6** of those warnings.
- **`civ-engine` occupancy integration landed:** the bridge now routes placement/passability occupancy queries through `src/game/simulation/worldOccupancy.ts`, an `OccupancyBinding` adapter that preserves the repo's crucial blocker-vs-crowding rule: terrain/buildings/resources are whole-cell blockers, while units only crowd cells and still remain path-passable. `createSimulationBridge.ts` now rebuilds/syncs occupancy from the authoritative world, keeps it current across movement, garrison, ungarrison, carried-relic movement, and save/load hydration, and avoids leaking low-level occupancy errors ahead of the fixture validator's seed-specific messages. Iteration stayed on affected tests first; the full final gate passed `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, and `npm.cmd run test:browser` (`80/80` browser tests). `npm.cmd test` finished at **35/35** files and **327/327** tests passing, but still exits non-zero because of the pre-existing **5** `[vitest-worker]: Timeout calling "onTaskUpdate"` unhandled errors on this Windows setup. Claude review ended with no actionable issues after the main review loop; Codex and Gemini were attempted repeatedly but remained blocked by local CLI timeout/model/quota problems, which is recorded in the detailed devlog rather than papered over.
- **Bundled HUD typography refresh:** the game now ships `IBM Plex Sans` latin 400/600/700 through `@fontsource` instead of relying on host-installed serif/system fonts, with `Courier New` preserved for the debug overlay and pasted-save textarea. Browser coverage in `tests/browser/game-hud-and-camera.spec.ts` now waits for `document.fonts.ready`, explicitly loads the bundled 400/600/700 faces, and still checks the mono HUD surfaces. Review iteration caught and fixed the original cross-platform font-stack drift, the weak computed-style-only assertion, the overly Windows-specific fallback stack, and an incidental `package-lock.json` `../civ-engine` version hunk. Visual verification: before/after HUD screenshots plus a pixel diff were generated during the task (`55,028` changed pixels, `11.46%` of an `800x600` capture) and summarized into the devlog before the temporary `code_review/` artifacts were deleted. Final reviewer verification ended at the right stopping point: Claude reported no actionable issues remaining, while local Codex and Gemini reruns were blocked by CLI timeout/model/quota failures rather than fresh code findings. Final validation: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, and `npm.cmd run test:browser` passed (`80` browser tests); `npm.cmd test` ran the full suite to completion with **34/34** files and **321/321** tests passing, but still exits non-zero because of the pre-existing **5** `[vitest-worker]: Timeout calling "onTaskUpdate"` errors on this Windows setup.
- **Fullscreen-only edge-pan safeguard:** edge-pan no longer triggers in ordinary windowed play. `GameScene` now enables edge-pan only when the game is actually fullscreen or the browser window already covers the full screen, and browser coverage now locks the four key camera contracts: windowed off, document-fullscreen on, full-screen-window on, and fullscreen-exit off. Review iteration caught and fixed an over-broad fullscreen predicate, a non-idempotent fullscreen helper, missing heuristic coverage, and the missing docs/devlog trail. Final reviewer verification from Codex, Gemini, and Claude reported no actionable remaining issues after the last cleanup/doc pass. Final validation: `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run test:browser` passed (`79` browser tests); `npm.cmd test` reached **34/34** files and **321/321** tests passing but still exits non-zero because of the pre-existing **6** `[vitest-worker]: Timeout calling "onTaskUpdate"` unhandled errors on this Windows setup.
- **Engine-feedback live-doc cleanup:** reformatted `docs/engine-feedback/current.md` into a tighter live-status document with compact bullets for verdict, active asks, and recommendation, without changing the underlying engine assessment. Review surfaced and resolved one documentation-hygiene mismatch between the summary and detailed log, and final verification found no actionable issues. Validation: not run because this was a docs-only formatting cleanup.

## 2026-04-22
- **Precise unit selection + browser spec split:** left-click selection and drag-box selection now use exact rendered-body geometry instead of padded tile-ish hit areas, marquee drags show live highlights for the units that will actually be selected on mouse-up, context-command targeting keeps a separate forgiving padded unit shape, same-cell exact-click cycling now keys off a repeated click in the same click cell instead of any prior selection state, and same-layer overlap hits now resolve to the visibly topmost entity when render order is the deciding factor. The old `tests/browser/game.spec.ts` was split into feature-focused browser specs plus shared helpers so selection regressions can run in isolation during iteration. Iteration checks: `npx.cmd vitest run tests/phaser/entityHitTest.test.ts` passed (11 tests), `npx.cmd playwright test tests/browser/game-selection.spec.ts` passed (10 tests), and `npx.cmd playwright test tests/browser/game-combat-and-meta.spec.ts` passed (12 tests). Final reviewer verification from Codex, Gemini, and Claude reported no actionable issues after the last overlap-z-order fix. Final validation: `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run lint`, and `npm.cmd run test:browser` passed; `npm.cmd test` reached **34/34** files and **321/321** tests passing but still exits non-zero because of the pre-existing **5** `[vitest-worker]: Timeout calling "onTaskUpdate"` unhandled errors on this Windows setup.
- **Prototype rule-table extraction cleanup:** split the biggest pure economy/building/unit rule clusters out of `src/game/simulation/createSimulationBridge.ts` into `prototypeEconomyRules.ts`, `prototypeBuildingRules.ts`, and `prototypeUnitRules.ts`, then added `tests/simulation/prototypeRules.test.ts` to lock representative gameplay-facing rule contracts against the extracted modules. Review also caught and fixed an accidental bridge-file BOM/mojibake rewrite, a duplicated unharvestable-resource error path, owner-id magic numbers in the new tests, and a trailing blank line in the staged diff. A brief attempt to widen some rule tables toward canonical AoE2 values was explicitly rolled back so the final change stayed cleanup-only and behavior-preserving. Validation: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, and `npm.cmd run test:browser` passed; `npm.cmd test` reached **34/34** files and **314/314** tests passing but still exits non-zero because of the pre-existing `[vitest-worker]: Timeout calling "onTaskUpdate"` errors.
- **Sheep vision from ownership:** claimed sheep now sync a real `visionSource` from `resource.owner`, so they reveal fog for their owner as they move and let previously seen enemy buildings fall back to normal fog memory when they leave. Added `sheep-vision-fixture` plus `tests/simulation/sheepVision.test.ts` to lock the full gameplay contract, including the negative guard that nearby neutral or enemy-owned sheep must NOT reveal the same hidden enemy house and a save/load round-trip that proves the revealed state survives from the `SaveBlob` itself rather than from the original fixture seed. Review cleanup dropped an intermediate depletion-only draft branch before finalizing the diff, documented the chosen sheep vision radius inline, and fixed an accidental `docs/learning/lessons.md` encoding regression. Validation: `npm.cmd test` reported 33/33 files and 303/303 tests passing, but the suite still exits non-zero because the pre-existing `[vitest-worker]: Timeout calling "onTaskUpdate"` unhandled errors remain; `npm.cmd run typecheck`, `npm.cmd run build`, and `npm.cmd run test:browser` passed; `npm.cmd run lint` still fails with 15 unrelated pre-existing errors.
- **Move-order path caching:** selected-unit move orders now reuse a transient `movePathCache` route instead of re-running `findGridPath` every tick while following the same destination. The cache lives outside serialized `unitCommands`, is cleared whenever a command is replaced or removed, and re-plans when no cached route exists, the immediate next cell stops being passable, or the originally clicked cell opens back up after a temporary blocker forced a fallback route. Added `tests/simulation/movementPathCaching.test.ts` plus the new `move-target-unblocks-fixture` to lock five contracts: steady-order cache hits, "new move order drops the old route," "save/load forces a fresh re-plan," "a blocked clicked cell that becomes free mid-walk still finishes on the clicked cell," and "once that blocker clears, the unit redirects before touching the stale fallback tile." Validation: `npm.cmd test` reported 32/32 files and 301/301 tests passing, but the suite still exits non-zero because the pre-existing `[vitest-worker]: Timeout calling "onTaskUpdate"` unhandled errors remain; `npm.cmd run typecheck` passed, and `npm.cmd run test:browser` passed (71 browser tests, including the fresh production build it runs via `npm run build`). `npm.cmd run lint` still fails in unrelated pre-existing files.

## 2026-04-20
- **Batch FU8 (Infrastructure close):** vitest worker RPC timeout investigated and documented. New config keeps default pool (forks) but adds `testTimeout/hookTimeout: 180_000` + `teardownTimeout: 30_000` + `slowTestThreshold: 60_000` + `maxWorkers/minWorkers: 1`. Full suite now runs to completion (Test Files 31/31 passed, Tests 296/296 passed in 17.6 min) with 6 benign `[vitest-worker]: Timeout calling "onTaskUpdate"` unhandled errors documented inline ƒ?" pre-FU8 the run would abort with `ERR_IPC_CHANNEL_CLOSED` after 5-6 files; post-FU8 the warnings fire but the suite completes fully. Investigated `pool: 'forks' + singleFork: true` and rejected it (made things WORSE: 130s aiPlayer test hogs the single fork, aborts remaining 27 files). Config comments in `vitest.config.ts` explain why the birpc deadline isn't user-tunable. OccupancyGrid migration permanent-skipped ƒ?" the API has one flat "blocked/occupied" namespace with no `blockedBy` metadata, but our helpers need a structural distinction between building/resource/unit blockers (asymmetric-ignore semantics in `isCellPassableForWildlife`). Documented in `docs/engine-feedback/current.md`. Fixed a drifted Arena ring test that had been counting `stone-mine` since FU3 changed it to `stone-wall`. Roadmap close: Slice 1-12 + FU1-FU8 shipped; 26,727 LOC in `src`, 296 vitest cases, 71 Playwright cases; consolidated summary in `docs/devlog/detailed/2026-04-19_2026-04-20.md`.
- **Batch FU7 (Trebuchet pack/unpack + tie-break + score tuning + Wonder/Monk regression):** Trebuchet gains a two-state pack/unpack machine ƒ?" packed=mobile/no-fire, unpacked=stationary/fires at range 16 with +200 anti-building; 50-tick transitions both directions via `trebuchetPackStates` side-map + helpers. Wonder vs Relic tie-break: both countdowns stamp `lastCompletedTick = world.tick`; new `prototypeWinConditionResolver` picks lower tick (Wonder wins exact ties). Score weights retuned: buildings A- 50, resources A- 0.02, enemy units killed A- 20 (NEW), wonder A- 500. New 3 trebuchet vitest cases + 4 new winConditions cases. Save-schema stayed at 1.

## 2026-04-19
- **Batch FU6 (Pure refactors, no behavior change):** split 2173-line `createHudController.ts` into orchestrator (433 lines, -80%) + 7 helpers (tooltips, toast, debugOverlay, postGameSummary, saveLoadPanel, displayNames, minimap, selectionPanel). Hoisted `SimulationDebugSnapshot` to `types.ts`. Extracted `latestResearchedInChain` helper. Zero behavior diffs.
- **Batch FU5 (Save/Load HUD + Playwright):** Slice 9 Tasks E+F. Save writes `localStorage['aoe2-save-v1']` + JSON download; Load accepts localStorage/paste-JSON and swaps the live bridge via HUD facade + `GameScene.setBridge`. Playwright save ƒ+' drift ƒ+' load ƒ+' rewind case.
- **Batch FU4 (AI improvements):** AI reaches Castle/Imperial via tuned villager targets per age + 15-tick decision interval for hard AI; AI builds Monastery + trains Monks + heals wounded + collects relics; AI pursues Wonder in Imperial (wins via Wonder victory on `ai-planner-fixture`).
- **Batch FU3 (Defensive-fire polish + real walls):** garrisoned-archer-extra-arrows for Castle (+1 per archer capped at 5); closest-edge distance for large buildings in `findPreferredVisibleEnemyUnitInRange`; real `stone-wall` (1x1 HP 2000) + Palisade Wall (1x1 HP 250) building types ƒ?" Arena map uses real walls.
- **Batch FU2 (Militia intermediates + Paladin + Heavy Camel):** Man-at-Arms / Long Swordsman / Two-Handed Swordsman / Champion chain; Paladin (Cavalier ƒ+' +40 HP +2 atk); Heavy Camel (Camel ƒ+' +20 HP +2 atk).
- **Batch FU1 (Armor damage + full Blacksmith progression):** wired `CombatState.armor` into every combat damage site (`Math.max(1, atk + bonus - targetArmor)` for units, `Math.max(0, ...)` for buildings). 11 new techs (Forging/Scale/Barding/Padded feudal; Iron Casting/Chain/Barding/Leather/Bodkin castle; Ring Archer/Chemistry imperial ƒ?" Chemistry gates Bombard Cannon). `startingResearchedTechnologies` fixture hook.
- **Engine feedback doc split:** `docs/engine-feedback.md` split into `current.md` (live asks) + `past.md` (archive).

## 2026-04-18
- **Slice 12 (engine-debt refactors):** unified `findSafeSpawnWithEgress` helper (`src/game/simulation/spawn.ts`); bridge-boot fixture validation pass catches 13 pre-existing bad fixtures; `coarse-vs-fine` F2 overlay; engine feedback doc refresh. OccupancyGrid migration descoped (addressed as permanent-skip in FU8).
- **Slice 11 (UX polish + overlays + maps):** HUD tooltips, command-rejection toast ring buffer, F2 debug overlay cycle (7 modes), Black Forest + Arena deterministic map generators.
- **Slice 9 (Save/Load):** `SaveBlob` + 29 side maps + `SAVE_SCHEMA_VERSION = 1`; byte-for-byte deterministic replay after 100 more ticks from rehydrated bridge. HUD Tasks E+F deferred ƒ+' FU5.
- **Slice 8 (Wonder/Relic/Score win conditions):** 4x4 Imperial-only Wonder; per-Wonder + per-Relic countdown systems; per-owner score.
- **Slice 7 (Imperial Age + final-tier):** 12 Imperial units (Arbalest/Halberdier/Hussar/Cavalry Archer/Cavalier/Champion/Elite Longbowman/Onager/Heavy Scorpion/Siege Ram/Bombard Cannon/Trebuchet) + 14 techs. Armor stat added (damage-reduction deferred ƒ+' FU1).
- **Slice 6 (Castle + Longbowman):** 4x4 Castle (HP 4800, atk 11 pierce range 8, garrison 20); Britons Longbowman with Fletching propagation.

## 2026-04-17
- **Slice 1-5 opening batch:** sheep command + fog memory; Castle-Age Crossbowman/Pikeman/Light Cavalry upgrades; Camel + Cavalry Archer; Siege Workshop (Mangonel/Scorpion/Battering Ram); Monastery + Monks + relics.
- **Docs reorganized** to match AGENTS.md (date-ranged detailed devlogs, `architecture/`, `debugging/`, `learning/`).

## 2026-04-10 to 2026-04-13 (pre-roadmap)
- **Bootstrap + spec:** TypeScript + Vite + Phaser 3 + `civ-engine`; normalized content pipeline; AoE2 spec finalized (18 supported civs). Deterministic resource starts, fog of war, minimap, Dark Age economy loop.
- **Full Dark/Feudal/Castle core:** TC + villager + House + Mill/Lumber/Mining Camp drop-offs; Barracks + Militia + conquest; Feudal Age with Archery Range/Blacksmith/Stable/Spearman/Skirmisher/Watch Tower/Market; Castle Age with Knights + multiple TCs. Drag-box + double-click + stacked-tile cycling. `EntityRef` semantics.
- **World + combat polish:** 60x36 default map; `civ-engine` 0.3.0 with explicit system ordering; wildlife combat; sub-grid movement + sub-cell slots + health bars; shoreline fish.
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 387ms:
## Core rules

- Use test-driven development for behavior changes: write or update tests first, then make them pass. Test the contract, not the code: tests should focus exclusively on app experience and mechanisms.
- For each desired change, make the change easy, then make the easy change.
- Before implementing a change, write a plan.
- Use a subagent to implement the plan such that the tests pass. For example, if the tech stack uses node, it should make sure `npx vitest run`, `npx tsc --noEmit`, and `npx vite build` pass.
- When the change is visual:
  - Capture a before screenshot.
  - Apply the change.
  - Capture an after screenshot.
  - Generate a pixel diff and use that as verification alongside the normal test/build gates.

## Team of subagents

- For every task from the user, create a stateless, ephemeral team of subgents to work together on tasks, then turn down the agents when you are done to avoid context rot.
- **Team lead**:
  - Responsibility: Breaks the human's request into atomic tasks, selects the appropriate domain specialists, routes the tasks, and acts as the final gatekeeper before merging.
  - If tests (`npx vitest run`, `npx tsc --noEmit`, etc.) fail or review consensus is not reached after 3 iterations, the Team Lead must execute a hard abort. It will `git reset --hard` the branch, dump the error logs and the failed approach into `docs/learning/lessons.md`, and spin up a completely fresh Architect and Engineer to write a brand new plan that explicitly avoids the failed approach.
- **Architect**:
  - Responsibility: Act purely as a consultant rather than an active driver. The Lead queries the Architect to draft the initial implementation plan and verify it against ARCHITECTURE.md before dispatching work.
- **Game designer**:
  - Responsibility: Make sure the game mechanism works well and is fun. Research local and online sources to ground your opinions.
- **Software engineer**:
  - Responsibility: Handle all the code writing.
  - Reach out to the team if you have questions or need a second opinion. 
  - CRITICAL: After you are done coding, ask the code reviewer to review your code. Iterate with the code reviewer. Reviews might take a long time. Be patient.
  - After addressing review comments, ask the reviewer to verify that you have successfully done so.
  - If the Software Engineer and the Code Reviewer cannot reach consensus after 3 iterations, escalate to the Tie-Breaker agent.
  - Write down the reviewer feedback from previous round(s) under `code_review/` as temp files. The reviewer should consider this info + `docs/learning/lessons.md` + your diff. After you summarize reviewer feedback into devlog, delete the temp files.
  - Continue this iteration loop until the reviewers seem to start nit-picking instead of catching real bugs / giving substantial feedback. Do not get stuck in an infinite loop.
- **Code reviewer**: Follow the code review section for detailed rules.
- **Tie breaker**: Use the high-reasoning model. Its prompt dictates that it must definitively choose to either ACCEPT the current diff (overriding the reviewer) or REJECT it with a mandatory, prescriptive patch. The Tie-Breaker's decision is final.

## Code review

- Use all of Codex / Gemini / Claude in CLI to independently review every change on the following aspects:
  1. Design.
    - Can easily scale, generalize, debug, be understood and reasoned about, and stay lean.
  2. Test coverage.
  3. Correctness.
  4. Clean code, typing, efficiency, memory leaks.
    - No: god class, large files, duplicated logic, inconsistent implementations, violation of boundaries.
    - Prefer composition over inheritance.
    - Clean up dead code.
    - Do not change app mechanics or behavior unless explicitly asked.
  5. Documentation.
    - Dev logs should be updated and maintained.
    - References to code should be up to date.
    - No outdated comments.
    - Learnings from debugging and friction points should be documented in `docs/learning/lessons.md`. The file should be actively maintained to not become long, tedious, or outdated.
- `base_prompt` for the code review agent: "You are a senior code reviewer. Flag bugs, security issues, and performance concerns. Do NOT modify files or propose patches. Only return findings, explanations, and suggestions in plain text."
- Optionally, use the @ symbol within `base_prompt` to include directory context for the best reasoning results.
- Codex:
  - `git diff [branch] | codex exec --model gpt-5.4 -c model_reasoning_effort=xhigh -c approval_policy=never --sandbox read-only --ephemeral <base_prompt>`
- Gemini:
  - `git diff [branch] | gemini -p <base_prompt> --model gemini-3.1-pro-preview`.
- Claude:
  - `git diff [branch] | claude -p --model opus --effort xhigh --append-system-prompt <base_prompt> --allowedTools "Read,Bash(git diff *),Bash(git log *),Bash(git show *)"`
- For full-codebase reviews (no diff), drop the `git diff` pipe and let each CLI agentically explore the workspace from its CWD; keep the same model/effort flags.

## Git

- When you iterate, only run affected tests.
- In the end, after you are confident about your change, run the full suite of tests to make sure you didn't accidentally break anything.
- Create a short-lived branch for every task (e.g., `agent/fix-tick-start`). Run the test suite on the branch. Only after all tests and visual pixel-diffs pass, merge into main using a fast-forward merge, and delete the branch.
- Commit durable docs you added if you are not planning to remove them.
- Commit as soon as you have a coherent, self-contained unit of change.

## Project docs

- Read `docs/devlog/summary.md` and `docs/architecture/ARCHITECTURE.md` at session start.
- Key directories:
  - `src`: app code.
  - `docs`: architecture, devlogs, reviews.
  - `design`: app and mechanism notes.

## Architecture

- Respect the boundaries documented there. If a boundary seems wrong, flag it instead of silently violating it.
- If architecture changes, update the relevant sections in `docs/architecture/ARCHITECTURE.md`, append a row to `docs/architecture/drift-log.md`, and mention the update in the devlog.
- Do not update `docs/architecture/ARCHITECTURE.md` for non-structural fixes, refactors, UI tweaks, or test-only work.
- Never delete a Key Architectural Decision in `docs/architecture/decisions.md`; add a newer decision that supersedes it.

## Devlog

- Detailed devlogs live under `docs/devlog/detailed/` as append-only files named `YYYY-MM-DD_YYYY-MM-DD.md` (e.g. `2026-04-07_2026-04-13.md`).
- Always append new entries to the latest detailed devlog (the file with the most recent `END_DATE`). When looking something up, start from the latest file and work backwards.
- Periodically archive: when the active file grows larger than 500 lines or a significant time boundary is reached, close it (freeze its `END_DATE` in the filename) and start a new file whose `START_DATE` is the next entry's date. Check if the start and end dates of all previous devlogs are still accurate.
- After every completed task, append a detailed entry with:
  - timestamp
  - action
  - code reviewer comments, broken down by AI provider and theme as stated above
  - result
  - reasoning
  - notes
- Keep `docs/devlog/summary.md` current after updating the detailed log. Always remove outdated info. Compact when it grows larger than 50 lines.
- If a subagent handles summary work, it should extract facts only and avoid interpretation.

## Debugging

- When debugging, use `docs/debugging/template.md` to record your process. Create a new file per debugging session and use it to iterate until you solve the problem.
- If a future session makes you realize that your previous debug sessions on the same topic did not fully solve the problem, update past docs to avoid misunderstandings.
- Clean up the temporary files (such as stack dump, test results) created during debugging after you are done.

## Doc formatting

- Don't wrap lines. Only use a new line when you are starting a new paragraph.

## Game specific

- Record current `civ-engine` weaknesses and misses in `docs/engine-feedback/current.md` as you work. Historical observations belong in `docs/engine-feedback/past.md`. Before you write to the current file, use a subagent to audit if its content is still valid and up to date. If too long, stale, or the issues are already addressed, it should be adjusted.
- If a missing engine feature blocks the task, stop your work and report it to the user. But do not modify the `civ-engine` repo directly.
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 390ms:
---
name: programming-best-practices
description: General coding workflow and engineering guardrails for planning, implementing, debugging, refactoring, reviewing, and validating code changes. Use when Codex is asked to write, edit, review, or test code in any repository, especially when correctness, maintainability, small diffs, and safe verification matter.
---

# Programming Best Practices

## Operate

- Read the relevant code path before editing.
- Trace data flow end to end before deciding on a fix.
- Prefer the smallest change that solves the actual problem.
- Match the existing architecture and conventions unless they are the source of the defect.
- Preserve backward compatibility unless the task explicitly requires a breaking change.

## Change Safely

- Do not overwrite unrelated user changes.
- Treat the worktree as potentially dirty and isolate your diff.
- Make state transitions explicit, especially around async flows and persistence.
- If concurrent results can race, decide which result wins and enforce it in code.
- Handle empty states, errors, cleanup, and cancellation paths deliberately.
- Avoid speculative abstractions until duplication or complexity actually justifies them.

## Validate

- Add or update targeted tests when behavior changes or a bug is fixed.
- Run the smallest meaningful verification first, then widen coverage if needed.
- Verify user-visible behavior, not only internal implementation details.
- If validation cannot run, state exactly what was blocked and what remains unverified.

## Review

- Prioritize bugs, regressions, broken assumptions, and missing tests.
- Present findings before summaries.
- Order findings by severity and include concrete file references.

## Communicate

- State assumptions when they affect implementation choices.
- Call out tradeoffs plainly.
- Explain non-obvious changes at a high level.
- Close with outcome, verification, and remaining risk.
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 424ms:
---
name: using-superpowers
description: Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## Instruction Priority

Superpowers skills override default system prompt behavior, but **user instructions always take precedence**:

1. **User's explicit instructions** (CLAUDE.md, GEMINI.md, AGENTS.md, direct requests) ƒ?" highest priority
2. **Superpowers skills** ƒ?" override default system behavior where they conflict
3. **Default system prompt** ƒ?" lowest priority

If CLAUDE.md, GEMINI.md, or AGENTS.md says "don't use TDD" and a skill says "always use TDD," follow the user's instructions. The user is in control.

## How to Access Skills

**In Claude Code:** Use the `Skill` tool. When you invoke a skill, its content is loaded and presented to youƒ?"follow it directly. Never use the Read tool on skill files.

**In Copilot CLI:** Use the `skill` tool. Skills are auto-discovered from installed plugins. The `skill` tool works the same as Claude Code's `Skill` tool.

**In Gemini CLI:** Skills activate via the `activate_skill` tool. Gemini loads skill metadata at session start and activates the full content on demand.

**In other environments:** Check your platform's documentation for how skills are loaded.

## Platform Adaptation

Skills use Claude Code tool names. Non-CC platforms: see `references/copilot-tools.md` (Copilot CLI), `references/codex-tools.md` (Codex) for tool equivalents. Gemini CLI users get the tool mapping loaded automatically via GEMINI.md.

# Using Skills

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means that you should invoke the skill to check. If an invoked skill turns out to be wrong for the situation, you don't need to use it.

```dot
digraph skill_flow {
    "User message received" [shape=doublecircle];
    "About to EnterPlanMode?" [shape=doublecircle];
    "Already brainstormed?" [shape=diamond];
    "Invoke brainstorming skill" [shape=box];
    "Might any skill apply?" [shape=diamond];
    "Invoke Skill tool" [shape=box];
    "Announce: 'Using [skill] to [purpose]'" [shape=box];
    "Has checklist?" [shape=diamond];
    "Create TodoWrite todo per item" [shape=box];
    "Follow skill exactly" [shape=box];
    "Respond (including clarifications)" [shape=doublecircle];

    "About to EnterPlanMode?" -> "Already brainstormed?";
    "Already brainstormed?" -> "Invoke brainstorming skill" [label="no"];
    "Already brainstormed?" -> "Might any skill apply?" [label="yes"];
    "Invoke brainstorming skill" -> "Might any skill apply?";

    "User message received" -> "Might any skill apply?";
    "Might any skill apply?" -> "Invoke Skill tool" [label="yes, even 1%"];
    "Might any skill apply?" -> "Respond (including clarifications)" [label="definitely not"];
    "Invoke Skill tool" -> "Announce: 'Using [skill] to [purpose]'";
    "Announce: 'Using [skill] to [purpose]'" -> "Has checklist?";
    "Has checklist?" -> "Create TodoWrite todo per item" [label="yes"];
    "Has checklist?" -> "Follow skill exactly" [label="no"];
    "Create TodoWrite todo per item" -> "Follow skill exactly";
}
```

## Red Flags

These thoughts mean STOPƒ?"you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ƒ%ÿ using the skill. Invoke it. |

## Skill Priority

When multiple skills could apply, use this order:

1. **Process skills first** (brainstorming, debugging) - these determine HOW to approach the task
2. **Implementation skills second** (frontend-design, mcp-builder) - these guide execution

"Let's build X" ƒ+' brainstorming first, then implementation skills.
"Fix this bug" ƒ+' debugging first, then domain-specific skills.

## Skill Types

**Rigid** (TDD, debugging): Follow exactly. Don't adapt away discipline.

**Flexible** (patterns): Adapt principles to context.

The skill itself tells you which.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

codex
Using `programming-best-practices` for a narrow verification pass. Next I’m checking the actual landed hunks, then tracing the adjacent code paths and tests for completeness/risk on each of the five fixes.
Verification pass over five targeted fixes: confirm landed code, trace related call-sites, inspect regression tests, then produce per-fix verdicts.
  → Inspect landed commits, files, and surrounding code for the five fixes
  • Trace related code paths and helper call-sites for completeness and regression risk
  • Assess regression test strength for each fix and write per-fix verdicts
2026-04-26T04:18:46.810052Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git branch --show-current; git rev-parse --short HEAD; git show --stat --oneline 7d63e00; git show --stat --oneline f54c55d; git show --stat --oneline af4c559; git show --stat --oneline 7687b82; git show --stat --oneline 0dc7cd7'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git branch --show-current; git rev-parse --short HEAD; git show --stat --oneline 7d63e00; git show --stat --oneline f54c55d; git show --stat --oneline af4c559; git show --stat --oneline 7687b82; git show --stat --oneline 0dc7cd7' in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git branch --show-current; git rev-parse --short HEAD; git show --stat --oneline 7d63e00; git show --stat --oneline f54c55d; git show --stat --oneline af4c559; git show --stat --oneline 7687b82; git show --stat --oneline 0dc7cd7'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content docs\\reviews\\full\\2026-04-25\\2\\REVIEW.md" in C:\Users\38909\Documents\github\aoe2
2026-04-26T04:18:46.812130Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git grep -n "getHudState()" -- src tests'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git grep -n "getHudState()" -- src tests' in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git grep -n "getHudState()" -- src tests'` rejected: blocked by policy
2026-04-26T04:18:46.973733Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "git grep -n \"applyTechnology\\|researchedTechnologies\\|queueResearch\\|research-progress\" -- src tests"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "git grep -n \"applyTechnology\\|researchedTechnologies\\|queueResearch\\|research-progress\" -- src tests" in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "git grep -n \"applyTechnology\\|researchedTechnologies\\|queueResearch\\|research-progress\" -- src tests"` rejected: blocked by policy
2026-04-26T04:18:46.976197Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "git grep -n \"isFootprintVisible\\|findPreferredVisibleEnemyBuilding\\|createProjector\\|visibility.isVisible(viewerOwner, entry.position.x, entry.position.y)\" -- src tests"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "git grep -n \"isFootprintVisible\\|findPreferredVisibleEnemyBuilding\\|createProjector\\|visibility.isVisible(viewerOwner, entry.position.x, entry.position.y)\" -- src tests" in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "git grep -n \"isFootprintVisible\\|findPreferredVisibleEnemyBuilding\\|createProjector\\|visibility.isVisible(viewerOwner, entry.position.x, entry.position.y)\" -- src tests"` rejected: blocked by policy
2026-04-26T04:18:46.978699Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "git grep -n \"to-dropoff\\|carriedResource\\|carriedAmount\\|dropOffPlan\" -- src tests"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "git grep -n \"to-dropoff\\|carriedResource\\|carriedAmount\\|dropOffPlan\" -- src tests" in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "git grep -n \"to-dropoff\\|carriedResource\\|carriedAmount\\|dropOffPlan\" -- src tests"` rejected: blocked by policy
2026-04-26T04:18:46.981619Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "git grep -n \"POCKET_RADIUS\\|STARTING_STONE\\|STARTING_GOLD\\|STARTING_BOARS\\|createBlackForestMap\" -- src tests"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "git grep -n \"POCKET_RADIUS\\|STARTING_STONE\\|STARTING_GOLD\\|STARTING_BOARS\\|createBlackForestMap\" -- src tests" in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "git grep -n \"POCKET_RADIUS\\|STARTING_STONE\\|STARTING_GOLD\\|STARTING_BOARS\\|createBlackForestMap\" -- src tests"` rejected: blocked by policy
 succeeded in 289ms:
# Full Codebase Review ƒ?" 2026-04-25 (Iteration 2)

**Reviewers:** Codex (`gpt-5.4` @ `model_reasoning_effort=high`), Gemini (`gemini-3-flash-preview` ƒ?" `gemini-2.5-pro` and `gemini-3.1-pro-preview` were both quota-exhausted on this account; reset in ~13 h, see process notes), Claude (`opus` @ `--effort high`). Each ran independently with read-only access to the working tree; raw outputs in `raw/codex.md`, `raw/gemini.md`, `raw/claude.md`.

**Scope:** Same ~47 kLOC TypeScript surface as iteration 1, but reviewers were told to (a) verify the four iteration-1 fixes, (b) sweep less-touched directories (`mapGeneration/`, `fixtures/`, `phaser/scenes/gameScene/`, `tests/browser/`, `scripts/`, `app/bootstrap/`), (c) focus more on game-design and player-experience correctness this round, (d) emit a verified-not-bugs section (Claude pioneered this in iter 1).

**HEAD reviewed:** `2e5283d` on `main`.

**Iteration-1 commits we asked them to verify:** `3f413e2` (C-1 monk flip-flop), `7bba71e` (H-1 projector seed), `bfce2c7` (H-3 garrison cross-reference), `6b37c62` (M-16 ARCHITECTURE.md `bridge/` topology).

---

## Executive summary

Two independent reviewers (Codex + Claude) caught that **the iteration-1 H-1 fix is incomplete**. Commit `7bba71e` correctly switched `createWorld(...)` and `createProjector(...)` to `effectiveSeed`, but the outer `seed` still leaks via `getSeed: () => seed` (`createSimulationBridge.ts:6894`, consumed by `saveGameOps.ts:210` for re-save) and `seed,` (`createSimulationBridge.ts:7314`, returned by `getHudState()`). After loading a saved game: world ticks the saved seed, but the HUD reports the outer seed and any subsequent save *writes the outer seed* back into the blob, breaking the determinism contract on the load ƒ+' re-save path. Iteration-1's regression test only asserted on `frame.seed`, which is the one path that was fixed.

Beyond that:

- **Claude found two new gameplay correctness bugs:**
  - **[H2-1]** Tech double-research via simultaneous queueing in two producer buildings ƒ?" non-idempotent Blacksmith techs can stack `+2` instead of `+1`.
  - **[H2-2]** A villager carrying gathered resources silently zeroes its load when `findBuildingApproachPlan` momentarily returns null (path blocked by an enemy unit, drop-off rebuilding) instead of waiting for the path to reopen.
- **Codex found a new map-generation regression:**
  - Black Forest seeds trees over `STARTING_STONE` cell `(1, 6)` because the carved start pocket is only radius 6; `applyResourcePatch()` ignores the rejected `addResourceSpawn(...)` and the map silently drops a starting stone node.
- **Gemini found a target-finding visibility bug:**
  - **[M-20]** `findPreferredVisibleEnemyBuilding` checks visibility of the building's anchor cell only, missing partially visible large buildings (Town Centers, Castles) ƒ?" diverges from `createProjector` which uses `isFootprintVisible`.

The iteration-1 deferred items (C-2 enum validation, H-2 wider round-trip, H-4 `getRenderState` cache, N-1 god class drain) all remain open and were re-acknowledged by at least one reviewer.

---

## Cross-reviewer agreement

| Theme | Codex | Gemini | Claude |
|---|---|---|---|
| H-1 fix is incomplete (HUD seed leak / re-save seed leak) | ƒo" (high) | ƒ?" (called V-2 verified) | ƒo" (medium) |
| Black Forest map silently loses starting stone | ƒo" (high) | ƒ?" | ƒ?" |
| Tech double-research via simultaneous queueing | ƒ?" | ƒ?" | ƒo" (high) |
| Carried gather load zeroed on temp path block | ƒ?" | ƒ?" | ƒo" (high) |
| `findPreferredVisibleEnemyBuilding` anchor-only visibility | ƒ?" | ƒo" (medium) | ƒ?" |
| Save panel discards download fallback on storage failure | ƒo" (medium) | ƒ?" | ƒ?" (iter 1 M-15 stands) |
| ARCHITECTURE.md `app/bootstrap/` description stale (refers to "dev HTTP API") | ƒo" (low) | ƒ?" | ƒ?" |
| HUD `destroy()` never returned (iter 1 H-7 still open) | ƒ?" | ƒ?" | ƒo" (medium) |
| Map-gen / scenario fuzz coverage gaps | ƒ?" | ƒ?" | ƒo" (medium) |
| AI build-order ergonomics (gathering-villager preference, watch-tower gate, idle producer round-robin) | ƒ?" | ƒ?" | ƒo" (medium A-3) |

Anything below appears in only one reviewer unless noted.

---

## Verification of iteration-1 fixes

### [V2-1] H-1 fix is incomplete ƒ?" outer `seed` leaks via `getSeed()` (re-save path) and `getHudState()` *(Codex + Claude ƒ?" independent)*

- **Severity:** high
- **Theme:** correctness
- **Where:**
  - `src/game/simulation/createSimulationBridge.ts:6894` ƒ?" `getSeed: () => seed,` (consumed by `saveGameOps.ts:210`)
  - `src/game/simulation/createSimulationBridge.ts:7314` ƒ?" `seed,` inside `getHudState()` return
  - `src/game/simulation/bridge/saveGameOps.ts:210` ƒ?" writes `getSeed()` into the blob `seed` field
  - `tests/simulation/saveLoad.test.ts:167-184` ƒ?" only asserts `frame.seed`
- **Finding:** Commit `7bba71e` plumbed `effectiveSeed` to `createWorld` (line 7166) and `createProjector` (line 7171) only. Two other consumers of `seed` survived:
  1. The save serializer reads `getSeed()` which returns the outer constructor `seed`. After load ƒ+' re-save, the new blob carries the outer (URL-param / default) seed, not the original `savedGame.seed`. The saved blob is then unloadable into a project that tracks seed-based determinism.
  2. `getHudState()` returns the outer `seed`. The HUD seed display, browser-test snapshots via `__AOE2_TEST__.getHudState()`, and any future debug overlay that surfaces the seed all read the wrong value after load.
- **Fix shape:** Change `getSeed: () => seed` to `getSeed: () => effectiveSeed` (or thread the resolved seed up explicitly). Change `seed,` in `getHudState()` to `seed: effectiveSeed,`. Widen `saveLoad.test.ts` to assert `getHudState().seed` and the re-save blob's `seed` both equal the originally loaded seed.

### [V2-2] C-1 monk-conversion regression test is order-dependent *(Claude)*

- **Severity:** low (probably-fine but worth tightening)
- **Theme:** tests
- **Where:** `tests/simulation/monkConversion.test.ts:51`
- **Finding:** The test asserts `expect(finalMilitia!.owner).toBe(1)`, which only passes because civ-engine's `world.query('unit')` iteration order happens to be stable. The actual contract is "first-processed Monk owns the increment, no flip-flop" ƒ?" the *which* is a side effect of iteration order. If iteration order ever changes (e.g., across save/load ƒ?" see iter-1 M-7), the asserted owner flips from 1 to 2 and the test fails despite the bug being correctly fixed.
- **Fix shape:** `expect([1, 2]).toContain(finalMilitia!.owner)` plus a separate assertion that the militia is no longer owned by player 3.

### [V2-3] H-3 garrison cross-reference, full H-1 projector seed (the part that was fixed), M-16 ARCHITECTURE.md refresh ƒ?" verified correct *(Codex + Gemini + Claude ƒ?" agreement)*

- The H-3 invariant covers all three breakage modes the regression test (`tests/simulation/saveLoadIntegrity.test.ts:14-63`) exercises.
- The fixed half of H-1 (projector / world consume `effectiveSeed`) is correct; the unfixed half is V2-1 above.
- ARCHITECTURE.md `bridge/` section matches the on-disk topology (11 modules + 3 top-level siblings); `drift-log.md` row added per AGENTS.md rules.

### Verified-also-correct from C-1 fix (with one nit)

- **[V2-4 ƒ?" applyMonkConvert per-tick guard stale-state edge case](#m2-7-applymonkconvert-per-tick-guard-can-write-stale-default-after-same-tick-flip-claude)** *(Claude)* ƒ?" see M2-7 below. Self-healing next tick, but the in-between state is misleading.

---

## Critical

*(none new ƒ?" iter-1's still-open clusters C-2 enum validation, H-2 wider round-trip coverage, H-4 / N-1 bridge size remain.)*

---

## High

### [H2-1] Same technology can be researched twice if queued in two producer buildings simultaneously *(Claude)*

- **Theme:** correctness
- **Where:** `src/game/simulation/createSimulationBridge.ts:3406-3409` (`enqueueResearch` dedupe), `:5467-5469` (production queue completion); `src/game/simulation/bridge/technologyOps.ts:158-475` (no idempotency guard in `applyTechnology`)
- **Finding:** `enqueueResearch` only blocks "already in *this* building's queue". `getResearchOptions` filters via `hasTechnology(...)`, but a tech in flight in Blacksmith A is not yet researched, so it can be queued in Blacksmith B too. Both complete; `applyTechnology` runs twice. For idempotent techs (`'fletching'`: `combat.attackDamage = base + 1`) double-fire is harmless, but every Blacksmith tier (`'forging'`, `'iron-casting'`, `'blast-furnace'`, `'bracer'`, `'chemistry'`, all armor tiers, `'bodkin-arrow'`, ...) uses `combat.attackDamage += 1` / `combat.armor += 1`. A player with 2+ Blacksmiths can race-queue and get `+2` instead of `+1`. AI build order does not preclude multi-Blacksmith.
- **Fix shape:** Either (a) one-line guard at the top of `applyTechnology`: `if (hasTechnology(owner, technologyType)) return;`, or (b) widen `enqueueResearch` to also reject techs currently in flight in any owned producer.

### [H2-2] Carried gather amount silently zeroed when no drop-off path exists *(Claude)*

- **Theme:** correctness, player-experience
- **Where:** `src/game/simulation/createSimulationBridge.ts:5694-5697`
- **Finding:** The `to-dropoff` task branch resets `gatherer.carriedAmount = 0` and `gatherer.carriedResource = null` whenever `findBuildingApproachPlan` returns `null`. A temporarily blocked path (an enemy unit in the way, a drop-off rebuilding) silently zeroes the player's carried wood / gold / stone / food load. Canonical AoE2 idles the villager (preserving the load) until a path opens.
- **Fix shape:** Only zero out when `carriedAmount === 0 || carriedResource === null`; otherwise transition `task = 'idle'` (or stay in `to-dropoff`) and retry next tick.

### [H2-3] Black Forest map silently drops a starting stone node *(Codex)*

- **Theme:** correctness
- **Where:** `src/game/simulation/mapGeneration/blackForestMap.ts:31-33,61-74`; `src/game/simulation/mapGeneration/startingOffsets.ts:52-56`; `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts:52-53`; `tests/simulation/prototypeScenario.test.ts:475-504`
- **Finding:** Black Forest seeds trees into every remaining forest cell before `applyStandardPlayerOpening` runs, but the carved start pocket is radius 6 while `STARTING_STONE` includes `{ x: 1, y: 6 }` outside that radius. The tree claims the cell first; `applyResourcePatch()` ignores the rejected `addResourceSpawn(...)` (silent no-op since the spawn-list helper enforces first-write-wins) and the map ships with one fewer starting stone node than the standard opening promises. The Black Forest test only checks villagers / Town Centers / berries.
- **Fix shape:** Either widen the carved pocket radius to ƒ%7, or have `placeForestCluster` consult `cellBlockedByScenarioEntity` (extended to also reserve the starting-resource offset cells), or assert that `addResourceSpawn(...)` returned true and surface the failure to the bridge bootstrap validator.

---

## Medium

### [M2-1] `findPreferredVisibleEnemyBuilding` only checks anchor-cell visibility *(Gemini)*

- **Theme:** correctness
- **Where:** `src/game/simulation/bridge/targetFindingOps.ts:316`
- **Finding:** The visibility filter calls `visibility.isVisible(building.x, building.y)` (the anchor cell). `createProjector` uses `isFootprintVisible(...)` from `pureHelpers.ts` ƒ?" the canonical helper that walks the full footprint. AI / auto-aggression therefore fails to target large buildings (TC, Castle, Wonder) when only non-anchor cells are visible to the player, even though the building is rendered. Diverges from the rendering contract.
- **Fix shape:** Replace the `visibility.isVisible(building.x, building.y)` call with `isFootprintVisible(building, visibility, owner)` parity.

### [M2-2] Save button discards the download fallback when `localStorage.setItem` fails *(Codex)*

- **Theme:** correctness
- **Where:** `src/ui/hud/saveLoadPanel.ts:159-165`
- **Finding:** The Save button writes `localStorage`, catches `setItem` failure, surfaces a generic toast, and **returns before** `triggerBlobDownload(json)`. In private-browsing Safari, quota-exhausted localStorage, or any setup where the storage write fails, the player loses the only remaining export path even though the JSON blob is already prepared. Browser suite only covers the happy-path localStorage flow.
- **Fix shape:** Try `localStorage.setItem`; on failure (especially `QuotaExceededError`), continue to `triggerBlobDownload(json)` and surface a clearer toast that the save was downloaded instead of stored.

### [M2-3] AI `findAvailableVillager` treats actively-gathering villagers as available *(Claude)*

- **Theme:** correctness, AI behavior
- **Where:** `src/game/simulation/createSimulationBridge.ts:3671-3680`
- **Finding:** "Available" is gated on `!unitCommands.has(id)`. Villager gathering uses `GathererComponent`, not `unitCommands`, so every gathering villager qualifies as "available" alongside truly idle villagers; iteration order picks the first match. The AI build-order loop calls `findAvailableVillager` up to 3A- per decision tick (Watch Tower / Wonder / next build), repeatedly disrupting gather progress.
- **Fix shape:** Two-pass priority ƒ?" first match `gatherer?.task === 'idle' && !unitCommands.has(id)`, then fall back to any villager. Mirrors canonical AoE2 "idle ƒ+' unassigned ƒ+' on-resource".

### [M2-4] Conquest resolver: simultaneous mutual annihilation grants human "defeat" instead of a draw *(Claude)*

- **Theme:** correctness, game design
- **Where:** `src/game/simulation/createSimulationBridge.ts:6232-6240`; `MatchState.outcome` schema
- **Finding:** Order is "if human has no presence ƒ+' defeat (early return); else if all enemies have no presence ƒ+' victory". A tick destroying both sides' last unit/building reaches the human-presence check first. `MatchState.outcome` only allows `'running' | 'victory' | 'defeat'` ƒ?" partly schema-driven.
- **Fix shape:** Either widen outcome to include `'draw'` and resolve simultaneous extinction as draw, or document the human-loses-on-tie semantics in the win-condition spec.

### [M2-5] AI Watch-Tower defensive response gated on Blacksmith *(Claude)*

- **Theme:** game design, AI behavior
- **Where:** `src/game/simulation/createSimulationBridge.ts:4503-4514`
- **Finding:** AI's "saw an enemy near base, build Watch Tower" response requires `hasCompletedBuilding(owner, 'blacksmith')`. Canonical AoE2 unlocks Watch Tower in Feudal as soon as Lumber Camp + Mining Camp exist. The Blacksmith gate makes the AI unable to respond to early Feudal aggression with the option canonical AoE2 affords it.
- **Fix shape:** Drop the Blacksmith requirement (matches canonical Feudal gating) or document why this is intentional.

### [M2-6] HUD controller `destroy()` not exposed (iter-1 H-7 still open) *(Claude)*

- **Theme:** cleanliness, correctness
- **Where:** `src/ui/hud/createHudController.ts:76-82, 424, 429-433`; `src/ui/hud/debugOverlay.ts:170-173`
- **Finding:** `debugOverlay.ts:170` already implements a `destroy()` method. `createHudController` returns only `{ getDebugOverlayMode, cycleDebugOverlayMode }` ƒ?" the recursive RAF `update()` and window F2 keydown remain attached forever. Bundle with the load-flow refactor: `handleLoadGame` already replaces the bridge cleanly; teach `createApp` to also tear down the prior HUD controller before constructing the next one.

### [M2-7] `applyMonkConvert` per-tick guard can write stale default after same-tick flip *(Claude)*

- **Theme:** correctness
- **Where:** `src/game/simulation/bridge/monkTaskOps.ts:360-378`
- **Finding:** When the first-processed Monk hits flip threshold, `conversionState.delete(targetId)` runs inside the flip block, but `monkConvertProcessedThisTick.add(targetId)` already fired earlier. A second-processed Monk on the same tick re-enters: `state = conversionState.get(targetId) ?? { byOwner: monkB.owner, progress: 0 }` resolves to the default; per-tick guard hits; `conversionState.set(targetId, state)` writes the stale default. Self-heals next tick (target is now the second monk's owner so the early-return at 355 fires), but the in-between state is misleading.
- **Fix shape:** Move `monkConvertProcessedThisTick.add` after the flip block, or skip the `set` when the entry was missing.

### [M2-8] `applyShoreFishPatches` and `applyShoreFishPatchesProcedural` are byte-for-byte identical *(Claude)*

- **Theme:** cleanliness
- **Where:** `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts:88-144` vs `:147-202`
- **Finding:** Both 56-line bodies do the same candidate scan, same math, same dedupe. Both exported, both have callers. Pick one; alias the other.

### [M2-9] No fuzz test exercises `createDefaultMap` across multiple seeds *(Claude)*

- **Theme:** tests
- **Where:** `tests/simulation/mapGeneration/defaultMap.test.ts:15-100`
- **Finding:** Every test pins `'aoe2-prototype'` or one alternate seed. Combined with M2-10 below, an arbitrary `?seed=...` URL is one collision away from a hard crash the suite cannot catch.
- **Fix shape:** Add a 10-20 seed corpus and assert `createSimulationBridge(seed)` constructs successfully for each.

### [M2-10] Default-map procedural placement can collide forward-enemy-house spawn with player-2 forest cells *(Claude)*

- **Theme:** correctness
- **Where:** `src/game/simulation/mapGeneration/defaultMap.ts:25-42`; `applyStandardPlayerOpening.ts:524-580` (`placeForestCluster`)
- **Finding:** `createDefaultMap` calls `paintDisc` to clear terrain at `FORWARD_ENEMY_HOUSE_POSITION (39, 18)` then `addBuildingSpawn` for the house ƒ?" but the building spawn does not consult `spawns.isCellOccupiedByResource`, and forest-cluster placement at owner-2's TC `(48, 24)` at angle `1.25I?` reaches ring-12 cells around `(39.5, 15.5)`. With `step ƒ^^ [-4, 4]` per direction, individual tree spawns can land at `(39, 18)`. Bootstrap validator throws "resource at (x,y) overlaps a building footprint" ƒ?" some seeds refuse to boot. Today's pinned seeds dodge it; switching seeds via URL could surface a hard crash.
- **Fix shape:** Drive `placeForestCluster` through a "blocked by static landmarks" predicate that also excludes `FORWARD_ENEMY_HOUSE_POSITION` / `SCOUT_POSITION` / `DEFAULT_RELIC_POSITIONS`.

### [M2-11] AI `findIdleProducer` returns first match; multi-base AI never trains at second producer until first fills *(Claude)*

- **Theme:** game design, AI behavior
- **Where:** `src/game/simulation/bridge/aiDecisionOps.ts:162-179`
- **Finding:** Iteration order across `world.query('building')` is essentially creation order. AI with a forward Barracks placed second never trains there until the home Barracks fills its 2-entry queue. Forward Barracks rarely trains.
- **Fix shape:** Tie-break by least-loaded producer (queue length) or by distance-to-target.

### [M2-12] `seedToNumber` walks code points but indexes by code unit *(Claude)*

- **Theme:** correctness
- **Where:** `src/game/simulation/mapGeneration/sharedTerrainHelpers.ts:20-26`
- **Finding:** `for (const character of seed)` iterates code points; `character.charCodeAt(0)` returns the first UTF-16 code unit (high surrogate for surrogate pairs). Hash collisions for any non-BMP seed names. Latent today (only ASCII fixture names + URL input).
- **Fix shape:** `hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0`.

### [M2-13] Stale C-1 regression test asserts specific owner *(Claude)*

- **Theme:** tests
- **Where:** `tests/simulation/monkConversion.test.ts:51`
- **Finding:** See V2-2.

### [M2-14] `renderFog` per-frame full-map scan + per-cell allocations *(Gemini)*

- **Theme:** efficiency
- **Where:** `src/phaser/scenes/gameScene/worldLayers.ts:133`
- **Finding:** Every frame, nested `y/x` loop over the entire map. Allocates two new `Set` objects from `number[]` arrays and calls `fogLayer.fillRect` per non-visible cell. Standard 120A-120 = 14 400 iterations + 2 set allocations / frame.
- **Fix shape:** Hoist the `Set` allocation; render fog only when the visibility frame's cell list changes (compare via tick + visibility-version counter); or cache the fog `Graphics` and re-paint only when frame changes.

### [M2-15] `getSnapshot` triggers redundant projecting and filtering *(Gemini)*

- **Theme:** efficiency, design
- **Where:** `src/app/bootstrap/browserTestApi.ts:98`
- **Finding:** `getSnapshot` calls multiple bridge methods (`getHudState`, `getRenderState`, etc.). Each triggers a full entity filter / projection pass. Reinforces the iter-1 H-4 deferred fix.
- **Fix shape:** Same as iter-1 H-4: cache the projected list per-tick.

### [M2-16] ARCHITECTURE.md says `app/bootstrap/` hosts a "dev HTTP API used by browser tests" *(Codex)*

- **Theme:** docs
- **Where:** `docs/architecture/ARCHITECTURE.md:11`; `src/app/bootstrap/browserTestApi.ts:107-113`; `tests/browser/helpers/gameTestHelpers/snapshot.ts:10,18-19`
- **Finding:** The actual seam is an in-page `window.__AOE2_TEST__` API installed by `installBrowserTestApi(...)` and consumed via `page.evaluate(...)`. The "dev HTTP API" description is stale; misleads future test-harness work.

---

## Low / Nit

### [L2-1] `destroyUnitEntity` comment claims "drop the relic at the Monk's last cell" but body never repositions *(Claude ƒ?" extends iter-1 L-2)*

- **Where:** `src/game/simulation/createSimulationBridge.ts:3087-3092`
- **Finding:** The relic ends up at the Monk's last cell because `prototypeMonkBehavior` glues the relic to the Monk every tick (`:5365-5379`). Comment misleads. Either delete the dead local + reword, or add an explicit `setPositionAndSyncOccupancy`. Iter-1 L-2 still standing.

### [L2-2] `handleLoadGame` re-installs the browser-test API but does not re-create the HUD controller *(Claude)*

- **Where:** `src/app/bootstrap/createApp.ts:33-41, 43-65`
- **Finding:** HUD facade arrows re-read the closure variable, so HUD keeps working ƒ?" by accident. No `setBridge` symmetry with `scene.setBridge`. Document or expose.

### [L2-3] `cellBlockedByScenarioEntity` corridor reservation uses hard-coded extent *(Claude)*

- **Where:** `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts:323-356`
- **Finding:** Each invocation builds the closure around the *current* `start.townCenter`. With current TC layout no collision; future tighter TC layout could re-introduce wall-in. Either compute corridors against every player's TC or assert `corridorExtent < TC_distance / 2`.

### [L2-4] `getResearchOptions` doesn't enforce predecessor-tier completion *(Claude)*

- **Where:** `src/game/simulation/createSimulationBridge.ts:4006-4022`
- **Finding:** `isAtLeastAge(owner, 'castle-age')` flips true the tick the age-up applies; no check that every in-flight Castle-Age research has finished. Player can queue Castle-Age + Imperial-tier research at the same time. Probably acceptable for prototype.

### [L2-5] `wildlifeStates.targetEntityRef` skips `getEntityRef` re-resolution on load *(Claude)*

- **Where:** `src/game/simulation/saveSchema.ts:80-94`; bridge load path
- **Finding:** Other refs guarded by `refFromSerialized`. Mostly invariant under `World.deserialize`, but asymmetric with siblings. Same flavor as iter-1 M-3.

### [L2-6] Default-map "produces different scenarios for different seeds" test only checks `not.toEqual` *(Claude)*

- **Where:** `tests/simulation/mapGeneration/defaultMap.test.ts:22-26`
- **Finding:** Two scenarios that differ by a single tile pass the test but visually look identical. Strengthen by asserting at least one starting-resource cluster anchor differs by ƒ%2 cells.

### [L2-7] `isEdgePanEnabled` overly restrictive *(Gemini)*

- **Where:** `src/phaser/scenes/gameScene/cameraController.ts:168`
- **Finding:** Edge panning hard-disabled unless fullscreen or window is maximized. Frustrates large-windowed-mode players who expect canonical RTS edge-pan.
- **Note:** This was deliberately added in the 2026-04-23 devlog ("fullscreen-only edge-pan safeguard") so this finding is design-disagreement, not a bug. Worth a re-discussion with game design.

### [L2-8] Hardcoded targeting priorities (iter-1 M-9 still open) *(Gemini)*

- **Where:** `src/game/simulation/bridge/targetFindingOps.ts:167, 199`
- **Finding:** `targetPriority` and `buildingTargetPriority` are long `switch` statements. Iter-1 M-9 covered the bigger tech-tree case; this is the same shape applied to combat.

### [L2-9] `applyForestPatch` and `applyResourcePatch` order checks asymmetrically *(Gemini ƒ?" re-reflagged from iter-1 L-1)*

- **Where:** `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts:64-86`
- **Finding:** Iter-1 L-1 still standing; no corruption today.

---

## Verified-not-bugs (do not re-investigate)

From Codex:

- The monk flip-flop fix is correct: `applyMonkConvert()` now checks `monkConvertProcessedThisTick` before resetting ownership; `prototypeMonkBehavior` clears the set once per tick at `createSimulationBridge.ts:5298`. The "first processed monk wins this tick" contract is intact (with the V2-2 nit on test strength).
- The garrison cross-reference fix is correct and appropriately fail-fast.
- The ARCHITECTURE.md `bridge/` topology refresh is accurate for the directory itself.

From Gemini:

- **AI villager rebalance with zero villagers** ƒ?" silent no-op is intended (re-confirms iter-1's H-5 rejection).
- **`applyForestPatch` OOB access** ƒ?" `setTerrainKind` has internal bounds checking; safe even if order is asymmetric (see L2-9).
- **`conversionState` cleanup** ƒ?" `destroyUnitEntity(id)` correctly cleans entries where the dying unit is the *target* of conversion (keyed by `targetId`).

From Claude:

- **`destroyUnitEntity`'s relic-drop comment misleads but the relic actually does end up at the Monk's last cell** ƒ?" `prototypeMonkBehavior` repositions the relic onto the Monk every tick. Death cleanup just needs to wipe the carry map (which it does). Comment fix only ƒ?" do not add a redundant `setPositionAndSyncOccupancy`.
- **Production-queue `entry.kind === 'unit' && entry.unitType` short-circuit at line 5446 is not dead code** ƒ?" defensive guard for save/load corruption that could carry `unitType: undefined`.
- **`currentRelicHoldingOwner` early-returns `null` when relics are in flight on a Monk** (`bridge/matchEndOps.ts:176-178`) ƒ?" correct. A Monk carrying a relic mid-walk should not satisfy the relic-victory predicate.
- **`resolveSheepClaimOwner` tie-break** (`bridge/visibility.ts:200-213`) ƒ?" handles `claimedOwner === null` correctly on first iteration via `claimedOwner ?? +Inf`.
- **`World.deserialize` preserves entity ids + generations** ƒ?" the H-3 cross-reference check happens against valid `EntityRef`s. The asserted error path is the partial-blob scenario (corruption / drift / hand-edit), not normal save round-trip.
- **The `CELL_SIZE * 0.5` offsets in `cameraController.getScreenPointForCell`** are intentional cell-center alignment.
- **Monastery destruction relic-drop fallback "stack on anchor cell"** (`createSimulationBridge.ts:3196-3198`) ƒ?" relics are resources without unit-occupancy; overlap is intended.

---

## Top issues to fix first (synthesized)

1. **[V2-1] Finish the H-1 seed fix** *(Codex + Claude ƒ?" agreement)* ƒ?" `getSeed: () => effectiveSeed` at `createSimulationBridge.ts:6894` and `seed: effectiveSeed,` at `:7314`. Widen `tests/simulation/saveLoad.test.ts` to assert both paths. Highest priority because (a) two reviewers caught it independently, (b) it breaks the determinism contract on the load ƒ+' re-save path that's ARCHITECTURE.md-load-bearing.
2. **[H2-1] Tech double-research idempotency guard** *(Claude)* ƒ?" one-line `if (hasTechnology(owner, type)) return;` at the top of `applyTechnology` in `bridge/technologyOps.ts`, plus a regression test that queues `'forging'` at two Blacksmiths and asserts `attackDamage` only gains `+1`.
3. **[H2-3] Black Forest stone loss** *(Codex)* ƒ?" widen the carved start pocket so `STARTING_STONE` cells fit, and have `applyResourcePatch` (or the spawn-list helper) surface rejected adds to the bootstrap validator. Add a regression test that asserts the standard per-owner stone count on the Black Forest seed.
4. **[H2-2] Carried gather load preserved on temp path-block** *(Claude)* ƒ?" guard `gatherer.carriedAmount = 0` behind "no carry exists"; otherwise `task = 'idle'`. Regression test: villager carrying wood + drop-off momentarily blocked + path reopens ƒ+' load delivered, not lost.
5. **[M2-1] `findPreferredVisibleEnemyBuilding` footprint visibility** *(Gemini)* ƒ?" replace anchor-cell `visibility.isVisible` with `isFootprintVisible` parity to `createProjector`. Regression test: large building with only non-anchor cells visible is still targetable.

`[M2-2]` (save-panel download fallback) and `[M2-3]` (AI villager-availability priority) are also small, isolated correctness fixes worth bundling with the same sprint if scope allows.

---

## Process notes for next iteration

- **Gemini quota issue:** `gemini-2.5-pro` and `gemini-3.1-pro-preview` were both quota-exhausted on this account when this iteration ran. Reset window was ~13 h. Fell back to `gemini-3-flash-preview` (probed via a `ping` test first). Flash is weaker on deep reasoning than pro/pro-preview but still produced the M2-1 footprint-visibility finding. **For iteration 3, retry pro-preview first; only fall back to flash if pro-preview is still rate-limited.**
- **Codex's PowerShell wrapper noise:** `codex exec` on Windows produces many `Cannot set property. Property setting is supported only on core types in this language mode.` warnings interleaved with its real output. These are harmless (PowerShell constrained-language mode rejecting Codex's `[Console]::OutputEncoding` setter) and the actual review is at the tail of the file. Worth a one-line note in `AGENTS.md` so reviewers don't worry about them.
- **Claude was again the most prolific** (204 lines vs Codex's ~50 lines of actual review content vs Gemini's ~50). Claude found 11 of the 16 medium findings and both new highs (H2-1, H2-2). Codex's strength was the verification pass ƒ?" it caught the incomplete H-1 fix faster than Claude (Claude found it as well, but Codex flagged saveGameOps.ts:210 in addition to the HUD path).
- **Iteration 1's "explicit verified-not-bugs section" prompt change worked:** all three reviewers emitted that section this round. Keep for iteration 3.
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

codex
I have the review report now. The next pass is file-local: verify the exact landed lines and inspect the adjacent logic that those one-line fixes depend on.
2026-04-26T04:18:59.659135Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git branch --show-current'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git branch --show-current' in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git branch --show-current'` rejected: blocked by policy
2026-04-26T04:18:59.661035Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git rev-parse --short HEAD'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git rev-parse --short HEAD' in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git rev-parse --short HEAD'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --stat --oneline 7d63e00' in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --stat --oneline f54c55d' in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --stat --oneline af4c559' in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --stat --oneline 7687b82' in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --stat --oneline 0dc7cd7' in C:\Users\38909\Documents\github\aoe2
2026-04-26T04:19:00.109246Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.3 seconds
Output:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
fatal: detected dubious ownership in repository at 'C:/Users/38909/Documents/github/aoe2'
'C:/Users/38909/Documents/github/aoe2' is owned by:
	'S-1-5-21-1271198036-759608721-3065425230-1001'
but the current user is:
	'S-1-5-21-1271198036-759608721-3065425230-1004'
To add an exception for this directory, call:

	git config --global --add safe.directory C:/Users/38909/Documents/github/aoe2

 exited 1 in 279ms:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
fatal: detected dubious ownership in repository at 'C:/Users/38909/Documents/github/aoe2'
'C:/Users/38909/Documents/github/aoe2' is owned by:
	'S-1-5-21-1271198036-759608721-3065425230-1001'
but the current user is:
	'S-1-5-21-1271198036-759608721-3065425230-1004'
To add an exception for this directory, call:

	git config --global --add safe.directory C:/Users/38909/Documents/github/aoe2

2026-04-26T04:19:00.140274Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.3 seconds
Output:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
fatal: detected dubious ownership in repository at 'C:/Users/38909/Documents/github/aoe2'
'C:/Users/38909/Documents/github/aoe2' is owned by:
	'S-1-5-21-1271198036-759608721-3065425230-1001'
but the current user is:
	'S-1-5-21-1271198036-759608721-3065425230-1004'
To add an exception for this directory, call:

	git config --global --add safe.directory C:/Users/38909/Documents/github/aoe2

 exited 1 in 305ms:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
fatal: detected dubious ownership in repository at 'C:/Users/38909/Documents/github/aoe2'
'C:/Users/38909/Documents/github/aoe2' is owned by:
	'S-1-5-21-1271198036-759608721-3065425230-1001'
but the current user is:
	'S-1-5-21-1271198036-759608721-3065425230-1004'
To add an exception for this directory, call:

	git config --global --add safe.directory C:/Users/38909/Documents/github/aoe2

2026-04-26T04:19:00.152669Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.3 seconds
Output:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
fatal: detected dubious ownership in repository at 'C:/Users/38909/Documents/github/aoe2'
'C:/Users/38909/Documents/github/aoe2' is owned by:
	'S-1-5-21-1271198036-759608721-3065425230-1001'
but the current user is:
	'S-1-5-21-1271198036-759608721-3065425230-1004'
To add an exception for this directory, call:

	git config --global --add safe.directory C:/Users/38909/Documents/github/aoe2

 exited 1 in 320ms:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
fatal: detected dubious ownership in repository at 'C:/Users/38909/Documents/github/aoe2'
'C:/Users/38909/Documents/github/aoe2' is owned by:
	'S-1-5-21-1271198036-759608721-3065425230-1001'
but the current user is:
	'S-1-5-21-1271198036-759608721-3065425230-1004'
To add an exception for this directory, call:

	git config --global --add safe.directory C:/Users/38909/Documents/github/aoe2

2026-04-26T04:19:00.185301Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.3 seconds
Output:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
fatal: detected dubious ownership in repository at 'C:/Users/38909/Documents/github/aoe2'
'C:/Users/38909/Documents/github/aoe2' is owned by:
	'S-1-5-21-1271198036-759608721-3065425230-1001'
but the current user is:
	'S-1-5-21-1271198036-759608721-3065425230-1004'
To add an exception for this directory, call:

	git config --global --add safe.directory C:/Users/38909/Documents/github/aoe2

 exited 1 in 349ms:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
fatal: detected dubious ownership in repository at 'C:/Users/38909/Documents/github/aoe2'
'C:/Users/38909/Documents/github/aoe2' is owned by:
	'S-1-5-21-1271198036-759608721-3065425230-1001'
but the current user is:
	'S-1-5-21-1271198036-759608721-3065425230-1004'
To add an exception for this directory, call:

	git config --global --add safe.directory C:/Users/38909/Documents/github/aoe2

2026-04-26T04:19:00.204035Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.4 seconds
Output:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
fatal: detected dubious ownership in repository at 'C:/Users/38909/Documents/github/aoe2'
'C:/Users/38909/Documents/github/aoe2' is owned by:
	'S-1-5-21-1271198036-759608721-3065425230-1001'
but the current user is:
	'S-1-5-21-1271198036-759608721-3065425230-1004'
To add an exception for this directory, call:

	git config --global --add safe.directory C:/Users/38909/Documents/github/aoe2

 exited 1 in 365ms:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
fatal: detected dubious ownership in repository at 'C:/Users/38909/Documents/github/aoe2'
'C:/Users/38909/Documents/github/aoe2' is owned by:
	'S-1-5-21-1271198036-759608721-3065425230-1001'
but the current user is:
	'S-1-5-21-1271198036-759608721-3065425230-1004'
To add an exception for this directory, call:

	git config --global --add safe.directory C:/Users/38909/Documents/github/aoe2

2026-04-26T04:19:11.503548Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 branch --show-current'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 branch --show-current' in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 branch --show-current'` rejected: blocked by policy
2026-04-26T04:19:11.505613Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 rev-parse --short HEAD'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 rev-parse --short HEAD' in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 rev-parse --short HEAD'` rejected: blocked by policy
2026-04-26T04:19:11.676147Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 show --stat --oneline 7d63e00'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 show --stat --oneline 7d63e00' in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 show --stat --oneline 7d63e00'` rejected: blocked by policy
2026-04-26T04:19:11.677688Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 show --stat --oneline f54c55d'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 show --stat --oneline f54c55d' in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 show --stat --oneline f54c55d'` rejected: blocked by policy
2026-04-26T04:19:11.679400Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 show --stat --oneline af4c559'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 show --stat --oneline af4c559' in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 show --stat --oneline af4c559'` rejected: blocked by policy
2026-04-26T04:19:11.681519Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 show --stat --oneline 7687b82'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 show --stat --oneline 7687b82' in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 show --stat --oneline 7687b82'` rejected: blocked by policy
2026-04-26T04:19:11.684103Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 show --stat --oneline 0dc7cd7'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 show --stat --oneline 0dc7cd7' in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git -c safe.directory=C:/Users/38909/Documents/github/aoe2 show --stat --oneline 0dc7cd7'` rejected: blocked by policy
codex
Git inspection is partly constrained by this environment’s ownership policy, so I’m falling back to direct file and test inspection where needed. That’s enough to verify the landed code paths, but I’ll call out anything I couldn’t confirm from `git show` itself.
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git show --stat --oneline 7d63e00' in C:\Users\38909\Documents\github\aoe2
2026-04-26T04:19:20.554843Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.2 seconds
Output:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
fatal: detected dubious ownership in repository at 'C:/Users/38909/Documents/github/aoe2'
'C:/Users/38909/Documents/github/aoe2' is owned by:
	'S-1-5-21-1271198036-759608721-3065425230-1001'
but the current user is:
	'S-1-5-21-1271198036-759608721-3065425230-1004'
To add an exception for this directory, call:

	git config --global --add safe.directory C:/Users/38909/Documents/github/aoe2

 exited 1 in 247ms:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 
fatal: detected dubious ownership in repository at 'C:/Users/38909/Documents/github/aoe2'
'C:/Users/38909/Documents/github/aoe2' is owned by:
	'S-1-5-21-1271198036-759608721-3065425230-1001'
but the current user is:
	'S-1-5-21-1271198036-759608721-3065425230-1004'
To add an exception for this directory, call:

	git config --global --add safe.directory C:/Users/38909/Documents/github/aoe2

2026-04-26T04:19:34.510293Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\createSimulationBridge.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 5688 -First 40'` rejected: blocked by policy
2026-04-26T04:19:34.510446Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\createSimulationBridge.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 7308 -First 24'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\createSimulationBridge.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 5688 -First 40' in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\createSimulationBridge.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 7308 -First 24' in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\createSimulationBridge.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 5688 -First 40'` rejected: blocked by policy
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\createSimulationBridge.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 7308 -First 24'` rejected: blocked by policy
2026-04-26T04:19:34.681387Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\bridge\\technologyOps.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 150 -First 30'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\bridge\\technologyOps.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 150 -First 30' in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\bridge\\technologyOps.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 150 -First 30'` rejected: blocked by policy
2026-04-26T04:19:34.685204Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\mapGeneration\\blackForestMap.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -First 70'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\mapGeneration\\blackForestMap.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -First 70' in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\mapGeneration\\blackForestMap.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -First 70'` rejected: blocked by policy
2026-04-26T04:19:34.687411Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\bridge\\targetFindingOps.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 300 -First 40'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\bridge\\targetFindingOps.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 300 -First 40' in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\bridge\\targetFindingOps.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 300 -First 40'` rejected: blocked by policy
2026-04-26T04:19:34.689345Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\bridge\\pureHelpers.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 392 -First 32'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\bridge\\pureHelpers.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 392 -First 32' in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=1; Get-Content src'"\\game\\simulation\\bridge\\pureHelpers.ts | ForEach-Object { '{0,6}: {1}' -f "'$i, $_; $i++ } | Select-Object -Skip 392 -First 32'` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\bridge\\technologyOps.ts | Select-Object -Skip 150 -First 30" in C:\Users\38909\Documents\github\aoe2
 succeeded in 320ms:
          entry.unitType = to;
          entry.label = to;
        }
      }
    }
  }

  function applyTechnology(owner: number, technologyType: ResearchableTechnologyType): void {
    // Idempotency guard (iter-2 H2-1): enqueueResearch only dedupes
    // within the same building's queue, so two producer buildings can
    // race-queue the same tech and reach this completion path twice.
    // Many cases below use += increments (forging, iron-casting,
    // blast-furnace, bracer, every armor tier, ...) so the second call
    // would silently double the bonus. Skip if the tech is already
    // applied for this owner.
    const ownerSet = researchedTechnologies.get(owner);
    if (ownerSet?.has(technologyType)) {
      return;
    }
    ownerSet?.add(technologyType);

    switch (technologyType) {
      case 'feudal-age':
        playerAges.set(owner, 'feudal-age');
        break;
      case 'castle-age':
        playerAges.set(owner, 'castle-age');
        break;
      case 'imperial-age':
        // Slice 7A: flip the player to Imperial Age. Individual unit-line
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\createSimulationBridge.ts | Select-Object -Skip 5690 -First 32" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\createSimulationBridge.ts | Select-Object -Skip 7318 -First 18" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\mapGeneration\\blackForestMap.ts | Select-Object -First 50" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\bridge\\targetFindingOps.ts | Select-Object -Skip 308 -First 34" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\bridge\\pureHelpers.ts | Select-Object -Skip 394 -First 22" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\createSimulationBridge.ts | Select-Object -Skip 6888 -First 12" in C:\Users\38909\Documents\github\aoe2
 succeeded in 366ms:
            ? null
            : findBuildingApproachPlan(id, dropOffId, 1, activeWorld);

          // Iter-2 H2-2: only zero out the carry when there is genuinely
          // nothing to deliver (empty resource type or amount). When the
          // villager IS carrying a load but the path / drop-off building
          // is momentarily unreachable (enemy unit on the path, drop-off
          // mid-rebuild, or no owned drop-off at all), preserve the load
          // and re-evaluate next tick. Canonical AoE2 idles the
          // villager holding its carry until the path reopens.
          const carriedResource = gatherer.carriedResource;
          if (carriedResource === null || gatherer.carriedAmount <= 0) {
            gatherer.task = 'idle';
            gatherer.carriedAmount = 0;
            gatherer.carriedResource = null;
          } else if (!dropOffPlan) {
            // Stay in 'to-dropoff' so the next tick re-checks for a
            // newly-available drop-off; do not touch the carry.
          } else if (isUnitAtTarget(id, dropOffPlan.destination, activeWorld)) {
            const stockpile = playerResources.get(unit.owner);
            // Slice 10: AI difficulty modifies the gather-rate via a
            // per-player multiplier applied at drop-off time. Easy
            // AIs bank 70% of their carried amount, hard AIs bank 130%
            // ƒ?" the worked simulation still walks villagers through
            // the full gather ƒ+' return cycle, we only scale the
            // stockpile increment. Humans gather at 1.0.
            const aiState = aiStates.get(unit.owner);
            const multiplier = aiState ? gatherMultiplier(aiState.difficulty) : 1;
            const deposited = Math.round(gatherer.carriedAmount * multiplier);
            if (stockpile) {
              stockpile[carriedResource] += deposited;
            }
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 388ms:
        visibleEntities: renderStore.getEntities().length,
        visibleCells: frame?.visibleCells.length ?? 0,
        exploredCells: frame?.exploredCells.length ?? 0,
        tickDurationMs,
        fpsTarget: TPS,
        worldSize: `${MAP_WIDTH}x${MAP_HEIGHT}`,
        seed: effectiveSeed,
        currentAge: getPlayerAge(HUMAN_PLAYER_ID),
        playerResources: getPlayerResources(HUMAN_PLAYER_ID),
        population: getPopulationState(HUMAN_PLAYER_ID),
        matchState: getMatchState(),
      };
    },
    getEconomyState,
    getPopulationState,
    getSelectionState,
    getMatchState,
    getPlacementPreview,
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 316ms:
import type { PrototypeScenario } from '../prototypeScenario';
import {
  applyStandardPlayerOpening,
  createPlayerStarts,
} from './applyStandardPlayerOpening';
import { MAP_HEIGHT, MAP_WIDTH } from './constants';
import {
  createTerrainCell,
  paintDisc,
  seedToNumber,
  type TerrainCellSpec,
} from './sharedTerrainHelpers';
import { createSpawnList } from './spawnList';

// Slice 11: Black Forest-style map. Dense forest covers the map with
// carved-out pockets for each player start and a winding corridor
// between them. Deterministic on the seed so tests and fixtures agree.
// The standard resource patches near each Town Center are preserved so
// the opening 2-3 minutes of play feel like Arabia ƒ?" the differentiator
// is the wall of trees across the rest of the map.
export function createBlackForestMap(seed: string): PrototypeScenario {
  const terrain: TerrainCellSpec[][] = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => createTerrainCell(x, y, 'forest')),
  );

  const starts = createPlayerStarts();
  const spawns = createSpawnList();

  // Carve out a base pocket (grass) around each start so the Town Center,
  // villagers, and resource offsets all have valid terrain. Iter-2 H2-3:
  // the prior radius of 6 cleared starting villager / sheep / berry
  // offsets but missed STARTING_STONE (1, 6) at distance ƒ%^ 6.08,
  // STARTING_GOLD (6, 0) at distance 6, and STARTING_BOARS (4, -5) at
  // distance ƒ%^ 6.40. Those cells stayed forest and got a tree spawn in
  // the seeding loop below; applyStandardPlayerOpening then silently
  // dropped the standard resource spawn at first-write-wins time. A
  // radius of 7 covers every starting offset without changing the
  // dense-forest character of the map.
  const POCKET_RADIUS = 7;
  for (const start of starts) {
    paintDisc(terrain, start.townCenter, POCKET_RADIUS, 'grass');
  }

  // Carve a winding corridor between the two starts. The corridor steps
  // from one Town Center to the other one tile at a time; at each step
  // we paint a small disc of grass so the path is passable. The seed
  // drives a small vertical wiggle so the corridor isn't a dead straight
  // line ƒ?" players on the same seed always get the same corridor.
  const [firstStart, secondStart] = starts;
  if (firstStart && secondStart) {
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 339ms:
  }

  function findPreferredVisibleEnemyBuilding(viewerOwner: number, origin: Position): number | null {
    // Iter-2 M2-1: visibility check goes through the building footprint,
    // not just the anchor cell, so partially-visible large buildings
    // (Castles, Town Centers, Wonders) are targetable as soon as ANY
    // cell of the footprint is in fog. Mirrors the contract createProjector
    // already uses to decide whether to render the building.
    const candidates = [...world.query('position', 'building')]
      .map((id) => ({
        id,
        position: world.getComponent<Position>(id, 'position'),
        building: world.getComponent<BuildingComponent>(id, 'building'),
      }))
      .filter(
        (
          entry,
        ): entry is { id: number; position: Position; building: BuildingComponent } => {
          if (
            entry.position === undefined
            || entry.building === undefined
            || entry.building.owner === viewerOwner
          ) {
            return false;
          }
          const footprint = getBuildingFootprint(entry.building.buildingType);
          return isFootprintVisible(
            visibility,
            viewerOwner,
            entry.position.x,
            entry.position.y,
            footprint.width,
            footprint.height,
          );
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 384ms:
    isPlacementBlocked,
    startConstruction,
    enqueueRejection,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
  });

  // Slice 9 + Phase 3: full-game serialization lives in
  // `bridge/saveGameOps`. The factory takes every persisted side map +
  // matchState + world/visibility references createWorld owns; the
  // returned `saveGame` produces the same blob as the pre-extraction
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 396ms:

// Structural visibility query ƒ?" only `isVisible` is needed here. The
// authoritative VisibilityMap satisfies this; so do the lighter
// `VisibilityQuery` mocks in targetFindingOps + tests.
interface IsVisibleQuery {
  isVisible: (playerId: number, x: number, y: number) => boolean;
}

export function isFootprintVisible(
  visibility: IsVisibleQuery,
  playerId: number,
  anchorX: number,
  anchorY: number,
  footprintWidth: number,
  footprintHeight: number,
): boolean {
  const flooredX = Math.floor(anchorX);
  const flooredY = Math.floor(anchorY);
  for (let offsetY = 0; offsetY < footprintHeight; offsetY += 1) {
    for (let offsetX = 0; offsetX < footprintWidth; offsetX += 1) {
      if (visibility.isVisible(playerId, flooredX + offsetX, flooredY + offsetY)) {
        return true;
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

2026-04-26T04:19:59.052376Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\createSimulationBridge.ts -Pattern \"getSeed|effectiveSeed|getHudState\" -Context 2,3"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\createSimulationBridge.ts -Pattern \"getSeed|effectiveSeed|getHudState\" -Context 2,3" in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\createSimulationBridge.ts -Pattern \"getSeed|effectiveSeed|getHudState\" -Context 2,3"` rejected: blocked by policy
2026-04-26T04:19:59.084967Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\bridge\\saveGameOps.ts -Pattern \"getSeed|seed:\" -Context 2,3"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\bridge\\saveGameOps.ts -Pattern \"getSeed|seed:\" -Context 2,3" in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\bridge\\saveGameOps.ts -Pattern \"getSeed|seed:\" -Context 2,3"` rejected: blocked by policy
2026-04-26T04:19:59.201578Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\bridge\\targetFindingOps.ts -Pattern \"findPreferredVisibleEnemyBuilding|findPreferredVisibleEnemyBuildingInRadius|isVisible\" -Context 2,3"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\bridge\\targetFindingOps.ts -Pattern \"findPreferredVisibleEnemyBuilding|findPreferredVisibleEnemyBuildingInRadius|isVisible\" -Context 2,3" in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\bridge\\targetFindingOps.ts -Pattern \"findPreferredVisibleEnemyBuilding|findPreferredVisibleEnemyBuildingInRadius|isVisible\" -Context 2,3"` rejected: blocked by policy
2026-04-26T04:19:59.220192Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\bridge\\visibility.ts -Pattern \"isFootprintVisible\" -Context 2,4"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\bridge\\visibility.ts -Pattern \"isFootprintVisible\" -Context 2,4" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\createSimulationBridge.ts -Pattern \"to-dropoff|findBuildingApproachPlan|carriedAmount = 0|carriedResource = null\" -Context 2,3" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\mapGeneration\\*.ts -Pattern \"STARTING_STONE|STARTING_GOLD|STARTING_BOARS|POCKET_RADIUS|addResourceSpawn|first-write-wins\" -Context 1,2" in C:\Users\38909\Documents\github\aoe2
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\bridge\\visibility.ts -Pattern \"isFootprintVisible\" -Context 2,4"` rejected: blocked by policy
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\createSimulationBridge.ts -Pattern \"to-dropoff|findBuildingApproachPlan|carriedAmount = 0|carriedResource = null\" -Context 2,3"` rejected: blocked by policy
 declined in 0ms:
`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\mapGeneration\\*.ts -Pattern \"STARTING_STONE|STARTING_GOLD|STARTING_BOARS|POCKET_RADIUS|addResourceSpawn|first-write-wins\" -Context 1,2"` rejected: blocked by policy
2026-04-26T04:19:59.220585Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\createSimulationBridge.ts -Pattern \"to-dropoff|findBuildingApproachPlan|carriedAmount = 0|carriedResource = null\" -Context 2,3"` rejected: blocked by policy
2026-04-26T04:19:59.220884Z ERROR codex_core::tools::router: error=`"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Select-String -Path src\\game\\simulation\\mapGeneration\\*.ts -Pattern \"STARTING_STONE|STARTING_GOLD|STARTING_BOARS|POCKET_RADIUS|addResourceSpawn|first-write-wins\" -Context 1,2"` rejected: blocked by policy
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\createSimulationBridge.ts | Select-Object -Skip 6888 -First 22" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\bridge\\saveGameOps.ts | Select-Object -Skip 200 -First 16" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\bridge\\visibility.ts | Select-Object -Skip 500 -First 26" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\bridge\\targetFindingOps.ts | Select-Object -First 260" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\mapGeneration\\applyStandardPlayerOpening.ts | Select-Object -Skip 40 -First 32" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\mapGeneration\\startingOffsets.ts | Select-Object -First 90" in C:\Users\38909\Documents\github\aoe2
 succeeded in 363ms:
    buildingHealthStates,
    buildingCombatStates,
    wildlifeStates,
    aiStates,
  } = deps;

  function saveGame(): SaveBlob {
    return {
      schema: SAVE_SCHEMA_VERSION,
      seed: getSeed(),
      worldSnapshot: world.serialize(),
      visibility: visibility.getState(),
      matchState: {
        outcome: matchState.outcome,
        summary: matchState.summary,
        winCondition: matchState.winCondition,
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 379ms:
    isPlacementBlocked,
    startConstruction,
    enqueueRejection,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
  });

  // Slice 9 + Phase 3: full-game serialization lives in
  // `bridge/saveGameOps`. The factory takes every persisted side map +
  // matchState + world/visibility references createWorld owns; the
  // returned `saveGame` produces the same blob as the pre-extraction
  // inline implementation.
  const { saveGame } = createSaveGameOps({
    world,
    visibility,
    getSeed: () => seed,
    matchState,
    trackedVisibilitySources,
    playerAges,
    playerCivilizations,
    researchedTechnologies,
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 318ms:
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 342ms:
  kind: ResourceKind,
  amount: number,
  baseOwner: number,
  spawns: SpawnList,
): void {
  for (const offset of offsets) {
    const position = projectOffset(center, offset);
    if (!isInBounds(position.x, position.y)) {
      continue;
    }

    setTerrainKind(terrain, position.x, position.y, 'grass');
    spawns.addResourceSpawn({
      kind,
      x: position.x,
      y: position.y,
      owner: null,
      baseOwner,
      amount,
    });
  }
}

export function applyForestPatch(
  terrain: TerrainCellSpec[][],
  center: Position,
  offsets: Offset[],
  baseOwner: number,
  spawns: SpawnList,
): void {
  for (const offset of offsets) {
    const position = projectOffset(center, offset);
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 381ms:
// Phase 3 target-finding helpers. Pure geometry + filter queries the
// combat, AI, and villager systems call to pick a target from the
// current world state. Factored out of `createSimulationBridge.ts` so
// the priority tables + visible-target / nearest-drop-off helpers live
// next to each other. Same flat dep-bag factory as the other `bridge/`
// extractions.
//
// All helpers take whatever varies per call (viewer owner, origin,
// range, activeWorld) as arguments so the factory deps stay small ƒ?"
// world + visibility + the three side maps this module reads.

import type { Position, World } from 'civ-engine';

import type {
  BuildingComponent,
  BuildingType,
  EconomyResourceKind,
  UnitComponent,
  UnitType,
} from '../types';
import { canDropOffAt } from '../prototypeEconomyRules';
import type {
  GameCommands,
  GameEvents,
  GameWorld,
} from './pureHelpers';
import {
  distanceFromBuildingFootprint,
  isFootprintVisible,
  manhattanDistance,
} from './pureHelpers';
import { getBuildingFootprint } from '../../content/buildingFootprints';

interface CombatStateLike {
  currentHp: number;
}

interface ConstructionStateLike {
  isComplete: boolean;
}

interface BuildingHealthStateLike {
  currentHp: number;
}

interface VisibilityQuery {
  isVisible: (playerId: number, x: number, y: number) => boolean;
}

export interface TargetFindingDeps {
  world: GameWorld;
  visibility: VisibilityQuery;
  // Side maps. createWorld owns the references; this module only
  // reads from them. `buildingHealthStates` is accepted for parity
  // with how combat helpers inspect building HP; unused callers pass
  // the same shared Map.
  combatStates: Map<number, CombatStateLike>;
  constructionStates: Map<number, ConstructionStateLike>;
  buildingHealthStates: Map<number, BuildingHealthStateLike>;
}

export interface TargetFindingOps {
  // Per-unitType targeting priority. Lower numbers are picked first
  // (ties break by Manhattan distance downstream).
  targetPriority(unitType: UnitType): number;
  // Per-buildingType targeting priority. Same lower-first convention.
  buildingTargetPriority(buildingType: BuildingType): number;
  // Scan every enemy unit visible to `viewerOwner`, pick the one with
  // the best priority/distance.
  findPreferredVisibleEnemyUnit(viewerOwner: number, origin: Position): number | null;
  // Footprint-aware variant. Measures distance from the nearest
  // footprint cell so a 4x4 Castle's stated range lands evenly all
  // the way around the footprint (not just from the anchor corner).
  findPreferredVisibleEnemyUnitInRangeOfBuilding(
    viewerOwner: number,
    buildingAnchor: Position,
    footprint: { width: number; height: number },
    range: number,
  ): number | null;
  // Scan every enemy building visible to `viewerOwner`, pick the one
  // with the best priority/distance.
  findPreferredVisibleEnemyBuilding(viewerOwner: number, origin: Position): number | null;
  // Nearest owned, complete building that accepts drop-off of
  // `resourceKind`. `activeWorld` parameter lets system-loop callers
  // thread the world reference they already hold.
  findNearestDropOffBuilding(
    activeWorld: World<GameEvents, GameCommands>,
    owner: number,
    resourceKind: EconomyResourceKind,
    origin: Position,
  ): number | null;
  // Scan for the nearest hostile unit within `aggroRange` of `origin`.
  // Used by wildlife aggro + similar auto-target behaviors.
  findNearestHostileWildlifeTarget(
    origin: Position,
    aggroRange: number,
    activeWorld?: World<GameEvents, GameCommands>,
  ): number | null;
  // Personal-LOS variant of `findPreferredVisibleEnemyUnit`. Auto-
  // aggression (canonical AoE2 Aggressive Stance) uses the unit's own
  // sight radius ƒ?" not the player-level fog state ƒ?" so a Knight
  // standing next to an enemy spearman engages even if no allied
  // structure illuminates that tile. Returns the highest-priority
  // enemy unit within `radius` Manhattan distance from `origin`.
  findPreferredEnemyUnitInRadius(
    viewerOwner: number,
    origin: Position,
    radius: number,
  ): number | null;
  // Personal-LOS variant of `findPreferredVisibleEnemyBuilding`. Same
  // contract as `findPreferredEnemyUnitInRadius` for buildings, with
  // construction-incomplete buildings filtered out (you cannot attack
  // a partially-built building anyway and they are an off-by-one
  // gameplay footgun for auto-aggression).
  findPreferredEnemyBuildingInRadius(
    viewerOwner: number,
    origin: Position,
    radius: number,
  ): number | null;
}

export function createTargetFindingOps(deps: TargetFindingDeps): TargetFindingOps {
  const {
    world,
    visibility,
    combatStates,
    constructionStates,
  } = deps;

  // Per-unitType targeting priority for AI / unit-vs-unit target
  // selection. Lower numbers are picked first (after the priority sort,
  // ties break by Manhattan distance). Siege units sit at the top of
  // priority because they disable defensive fire (tower, castle, stone
  // wall) before chewing on infantry that will still be there after the
  // siege is gone. Monks follow because they convert and heal and also
  // need to be silenced early. Ranged units sit above melee / cavalry
  // since hitting the archer line usually wins the engagement, and
  // villagers / scouts sit last ƒ?" they are low-value kills compared to
  // losing the tower or a key army unit to siege fire.
  function targetPriority(unitType: UnitType): number {
    switch (unitType) {
      // Slice 7A: the Imperial-tier siege units slot into the same top-of-
      // target-priority bucket as their Castle-Age predecessors. Bombard
      // Cannon and Trebuchet are Imperial-only newcomers but still count
      // as siege and get the same priority.
      case 'mangonel':
      case 'scorpion':
      case 'battering-ram':
      case 'onager':
      case 'heavy-scorpion':
      case 'siege-ram':
      case 'bombard-cannon':
      case 'trebuchet':
        return 0;
      case 'monk':
        return 1;
      case 'archer':
      case 'crossbowman':
      case 'cavalry-archer':
      case 'skirmisher':
      case 'longbowman':
      case 'arbalest':
      case 'heavy-cavalry-archer':
      case 'elite-longbowman':
        return 2;
      case 'militia':
      case 'spearman':
      case 'pikeman':
      case 'knight':
      case 'camel':
      case 'scout':
      case 'light-cavalry':
      case 'halberdier':
      case 'hussar':
      case 'cavalier':
      case 'champion':
      case 'man-at-arms':
      case 'long-swordsman':
      case 'two-handed-swordsman':
      case 'paladin':
      case 'heavy-camel':
        return 3;
      case 'villager':
        return 4;
    }
  }

  // Per-buildingType targeting priority for AI / unit-vs-building target
  // selection. Lower numbers are picked first (after the priority sort,
  // ties break by Manhattan distance). Castles and Town Centers are
  // intentionally pushed to the bottom: they have huge HP pools and are
  // poor first-strikes (Gemini Medium review). Watch Towers are still
  // worth attacking quickly. Everything else stays in the middle so the
  // sort is stable for buildings without an explicit reason to defer.
  function buildingTargetPriority(buildingType: BuildingType): number {
    switch (buildingType) {
      case 'watch-tower':
        return 2;
      case 'wonder':
        // Slice 8: a Wonder with an active countdown is the single most
        // important target on the map ƒ?" if it stands, its owner wins. Rank
        // it first so AI / auto-target picks swarm the Wonder.
        return 1;
      case 'town-center':
        return 9;
      case 'castle':
        return 10;
      case 'stone-wall':
      case 'palisade-wall':
        // FU3: walls sit behind every production / tech building. They're
        // attacked only when no better target is visible (ram punch-through
        // behavior). Units still attack a wall if it blocks their path to
        // a real objective ƒ?" the pathing fallback handles that.
        return 11;
      default:
        return 5;
    }
  }

  function findPreferredVisibleEnemyUnit(viewerOwner: number, origin: Position): number | null {
    const candidates = [...world.query('position', 'unit')]
      .map((id) => ({
        id,
        position: world.getComponent<Position>(id, 'position'),
        unit: world.getComponent<UnitComponent>(id, 'unit'),
      }))
      .filter(
        (
          entry,
        ): entry is { id: number; position: Position; unit: UnitComponent } =>
          entry.position !== undefined
          && entry.unit !== undefined
          && entry.unit.owner !== viewerOwner
          && visibility.isVisible(viewerOwner, entry.position.x, entry.position.y),
      )
      .sort((left, right) => {
        const priorityDelta = targetPriority(left.unit.unitType) - targetPriority(right.unit.unitType);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        return manhattanDistance(origin, left.position) - manhattanDistance(origin, right.position);
      });

    return candidates[0]?.id ?? null;
  }

  // FU3: range check for large buildings that measures distance from the
  // NEAREST footprint cell to the target (not from the anchor cell). The
  // anchor of a 4x4 Castle is its top-left corner, so a target at range 8
  // off the south-east corner used to be reported as distance 8 + 3 = 11
  // ƒ?" three cells outside the stated range. This helper fixes that by
  // folding the footprint into the distance math so the Castle's stated
  // range lands evenly all the way around the footprint.
  function findPreferredVisibleEnemyUnitInRangeOfBuilding(
    viewerOwner: number,
    buildingAnchor: Position,
    footprint: { width: number; height: number },
    range: number,
  ): number | null {
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 418ms:
import type { Position } from 'civ-engine';

import { MAP_HEIGHT, MAP_WIDTH } from './constants';
import {
  orientationFor,
  projectOffset,
  type Offset,
} from './sharedTerrainHelpers';
import type { ScenarioSpawnSpec } from '../prototypeScenario';

// Slice 1: starting unit, sheep, boar, berry, gold, stone, and forest
// offsets for every player base. Coordinates are expressed relative to
// the player's Town Center anchor and get mirrored to fit the
// orientation of each player's home base.

export const HUMAN_PLAYER_ID = 1;

export const STARTING_VILLAGERS: Offset[] = [
  { x: -2, y: 0 },
  { x: -2, y: 1 },
  { x: -1, y: 1 },
];

export const STARTING_SHEEP: Offset[] = [
  { x: 4, y: 1 },
  { x: 5, y: 1 },
  { x: 4, y: 2 },
  { x: 5, y: 2 },
];

export const STARTING_BOARS: Offset[] = [
  { x: -4, y: -4 },
  { x: 4, y: -5 },
];

export const STARTING_BERRIES: Offset[] = [
  { x: -4, y: 1 },
  { x: -4, y: 2 },
  { x: -3, y: 2 },
  { x: -3, y: 3 },
  { x: -2, y: 2 },
  { x: -2, y: 3 },
];

export const STARTING_GOLD: Offset[] = [
  { x: 5, y: -1 },
  { x: 6, y: -1 },
  { x: 5, y: 0 },
  { x: 6, y: 0 },
];

export const STARTING_STONE: Offset[] = [
  { x: 0, y: 5 },
  { x: 1, y: 5 },
  { x: 0, y: 6 },
  { x: 1, y: 6 },
];

export const SHORE_FISH_AMOUNT = 225;

export const FOREST_PATCHES: Offset[][] = [
  [
    { x: -6, y: -2 },
    { x: -6, y: -1 },
    { x: -6, y: 0 },
    { x: -5, y: -2 },
    { x: -5, y: -1 },
    { x: -5, y: 0 },
    { x: -4, y: -2 },
    { x: -4, y: -1 },
  ],
  [
    { x: 4, y: -4 },
    { x: 5, y: -4 },
    { x: 6, y: -4 },
    { x: 4, y: -3 },
    { x: 5, y: -3 },
    { x: 6, y: -3 },
    { x: 5, y: -2 },
    { x: 6, y: -2 },
  ],
  [
    { x: -2, y: 5 },
    { x: -1, y: 5 },
    { x: 0, y: 5 },
    { x: 1, y: 5 },
    { x: -2, y: 6 },
    { x: -1, y: 6 },
    { x: 0, y: 6 },
    { x: 1, y: 6 },
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

codex
The first real bug surfaced: the HUD half of the seed fix landed, but the re-save half did not. `getHudState()` now uses `effectiveSeed`; `createSaveGameOps` is still wired to `getSeed: () => seed`, so load → re-save can still stamp the outer constructor seed back into the blob.
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content tests\\simulation\\saveLoad.test.ts | Select-Object -Skip 190 -First 48" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\createSimulationBridge.ts | Select-Object -Skip 3398 -First 18" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\createSimulationBridge.ts | Select-Object -Skip 5458 -First 18" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content tests\\simulation\\technologyIdempotency.test.ts | Select-Object -First 120" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content tests\\simulation\\gatherCarryPreservation.test.ts | Select-Object -First 120" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content tests\\simulation\\targetFindingFootprintVisibility.test.ts | Select-Object -First 220" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content tests\\simulation\\prototypeScenario.test.ts | Select-Object -Skip 486 -First 56" in C:\Users\38909\Documents\github\aoe2
 succeeded in 334ms:
    for (let i = 0; i < 50; i += 1) {
      bridge1.step(100);
    }

    const economy1 = bridge1.getEconomyState();
    const blob = bridge1.saveGame();
    const bridge2 = createSimulationBridge('conquest-victory-fixture', { savedGame: blob });
    const economy2 = bridge2.getEconomyState();

    expect(economy2.ages).toEqual(economy1.ages);
  });

  it('reports the saved-game seed via getHudState() after load (review V2-1 follow-up)', () => {
    // Companion to the H-1 projector-seed test above: getHudState().seed
    // is the seed surface the HUD + browser test snapshot consume. After
    // load it must equal `savedGame.seed`, not the outer constructor seed.
    const savedSeed = 'conquest-victory-fixture';
    const otherSeed = 'aoe2-prototype';
    expect(savedSeed).not.toBe(otherSeed);
    const bridge1 = createSimulationBridge(savedSeed);
    bridge1.step(1000);
    const blob = bridge1.saveGame();

    const loadedBridge = createSimulationBridge(otherSeed, { savedGame: blob });
    expect(loadedBridge.getHudState().seed).toBe(savedSeed);
  });

  it('writes the saved-game seed (not the outer constructor seed) when re-saving a loaded match (review V2-1 follow-up)', () => {
    // Re-saving a loaded match must not silently rebrand the blob with
    // the outer constructor seed; that breaks the determinism contract
    // for the load ƒ+' re-save round-trip.
    const savedSeed = 'conquest-victory-fixture';
    const otherSeed = 'aoe2-prototype';
    expect(savedSeed).not.toBe(otherSeed);
    const bridge1 = createSimulationBridge(savedSeed);
    bridge1.step(1000);
    const firstBlob = bridge1.saveGame();
    expect(firstBlob.seed).toBe(savedSeed);

    const loadedBridge = createSimulationBridge(otherSeed, { savedGame: firstBlob });
    const secondBlob = loadedBridge.saveGame();
    expect(secondBlob.seed).toBe(savedSeed);
  });
});
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 337ms:
      return false;
    }

    if (!getResearchOptions(building.owner, building.buildingType).includes(technologyType)) {
      return false;
    }

    const queue = productionQueues.get(buildingId) ?? [];
    if (queue.some((entry) => entry.kind === 'technology' && entry.technologyType === technologyType)) {
      return false;
    }

    const stockpile = playerResources.get(building.owner);
    if (!stockpile) {
      return false;
    }

    const cost = researchCost(technologyType);
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 375ms:
          // `addUnitEntity`, covering both scenario spawns and production-
          // queue spawns uniformly.
          const rallyPoint = rallyPoints.get(buildingId);
          if (rallyPoint) {
            issueUnitMoveCommand(unitId, rallyPoint);
          }
        }

        if (entry.kind === 'technology' && entry.technologyType) {
          applyTechnology(building.owner, entry.technologyType);
        }

        queue.shift();
      }
    },
  });

  world.registerSystem({
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 382ms:
import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function findOwnedMilitia(bridge: Bridge, owner: number) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === 'militia');
}

describe('iter-2 H2-1 ƒ?" research idempotency across multiple producer buildings', () => {
  it('Forging only grants +1 attack even when both Blacksmiths complete the same research', () => {
    // Two Blacksmiths owned by player 1 race-queue Forging at the same
    // tick. Without an idempotency guard in applyTechnology, the
    // production-queue completion path fires twice and the +1 increment
    // doubles to +2. Canonical AoE2 caps the bonus at the per-tier value.
    const bridge = createSimulationBridge('double-blacksmith-race-fixture');

    const baseMilitia = findOwnedMilitia(bridge, 1);
    expect(baseMilitia).toBeDefined();
    expect(baseMilitia?.attackDamage).toBe(4);

    // Confirm the fixture really has two Blacksmiths.
    const blacksmiths = bridge
      .getEconomyState()
      .buildings.filter((b) => b.owner === 1 && b.buildingType === 'blacksmith');
    expect(blacksmiths).toHaveLength(2);

    // Queue Forging at Blacksmith A.
    expect(bridge.selectEntityAtCell(4, 6)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('blacksmith');
    expect(bridge.queueResearch('forging')).toBe(true);

    // Queue Forging at Blacksmith B. Today this returns true because
    // enqueueResearch only dedupes within the same building's queue;
    // both researches will run to completion. The fix ensures
    // applyTechnology is idempotent so the second completion is a
    // no-op.
    expect(bridge.selectEntityAtCell(16, 6)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('blacksmith');
    expect(bridge.queueResearch('forging')).toBe(true);

    // Step until at least one completion fires.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const militia = findOwnedMilitia(bridge, 1);
          return !!militia && militia.attackDamage > 4;
        },
        { maxSteps: 600 },
      ),
    ).toBe(true);

    // Step a generous tail so the second-completing Blacksmith also
    // runs through applyTechnology.
    for (let i = 0; i < 200; i += 1) {
      bridge.step(100);
    }

    const finalMilitia = findOwnedMilitia(bridge, 1);
    expect(finalMilitia?.attackDamage).toBe(5);
  }, 30_000);
});
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 397ms:
import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function findOwnedVillager(bridge: Bridge, owner: number) {
  return bridge.getEconomyState().villagers.find((v) => v.owner === owner);
}

function findTree(bridge: Bridge) {
  return bridge.getEconomyState().resources.find((r) => r.resourceType === 'tree');
}

describe('iter-2 H2-2 ƒ?" gather carry preserved when no drop-off path exists', () => {
  it('villager carrying wood does not zero its load and re-gather forever when no wood drop-off is owned', () => {
    // Player 1 has only a Mill (food drop-off) and a single tree. The
    // villager picks up wood, transitions to `to-dropoff`, and finds no
    // owned wood drop-off building. Without the fix the gather-system
    // zeroes the carry every tick ƒ?" and shouldMaintainGatheringOrder
    // re-targets the same tree, so the villager farms the tree from
    // 200 ƒ+' 0 for nothing. With the fix the load persists and the
    // villager idles holding the 10-wood carry; the tree stops at 190.
    const bridge = createSimulationBridge('villager-no-wood-dropoff-fixture');

    const villager = findOwnedVillager(bridge, 1);
    expect(villager).toBeDefined();
    expect(villager?.carriedAmount).toBe(0);

    const initialTree = findTree(bridge);
    expect(initialTree).toBeDefined();
    expect(initialTree?.amount).toBe(200);
    expect(
      bridge
        .getEconomyState()
        .buildings.filter(
          (b) =>
            b.owner === 1
            && (b.buildingType === 'town-center' || b.buildingType === 'lumber-camp'),
        ),
    ).toHaveLength(0);

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.issueContextCommand(initialTree!.x, initialTree!.y)).toBe(true);

    // Wait for at least one gather to land ƒ?" sample tree amount and
    // wait until it drops below 200 (the villager has chopped at least
    // one wood off).
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const t = findTree(bridge);
          return !!t && t.amount < 200;
        },
        { maxSteps: 600 },
      ),
    ).toBe(true);

    // Step a generous tail past the point where the villager fills its
    // 10-wood carry. With the bug, the villager would zero the carry
    // and re-target the tree on the next tick, so the tree's amount
    // would keep decreasing past 190 toward 0. With the fix the carry
    // stays at 10 and the villager idles in `to-dropoff`; tree never
    // drops past 190.
    for (let i = 0; i < 800; i += 1) {
      bridge.step(100);
    }

    const treeAfter = findTree(bridge);
    expect(treeAfter).toBeDefined();
    expect(treeAfter!.amount).toBeGreaterThanOrEqual(190);

    // Stockpile didn't grow ƒ?" there was no drop-off to deposit at.
    expect(bridge.getEconomyState().playerResources[1].wood).toBe(200);
  }, 30_000);
});
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 416ms:
import { describe, expect, it } from 'vitest';

import { createTargetFindingOps } from '../../src/game/simulation/bridge/targetFindingOps';
import type { BuildingComponent } from '../../src/game/simulation/types';

// Mock minimal civ-engine world + visibility surfaces. The
// targetFindingOps factory only touches `query`, `queryInRadius`, and
// `getComponent` for unit/building lookups, plus `visibility.isVisible`.
function createMockWorld(entities: {
  buildings: Array<{
    id: number;
    x: number;
    y: number;
    owner: number;
    buildingType: BuildingComponent['buildingType'];
    footprint: { width: number; height: number };
  }>;
}) {
  const buildings = new Map<number, BuildingComponent>();
  const positions = new Map<number, { x: number; y: number }>();
  for (const b of entities.buildings) {
    positions.set(b.id, { x: b.x, y: b.y });
    buildings.set(b.id, {
      buildingType: b.buildingType,
      owner: b.owner,
      footprint: b.footprint,
    } as unknown as BuildingComponent);
  }

  return {
    *query(...components: string[]) {
      const wantsBuilding = components.includes('building');
      for (const id of buildings.keys()) {
        if (wantsBuilding && positions.has(id)) {
          yield id;
        }
      }
    },
    *queryInRadius() {
      // Unused for findPreferredVisibleEnemyBuilding; left as a noop
      // generator so the type checker is happy if anything probes it.
    },
    getComponent<T>(id: number, component: string): T | undefined {
      if (component === 'position') {
        return positions.get(id) as T | undefined;
      }
      if (component === 'building') {
        return buildings.get(id) as T | undefined;
      }
      return undefined;
    },
  } as unknown as Parameters<typeof createTargetFindingOps>[0]['world'];
}

function createMockVisibility(visibleCells: Set<string>) {
  return {
    isVisible(_playerId: number, x: number, y: number): boolean {
      return visibleCells.has(`${x},${y}`);
    },
  };
}

describe('iter-2 M2-1 ƒ?" findPreferredVisibleEnemyBuilding uses footprint visibility', () => {
  it('returns a 4x4 castle when a non-anchor cell is visible but the anchor is not', () => {
    // Player-1 castle (4x4) anchored at (10, 10) ƒ?" occupies (10,10) to
    // (13,13). Viewer (player 2) has visibility on (12, 12) only ƒ?" a
    // non-anchor cell. createProjector treats this footprint as visible
    // (matches what the player sees on screen). The buggy
    // findPreferredVisibleEnemyBuilding only checked the anchor cell
    // visibility, so it would return null even though the building is
    // rendered.
    const world = createMockWorld({
      buildings: [
        {
          id: 1001,
          x: 10,
          y: 10,
          owner: 1,
          buildingType: 'castle',
          footprint: { width: 4, height: 4 },
        },
      ],
    });
    const visibility = createMockVisibility(new Set(['12,12']));

    const ops = createTargetFindingOps({
      world,
      visibility,
      combatStates: new Map(),
      constructionStates: new Map(),
      buildingHealthStates: new Map(),
    });

    const result = ops.findPreferredVisibleEnemyBuilding(2, { x: 16, y: 12 });
    expect(result).toBe(1001);
  });

  it('returns null when no cell of the building footprint is visible', () => {
    // Sanity case: viewer has no visibility on any cell of the castle.
    // Should return null both before and after the fix.
    const world = createMockWorld({
      buildings: [
        {
          id: 1001,
          x: 10,
          y: 10,
          owner: 1,
          buildingType: 'castle',
          footprint: { width: 4, height: 4 },
        },
      ],
    });
    const visibility = createMockVisibility(new Set(['25,25']));

    const ops = createTargetFindingOps({
      world,
      visibility,
      combatStates: new Map(),
      constructionStates: new Map(),
      buildingHealthStates: new Map(),
    });

    const result = ops.findPreferredVisibleEnemyBuilding(2, { x: 16, y: 12 });
    expect(result).toBeNull();
  });

  it('still returns a building when only the anchor cell is visible (regression for the fix)', () => {
    // Confirm the fix does not break the prior happy path ƒ?" anchor-cell
    // visibility was the only path the original code accepted.
    const world = createMockWorld({
      buildings: [
        {
          id: 1001,
          x: 10,
          y: 10,
          owner: 1,
          buildingType: 'castle',
          footprint: { width: 4, height: 4 },
        },
      ],
    });
    const visibility = createMockVisibility(new Set(['10,10']));

    const ops = createTargetFindingOps({
      world,
      visibility,
      combatStates: new Map(),
      constructionStates: new Map(),
      buildingHealthStates: new Map(),
    });

    const result = ops.findPreferredVisibleEnemyBuilding(2, { x: 16, y: 12 });
    expect(result).toBe(1001);
  });
});
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 438ms:
    // villagers, one scout, one mill-ready berry patch, etc.
    for (const owner of [1, 2]) {
      expect(
        left.spawns.filter(
          (spawn) => spawn.owner === owner && spawn.kind === 'villager',
        ).length,
      ).toBe(3);
      expect(
        left.spawns.some(
          (spawn) =>
            spawn.kind === 'town-center' && spawn.owner === owner,
        ),
      ).toBe(true);
      expect(
        left.spawns.filter(
          (spawn) => spawn.baseOwner === owner && spawn.kind === 'berry-bush',
        ).length,
      ).toBe(6);

      // Iter-2 H2-3: standard opening seeds 4 stone, 4 gold, 2 boar
      // for every player, but the Black Forest carve-pocket was only
      // radius 6 ƒ?" so cells like STARTING_STONE (1, 6) (distance ƒ%^
      // 6.08), STARTING_GOLD (6, 0) (distance 6), and STARTING_BOARS
      // (4, -5) (distance ƒ%^ 6.40) fell into forest cells that were
      // already seeded as a tree, and the standard-opening
      // applyResourcePatch silently dropped the rejected resource
      // spawn. Lock the per-owner counts so the regression cannot
      // come back.
      expect(
        left.spawns.filter(
          (spawn) => spawn.baseOwner === owner && spawn.kind === 'stone-mine',
        ).length,
      ).toBe(4);
      expect(
        left.spawns.filter(
          (spawn) => spawn.baseOwner === owner && spawn.kind === 'gold-mine',
        ).length,
      ).toBe(4);
      expect(
        left.spawns.filter(
          (spawn) => spawn.baseOwner === owner && spawn.kind === 'boar',
        ).length,
      ).toBe(2);
    }
  });

  it('builds the Arena map deterministically with a stone ring around each base', () => {
    const left = createPrototypeScenario('arena-fixture');
    const right = createPrototypeScenario('arena-fixture');

    expect(left).toEqual(right);

    const humanStart = left.starts.find((start) => start.owner === 1);
    expect(humanStart).toBeDefined();

    // Count stone-wall cells that sit on the ring perimeter (between
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"visibility.isVisible\" src\\game\\simulation\\bridge\\targetFindingOps.ts" in C:\Users\38909\Documents\github\aoe2
 succeeded in 250ms:
234:          && visibility.isVisible(viewerOwner, entry.position.x, entry.position.y),
290:          if (!visibility.isVisible(viewerOwner, entry.position.x, entry.position.y)) {
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\bridge\\targetFindingOps.ts | Select-Object -Skip 280 -First 20" in C:\Users\38909\Documents\github\aoe2
 succeeded in 308ms:
          entry,
        ): entry is { id: number; position: Position; unit: UnitComponent } => {
          if (
            entry.position === undefined
            || entry.unit === undefined
            || entry.unit.owner === viewerOwner
          ) {
            return false;
          }
          if (!visibility.isVisible(viewerOwner, entry.position.x, entry.position.y)) {
            return false;
          }
          return distanceFromBuildingFootprint(buildingAnchor, footprint, entry.position) <= range;
        },
      )
      .sort((left, right) => {
        const priorityDelta = targetPriority(left.unit.unitType) - targetPriority(right.unit.unitType);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"findPreferredEnemyBuildingInRadius\" /c:\"findPreferredVisibleEnemyBuilding\" src\\game\\simulation\\bridge\\targetFindingOps.ts" in C:\Users\38909\Documents\github\aoe2
 succeeded in 249ms:
82:  findPreferredVisibleEnemyBuilding(viewerOwner: number, origin: Position): number | null;
110:  // Personal-LOS variant of `findPreferredVisibleEnemyBuilding`. Same
115:  findPreferredEnemyBuildingInRadius(
311:  function findPreferredVisibleEnemyBuilding(viewerOwner: number, origin: Position): number | null {
468:  function findPreferredEnemyBuildingInRadius(
513:    findPreferredVisibleEnemyBuilding,
517:    findPreferredEnemyBuildingInRadius,
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\bridge\\targetFindingOps.ts | Select-Object -Skip 460 -First 44" in C:\Users\38909\Documents\github\aoe2
 succeeded in 307ms:
        bestId = id;
      }
    }

    return bestId;
  }

  function findPreferredEnemyBuildingInRadius(
    viewerOwner: number,
    origin: Position,
    radius: number,
  ): number | null {
    let bestId: number | null = null;
    let bestPriority = Number.POSITIVE_INFINITY;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const id of world.queryInRadius(origin.x, origin.y, radius, 'position', 'building')) {
      const position = world.getComponent<Position>(id, 'position');
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (!position || !building || building.owner === viewerOwner) {
        continue;
      }

      const construction = constructionStates.get(id);
      if (construction && !construction.isComplete) {
        continue;
      }

      const distance = manhattanDistance(origin, position);
      if (distance > radius) {
        continue;
      }

      const priority = buildingTargetPriority(building.buildingType);
      if (
        priority < bestPriority
        || (priority === bestPriority && distance < bestDistance)
      ) {
        bestPriority = priority;
        bestDistance = distance;
        bestId = id;
      }
    }

Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"isFootprintVisible\" src\\game\\simulation\\bridge\\visibility.ts" in C:\Users\38909\Documents\github\aoe2
 succeeded in 258ms:
12:  isFootprintVisible,
83:        !isFootprintVisible(
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\bridge\\visibility.ts | Select-Object -Skip 72 -First 22" in C:\Users\38909\Documents\github\aoe2
 succeeded in 318ms:
        entityType = building.buildingType;
      }
      if (resource) {
        owner = resource.owner;
        entityType = resource.resourceType;
      }

      if (
        renderable.kind !== 'tile' &&
        owner !== playerId &&
        !isFootprintVisible(
          visibility,
          playerId,
          position.x,
          position.y,
          renderable.footprintWidth,
          renderable.footprintHeight,
        )
      ) {
        return null;
      }

Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /s /n /c:\"isFootprintVisible(\" src\\game\\simulation\\*.ts tests\\simulation\\*.ts" in C:\Users\38909\Documents\github\aoe2
 succeeded in 262ms:
src\game\simulation\bridge\pureHelpers.ts:403:export function isFootprintVisible(
src\game\simulation\bridge\targetFindingOps.ts:335:          return isFootprintVisible(
src\game\simulation\bridge\visibility.ts:83:        !isFootprintVisible(
src\game\simulation\createSimulationBridge.ts:2564:    return isFootprintVisible(
src\game\simulation\createSimulationBridge.ts:7252:        return isFootprintVisible(
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\createSimulationBridge.ts | Select-Object -Skip 2554 -First 18" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\createSimulationBridge.ts | Select-Object -Skip 7246 -First 18" in C:\Users\38909\Documents\github\aoe2
 succeeded in 321ms:
  function isEntityFootprintVisibleToHuman(
    position: Position,
    owner: number | null,
    footprintWidth: number,
    footprintHeight: number,
  ): boolean {
    if (owner === HUMAN_PLAYER_ID) {
      return true;
    }
    return isFootprintVisible(
      visibility,
      HUMAN_PLAYER_ID,
      position.x,
      position.y,
      footprintWidth,
      footprintHeight,
    );
  }
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 349ms:
          return true;
        }
        if (entity.owner === HUMAN_PLAYER_ID) {
          return true;
        }
        return isFootprintVisible(
          visibility,
          HUMAN_PLAYER_ID,
          entity.x,
          entity.y,
          entity.footprintWidth,
          entity.footprintHeight,
        );
      });

      // Fast path: if the human player has no fog memory at all, skip the dedupe
      // Set, the memory projection, and the merge sort entirely. This is the
      // common case every frame after warmup.
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"to-dropoff\" /c:\"carriedAmount = 0\" /c:\"carriedResource = null\" src\\game\\simulation\\createSimulationBridge.ts" in C:\Users\38909\Documents\github\aoe2
 succeeded in 243ms:
5589:            gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
5615:            gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
5638:              gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
5672:                  gatherer.task = 'to-dropoff';
5679:        if (gatherer.task === 'to-dropoff') {
5704:            gatherer.carriedAmount = 0;
5705:            gatherer.carriedResource = null;
5707:            // Stay in 'to-dropoff' so the next tick re-checks for a
5728:            gatherer.carriedAmount = 0;
5729:            gatherer.carriedResource = null;
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\mapGeneration\\spawnList.ts | Select-Object -First 220" in C:\Users\38909\Documents\github\aoe2
 succeeded in 310ms:
import type { ResourceKind } from '../types';
import type { ScenarioSpawnSpec } from '../prototypeScenario';

export type AddResourceResult =
  | { accepted: true }
  | { accepted: false; reason: 'cell-occupied'; existingKind: ResourceKind };

export interface SpawnList {
  addResourceSpawn(spawn: ScenarioSpawnSpec): AddResourceResult;
  addBuildingSpawn(spawn: ScenarioSpawnSpec): void;
  addUnitSpawn(spawn: ScenarioSpawnSpec): void;
  isCellOccupiedByResource(x: number, y: number): boolean;
  toArray(): ScenarioSpawnSpec[];
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function createSpawnList(): SpawnList {
  const spawns: ScenarioSpawnSpec[] = [];
  const resourceByCell = new Map<string, ScenarioSpawnSpec>();

  return {
    addResourceSpawn(spawn: ScenarioSpawnSpec): AddResourceResult {
      const key = cellKey(spawn.x, spawn.y);
      const existing = resourceByCell.get(key);
      if (existing) {
        return {
          accepted: false,
          reason: 'cell-occupied',
          existingKind: existing.kind as ResourceKind,
        };
      }
      resourceByCell.set(key, spawn);
      spawns.push(spawn);
      return { accepted: true };
    },

    addBuildingSpawn(spawn: ScenarioSpawnSpec): void {
      spawns.push(spawn);
    },

    addUnitSpawn(spawn: ScenarioSpawnSpec): void {
      spawns.push(spawn);
    },

    isCellOccupiedByResource(x: number, y: number): boolean {
      return resourceByCell.has(cellKey(x, y));
    },

    toArray(): ScenarioSpawnSpec[] {
      return spawns;
    },
  };
}
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"effectiveSeed\" /c:\"seed:\" /c:\"getSeed\" /c:\" seed,\" src\\game\\simulation\\createSimulationBridge.ts src\\game\\simulation\\bridge\\saveGameOps.ts tests\\simulation\\saveLoad.test.ts" in C:\Users\38909\Documents\github\aoe2
 succeeded in 266ms:
src\game\simulation\createSimulationBridge.ts:378:  seed: string,
src\game\simulation\createSimulationBridge.ts:436:        seed,
src\game\simulation\createSimulationBridge.ts:6905:    getSeed: () => seed,
src\game\simulation\createSimulationBridge.ts:7139:  const effectiveSeed = savedGame ? savedGame.seed : seed;
src\game\simulation\createSimulationBridge.ts:7177:    createWorld(effectiveSeed, visibility, savedGame);
src\game\simulation\createSimulationBridge.ts:7182:    projector: createProjector(visibility, HUMAN_PLAYER_ID, effectiveSeed, isSelected, getEntityHealth),
src\game\simulation\createSimulationBridge.ts:7325:        seed: effectiveSeed,
src\game\simulation\bridge\saveGameOps.ts:119:  getSeed: () => string;
src\game\simulation\bridge\saveGameOps.ts:169:    getSeed,
src\game\simulation\bridge\saveGameOps.ts:210:      seed: getSeed(),
tests\simulation\saveLoad.test.ts:168:  it('projects render frames with the saved-game seed, not the outer constructor seed (review H-1)', () => {
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"function hasTechnology\" /c:\"getResearchOptions\" src\\game\\simulation\\createSimulationBridge.ts" in C:\Users\38909\Documents\github\aoe2
 succeeded in 251ms:
1080:  function hasTechnology(owner: number, technologyType: ResearchableTechnologyType): boolean {
3402:    if (!getResearchOptions(building.owner, building.buildingType).includes(technologyType)) {
3967:  function getResearchOptions(owner: number, buildingType: BuildingType): ResearchableTechnologyType[] {
4184:    return getResearchOptions(owner, buildingType);
4712:            const options = getResearchOptions(owner, buildingType);
6366:        ? getResearchOptions(building.owner, building.buildingType)
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\createSimulationBridge.ts | Select-Object -Skip 1076 -First 10" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\createSimulationBridge.ts | Select-Object -Skip 3966 -First 80" in C:\Users\38909\Documents\github\aoe2
 succeeded in 306ms:
    return isUnitTransformAtTarget(transform, id, target);
  }

  function hasTechnology(owner: number, technologyType: ResearchableTechnologyType): boolean {
    return researchedTechnologies.get(owner)?.has(technologyType) ?? false;
  }

  function createCombatState(owner: number, unitType: UnitType): CombatState {
    const state: CombatState = {
      currentHp: unitMaxHp(unitType),
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 349ms:
  function getResearchOptions(owner: number, buildingType: BuildingType): ResearchableTechnologyType[] {
    if (buildingType === 'town-center' && canAdvanceToFeudalAge(owner)) {
      return ['feudal-age'];
    }

    if (buildingType === 'town-center' && canAdvanceToCastleAge(owner)) {
      return ['castle-age'];
    }

    // Slice 7A: Imperial Age research option at the Town Center. Shown only
    // when the player is in Castle Age and has two Castle-Age buildings
    // complete.
    if (buildingType === 'town-center' && canAdvanceToImperialAge(owner)) {
      return ['imperial-age'];
    }

    if (buildingType === 'blacksmith' && getPlayerAge(owner) !== 'dark-age') {
      const options: ResearchableTechnologyType[] = [];
      if (!hasTechnology(owner, 'fletching')) {
        options.push('fletching');
      }
      // FU1: Feudal Blacksmith tier ƒ?" independent one-shot upgrades.
      // Forging +1 melee attack, Scale Mail / Scale Barding / Padded
      // Archer each +1 armor to their respective unit bucket.
      if (!hasTechnology(owner, 'forging')) {
        options.push('forging');
      }
      if (!hasTechnology(owner, 'scale-mail-armor')) {
        options.push('scale-mail-armor');
      }
      if (!hasTechnology(owner, 'scale-barding-armor')) {
        options.push('scale-barding-armor');
      }
      if (!hasTechnology(owner, 'padded-archer-armor')) {
        options.push('padded-archer-armor');
      }
      // FU1: Castle Blacksmith tier ƒ?" stacks on Feudal tier. Independent
      // of prerequisite (canonical AoE2 does NOT require the predecessor
      // tech).
      if (isAtLeastAge(owner, 'castle-age')) {
        if (!hasTechnology(owner, 'iron-casting')) {
          options.push('iron-casting');
        }
        if (!hasTechnology(owner, 'chain-mail-armor')) {
          options.push('chain-mail-armor');
        }
        if (!hasTechnology(owner, 'chain-barding-armor')) {
          options.push('chain-barding-armor');
        }
        if (!hasTechnology(owner, 'leather-archer-armor')) {
          options.push('leather-archer-armor');
        }
        if (!hasTechnology(owner, 'bodkin-arrow')) {
          options.push('bodkin-arrow');
        }
      }
      // Slice 7E + FU1: Imperial Blacksmith tier. Each independent
      // one-shot upgrade ƒ?" researched order doesn't matter, bonuses
      // stack multiplicatively via createCombatState + the per-tech
      // callback.
      if (isAtLeastAge(owner, 'imperial-age')) {
        if (!hasTechnology(owner, 'bracer')) {
          options.push('bracer');
        }
        if (!hasTechnology(owner, 'blast-furnace')) {
          options.push('blast-furnace');
        }
        if (!hasTechnology(owner, 'plate-mail-armor')) {
          options.push('plate-mail-armor');
        }
        if (!hasTechnology(owner, 'plate-barding')) {
          options.push('plate-barding');
        }
        if (!hasTechnology(owner, 'ring-archer-armor')) {
          options.push('ring-archer-armor');
        }
        if (!hasTechnology(owner, 'chemistry')) {
          options.push('chemistry');
        }
      }
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"export interface BuildingComponent\" /c:\"footprint:\" src\\game\\simulation\\types.ts" in C:\Users\38909\Documents\github\aoe2
 succeeded in 261ms:
191:export interface BuildingComponent {
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content src\\game\\simulation\\types.ts | Select-Object -Skip 190 -First 18" in C:\Users\38909\Documents\github\aoe2
 succeeded in 304ms:
export interface BuildingComponent {
  owner: number;
  buildingType: BuildingType;
}

export interface ResourceComponent {
  resourceType: ResourceKind;
  amount: number;
  maxAmount: number;
  owner: number | null;
  baseOwner: number | null;
}

export interface GathererComponent {
  desiredResource: EconomyResourceKind;
  hasExplicitGatherOrder: boolean;
  task: GatherTaskState;
  targetResourceId: number | null;
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

codex
I’ve traced the surrounding call-sites now. The two places where the fix quality actually changes are: `H2-1`, where the stat-stacking bug is fixed but duplicate queueing still burns a second research slot/cost, and `H2-2`, where the code path looks sound but the regression test is materially weaker than its comment claims.
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"getSeed: () => seed\" /c:\"seed: effectiveSeed\" src\\game\\simulation\\createSimulationBridge.ts" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"const ownerSet = researchedTechnologies.get(owner);\" /c:\"if (ownerSet?.has(technologyType))\" src\\game\\simulation\\bridge\\technologyOps.ts" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'findstr /n /c:"const carriedResource = gatherer.carriedResource;" /c:"} else if (!dropOffPlan) {" src'"\\game\\simulation\\createSimulationBridge.ts" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"const POCKET_RADIUS = 7;\" src\\game\\simulation\\mapGeneration\\blackForestMap.ts" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"interface IsVisibleQuery\" /c:\"visibility: IsVisibleQuery\" src\\game\\simulation\\bridge\\pureHelpers.ts" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"const footprint = getBuildingFootprint(entry.building.buildingType);\" /c:\"return isFootprintVisible(\" src\\game\\simulation\\bridge\\targetFindingOps.ts" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"expect(loadedBridge.getHudState().seed).toBe(savedSeed);\" /c:\"expect(secondBlob.seed).toBe(savedSeed);\" tests\\simulation\\saveLoad.test.ts" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"expect(bridge.queueResearch('forging')).toBe(true);\" /c:\"expect(finalMilitia?.attackDamage).toBe(5);\" tests\\simulation\\technologyIdempotency.test.ts" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'findstr /n /c:"expect(treeAfter!.amount).toBeGreaterThanOrEqual(190);" /c:"expect(bridge.getEconomyState().playerResources[1].wood).toBe(200);" tests'"\\simulation\\gatherCarryPreservation.test.ts" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"stone-mine\" /c:\"gold-mine\" /c:\"boar\" tests\\simulation\\prototypeScenario.test.ts" in C:\Users\38909\Documents\github\aoe2
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"returns a 4x4 castle when a non-anchor cell is visible\" /c:\"returns null when no cell of the building footprint is visible\" /c:\"still returns a building when only the anchor cell is visible\" tests\\simulation\\targetFindingFootprintVisibility.test.ts" in C:\Users\38909\Documents\github\aoe2
 succeeded in 279ms:
166:    const ownerSet = researchedTechnologies.get(owner);
167:    if (ownerSet?.has(technologyType)) {
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 297ms:
6905:    getSeed: () => seed,
7325:        seed: effectiveSeed,
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 275ms:
5701:          const carriedResource = gatherer.carriedResource;
5706:          } else if (!dropOffPlan) {
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 304ms:
39:  const POCKET_RADIUS = 7;
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 319ms:
399:interface IsVisibleQuery {
404:  visibility: IsVisibleQuery,
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 326ms:
334:          const footprint = getBuildingFootprint(entry.building.buildingType);
335:          return isFootprintVisible(
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 356ms:
215:    expect(loadedBridge.getHudState().seed).toBe(savedSeed);
232:    expect(secondBlob.seed).toBe(savedSeed);
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 379ms:
35:    expect(bridge.queueResearch('forging')).toBe(true);
44:    expect(bridge.queueResearch('forging')).toBe(true);
65:    expect(finalMilitia?.attackDamage).toBe(5);
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 382ms:
72:      expect(countBy('boar', owner)).toBe(2);
75:      expect(countBy('gold-mine', owner)).toBe(4);
76:      expect(countBy('stone-mine', owner)).toBe(4);
170:    const boarAggroScenario = createPrototypeScenario('boar-aggro-fixture');
390:      boarAggroScenario.spawns.some(
391:        (spawn) => spawn.kind === 'boar' && spawn.x === 13 && spawn.y === 8,
506:      // Iter-2 H2-3: standard opening seeds 4 stone, 4 gold, 2 boar
517:          (spawn) => spawn.baseOwner === owner && spawn.kind === 'stone-mine',
522:          (spawn) => spawn.baseOwner === owner && spawn.kind === 'gold-mine',
527:          (spawn) => spawn.baseOwner === owner && spawn.kind === 'boar',
546:    // buildings rather than the pre-FU3 stone-mine proxy.
560:    // unchanged. Assert at least two stone-mine spawns beside whatever
563:      (spawn) => spawn.kind === 'stone-mine' && spawn.baseOwner === humanStart?.owner,
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 410ms:
73:    expect(treeAfter!.amount).toBeGreaterThanOrEqual(190);
76:    expect(bridge.getEconomyState().playerResources[1].wood).toBe(200);
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

 succeeded in 433ms:
64:  it('returns a 4x4 castle when a non-anchor cell is visible but the anchor is not', () => {
98:  it('returns null when no cell of the building footprint is visible', () => {
127:  it('still returns a building when only the anchor cell is visible (regression for the fix)', () => {
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "findstr /n /c:\"Project state and valid planning docs\" /c:\"C:\\Users\\38909\\Documents\\github\\aoe2\" C:\\Users\\38909\\.codex\\memories\\MEMORY.md" in C:\Users\38909\Documents\github\aoe2
 succeeded in 250ms:
39:applies_to: cwd=C:\Users\38909\Documents\github\civ-engine and C:\Users\38909\Documents\github\aoe2\docs\engine-feedback; reuse_rule=reuse for occupancy/passability/benchmarking/feedback-sync work in these repos, but re-check paths and current docs ownership before applying elsewhere
320:applies_to: cwd=C:\Users\38909\Documents\github\aoe2; reuse_rule=reuse for status checks and backlog routing in this checkout, but rerun validations because repo health can change quickly
326:- rollout_summaries/2026-04-19T06-27-22-hBBf-project_state_and_planning_docs.md (cwd=C:\Users\38909\Documents\github\aoe2, rollout_path=C:\Users\38909\.codex\sessions\2026\04\18\rollout-2026-04-18T23-27-22-019da46c-1e54-7ab0-974a-2bcd066a4f81.jsonl, updated_at=2026-04-19T06:48:27+00:00, thread_id=019da46c-1e54-7ab0-974a-2bcd066a4f81, success)
336:- rollout_summaries/2026-04-19T06-27-22-hBBf-project_state_and_planning_docs.md (cwd=C:\Users\38909\Documents\github\aoe2, rollout_path=C:\Users\38909\.codex\sessions\2026\04\18\rollout-2026-04-18T23-27-22-019da46c-1e54-7ab0-974a-2bcd066a4f81.jsonl, updated_at=2026-04-19T06:48:27+00:00, thread_id=019da46c-1e54-7ab0-974a-2bcd066a4f81, success)
Cannot set property. Property setting is supported only on core types in this language mode.
At line:1 char:1
+ [Console]::OutputEncoding=[System.Text.Encoding]::UTF8;
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidOperation: (:) [], RuntimeException
    + FullyQualifiedErrorId : PropertySetterNotSupportedInConstrainedLanguage
 

Inspected the landed file hunks, traced adjacent code paths for completeness, and assessed each regression test’s strength. One fix is still incomplete; two others have caveats around broader behavior or test strength.
  ✓ Inspect landed commits, files, and surrounding code for the five fixes
  ✓ Trace related code paths and helper call-sites for completeness and regression risk
  ✓ Assess regression test strength for each fix and write per-fix verdicts
codex
I verified against the current tree contents plus the supplied diff. I could not confirm the commit objects themselves with `git show` because this sandbox sees the repo as a dubious-ownership checkout, but the landed hunks are present at the expected files.

1. **[V2-1] HUD/save seed**
The HUD half did land in the right spot: [createSimulationBridge.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/createSimulationBridge.ts:7325) now returns `seed: effectiveSeed`, and the new assertions in [saveLoad.test.ts](/C:/Users/38909/Documents/github/aoe2/tests/simulation/saveLoad.test.ts:215) and [saveLoad.test.ts](/C:/Users/38909/Documents/github/aoe2/tests/simulation/saveLoad.test.ts:232) target the right contract. But the fix is still incomplete: [createSimulationBridge.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/createSimulationBridge.ts:6905) still passes `getSeed: () => seed` into saveGameOps, and [saveGameOps.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/bridge/saveGameOps.ts:210) still serializes that value. So load -> re-save is still wrong. The tests are strong enough; the second one directly catches the remaining bug and should fail against this tree. Verdict: `NEEDS CHANGE: switch save serialization to effectiveSeed as well, not just getHudState().`

2. **[H2-1] Tech idempotency across buildings**
The guard landed in the right place at [technologyOps.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/bridge/technologyOps.ts:166). It fixes the specific double-apply bug on completion, and I do not see a new defect from the guard itself. The related queue path is still loose, though: [createSimulationBridge.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/createSimulationBridge.ts:3402) still only dedupes within one building, so a second Blacksmith can still accept and charge the same tech; the second completion is now just a no-op. The regression test in [technologyIdempotency.test.ts](/C:/Users/38909/Documents/github/aoe2/tests/simulation/technologyIdempotency.test.ts:35) catches the stat-stacking symptom, but it does not prove both queues actually completed or cover the duplicate-cost behavior. Verdict: `OK with caveats: fixes the double-bonus bug, but duplicate queueing/cost burn is still allowed.`

3. **[H2-2] Preserve carried load with no drop-off path**
The branch split landed in the right area at [createSimulationBridge.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/createSimulationBridge.ts:5701). As written, it looks complete for this bug: any non-empty carried load is preserved, all resource kinds go through the same path, and the villager rechecks each tick until a drop-off becomes reachable. I do not see a new loop/off-by-one defect here; staying in `to-dropoff` is a reasonable choice. The test is the weak part: [gatherCarryPreservation.test.ts](/C:/Users/38909/Documents/github/aoe2/tests/simulation/gatherCarryPreservation.test.ts:73) only asserts `treeAfter.amount >= 190` and unchanged stockpile, which can pass without proving the villager preserved a full carried load. It should also assert the villager is still carrying wood at the end, ideally the expected full carry. Verdict: `OK with caveats: logic looks right, but the regression test is too loose.`

4. **[H2-3] Black Forest pocket radius**
The constant change landed at [blackForestMap.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/mapGeneration/blackForestMap.ts:39). For this finding, the fix is complete: radius 7 covers the known boar/gold/stone offsets, and I do not see another Black-Forest-specific call-site that also needed touching. It does not harden the more general “silent rejected spawn” mechanism in `SpawnList`, but that is beyond this specific fix. The test extension in [prototypeScenario.test.ts](/C:/Users/38909/Documents/github/aoe2/tests/simulation/prototypeScenario.test.ts:506) is good: locking per-owner `stone/gold/boar = 4/4/2` is the right regression surface. Verdict: `OK`.

5. **[M2-1] Building target finding uses footprint visibility**
The behavior change landed where it should: [targetFindingOps.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/bridge/targetFindingOps.ts:334) now routes building visibility through `isFootprintVisible`, and [pureHelpers.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/bridge/pureHelpers.ts:399) widens the visibility input structurally. That looks complete for the reported bug; this was the only player-visibility building-target path still using anchor-cell visibility, so projector parity is restored. I do not see a new typing or scope problem from `IsVisibleQuery`. The regression tests in [targetFindingFootprintVisibility.test.ts](/C:/Users/38909/Documents/github/aoe2/tests/simulation/targetFindingFootprintVisibility.test.ts:64) are solid behaviorally: they cover non-anchor-visible, none-visible, and anchor-visible cases. Verdict: `OK`.

**Out-of-scope follow-ups**
None high/critical beyond the still-open V2-1 re-save seed leak.


tokens used
146,849
I verified against the current tree contents plus the supplied diff. I could not confirm the commit objects themselves with `git show` because this sandbox sees the repo as a dubious-ownership checkout, but the landed hunks are present at the expected files.

1. **[V2-1] HUD/save seed**
The HUD half did land in the right spot: [createSimulationBridge.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/createSimulationBridge.ts:7325) now returns `seed: effectiveSeed`, and the new assertions in [saveLoad.test.ts](/C:/Users/38909/Documents/github/aoe2/tests/simulation/saveLoad.test.ts:215) and [saveLoad.test.ts](/C:/Users/38909/Documents/github/aoe2/tests/simulation/saveLoad.test.ts:232) target the right contract. But the fix is still incomplete: [createSimulationBridge.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/createSimulationBridge.ts:6905) still passes `getSeed: () => seed` into saveGameOps, and [saveGameOps.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/bridge/saveGameOps.ts:210) still serializes that value. So load -> re-save is still wrong. The tests are strong enough; the second one directly catches the remaining bug and should fail against this tree. Verdict: `NEEDS CHANGE: switch save serialization to effectiveSeed as well, not just getHudState().`

2. **[H2-1] Tech idempotency across buildings**
The guard landed in the right place at [technologyOps.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/bridge/technologyOps.ts:166). It fixes the specific double-apply bug on completion, and I do not see a new defect from the guard itself. The related queue path is still loose, though: [createSimulationBridge.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/createSimulationBridge.ts:3402) still only dedupes within one building, so a second Blacksmith can still accept and charge the same tech; the second completion is now just a no-op. The regression test in [technologyIdempotency.test.ts](/C:/Users/38909/Documents/github/aoe2/tests/simulation/technologyIdempotency.test.ts:35) catches the stat-stacking symptom, but it does not prove both queues actually completed or cover the duplicate-cost behavior. Verdict: `OK with caveats: fixes the double-bonus bug, but duplicate queueing/cost burn is still allowed.`

3. **[H2-2] Preserve carried load with no drop-off path**
The branch split landed in the right area at [createSimulationBridge.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/createSimulationBridge.ts:5701). As written, it looks complete for this bug: any non-empty carried load is preserved, all resource kinds go through the same path, and the villager rechecks each tick until a drop-off becomes reachable. I do not see a new loop/off-by-one defect here; staying in `to-dropoff` is a reasonable choice. The test is the weak part: [gatherCarryPreservation.test.ts](/C:/Users/38909/Documents/github/aoe2/tests/simulation/gatherCarryPreservation.test.ts:73) only asserts `treeAfter.amount >= 190` and unchanged stockpile, which can pass without proving the villager preserved a full carried load. It should also assert the villager is still carrying wood at the end, ideally the expected full carry. Verdict: `OK with caveats: logic looks right, but the regression test is too loose.`

4. **[H2-3] Black Forest pocket radius**
The constant change landed at [blackForestMap.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/mapGeneration/blackForestMap.ts:39). For this finding, the fix is complete: radius 7 covers the known boar/gold/stone offsets, and I do not see another Black-Forest-specific call-site that also needed touching. It does not harden the more general “silent rejected spawn” mechanism in `SpawnList`, but that is beyond this specific fix. The test extension in [prototypeScenario.test.ts](/C:/Users/38909/Documents/github/aoe2/tests/simulation/prototypeScenario.test.ts:506) is good: locking per-owner `stone/gold/boar = 4/4/2` is the right regression surface. Verdict: `OK`.

5. **[M2-1] Building target finding uses footprint visibility**
The behavior change landed where it should: [targetFindingOps.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/bridge/targetFindingOps.ts:334) now routes building visibility through `isFootprintVisible`, and [pureHelpers.ts](/C:/Users/38909/Documents/github/aoe2/src/game/simulation/bridge/pureHelpers.ts:399) widens the visibility input structurally. That looks complete for the reported bug; this was the only player-visibility building-target path still using anchor-cell visibility, so projector parity is restored. I do not see a new typing or scope problem from `IsVisibleQuery`. The regression tests in [targetFindingFootprintVisibility.test.ts](/C:/Users/38909/Documents/github/aoe2/tests/simulation/targetFindingFootprintVisibility.test.ts:64) are solid behaviorally: they cover non-anchor-visible, none-visible, and anchor-visible cases. Verdict: `OK`.

**Out-of-scope follow-ups**
None high/critical beyond the still-open V2-1 re-save seed leak.


