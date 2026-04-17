# Sheep Movement Implementation Plan

> **For agentic workers:** Implement task-by-task, TDD per `AGENTS.md`. Run the full gate (`npx vitest run`, `npx tsc --noEmit`, `npx vite build`, Playwright) only at the end of all simulation tasks.

**Goal:** Player can select a player-owned (claimed) sheep and right-click a destination to move it at half villager speed; once claimed, sheep ownership is sticky.

**Architecture:** Treat sheep as movable resources. Reuse the existing path planner, subgrid transforms, and `moveUnitOneSubgridStep` helper. Add a new sheep-only movement system (`prototypeHerdableMovement`), make `updateSheepOwnership` sticky, and route player commands through a new `issueSheepMoveCommand` when an owned sheep is the sole selection.

**Tech Stack:** TypeScript, civ-engine ECS, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-04-17-sheep-movement-design.md`

**Key existing helpers reused:** `findGridPath`, `getUnitTransform`, `getUnitTargetTransformForCell`, `isUnitTransformAtTarget`, `moveUnitOneSubgridStep`, `isCellPassableForWildlife` (already exists and is the right passability for sheep — checks terrain + building + other-resource, skips unit occupancy).

---

## Task 1: Add `unitTransform` to sheep entities at creation

**Files:**
- Modify: `src/game/simulation/createSimulationBridge.ts` — `addResourceEntity`

**Change:** After the existing `world.addComponent(entity, 'renderable', ...)` call inside `addResourceEntity`, add (only for sheep):

```ts
if (resourceType === 'sheep') {
  world.addComponent(entity, 'unitTransform', getUnitTargetTransformForCell(entity, position));
}
```

This makes the existing `getUnitTransform`, `moveUnitOneSubgridStep`, and `isUnitTransformAtTarget` helpers usable on sheep entities without changing their signatures.

**Verify:** `npx tsc --noEmit` clean.

**Commit:** `Add subgrid transform component to sheep entities`

---

## Task 2: Make `updateSheepOwnership` sticky

**Files:**
- Modify: `src/game/simulation/createSimulationBridge.ts` — `updateSheepOwnership`
- Test: `tests/simulation/sheepMovement.test.ts` (new)

**Step 1 — failing test:**

Create `tests/simulation/sheepMovement.test.ts` with a stickiness test that:
1. Boots a deterministic seed where a player villager is adjacent to a sheep.
2. Steps until the sheep's `owner` becomes the human player.
3. Issues a move command on the villager that walks far away (outside `MAX_HERDABLE_CLAIM_RADIUS = 6`).
4. Steps until the villager has moved away.
5. Asserts the sheep's `owner` is still the human player.

Use a fresh seed name (e.g. `sheep-movement-fixture`) and add it to `prototypeScenario.ts` (mirroring `createSheepOwnershipFixture`) — one human villager, one sheep adjacent, one human Town Center far enough away that the villager leaving the radius leaves the sheep with zero nearby player units.

**Step 2 — run, verify it fails** because today's `updateSheepOwnership` re-evaluates every tick and would null out `owner` once nobody is in range.

```
npx vitest run tests/simulation/sheepMovement.test.ts
```

**Step 3 — implementation:**

In `updateSheepOwnership`, after fetching `resource`, add:

```ts
if (resource.owner !== null) {
  continue;
}
```

before the proximity scan. Initial claim still works, but once owned it stays owned until the entity is destroyed (depleted/eaten/killed).

**Step 4 — run, verify it passes:**

```
npx vitest run tests/simulation/sheepMovement.test.ts
```

**Step 5 — commit:** `Make sheep ownership sticky once claimed`

---

## Task 3: Generalize `stepUnitTransformToward` to take a step size

**Files:**
- Modify: `src/game/simulation/createSimulationBridge.ts` — `stepUnitTransformToward`, `moveUnitOneSubgridStep`

**Change `stepUnitTransformToward`:** add an optional `stepUnits` parameter, default `UNIT_SUBGRID_STEP_PER_TICK`. Replace the two literal `UNIT_SUBGRID_STEP_PER_TICK` references inside with `stepUnits`.

```ts
function stepUnitTransformToward(
  transform: UnitTransformComponent,
  targetTransform: UnitTransformComponent,
  stepUnits: number = UNIT_SUBGRID_STEP_PER_TICK,
): UnitTransformComponent {
  // …unchanged body, but use `stepUnits` in the two places that used UNIT_SUBGRID_STEP_PER_TICK…
}
```

**Change `moveUnitOneSubgridStep`:** add an optional `stepUnits` parameter, default `UNIT_SUBGRID_STEP_PER_TICK`, forward it into `stepUnitTransformToward`.

All existing call sites stay unchanged (they implicitly use the default → identical behavior).

**Verify:** `npx tsc --noEmit` clean and `npx vitest run` is unchanged green from before — unit/military movement must be byte-identical.

**Commit:** `Parameterize subgrid step size on transform stepping`

---

## Task 4: Add `sheepMoveOrders` state, `issueSheepMoveCommand`, and the movement system

**Files:**
- Modify: `src/game/simulation/createSimulationBridge.ts`
- Test: `tests/simulation/sheepMovement.test.ts`

**Step 1 — failing tests:** add to the test file:

1. **Owned sheep moves on command:** select an owned sheep via `selectEntityAtCell` at its cell, call `issueMoveCommand(targetX, targetY)` to a cell several tiles away on open terrain, step the bridge ~80 ticks, assert the sheep's reported position has moved toward the target.
2. **Order clears at arrival:** step until arrival; assert no further movement once arrived (position stable for an additional 10 ticks).
3. **Half villager speed:** spawn an owned sheep and a player villager at symmetric start positions, issue identical `issueMoveCommand` to a far cell on both, step exactly 16 ticks, and assert the villager has covered roughly twice the subgrid distance the sheep covered (use `Math.abs(deltaSubgrid)` ratio, allow a ±1 subgrid-unit tolerance to absorb integer rounding).

**Step 2 — run, verify they fail.**

**Step 3 — implementation:**

Add near `unitCommands`:

```ts
const SHEEP_SUBGRID_STEP_PER_TICK = 1;
const sheepMoveOrders = new Map<number, Position>();
```

Add a closure `issueSheepMoveCommand` near `issueUnitMoveCommand`:

```ts
function issueSheepMoveCommand(sheepId: number, target: Position): boolean {
  const resource = world.getComponent<ResourceComponent>(sheepId, 'resource');
  if (
    !resource
    || resource.resourceType !== 'sheep'
    || resource.owner !== HUMAN_PLAYER_ID
    || resource.amount <= 0
  ) {
    return false;
  }

  sheepMoveOrders.set(sheepId, {
    x: clamp(target.x, 0, MAP_WIDTH - 1),
    y: clamp(target.y, 0, MAP_HEIGHT - 1),
  });
  return true;
}
```

Add the movement system. Place its registration immediately after `prototypeHerdableOwnership` is registered so we can use the `after` ordering, and before `prototypePlayerCommands`:

```ts
world.registerSystem({
  name: 'prototypeHerdableMovement',
  phase: 'update',
  after: ['prototypeHerdableOwnership'],
  before: ['prototypePlayerCommands'],
  execute(activeWorld) {
    for (const [sheepId, target] of [...sheepMoveOrders.entries()]) {
      const resource = activeWorld.getComponent<ResourceComponent>(sheepId, 'resource');
      const transform = getUnitTransform(sheepId, activeWorld);
      if (
        !resource
        || !transform
        || resource.resourceType !== 'sheep'
        || resource.amount <= 0
        || resource.owner === null
      ) {
        sheepMoveOrders.delete(sheepId);
        continue;
      }

      if (isUnitTransformAtTarget(transform, sheepId, target)) {
        sheepMoveOrders.delete(sheepId);
        continue;
      }

      const plan = findMovementPlan(
        sheepId,
        gridPositionFromUnitTransform(transform),
        getNearestMoveCandidates(target),
        false,
        activeWorld,
        isCellPassableForWildlife,
      );
      if (!plan) {
        sheepMoveOrders.delete(sheepId);
        continue;
      }

      moveUnitOneSubgridStep(sheepId, plan.nextStep, activeWorld, SHEEP_SUBGRID_STEP_PER_TICK);
    }
  },
});
```

(Note: `findMovementPlan` already accepts the `isPassable` function as a parameter and `isCellPassableForWildlife` already exists with the right signature — terrain + buildings + other resources, no unit-occupancy check, sheep can step around other sheep on different cells.)

**Step 4 — run, verify tests pass.**

**Step 5 — commit:** `Add sheep movement orders and per-tick stepping system`

---

## Task 5: Route right-click and move commands for selected owned sheep

**Files:**
- Modify: `src/game/simulation/createSimulationBridge.ts` — `issueMoveCommand`, `issueContextCommand`, `issueContextCommandAtEntityInternal`
- Test: `tests/simulation/sheepMovement.test.ts`

**Step 1 — failing tests:** add to the file:

1. **Right-click ground routes to sheep move:** select an owned sheep, call `issueContextCommand(targetX, targetY)` to a free cell, step ~80 ticks, assert position advanced.
2. **Right-click on entity routes to sheep move-to-position:** select an owned sheep, identify the player Town Center entity id, call `issueContextCommandAtEntity(townCenterId)`, step, assert sheep position moved toward the TC.
3. **Unclaimed sheep rejects move:** in a fixture without nearby player units, select an unclaimed sheep, call `issueMoveCommand(...)` → returns `false`, position unchanged after 30 ticks.
4. **Enemy-owned sheep rejects move:** select an enemy-claimed sheep, call `issueMoveCommand(...)` → `false`, unchanged.

**Step 2 — run, verify they fail.**

**Step 3 — implementation:** at the top of `issueMoveCommand(x, y)`, after the `isMatchRunning()` guard, insert:

```ts
const selectedIds = getSelectedEntityIds();
if (selectedIds.length === 1) {
  const onlyId = selectedIds[0]!;
  const resource = world.getComponent<ResourceComponent>(onlyId, 'resource');
  if (
    resource
    && resource.resourceType === 'sheep'
    && resource.owner === HUMAN_PLAYER_ID
    && resource.amount > 0
  ) {
    placementMode = null;
    return issueSheepMoveCommand(onlyId, { x, y });
  }
}
```

Apply the same routing block at the top of `issueContextCommand(x, y)` (after `isMatchRunning()`), so right-click on a free cell with an owned sheep selected becomes a sheep move.

In `issueContextCommandAtEntityInternal(entityId)`, after the existing `targetPosition`/selection guards, before the building-rally and unit branches, add the same single-selection sheep check using `targetPosition` as the destination.

**Step 4 — run, verify tests pass.**

**Step 5 — commit:** `Route move/right-click commands to owned sheep selections`

---

## Task 6: Cleanup `sheepMoveOrders` on sheep destruction

**Files:**
- Modify: `src/game/simulation/createSimulationBridge.ts`

**Find** every site that destroys/depletes a sheep entity (resource depletion, killed-by-wolf, eaten by villager). Add `sheepMoveOrders.delete(id);` alongside the existing `wildlifeStates.delete(id)` / `world.destroyEntity(id)` cleanup. The system itself (Task 4) already tolerates stale ids, so this is a leak guard, not correctness.

**Verify:** existing tests stay green.

**Commit:** `Drop sheep move orders when sheep entity is destroyed`

---

## Task 7: Browser regression test

**Files:**
- Modify: `tests/browser/game.spec.ts`

**Step 1 — add a Playwright test** under an existing `describe`:

- Boot the `sheep-movement-fixture` seed via the test API.
- Find the player-owned sheep render entity.
- Click the sheep cell to select it.
- Right-click a target cell several tiles away on open terrain.
- Wait for the rendered sheep position to change toward the target (poll up to a few seconds).
- Assert the new position differs from the original and is closer to the target.

Follow the patterns in the same file (e.g., the existing herdable / minimap tests) — use the dev HTTP API for selection and command issuance if tests in this file use that pattern; otherwise use UI events.

**Step 2 — run:** `npm run test:browser` and verify the new test passes.

**Step 3 — commit:** `Cover sheep right-click movement in browser tests`

---

## Task 8: Final gate + devlog

**Step 1 — run the full gate, sequentially (no compound shells):**

```
npx vitest run
npx tsc --noEmit
npx vite build
npm run test:browser
```

All four must pass.

**Step 2 — append a detailed devlog entry** to `docs/devlog/detailed/2026-04-17_2026-04-17.md` with timestamp, action, result, files changed, reasoning, notes (per `AGENTS.md`).

**Step 3 — update `docs/devlog/summary.md`:** add a single-line current entry under `## Current` for 2026-04-17 covering the sheep movement feature; remove any now-superseded same-date entries that the new one replaces; keep the file under 50 lines.

**Step 4 — commit:** `Document sheep movement feature in devlog`

---

## Self-review

- **Spec coverage:** Stickiness (T2), command on owned (T4/T5), arrival (T4), reject unclaimed/enemy (T5), half speed (T4), browser path (T7), cleanup (T6). Edge cases listed in the spec (active gather, wolf attack, multi-select) are covered by behavior of existing systems plus the sheep system's tolerance for stale state — no extra task needed.
- **Placeholders:** none.
- **Type consistency:** `SHEEP_SUBGRID_STEP_PER_TICK`, `sheepMoveOrders`, `issueSheepMoveCommand`, `prototypeHerdableMovement` used identically across tasks.
- **Out of scope** (called out in spec): multi-sheep selection batch herding, enemy re-claim by proximity, random wandering for unclaimed sheep, rally-line UI.
