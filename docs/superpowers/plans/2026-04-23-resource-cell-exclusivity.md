# Resource Cell Exclusivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce one-resource-per-cell across all map generation, add a bridge-boot guard, and replace the hand-crafted default-seed offset tables with a deterministic procedural generator that guarantees every player base has at least one cell of every starting resource type after dedupe.

**Architecture:** A new `spawnList` helper funnels every resource push through first-write-wins dedupe, so any generator that uses it inherits the invariant. A new `defaultMap` module builds the `aoe2-prototype` seed from the seed string itself, with starting-resource placement happening before forest placement so the seed's resource cluster wins any collision. The bridge-boot validator gains a resource-on-resource check that mirrors the existing building-on-building error style.

**Tech Stack:** TypeScript, Vitest, Playwright (for screenshots), Vite, Park-Miller LCG (already used elsewhere in this file).

**Spec:** `docs/superpowers/specs/2026-04-23-resource-cell-exclusivity-design.md`

---

## File map

- **Create:** `src/game/simulation/mapGeneration/spawnList.ts` — spawn-list helper with `addResourceSpawn` dedupe.
- **Create:** `src/game/simulation/mapGeneration/defaultMap.ts` — procedural `aoe2-prototype` generator.
- **Create:** `tests/simulation/mapGeneration/spawnList.test.ts` — unit tests for the helper.
- **Create:** `tests/simulation/mapGeneration/defaultMap.test.ts` — unit tests for the procedural generator.
- **Modify:** `src/game/simulation/prototypeScenario.ts` — route `applyResourcePatch`, `applyForestPatch`, `applyShoreFishPatches`, relic pushes through the spawn list; delegate `DEFAULT_SEED` branch to `createDefaultMap`; add a `slice12-validation-resource-on-resource-fixture` seed to the scenario-validation dispatcher and fixture factory.
- **Modify:** `src/game/simulation/createSimulationBridge.ts` — add resource-on-resource validation pass after line 2431.
- **Modify:** `tests/simulation/scenarioValidation.test.ts` — assert the new fixture throws.
- **Modify:** `docs/architecture/ARCHITECTURE.md` — mention the new `simulation/mapGeneration/` subdirectory.
- **Modify:** `docs/architecture/drift-log.md` — append a row for the new module.
- **Append:** `docs/devlog/detailed/2026-04-23_2026-04-23.md` — detailed entry.
- **Update:** `docs/devlog/summary.md` — top-level bullet.

---

## Task 1: Spawn-list helper with first-write-wins dedupe

**Files:**
- Create: `src/game/simulation/mapGeneration/spawnList.ts`
- Test: `tests/simulation/mapGeneration/spawnList.test.ts`

- [ ] **Step 1: Write the failing test**

Write to `tests/simulation/mapGeneration/spawnList.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { createSpawnList } from '../../../src/game/simulation/mapGeneration/spawnList';
import type { ScenarioSpawnSpec } from '../../../src/game/simulation/prototypeScenario';

describe('createSpawnList', () => {
  it('accepts the first resource at a cell and returns it from toArray in order', () => {
    const list = createSpawnList();
    const stone: ScenarioSpawnSpec = {
      kind: 'stone-mine',
      x: 9,
      y: 13,
      owner: null,
      baseOwner: 1,
      amount: 350,
    };

    expect(list.addResourceSpawn(stone)).toEqual({ accepted: true });
    expect(list.toArray()).toEqual([stone]);
  });

  it('rejects a second resource spawn at an already-claimed cell', () => {
    const list = createSpawnList();
    const stone: ScenarioSpawnSpec = {
      kind: 'stone-mine',
      x: 9,
      y: 13,
      owner: null,
      baseOwner: 1,
      amount: 350,
    };
    const tree: ScenarioSpawnSpec = {
      kind: 'tree',
      x: 9,
      y: 13,
      owner: null,
      baseOwner: 1,
      amount: 100,
    };

    list.addResourceSpawn(stone);
    const result = list.addResourceSpawn(tree);

    expect(result).toEqual({
      accepted: false,
      reason: 'cell-occupied',
      existingKind: 'stone-mine',
    });
    expect(list.toArray()).toEqual([stone]);
  });

  it('accepts resources of different kinds at different cells', () => {
    const list = createSpawnList();
    const stone: ScenarioSpawnSpec = {
      kind: 'stone-mine',
      x: 9,
      y: 13,
      owner: null,
      baseOwner: 1,
      amount: 350,
    };
    const tree: ScenarioSpawnSpec = {
      kind: 'tree',
      x: 10,
      y: 13,
      owner: null,
      baseOwner: 1,
      amount: 100,
    };

    expect(list.addResourceSpawn(stone)).toEqual({ accepted: true });
    expect(list.addResourceSpawn(tree)).toEqual({ accepted: true });
    expect(list.toArray()).toEqual([stone, tree]);
  });

  it('addBuildingSpawn is pass-through and does not dedupe', () => {
    const list = createSpawnList();
    const house1: ScenarioSpawnSpec = {
      kind: 'house',
      x: 5,
      y: 5,
      owner: 1,
      baseOwner: 1,
    };
    const house2: ScenarioSpawnSpec = {
      kind: 'house',
      x: 5,
      y: 5,
      owner: 2,
      baseOwner: 2,
    };

    list.addBuildingSpawn(house1);
    list.addBuildingSpawn(house2);

    expect(list.toArray()).toEqual([house1, house2]);
  });

  it('addUnitSpawn is pass-through and does not dedupe', () => {
    const list = createSpawnList();
    const villager1: ScenarioSpawnSpec = {
      kind: 'villager',
      x: 6,
      y: 9,
      owner: 1,
      baseOwner: 1,
    };
    const villager2: ScenarioSpawnSpec = {
      kind: 'villager',
      x: 6,
      y: 9,
      owner: 1,
      baseOwner: 1,
    };

    list.addUnitSpawn(villager1);
    list.addUnitSpawn(villager2);

    expect(list.toArray()).toEqual([villager1, villager2]);
  });

  it('reports whether a cell already holds a resource', () => {
    const list = createSpawnList();
    const stone: ScenarioSpawnSpec = {
      kind: 'stone-mine',
      x: 9,
      y: 13,
      owner: null,
      baseOwner: 1,
      amount: 350,
    };

    expect(list.isCellOccupiedByResource(9, 13)).toBe(false);
    list.addResourceSpawn(stone);
    expect(list.isCellOccupiedByResource(9, 13)).toBe(true);
    expect(list.isCellOccupiedByResource(10, 13)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run tests/simulation/mapGeneration/spawnList.test.ts`

Expected: failure (`Cannot find module .../spawnList`).

- [ ] **Step 3: Write the module**

Write to `src/game/simulation/mapGeneration/spawnList.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd vitest run tests/simulation/mapGeneration/spawnList.test.ts`

Expected: 6 tests passing.

- [ ] **Step 5: Typecheck**

Run: `npx.cmd tsc --noEmit`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/game/simulation/mapGeneration/spawnList.ts tests/simulation/mapGeneration/spawnList.test.ts
git commit -m "Add spawn-list helper with first-write-wins resource dedupe"
```

---

## Task 2: Route existing resource-patch helpers through the spawn list

**Files:**
- Modify: `src/game/simulation/prototypeScenario.ts` — update `applyResourcePatch`, `applyForestPatch`, `applyShoreFishPatches`, and the default-seed / Black Forest / Arena relic pushes to use the spawn list.

- [ ] **Step 1: Write the failing test**

Append to `tests/simulation/mapGeneration/spawnList.test.ts` a new describe block:

```typescript
import { createPrototypeScenario, DEFAULT_SEED } from '../../../src/game/simulation/prototypeScenario';

describe('default seed spawns are dedupe-safe', () => {
  it('never places two resources on the same cell', () => {
    const scenario = createPrototypeScenario(DEFAULT_SEED);
    const resourceKinds = new Set([
      'tree',
      'stone-mine',
      'gold-mine',
      'berry-bush',
      'sheep',
      'boar',
      'deer',
      'wolf',
      'fish',
      'relic',
    ]);

    const cellToResource = new Map<string, string>();
    for (const spawn of scenario.spawns) {
      if (!resourceKinds.has(spawn.kind)) {
        continue;
      }
      const key = `${spawn.x},${spawn.y}`;
      const existing = cellToResource.get(key);
      expect(existing, `duplicate at (${spawn.x},${spawn.y}): ${existing} vs ${spawn.kind}`).toBeUndefined();
      cellToResource.set(key, spawn.kind);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run tests/simulation/mapGeneration/spawnList.test.ts`

Expected: the new test fails (default seed currently stacks stone and tree at the four south cells: `(9,13),(10,13),(9,14),(10,14)` for player 1 and their mirror for player 2).

- [ ] **Step 3: Refactor `applyResourcePatch`**

In `src/game/simulation/prototypeScenario.ts`, locate `applyResourcePatch` (around line 6438). Change its signature to accept a `SpawnList` and use `addResourceSpawn`:

Replace the existing function with:

```typescript
function applyResourcePatch(
  terrain: TerrainCellSpec[][],
  center: Position,
  offsets: Offset[],
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
```

Add the import at the top of the file (near the other simulation imports):

```typescript
import { createSpawnList, type SpawnList } from './mapGeneration/spawnList';
```

- [ ] **Step 4: Refactor `applyForestPatch` and `applyShoreFishPatches`**

In the same file, change `applyForestPatch` (around line 6465):

```typescript
function applyForestPatch(
  terrain: TerrainCellSpec[][],
  center: Position,
  offsets: Offset[],
  baseOwner: number,
  spawns: SpawnList,
): void {
  for (const offset of offsets) {
    const position = projectOffset(center, offset);
    setTerrainKind(terrain, position.x, position.y, 'forest');
    if (!isInBounds(position.x, position.y)) {
      continue;
    }
    spawns.addResourceSpawn({
      kind: 'tree',
      x: position.x,
      y: position.y,
      owner: null,
      baseOwner,
      amount: 100,
    });
  }
}
```

Change `applyShoreFishPatches` (around line 6512) — its signature takes a `spawns: ScenarioSpawnSpec[]` argument; replace every `spawns.push({...})` with `spawns.addResourceSpawn({...})` and change the parameter type to `SpawnList`.

- [ ] **Step 5: Update every call site**

Search the file for all call sites of the three helpers (`applyResourcePatch`, `applyForestPatch`, `applyShoreFishPatches`) and `applyStandardPlayerOpening`. Adjust them so they pass a `SpawnList` instead of a raw array.

For each scenario / map builder that currently does `const spawns: ScenarioSpawnSpec[] = [];`, replace with:

```typescript
const spawns = createSpawnList();
```

And for each `spawns.push(...)` that pushes a resource (`kind` in `tree|stone-mine|gold-mine|berry-bush|sheep|boar|deer|wolf|fish|relic`), replace with `spawns.addResourceSpawn(...)`. For building and unit pushes, replace with `spawns.addBuildingSpawn(...)` and `spawns.addUnitSpawn(...)` respectively.

At the end of the builder, return `spawns: spawns.toArray()` instead of the raw array.

Also update `applyStandardPlayerOpening` (around line 9466) to take `spawns: SpawnList` instead of `ScenarioSpawnSpec[]` and replace its internal `spawns.push(...)` with the appropriate typed method (it pushes the TC as a building, the villagers and scout via their helpers as units, plus the resource patches via the already-refactored helpers).

- [ ] **Step 6: Run test to verify it passes**

Run: `npx.cmd vitest run tests/simulation/mapGeneration/spawnList.test.ts tests/simulation/prototypeScenario.test.ts`

Expected: `spawnList.test.ts` now passes (including the new "no two resources on same cell" case — first-wins drops the 4 colliding trees). `prototypeScenario.test.ts` has one failing case: `countBy('tree', owner) === 24` will be short by 4 for each player because the 4 south-side tree cells were dropped by dedupe. This is expected and will be addressed in Task 4's procedural generator; keep a note.

For Task 2, loosen the tree expectation temporarily so CI stays green between commits. In `tests/simulation/prototypeScenario.test.ts` line 74, change:

```typescript
expect(countBy('tree', owner)).toBe(24);
```

to:

```typescript
// Temporarily loosened: Task 2 routes spawns through spawn-list
// dedupe, which drops the 4 tree cells that overlapped stone. Task 4's
// procedural generator restores the exact count.
expect(countBy('tree', owner)).toBeGreaterThanOrEqual(20);
```

Re-run: `npx.cmd vitest run tests/simulation/prototypeScenario.test.ts`

Expected: all pass.

- [ ] **Step 7: Typecheck and build**

Run: `npx.cmd tsc --noEmit`

Expected: no errors.

Run: `npx.cmd vite build`

Expected: success.

- [ ] **Step 8: Commit**

```bash
git add src/game/simulation/prototypeScenario.ts tests/simulation/mapGeneration/spawnList.test.ts tests/simulation/prototypeScenario.test.ts
git commit -m "Route scenario spawns through spawn-list dedupe"
```

---

## Task 3: Bridge-boot resource-on-resource validation

**Files:**
- Modify: `src/game/simulation/createSimulationBridge.ts:2412-2431` — add a second loop after the resource-on-building check.
- Modify: `src/game/simulation/prototypeScenario.ts` — add a `slice12-validation-resource-on-resource-fixture` seed.
- Modify: `tests/simulation/scenarioValidation.test.ts` — assert the new fixture throws.

- [ ] **Step 1: Write the failing test**

In `tests/simulation/scenarioValidation.test.ts`, append a new case before the closing `});`:

```typescript
  it('throws when two resources share the same cell', () => {
    expect(() =>
      createSimulationBridge('slice12-validation-resource-on-resource-fixture'),
    ).toThrowError(/slice12-validation-resource-on-resource-fixture/);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run tests/simulation/scenarioValidation.test.ts`

Expected: the new case fails (currently returns without throwing because the fixture seed doesn't exist and also because there's no overlap validator yet).

- [ ] **Step 3: Register the fixture seed**

In `src/game/simulation/prototypeScenario.ts`, locate `createScenarioValidationFixture` (around line 6213) and add a new switch case before `default:` (around line 6272):

```typescript
    case 'slice12-validation-resource-on-resource-fixture':
      // Tree and stone-mine placed on the same cell. Validation should
      // catch the resource-on-resource overlap.
      baseSpawns.push({
        kind: 'tree',
        x: 12,
        y: 4,
        owner: null,
        baseOwner: null,
        amount: 100,
      });
      baseSpawns.push({
        kind: 'stone-mine',
        x: 12,
        y: 4,
        owner: null,
        baseOwner: null,
        amount: 350,
      });
      break;
```

Also extend the seed-dispatcher block around line 9187 to include the new seed:

```typescript
  if (
    seed === 'slice12-validation-ok-fixture'
    || seed === 'slice12-validation-out-of-bounds-fixture'
    || seed === 'slice12-validation-overlap-fixture'
    || seed === 'slice12-validation-unit-in-building-fixture'
    || seed === 'slice12-validation-resource-on-building-fixture'
    || seed === 'slice12-validation-resource-on-resource-fixture'
  ) {
    return createScenarioValidationFixture(seed);
  }
```

- [ ] **Step 4: Add the validation pass**

In `src/game/simulation/createSimulationBridge.ts`, locate the end of the resource-on-building loop (around line 2431, the `}` that closes `for (const resourceId of world.query('resource', 'position'))`) and insert a new loop immediately after:

```typescript
  // Resource-on-resource overlaps: no two resource entities may share a
  // cell. This matches the building-on-building pass above. The
  // overlapWhitelist escape hatch still applies for fixtures that
  // deliberately stack resources (none today, but the opt-out stays
  // consistent across kinds).
  const resourceByCell = new Map<string, { id: number; kind: string }>();
  for (const resourceId of world.query('resource', 'position')) {
    if (overlapWhitelist.has(resourceId)) {
      continue;
    }
    const position = world.getComponent<Position>(resourceId, 'position');
    const resource = world.getComponent<ResourceComponent>(resourceId, 'resource');
    if (!position || !resource) {
      continue;
    }
    const key = `${position.x},${position.y}`;
    const existing = resourceByCell.get(key);
    if (existing) {
      throw new Error(
        `Scenario '${scenario.seed}': ${resource.resourceType} resource at (${position.x},${position.y}) overlaps ${existing.kind} at the same cell.`,
      );
    }
    resourceByCell.set(key, { id: resourceId, kind: resource.resourceType });
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx.cmd vitest run tests/simulation/scenarioValidation.test.ts`

Expected: all 7 cases pass (the new overlap case throws with the seed name in the message).

- [ ] **Step 6: Typecheck**

Run: `npx.cmd tsc --noEmit`

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/game/simulation/createSimulationBridge.ts src/game/simulation/prototypeScenario.ts tests/simulation/scenarioValidation.test.ts
git commit -m "Add resource-on-resource overlap validation at bridge boot"
```

---

## Task 4: Procedural default-map module

**Files:**
- Create: `src/game/simulation/mapGeneration/defaultMap.ts`
- Create: `tests/simulation/mapGeneration/defaultMap.test.ts`

- [ ] **Step 1: Write the failing tests**

Write to `tests/simulation/mapGeneration/defaultMap.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { createDefaultMap } from '../../../src/game/simulation/mapGeneration/defaultMap';
import type { ResourceKind } from '../../../src/game/simulation/types';

const STARTING_RESOURCE_KINDS: ResourceKind[] = [
  'sheep',
  'boar',
  'berry-bush',
  'gold-mine',
  'stone-mine',
  'tree',
];

describe('createDefaultMap', () => {
  it('is deterministic for the same seed', () => {
    const left = createDefaultMap('aoe2-prototype');
    const right = createDefaultMap('aoe2-prototype');
    expect(left).toEqual(right);
  });

  it('produces different scenarios for different seeds', () => {
    const a = createDefaultMap('aoe2-prototype');
    const b = createDefaultMap('alt-seed-one');
    expect(a).not.toEqual(b);
  });

  it('never places two resources on the same cell', () => {
    const scenario = createDefaultMap('aoe2-prototype');
    const seen = new Map<string, string>();
    for (const spawn of scenario.spawns) {
      if (!STARTING_RESOURCE_KINDS.includes(spawn.kind as ResourceKind) && spawn.kind !== 'fish' && spawn.kind !== 'relic') {
        continue;
      }
      const key = `${spawn.x},${spawn.y}`;
      const existing = seen.get(key);
      expect(existing, `duplicate at ${key}: ${existing} vs ${spawn.kind}`).toBeUndefined();
      seen.set(key, spawn.kind);
    }
  });

  it('guarantees every starting resource kind near every player base', () => {
    const scenario = createDefaultMap('aoe2-prototype');
    const NEAR_RADIUS_SQ = 10 * 10;

    for (const start of scenario.starts) {
      for (const kind of STARTING_RESOURCE_KINDS) {
        const nearby = scenario.spawns.some((spawn) => {
          if (spawn.kind !== kind) {
            return false;
          }
          if (spawn.baseOwner !== start.owner) {
            return false;
          }
          const dx = spawn.x - start.townCenter.x;
          const dy = spawn.y - start.townCenter.y;
          return dx * dx + dy * dy <= NEAR_RADIUS_SQ;
        });
        expect(nearby, `missing ${kind} near owner ${start.owner} TC (${start.townCenter.x},${start.townCenter.y})`).toBe(true);
      }
    }
  });

  it('preserves the canonical per-owner resource counts', () => {
    const scenario = createDefaultMap('aoe2-prototype');
    const countBy = (kind: string, owner: number): number =>
      scenario.spawns.filter((spawn) => spawn.kind === kind && spawn.baseOwner === owner).length;

    for (const start of scenario.starts) {
      expect(countBy('sheep', start.owner)).toBe(4);
      expect(countBy('boar', start.owner)).toBe(2);
      expect(countBy('berry-bush', start.owner)).toBe(6);
      expect(countBy('gold-mine', start.owner)).toBe(4);
      expect(countBy('stone-mine', start.owner)).toBe(4);
      expect(countBy('tree', start.owner)).toBe(24);
    }
  });

  it('preserves the standard TC/villager/scout opening', () => {
    const scenario = createDefaultMap('aoe2-prototype');
    const countBy = (kind: string): number =>
      scenario.spawns.filter((spawn) => spawn.kind === kind).length;

    expect(countBy('town-center')).toBe(2);
    expect(countBy('villager')).toBe(6);
    // Two starting scouts (one per player) + one forward enemy scout.
    expect(countBy('scout')).toBe(3);
    expect(countBy('house')).toBe(1);
    expect(countBy('fish')).toBeGreaterThan(0);
    expect(countBy('relic')).toBe(2);
  });

  it('uses the same MAP_WIDTH/MAP_HEIGHT as the simulation constants', () => {
    const scenario = createDefaultMap('aoe2-prototype');
    expect(scenario.width).toBe(60);
    expect(scenario.height).toBe(36);
    expect(scenario.terrain.length).toBe(36);
    expect(scenario.terrain[0]?.length ?? 0).toBe(60);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx.cmd vitest run tests/simulation/mapGeneration/defaultMap.test.ts`

Expected: failure (`Cannot find module .../defaultMap`).

- [ ] **Step 3: Implement the generator**

Write to `src/game/simulation/mapGeneration/defaultMap.ts`:

```typescript
import type { Position } from 'civ-engine';

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  applyStandardPlayerOpeningProcedural,
  applyShoreFishPatchesProcedural,
  createBaseTerrain,
  createPlayerStarts,
  paintDisc,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createSpawnList } from './spawnList';

const FORWARD_ENEMY_SCOUT_POSITION: Position = { x: 41, y: 20 };
const FORWARD_ENEMY_HOUSE_POSITION: Position = { x: 39, y: 18 };
const DEFAULT_RELIC_POSITIONS: Position[] = [
  { x: 24, y: 24 },
  { x: 36, y: 10 },
];

export function createDefaultMap(seed: string): PrototypeScenario {
  const terrain = createBaseTerrain(seed);
  const starts = createPlayerStarts();
  const spawns = createSpawnList();

  for (const start of starts) {
    applyStandardPlayerOpeningProcedural(terrain, start, spawns, seed);
  }

  paintDisc(terrain, FORWARD_ENEMY_SCOUT_POSITION, 1, 'grass');
  paintDisc(terrain, FORWARD_ENEMY_HOUSE_POSITION, 2, 'grass');

  spawns.addBuildingSpawn({
    kind: 'house',
    x: FORWARD_ENEMY_HOUSE_POSITION.x,
    y: FORWARD_ENEMY_HOUSE_POSITION.y,
    owner: 2,
    baseOwner: 2,
  });
  spawns.addUnitSpawn({
    kind: 'scout',
    x: FORWARD_ENEMY_SCOUT_POSITION.x,
    y: FORWARD_ENEMY_SCOUT_POSITION.y,
    owner: 2,
    baseOwner: 2,
    vision: { playerId: 2, radius: 6 },
  });

  for (const relicPosition of DEFAULT_RELIC_POSITIONS) {
    paintDisc(terrain, relicPosition, 1, 'grass');
    spawns.addResourceSpawn({
      kind: 'relic',
      x: relicPosition.x,
      y: relicPosition.y,
      owner: null,
      baseOwner: null,
      amount: 0,
    });
  }

  applyShoreFishPatchesProcedural(terrain, starts, seed, spawns);

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts,
    spawns: spawns.toArray(),
  };
}
```

This references two not-yet-exposed helpers (`applyStandardPlayerOpeningProcedural`, `applyShoreFishPatchesProcedural`, plus the existing `createBaseTerrain`, `createPlayerStarts`, `paintDisc`, `MAP_WIDTH`, `MAP_HEIGHT`) from `prototypeScenario.ts`. They need to be exported and the standard-opening helper needs a procedural variant.

- [ ] **Step 4: Expose helpers from `prototypeScenario.ts`**

In `src/game/simulation/prototypeScenario.ts`, add `export` to each of:
- `function createBaseTerrain` (line ~6407)
- `function createPlayerStarts` (line ~6431)
- `function paintDisc` (line ~6328)
- `function createStartingScoutSpawn` (line ~6372)
- The helpers will be needed so the module boundary works without circular re-imports.

Add a new exported function `applyStandardPlayerOpeningProcedural` near the existing `applyStandardPlayerOpening` (around line 9466). Paste this implementation (keep the existing `applyStandardPlayerOpening` untouched so Black Forest and Arena don't change):

```typescript
// Procedural variant of applyStandardPlayerOpening used by the default
// map. Lays down each starting-resource type at seed-derived cluster
// directions, then forest clusters, with first-write-wins dedupe via
// the spawn list. Guarantees the per-owner counts required by the
// prototypeScenario contract (sheep 4, boar 2, berry 6, gold 4, stone
// 4, tree 24) because a spiral-outward fallback backfills whenever the
// primary cluster position is blocked.
export function applyStandardPlayerOpeningProcedural(
  terrain: TerrainCellSpec[][],
  start: PlayerStartSpec,
  spawns: SpawnList,
  seed: string,
): void {
  paintDisc(terrain, start.townCenter, 4, 'grass');

  spawns.addBuildingSpawn({
    kind: 'town-center',
    x: start.townCenter.x,
    y: start.townCenter.y,
    owner: start.owner,
    baseOwner: start.owner,
    vision: { playerId: start.owner, radius: 7 },
  });

  const rng = createSeedPerBaseRng(seed, start.owner);

  const cellBlockedByScenarioEntity = (x: number, y: number): boolean => {
    // Block TC footprint (4x4 starting at TC anchor).
    if (
      x >= start.townCenter.x
      && x < start.townCenter.x + 4
      && y >= start.townCenter.y
      && y < start.townCenter.y + 4
    ) {
      return true;
    }
    return spawns.isCellOccupiedByResource(x, y);
  };

  placeResourceCluster(
    terrain,
    start,
    'sheep',
    4,
    100,
    rng,
    cellBlockedByScenarioEntity,
    spawns,
    { minRing: 3, maxRing: 5, preferredAngle: 0 },
  );
  placeResourceCluster(
    terrain,
    start,
    'boar',
    2,
    340,
    rng,
    cellBlockedByScenarioEntity,
    spawns,
    { minRing: 4, maxRing: 6, preferredAngle: Math.PI * 1.75 },
  );
  placeResourceCluster(
    terrain,
    start,
    'berry-bush',
    6,
    125,
    rng,
    cellBlockedByScenarioEntity,
    spawns,
    { minRing: 3, maxRing: 4, preferredAngle: Math.PI },
  );
  placeResourceCluster(
    terrain,
    start,
    'gold-mine',
    4,
    800,
    rng,
    cellBlockedByScenarioEntity,
    spawns,
    { minRing: 5, maxRing: 6, preferredAngle: Math.PI * 0.25 },
  );
  placeResourceCluster(
    terrain,
    start,
    'stone-mine',
    4,
    350,
    rng,
    cellBlockedByScenarioEntity,
    spawns,
    { minRing: 5, maxRing: 6, preferredAngle: Math.PI * 0.5 },
  );

  placeForestCluster(
    terrain,
    start,
    24,
    rng,
    cellBlockedByScenarioEntity,
    spawns,
  );

  const orientation = orientationFor(start.townCenter);
  const villagerOffsets: Offset[] = [
    { x: -2, y: 0 },
    { x: -2, y: 1 },
    { x: -1, y: 1 },
  ];
  for (const offset of villagerOffsets) {
    const position = {
      x: start.townCenter.x + offset.x * orientation.x,
      y: start.townCenter.y + offset.y * orientation.y,
    };
    spawns.addUnitSpawn({
      kind: 'villager',
      x: position.x,
      y: position.y,
      owner: start.owner,
      baseOwner: start.owner,
      vision: { playerId: start.owner, radius: 4 },
      requiresSafeSpawn: true,
    });
  }

  spawns.addUnitSpawn(createStartingScoutSpawn(start.owner, start.townCenter));
}

// Procedural variant of applyShoreFishPatches that uses the spawn list.
export function applyShoreFishPatchesProcedural(
  terrain: TerrainCellSpec[][],
  starts: PlayerStartSpec[],
  seed: string,
  spawns: SpawnList,
): void {
  const candidates: Position[] = [];
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (!isAccessibleShorelineCell(terrain, x, y)) {
        continue;
      }
      if (starts.some((start) => distanceSquared(start.townCenter, { x, y }) <= 81)) {
        continue;
      }
      candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) {
    return;
  }

  const placed: Position[] = [];
  const targetCount = Math.min(14, Math.max(4, Math.floor(candidates.length / 12)));
  const startIndex = seedToNumber(seed) % candidates.length;
  const stride = Math.max(3, Math.floor(candidates.length / Math.max(targetCount, 1)));

  for (let attempt = 0; attempt < candidates.length && placed.length < targetCount; attempt += 1) {
    const candidate = candidates[(startIndex + attempt * stride) % candidates.length];
    if (placed.some((position) => distanceSquared(position, candidate) < 9)) {
      continue;
    }
    spawns.addResourceSpawn({
      kind: 'fish',
      x: candidate.x,
      y: candidate.y,
      owner: null,
      baseOwner: null,
      amount: SHORE_FISH_AMOUNT,
    });
    placed.push(candidate);
  }

  if (placed.length === 0) {
    const fallback = candidates[0];
    spawns.addResourceSpawn({
      kind: 'fish',
      x: fallback.x,
      y: fallback.y,
      owner: null,
      baseOwner: null,
      amount: SHORE_FISH_AMOUNT,
    });
  }
}

function createSeedPerBaseRng(seed: string, owner: number): () => number {
  let state = (seedToNumber(seed) ^ (owner * 2654435761)) >>> 0;
  if (state === 0) {
    state = 1;
  }
  return () => {
    state = (state * 48271) % 0x7fffffff;
    return state / 0x7fffffff;
  };
}

interface ClusterOptions {
  minRing: number;
  maxRing: number;
  preferredAngle: number;
}

function placeResourceCluster(
  terrain: TerrainCellSpec[][],
  start: PlayerStartSpec,
  kind: ResourceKind,
  count: number,
  amount: number,
  rng: () => number,
  isBlocked: (x: number, y: number) => boolean,
  spawns: SpawnList,
  options: ClusterOptions,
): void {
  // Perturb the preferred angle deterministically so different seeds
  // don't always put the sheep due east. Within +/- 45 degrees of the
  // preferred direction.
  const angleJitter = (rng() - 0.5) * (Math.PI / 2);
  const angle = options.preferredAngle + angleJitter;

  let placed = 0;
  const tried = new Set<string>();
  for (let ring = options.minRing; ring <= options.maxRing + 6 && placed < count; ring += 1) {
    // Walk around the ring starting from the chosen angle.
    const perimeter = Math.max(8, Math.floor(2 * Math.PI * ring));
    for (let step = 0; step < perimeter && placed < count; step += 1) {
      const theta = angle + (step * 2 * Math.PI) / perimeter;
      const x = Math.round(start.townCenter.x + Math.cos(theta) * ring);
      const y = Math.round(start.townCenter.y + Math.sin(theta) * ring);
      const key = `${x},${y}`;
      if (tried.has(key)) {
        continue;
      }
      tried.add(key);
      if (!isInBounds(x, y)) {
        continue;
      }
      if (isBlocked(x, y)) {
        continue;
      }
      setTerrainKind(terrain, x, y, 'grass');
      const result = spawns.addResourceSpawn({
        kind,
        x,
        y,
        owner: null,
        baseOwner: start.owner,
        amount,
      });
      if (result.accepted) {
        placed += 1;
      }
    }
  }

  if (placed < count) {
    throw new Error(
      `createDefaultMap: only placed ${placed}/${count} ${kind} near owner ${start.owner} TC (${start.townCenter.x},${start.townCenter.y}).`,
    );
  }
}

function placeForestCluster(
  terrain: TerrainCellSpec[][],
  start: PlayerStartSpec,
  count: number,
  rng: () => number,
  isBlocked: (x: number, y: number) => boolean,
  spawns: SpawnList,
): void {
  // Forest clusters live farther out than starting resources (ring 7+)
  // so they rarely conflict. Spread across three seed-perturbed
  // directions to keep the starting map feeling similar to the pre-
  // procedural layout.
  let placed = 0;
  const directions = [
    Math.PI * 0.75 + rng() * 0.4,
    Math.PI * 1.25 + rng() * 0.4,
    Math.PI * 1.75 + rng() * 0.4,
  ];

  for (const baseAngle of directions) {
    if (placed >= count) {
      break;
    }
    for (let ring = 6; ring <= 12 && placed < count; ring += 1) {
      const perimeter = Math.max(10, Math.floor(2 * Math.PI * ring));
      for (let step = -4; step <= 4 && placed < count; step += 1) {
        const theta = baseAngle + (step * 2 * Math.PI) / perimeter;
        const x = Math.round(start.townCenter.x + Math.cos(theta) * ring);
        const y = Math.round(start.townCenter.y + Math.sin(theta) * ring);
        if (!isInBounds(x, y)) {
          continue;
        }
        if (isBlocked(x, y)) {
          continue;
        }
        setTerrainKind(terrain, x, y, 'forest');
        const result = spawns.addResourceSpawn({
          kind: 'tree',
          x,
          y,
          owner: null,
          baseOwner: start.owner,
          amount: 100,
        });
        if (result.accepted) {
          placed += 1;
        }
      }
    }
  }

  if (placed < count) {
    throw new Error(
      `createDefaultMap: only placed ${placed}/${count} trees near owner ${start.owner} TC (${start.townCenter.x},${start.townCenter.y}).`,
    );
  }
}
```

Export the helpers being referenced (`isInBounds`, `orientationFor`, `setTerrainKind`, `seedToNumber`, `distanceSquared`, `isAccessibleShorelineCell`, `SHORE_FISH_AMOUNT`, `Offset` type, `TerrainCellSpec`, `ResourceKind` type via re-export) from `prototypeScenario.ts` so the new code can import them.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx.cmd vitest run tests/simulation/mapGeneration/defaultMap.test.ts`

Expected: all 7 tests pass.

- [ ] **Step 6: Typecheck and build**

Run: `npx.cmd tsc --noEmit && npx.cmd vite build`

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/game/simulation/mapGeneration/defaultMap.ts src/game/simulation/prototypeScenario.ts tests/simulation/mapGeneration/defaultMap.test.ts
git commit -m "Add procedural default-map module with per-base resource coverage"
```

---

## Task 5: Switch the default seed to use the procedural map + restore the tree-count expectation

**Files:**
- Modify: `src/game/simulation/prototypeScenario.ts` — replace the inline default-seed branch in `createPrototypeScenario` with a delegation to `createDefaultMap`.
- Modify: `tests/simulation/prototypeScenario.test.ts` — restore the `tree` count to `toBe(24)`.

- [ ] **Step 1: Tighten the tree count expectation**

In `tests/simulation/prototypeScenario.test.ts`, revert the loosened assertion:

```typescript
expect(countBy('tree', owner)).toBe(24);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx.cmd vitest run tests/simulation/prototypeScenario.test.ts`

Expected: the per-owner tree count case fails (currently 20 after Task 2's dedupe drop).

- [ ] **Step 3: Delegate the default-seed branch**

In `src/game/simulation/prototypeScenario.ts`, locate `createPrototypeScenario` at line ~8686 and the fallback that starts at line ~9197 (`const terrain = createBaseTerrain(seed);`). Add a dispatch at the very top of the function:

```typescript
export function createPrototypeScenario(seed = DEFAULT_SEED): PrototypeScenario {
  if (seed === DEFAULT_SEED) {
    // Inline import avoids a circular reference at module load; the
    // procedural generator depends on several helpers exported below.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createDefaultMap } = require('./mapGeneration/defaultMap') as typeof import('./mapGeneration/defaultMap');
    return createDefaultMap(seed);
  }

  if (seed === 'conquest-victory-fixture') {
    return createConquestVictoryFixture(seed);
  }
  // ... rest of the existing function unchanged
```

If the `require` approach doesn't pass lint, switch to a top-of-file `import` and verify there's no true circularity (the `defaultMap.ts` module already imports from `prototypeScenario.ts`, but since the call is inside the dispatched function and not at module load, TypeScript/ES modules should resolve both sides fine).

Prefer the static-import form:

```typescript
import { createDefaultMap } from './mapGeneration/defaultMap';
```

- [ ] **Step 4: Leave the old inline default-seed body in place for now**

Do not delete the inline block yet — the default seed short-circuits before reaching it. Leaving it guards against an accidental unused-helper warning if any still-live fixture reaches into the helpers. Task 5's Step 5 will revisit.

- [ ] **Step 5: Run the default-seed tests**

Run: `npx.cmd vitest run tests/simulation/prototypeScenario.test.ts tests/simulation/mapGeneration/ tests/simulation/scenarioValidation.test.ts`

Expected: all pass. The tree-count case that failed in Step 2 now passes because the procedural generator places exactly 24 trees per base.

- [ ] **Step 6: Run the full vitest suite**

Run: `npx.cmd vitest run`

Expected: all existing simulation tests pass. If any pre-existing test hardcoded a default-seed resource coordinate, it will fail and needs to be re-anchored to "find nearest X" queries. Report failures if any and fix them by:
- Using `scenario.spawns.find((spawn) => spawn.kind === 'tree' && spawn.baseOwner === 1)` instead of literal coordinates.
- Otherwise adjusting the test to the new coordinates (document which in the commit message).

- [ ] **Step 7: Run typecheck, lint, build**

Run: `npx.cmd tsc --noEmit`

Expected: no errors.

Run: `npm.cmd run lint`

Expected: no new errors (pre-existing ones documented in devlog are fine).

Run: `npx.cmd vite build`

Expected: success.

- [ ] **Step 8: Commit**

```bash
git add src/game/simulation/prototypeScenario.ts tests/simulation/prototypeScenario.test.ts
git commit -m "Use procedural default map for aoe2-prototype seed"
```

---

## Task 6: Visual verification, browser tests, devlog, architecture note

**Files:**
- Modify: `docs/architecture/ARCHITECTURE.md` — mention `simulation/mapGeneration/` subdirectory.
- Modify: `docs/architecture/drift-log.md` — append a row.
- Create: `docs/devlog/detailed/2026-04-23_2026-04-23.md` (or append to existing `2026-04-23_...md` detailed file).
- Modify: `docs/devlog/summary.md` — add top-level bullet.

- [ ] **Step 1: Capture before/after screenshots**

Use Playwright to capture a screenshot of the starting Town Center region under the default seed. Note: since the code has already changed, "before" needs to be captured from the last commit before Task 5 or via git stash. Practical flow:

```bash
git stash
npx.cmd playwright test tests/browser/game-selection.spec.ts --grep "renders" --reporter=dot
# Copy the relevant screenshot to docs/devlog/artifacts/2026-04-23-default-map-before.png
git stash pop
npx.cmd playwright test tests/browser/game-selection.spec.ts --grep "renders" --reporter=dot
# Copy to docs/devlog/artifacts/2026-04-23-default-map-after.png
```

If the project already uses a specific screenshot tool, use that instead. Record the changed-pixel count from a pixel-diff tool (the repo uses ad-hoc `sharp`-based diffing in earlier devlog entries; produce an equivalent number).

- [ ] **Step 2: Run the full browser test suite**

Run: `npm.cmd run test:browser`

Expected: pass. If any browser test hardcoded a default-seed resource coordinate (the earlier survey said none did, but re-confirm under the changed layout), re-anchor it.

- [ ] **Step 3: Run the full gates once more**

Run: `npx.cmd tsc --noEmit && npm.cmd run lint && npx.cmd vite build && npx.cmd vitest run && npm.cmd run test:browser`

Record results (file count, pass count) for the devlog.

- [ ] **Step 4: Update `docs/architecture/ARCHITECTURE.md`**

Add a bullet under "Repository layout → `src/game/simulation/`":

```
    - `mapGeneration/` — deterministic procedural map generators and the
      spawn-list helper that enforces one-resource-per-cell.
```

- [ ] **Step 5: Append a row to `docs/architecture/drift-log.md`**

Format matches prior rows. The row states the date, the change (new `simulation/mapGeneration/` subdirectory), and the reason (extract map-generation and dedupe concerns out of `prototypeScenario.ts`).

- [ ] **Step 6: Write the detailed devlog entry**

Append to `docs/devlog/detailed/2026-04-23_2026-04-23.md` (or the current latest detailed file):

```markdown
## 2026-04-23 — Resource cell exclusivity + procedural default map

### Action
Added a spawn-list helper with first-write-wins dedupe, routed all
scenario resource pushes through it, added a resource-on-resource
bridge-boot validation pass, and replaced the hand-crafted default-seed
offset tables with a deterministic procedural generator that guarantees
every player base has at least one cell of every starting resource type
after dedupe. The change was triggered by a tree+stone overlap observed
in `npm run dev` — `STARTING_STONE` offsets exactly overlapped
`FOREST_PATCHES[2]` so every game, stone cells also carried a tree.

### Code reviewer comments
(Populate after running Codex / Gemini / Claude review per AGENTS.md.
Break down by provider and theme.)

### Result
- Spec: `docs/superpowers/specs/2026-04-23-resource-cell-exclusivity-design.md`
- Plan: `docs/superpowers/plans/2026-04-23-resource-cell-exclusivity.md`
- New modules: `src/game/simulation/mapGeneration/spawnList.ts`,
  `src/game/simulation/mapGeneration/defaultMap.ts`.
- New validator: resource-on-resource check in
  `createSimulationBridge.ts`.
- New fixture: `slice12-validation-resource-on-resource-fixture`.
- Test files: `tests/simulation/mapGeneration/spawnList.test.ts`,
  `tests/simulation/mapGeneration/defaultMap.test.ts`, plus an extended
  `tests/simulation/scenarioValidation.test.ts`.
- Pixel diff: (from Step 1, e.g. "N,NNN changed pixels, X.X% of
  800x600").

### Reasoning
Root cause is hand-authored offset tables with no dedupe. The
spawn-list helper forces a single path through which any generator
emits resource spawns. The bridge-boot validator backstops fixtures.
The procedural generator retires the specific offsets that caused the
bug and keeps the contract the tests and AI rely on (per-owner counts,
standard opening composition).

### Notes
- Save schema unchanged (still 1).
- Black Forest and Arena maps continue to use the hand-crafted
  `applyStandardPlayerOpening` helper; they inherit the dedupe-safety
  for free via the spawn list but their procedural identity is
  unchanged.
- Engine-feedback: none — this is fully in the simulation-bridge layer.
```

- [ ] **Step 7: Update `docs/devlog/summary.md`**

Prepend a new bullet under the `## 2026-04-23` section:

```markdown
- **Resource cell exclusivity + procedural default map:** replaced the
  hand-crafted `aoe2-prototype` offset tables with a deterministic
  procedural generator and added a spawn-list helper plus a bridge-boot
  resource-on-resource validation pass. Fixes the tree-on-stone overlap
  visible in `npm run dev` (caused by `STARTING_STONE` ⟂ `FOREST_PATCHES[2]`
  cells colliding). Detailed entry in
  `docs/devlog/detailed/2026-04-23_2026-04-23.md`.
```

- [ ] **Step 8: Run code reviewers per AGENTS.md**

Run each of:

```bash
git diff main | codex exec --model gpt-5.4 --model-reasoning-effort xhigh --sandbox read-only --ask-for-approval never --ephemeral "You are a senior code reviewer. Flag bugs, security issues, and performance concerns. Do NOT modify files or propose patches. Only return findings, explanations, and suggestions in plain text."
git diff main | gemini -p "You are a senior code reviewer. Flag bugs, security issues, and performance concerns. Do NOT modify files or propose patches. Only return findings, explanations, and suggestions in plain text." --model gemini-3-pro --thinking high
git diff main | claude -p --append-system-prompt "You are a senior code reviewer. Flag bugs, security issues, and performance concerns. Do NOT modify files or propose patches. Only return findings, explanations, and suggestions in plain text." --allowedTools "Read,Bash(git diff *),Bash(git log *),Bash(git show *)"
```

Fold findings into the devlog's "Code reviewer comments" section, iterate until each reviewer reports no actionable issues (or nit-only).

- [ ] **Step 9: Commit the docs + final gates**

```bash
git add docs/architecture/ARCHITECTURE.md docs/architecture/drift-log.md docs/devlog/detailed/2026-04-23_2026-04-23.md docs/devlog/summary.md docs/devlog/artifacts/
git commit -m "Doc resource cell exclusivity + procedural default map"
```

Verify working tree clean:

```bash
git status
```

Expected: clean.

---

## Self-review

**Spec coverage:**
- Dedupe helper: Task 1.
- Existing generators route through it: Task 2.
- Bridge-boot validator: Task 3.
- Procedural default map: Tasks 4 and 5.
- New test coverage (spawn-list, default map, resource-on-resource validation fixture): Tasks 1, 3, 4.
- Visual verification: Task 6 Step 1.
- ARCHITECTURE + drift-log + devlog: Task 6 Steps 4-7.
- Code reviewer loop: Task 6 Step 8.

**Placeholders:** none. All code blocks show the actual code, all commands include expected output.

**Type consistency:** `SpawnList` interface names and methods (`addResourceSpawn`, `addBuildingSpawn`, `addUnitSpawn`, `isCellOccupiedByResource`, `toArray`) are used consistently across Tasks 1, 2, 4. `ScenarioSpawnSpec` imports route through the existing `prototypeScenario.ts` symbol. `createDefaultMap` signature stays stable across Tasks 4 and 5. The `AddResourceResult` tagged union matches the shape expected by the Task 2 generator callers.

**Known risks:** Task 5 Step 6 may surface tests that hardcode default-seed resource coordinates. The survey in brainstorming found none in vitest tests (all coord-specific tests use their own fixtures), and browser helpers use dynamic lookups, but verify at execution time.
