# Selection Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the current activity ("Gathering wood", "Training Villager", "Idle", etc.) for owned units and buildings in the HUD selection info panel, with a coarse-verb roll-up for multi-selection.

**Architecture:** Extend `SelectionState` with two optional fields (`activity`, `activityBreakdown`) computed inside `createSimulationBridge.getSelectionState()`. Rendering is a thin slot added to `selectionPanel.ts`. No new modules. No boundary changes.

**Tech Stack:** TypeScript + Vitest for simulation tests + Playwright for browser tests. Repo uses `npm.cmd` on Windows bash.

**Spec:** `docs/superpowers/specs/2026-04-23-selection-activity-design.md`

---

## File Structure

- Modify `src/game/simulation/types.ts` — add two fields to `SelectionState`.
- Modify `src/game/simulation/createSimulationBridge.ts` — add helper fns `getUnitActivity(id)`, `getBuildingActivity(id)`, `getSelectionActivity(ids)`, `getSelectionActivityBreakdown(ids)`; update `getSelectionState()` fill.
- Modify `src/ui/hud/selectionPanel.ts` — render activity line under the name.
- Create `tests/simulation/selectionActivity.test.ts` — unit + building + multi-selection coverage.
- Modify `tests/browser/game-selection.spec.ts` — one E2E per shape (single + multi).
- Modify `docs/devlog/detailed/2026-04-07_2026-04-13.md` (or latest active detailed devlog) — append entry per AGENTS.md.
- Modify `docs/devlog/summary.md` — add a line for the feature.
- Possibly `src/styles.css` — only if new class needs styling. Prefer reusing existing classes.

---

## Task 1: Add activity fields to SelectionState type

**Files:**
- Modify: `src/game/simulation/types.ts` (near the `SelectionState` interface at ~line 348)
- Modify: `src/game/simulation/createSimulationBridge.ts` (empty-default block in `getSelectionState` at ~line 7992 and real-return block at ~line 8108)

- [ ] **Step 1: Add fields to the interface**

In `src/game/simulation/types.ts`, inside `SelectionState` (between `inventory: string | null;` and `x: number | null;`):

```ts
  activity: string | null;
  activityBreakdown: { label: string; count: number }[] | null;
```

- [ ] **Step 2: Fill the empty-default return**

In `createSimulationBridge.ts`, in the `getSelectionState()` early-return object (the one that returns when `selectedEntityId === null`), add:

```ts
        activity: null,
        activityBreakdown: null,
```

- [ ] **Step 3: Fill the populated return with temporary nulls**

In the main `return { ... }` block at the bottom of `getSelectionState()`, add (before `queue:`):

```ts
      activity: null,
      activityBreakdown: null,
```

These are placeholders — Task 2 replaces them with real computations.

- [ ] **Step 4: Typecheck**

Run: `npm.cmd run typecheck`
Expected: PASS (no type errors).

- [ ] **Step 5: Commit**

```bash
git add src/game/simulation/types.ts src/game/simulation/createSimulationBridge.ts
git commit -m "Add activity fields to SelectionState"
```

---

## Task 2: Unit activity for single owned unit

**Files:**
- Create: `tests/simulation/selectionActivity.test.ts`
- Modify: `src/game/simulation/createSimulationBridge.ts` (add helpers near other `getSelection*` helpers at ~line 1650; call site in `getSelectionState` at ~line 8108)

- [ ] **Step 1: Write failing tests for all unit single-selection branches**

Create `tests/simulation/selectionActivity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

const HUMAN_PLAYER_ID = 1;

describe('selection activity — owned unit', () => {
  it('idle villager reports Idle', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'villager')).toBe(true);
    expect(bridge.getSelectionState().activity).toBe('Idle');
  });

  it('villager ordered onto a tree reports Gathering wood', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'villager')).toBe(true);
    const tree = bridge.getEconomyState().resources.find((r) => r.resourceType === 'tree');
    expect(tree).toBeDefined();
    expect(bridge.issueContextCommandAtCell(tree!.x, tree!.y)).toBe(true);
    // Advance one tick so the command is registered.
    stepBridgeUntil(bridge, () => bridge.getSelectionState().activity !== 'Idle', 5);
    expect(bridge.getSelectionState().activity).toBe('Gathering wood');
  });
});
```

(Extensive taxonomy cases — attacking, building, healing, converting, retrieving/depositing, garrisoned, packing, returning, moving — are appended in Task 3. This step covers the idle + gathering pair so the first vertical slice exists.)

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx.cmd vitest run tests/simulation/selectionActivity.test.ts`
Expected: 2 failing tests with `activity` being `null` instead of the expected strings.

- [ ] **Step 3: Implement `getUnitActivity`**

In `createSimulationBridge.ts`, add a helper near other `getSelection*` helpers (around line 1704, after `getSelectionInventory`):

```ts
  function resolveTargetEntityName(ref: EntityRef | undefined): string | null {
    if (!ref) return null;
    const id = resolveEntityRef(ref);
    if (id === null) return null;
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (unit) return formatEntityName(unit.unitType);
    const building = world.getComponent<BuildingComponent>(id, 'building');
    if (building) return formatEntityName(building.buildingType);
    const resource = world.getComponent<ResourceComponent>(id, 'resource');
    if (resource) return formatEntityName(resource.resourceType);
    return null;
  }

  function getUnitActivity(id: number, unit: UnitComponent): string {
    // 1. Garrisoned
    for (const [buildingId, occupants] of garrisonedByBuilding) {
      if (occupants.includes(id)) {
        const b = world.getComponent<BuildingComponent>(buildingId, 'building');
        return b ? `Garrisoned in ${formatEntityName(b.buildingType)}` : 'Garrisoned';
      }
    }

    // 2. Monk task
    const monkTask = monkTasks.get(id);
    if (monkTask) {
      const targetName = resolveTargetEntityName(monkTask.targetEntityRef);
      switch (monkTask.kind) {
        case 'heal': return targetName ? `Healing ${targetName}` : 'Healing';
        case 'convert': return targetName ? `Converting ${targetName}` : 'Converting';
        case 'pickup': return 'Retrieving relic';
        case 'deposit': return 'Depositing relic';
      }
    }

    // 3. Trebuchet transition
    const treb = trebuchetPackStates.get(id);
    if (treb && treb.transitionTicksRemaining > 0) {
      // packed flag flips at end of transition; during transition, packed still
      // reflects the PRE-flip state. Packed → Unpacking; Unpacked → Packing.
      return treb.packed ? 'Unpacking' : 'Packing';
    }

    // 4. Unit command
    const cmd = unitCommands.get(id);
    if (cmd) {
      if (cmd.type === 'attack') {
        const targetName = resolveTargetEntityName(cmd.targetEntityRef);
        return targetName ? `Attacking ${targetName}` : 'Attacking';
      }
      if (cmd.type === 'build') {
        const targetName = resolveTargetEntityName(cmd.buildingRef);
        return targetName ? `Building ${targetName}` : 'Building';
      }
      if (cmd.type === 'move') {
        if (unit.unitType === 'villager' && cmd.targetEntityKind === 'resource') {
          const targetId = cmd.targetEntityRef ? resolveEntityRef(cmd.targetEntityRef) : null;
          if (targetId !== null) {
            const r = world.getComponent<ResourceComponent>(targetId, 'resource');
            if (r) {
              const econ = resourceKindToEconomyResource(r.resourceType);
              if (econ) return `Gathering ${economyResourceLabel(econ)}`;
            }
          }
          return 'Gathering';
        }
        if (unit.unitType === 'villager') {
          const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
          if (gatherer && gatherer.carriedResource && gatherer.carriedAmount > 0) {
            return `Returning ${economyResourceLabel(gatherer.carriedResource)}`;
          }
        }
        return 'Moving';
      }
    }

    // 5. Fall-through
    return 'Idle';
  }
```

`resolveEntityRef` already exists in the bridge; `formatEntityName` needs to be imported from `'../../ui/hud/displayNames'` — WAIT. That would cross the boundary upward (sim importing UI). Instead, define a local `formatEntityNameForActivity(type)` inside the bridge that returns titlecase labels for the subset used here. The bridge already has per-type display logic elsewhere — centralise it if one already exists.

Check if the bridge already exposes such a helper (search for `function formatEntityName` or the Spanish label strings like `'Town Center'` inside the bridge). If not, define:

```ts
  function formatEntityNameForActivity(type: string): string {
    // Turn 'town-center' → 'Town Center', 'lumber-camp' → 'Lumber Camp', etc.
    return type
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
```

Replace every `formatEntityName(...)` reference in `getUnitActivity` with `formatEntityNameForActivity(...)`.

- [ ] **Step 4: Wire it into `getSelectionState`**

Replace the `activity: null,` line in the populated return block with:

```ts
      activity:
        selectedEntityIds.length === 1 && unit && unit.owner === HUMAN_PLAYER_ID
          ? getUnitActivity(selectedEntityId, unit)
          : null,
```

- [ ] **Step 5: Run tests — expect PASS for Task 2 subset**

Run: `npx.cmd vitest run tests/simulation/selectionActivity.test.ts`
Expected: both tests pass.

- [ ] **Step 6: Typecheck**

Run: `npm.cmd run typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add tests/simulation/selectionActivity.test.ts src/game/simulation/createSimulationBridge.ts
git commit -m "Show current activity for single owned unit"
```

---

## Task 3: Fill out the rest of the unit taxonomy

**Files:**
- Modify: `tests/simulation/selectionActivity.test.ts`

- [ ] **Step 1: Append remaining unit-activity tests**

Append cases covering every branch of `getUnitActivity`. For each case, set up the minimum simulation state, advance a tick if needed, then assert `bridge.getSelectionState().activity` equals the expected string.

Cases (all under `describe('selection activity — owned unit', ...)`):

- `villager placing foundation reports Building House` (start placement, confirm, check activity mid-construction).
- `villager returning with wood reports Returning wood` (chop for N ticks until `gatherer.carriedResource === 'wood'` and command becomes a move toward drop-off, then assert).
- `knight with attack command reports Attacking <target>` (spawn enemy unit nearby, issue attack-move, assert).
- `monk healing reports Healing <target>` (use `monastery-fixture` or spawn monk + wounded unit, issue heal, assert).
- `monk converting reports Converting <target>` (opposite owner target, issue convert, assert).
- `monk retrieving relic reports Retrieving relic`.
- `monk depositing relic reports Depositing relic`.
- `unit garrisoned in castle reports Garrisoned in Castle`.
- `trebuchet unpacking reports Unpacking` (set pack state to packed, trigger unpack, advance partial ticks).
- `trebuchet packing reports Packing`.
- `idle knight with no command reports Idle`.

Use the same imports and patterns as the first file block. Use the existing `stepBridgeUntil` helper. If a scenario requires a fixture (e.g. monastery), use `createSimulationBridge(seed)` with the right fixture seed from `prototypeScenario.ts`; search for `fixture` in that file for naming conventions.

- [ ] **Step 2: Run tests**

Run: `npx.cmd vitest run tests/simulation/selectionActivity.test.ts`
Expected: all pass. If any fail, it points to a missing branch in `getUnitActivity` — patch the helper and re-run.

- [ ] **Step 3: Commit**

```bash
git add tests/simulation/selectionActivity.test.ts src/game/simulation/createSimulationBridge.ts
git commit -m "Cover remaining unit activity branches"
```

---

## Task 4: Building activity

**Files:**
- Modify: `tests/simulation/selectionActivity.test.ts`
- Modify: `src/game/simulation/createSimulationBridge.ts`

- [ ] **Step 1: Write failing tests for building branches**

Append to the test file:

```ts
describe('selection activity — owned building', () => {
  it('idle Barracks reports Idle', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    // Build + complete a Barracks, select it.
    // ... (use placeBuildingNearTownCenter + stepBridgeUntil for construction completion)
    expect(bridge.getSelectionState().activity).toBe('Idle');
  });

  it('Town Center training Villager reports Training Villager', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    expect(selectOwnedBuildingDirect(bridge, HUMAN_PLAYER_ID, 'town-center')).toBe(true);
    expect(bridge.queueTrainUnit('villager')).toBe(true);
    expect(bridge.getSelectionState().activity).toBe('Training Villager');
  });

  it('building mid-construction reports Under construction', () => {
    // Place a house, select it, assert activity before construction completes.
    // ... use placeBuildingNearTownCenter + select at first tick
  });

  it('University researching a tech reports Researching <tech>', () => {
    // Use fixture or manual setup that has a University available and a tech queued.
  });
});
```

Flesh out the ellipses using patterns from `createSimulationBridge.core.test.ts` and `createSimulationBridge.production.test.ts`.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx.cmd vitest run tests/simulation/selectionActivity.test.ts`
Expected: building cases fail with `activity === null`.

- [ ] **Step 3: Implement `getBuildingActivity`**

In `createSimulationBridge.ts`, next to `getUnitActivity`:

```ts
  function getBuildingActivity(id: number): string {
    // 1. Under construction
    const construction = constructionStates.get(id);
    if (construction && !construction.isComplete) {
      return 'Under construction';
    }

    // 2. First queue entry
    const queue = productionQueues.get(id);
    const head = queue && queue.length > 0 ? queue[0] : null;
    if (head) {
      if (head.kind === 'train') {
        return `Training ${formatEntityNameForActivity(head.unitType)}`;
      }
      if (head.kind === 'research') {
        return `Researching ${formatEntityNameForActivity(head.technologyType)}`;
      }
    }

    return 'Idle';
  }
```

- [ ] **Step 4: Wire into getSelectionState**

Update the `activity:` line to include buildings:

```ts
      activity:
        selectedEntityIds.length === 1 && unit && unit.owner === HUMAN_PLAYER_ID
          ? getUnitActivity(selectedEntityId, unit)
          : selectedEntityIds.length === 1 && building && building.owner === HUMAN_PLAYER_ID
          ? getBuildingActivity(selectedEntityId)
          : null,
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `npx.cmd vitest run tests/simulation/selectionActivity.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add tests/simulation/selectionActivity.test.ts src/game/simulation/createSimulationBridge.ts
git commit -m "Show current activity for owned buildings"
```

---

## Task 5: Enemy / resource / unowned return null

**Files:**
- Modify: `tests/simulation/selectionActivity.test.ts`

- [ ] **Step 1: Add negative-case tests**

```ts
describe('selection activity — hidden cases', () => {
  it('resource (tree) selection returns null activity', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    const tree = bridge.getEconomyState().resources.find((r) => r.resourceType === 'tree');
    expect(tree).toBeDefined();
    expect(bridge.selectEntityAtCell(tree!.x, tree!.y)).toBe(true);
    expect(bridge.getSelectionState().activity).toBeNull();
    expect(bridge.getSelectionState().activityBreakdown).toBeNull();
  });

  it('enemy unit selection returns null activity', () => {
    // Advance until enemy unit is visible; select it; assert null.
  });

  it('enemy building selection returns null activity', () => {
    // Advance until enemy building is visible; select it; assert null.
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx.cmd vitest run tests/simulation/selectionActivity.test.ts`
Expected: pass (the existing wiring already gates on `owner === HUMAN_PLAYER_ID`).

- [ ] **Step 3: Commit**

```bash
git add tests/simulation/selectionActivity.test.ts
git commit -m "Lock null activity for resources and enemies"
```

---

## Task 6: Multi-selection breakdown

**Files:**
- Modify: `tests/simulation/selectionActivity.test.ts`
- Modify: `src/game/simulation/createSimulationBridge.ts`

- [ ] **Step 1: Write failing test for breakdown**

```ts
describe('selection activity — multi-selection', () => {
  it('3 gathering + 2 idle villagers produce a breakdown', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    // Box-select all owned villagers.
    // Command 3 of them onto trees; leave 2 idle.
    // Advance until those 3 have 'Gathering' activity.
    // Box-select all 5 again; assert breakdown.
    const breakdown = bridge.getSelectionState().activityBreakdown;
    expect(breakdown).toEqual([
      { label: 'gathering', count: 3 },
      { label: 'idle', count: 2 },
    ]);
    expect(bridge.getSelectionState().activity).toBeNull();
  });

  it('overflow beyond 5 verbs shows ellipsis token', () => {
    // Construct an arrangement with 6 distinct coarse verbs; verify breakdown
    // length is 5 and includes `{ label: '…', count: remaining }` or similar;
    // spec says cap at 5 and append `· …`. Decide: model the overflow as
    // `{ label: '…', count: 0 }` and let the renderer format it, OR keep 5
    // entries and expose a separate `overflow: number` field. For simplicity
    // here, add `overflow: number` on `activityBreakdown` — update the type
    // accordingly in Step 3.
  });
});
```

Re-read the spec (`docs/superpowers/specs/2026-04-23-selection-activity-design.md` → Multi-selection) — the spec says "Cap at 5 tokens; if more, append · …". Decide on representation: **amend the type to** `activityBreakdown: { entries: { label: string; count: number }[]; overflow: number } | null` to keep the renderer simple. Update the types.ts change from Task 1 accordingly BEFORE writing the test.

- [ ] **Step 2: Update SelectionState shape if you chose the `{ entries, overflow }` form**

Revise `src/game/simulation/types.ts`:

```ts
  activityBreakdown: {
    entries: { label: string; count: number }[];
    overflow: number;
  } | null;
```

Update any existing `activityBreakdown: null` placeholders — they are still null, no change.

- [ ] **Step 3: Implement `getSelectionActivityBreakdown`**

```ts
  const COARSE_VERB_PRIORITY: Record<string, number> = {
    // purely used for alphabetical tiebreak; just use `localeCompare` in code.
  };

  function coarseVerbForUnit(id: number, unit: UnitComponent): string {
    const activity = getUnitActivity(id, unit);
    // Map full labels to coarse verbs per spec.
    if (activity.startsWith('Garrisoned')) return 'garrisoned';
    if (activity.startsWith('Healing')) return 'healing';
    if (activity.startsWith('Converting')) return 'converting';
    if (activity === 'Retrieving relic') return 'retrieving';
    if (activity === 'Depositing relic') return 'depositing';
    if (activity === 'Packing') return 'packing';
    if (activity === 'Unpacking') return 'unpacking';
    if (activity.startsWith('Attacking')) return 'attacking';
    if (activity.startsWith('Building')) return 'building';
    if (activity.startsWith('Gathering')) return 'gathering';
    if (activity.startsWith('Returning')) return 'returning';
    if (activity === 'Moving') return 'moving';
    return 'idle';
  }

  function coarseVerbForBuilding(id: number): string {
    const activity = getBuildingActivity(id);
    if (activity === 'Under construction') return 'under construction';
    if (activity.startsWith('Training')) return 'training';
    if (activity.startsWith('Researching')) return 'researching';
    return 'idle';
  }

  function getSelectionActivityBreakdown(
    ids: number[],
  ): { entries: { label: string; count: number }[]; overflow: number } | null {
    const counts = new Map<string, number>();
    for (const id of ids) {
      const u = world.getComponent<UnitComponent>(id, 'unit');
      if (u && u.owner === HUMAN_PLAYER_ID) {
        const v = coarseVerbForUnit(id, u);
        counts.set(v, (counts.get(v) ?? 0) + 1);
        continue;
      }
      const b = world.getComponent<BuildingComponent>(id, 'building');
      if (b && b.owner === HUMAN_PLAYER_ID) {
        const v = coarseVerbForBuilding(id);
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }
    if (counts.size === 0) return null;
    const sorted = [...counts.entries()]
      .sort(([aLabel, aCount], [bLabel, bCount]) => bCount - aCount || aLabel.localeCompare(bLabel))
      .map(([label, count]) => ({ label, count }));
    const cap = 5;
    return sorted.length <= cap
      ? { entries: sorted, overflow: 0 }
      : { entries: sorted.slice(0, cap), overflow: sorted.length - cap };
  }
```

- [ ] **Step 4: Wire into getSelectionState**

Update the `activityBreakdown:` line:

```ts
      activityBreakdown:
        selectedEntityIds.length > 1 ? getSelectionActivityBreakdown(selectedEntityIds) : null,
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `npx.cmd vitest run tests/simulation/selectionActivity.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add tests/simulation/selectionActivity.test.ts src/game/simulation/createSimulationBridge.ts src/game/simulation/types.ts
git commit -m "Roll up activity verbs for multi-selection"
```

---

## Task 7: Render activity in the selection panel

**Files:**
- Modify: `src/ui/hud/selectionPanel.ts`
- Optionally: `src/styles.css`

- [ ] **Step 1: Add renderer**

In `src/ui/hud/selectionPanel.ts`, near `renderSelectionDetails`:

```ts
function renderSelectionActivity(selectionState: SelectionState): string {
  if (selectionState.activity) {
    return `<div class="hud-selection-activity" data-selection-activity>${selectionState.activity}</div>`;
  }
  const breakdown = selectionState.activityBreakdown;
  if (breakdown && breakdown.entries.length > 0) {
    const tokens = breakdown.entries.map((e) => `${e.count} ${e.label}`);
    if (breakdown.overflow > 0) tokens.push('…');
    return `<div class="hud-selection-activity" data-selection-activity-multi>${tokens.join(' · ')}</div>`;
  }
  return '';
}
```

Escape the label/count tokens with simple text-only concat — `label` comes from a fixed enum of verb strings, `count` is a number, neither is attacker-controlled. The activity string is derived from our own type names; no escaping needed beyond what the template already does for those fields elsewhere.

- [ ] **Step 2: Insert into the innerHTML template**

Between the name line and `${selectionIcons}`:

```ts
    el.innerHTML = `
      <div class="hud-label">Selection</div>
      <div class="hud-selection-name" data-selection-name>${formatSelectionName(selectionState)}</div>
      ${renderSelectionActivity(selectionState)}
      ${selectionIcons}
      ...
    `;
```

- [ ] **Step 3: Add minimal CSS if needed**

Check the rendered output in dev (or reason about existing class weights) — if the activity line needs its own styling, add to `src/styles.css`:

```css
.hud-selection-activity {
  font-size: 0.85em;
  opacity: 0.85;
  margin-top: 2px;
}
```

If existing class cascades already give the right visual, skip this step.

- [ ] **Step 4: Build and typecheck**

Run: `npm.cmd run typecheck && npm.cmd run build`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hud/selectionPanel.ts src/styles.css
git commit -m "Render activity line in selection panel"
```

---

## Task 8: Browser coverage

**Files:**
- Modify: `tests/browser/game-selection.spec.ts` (or a new `game-selection-activity.spec.ts` if the existing file is already large)

- [ ] **Step 1: Inspect existing selection spec for patterns**

Read `tests/browser/game-selection.spec.ts` top of file to learn bootstrap / fixture / helper patterns.

- [ ] **Step 2: Add the single-unit activity test**

Append:

```ts
test('activity line shows Gathering wood after chop order', async ({ page }) => {
  // Load default seed.
  // Select a villager.
  // Right-click a tree tile.
  // Wait for [data-selection-activity] to contain 'Gathering'.
  await expect(page.locator('[data-selection-activity]')).toContainText('Gathering wood');
});
```

Fill in setup using existing helpers from the spec file.

- [ ] **Step 3: Add the multi-selection activity test**

```ts
test('activity breakdown shows N idle after box-selecting idle villagers', async ({ page }) => {
  // Box-select 3 starting villagers.
  await expect(page.locator('[data-selection-activity-multi]')).toContainText('3 idle');
});
```

- [ ] **Step 4: Run browser tests**

Run: `npm.cmd run test:browser -- tests/browser/game-selection.spec.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add tests/browser/game-selection.spec.ts
git commit -m "Browser coverage for selection activity line"
```

---

## Task 9: Final validation + devlog

**Files:**
- Modify: latest active file under `docs/devlog/detailed/` (check which is current — the file whose `END_DATE` is latest).
- Modify: `docs/devlog/summary.md`.

- [ ] **Step 1: Run the full validation gate**

```bash
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:browser
npm.cmd test
```

Expected: typecheck / lint / build / browser tests clean. `npm.cmd test` is known to exit non-zero on this Windows setup due to pre-existing `[vitest-worker]: Timeout` errors — accept that and record the file/test counts from the run (e.g. `35/35 files, 327/327 tests`).

- [ ] **Step 2: Append a detailed devlog entry**

Per AGENTS.md, append to the current detailed devlog an entry with: timestamp, action, reviewer comments (from team code-reviewer/architect/game-designer/game-researcher rounds — fill in during task execution), result (validation numbers), reasoning, notes. Follow the tone of existing entries in the same file.

- [ ] **Step 3: Update `docs/devlog/summary.md`**

Add a bullet at the top under the current date header. Trim the summary if it exceeds 50 lines.

- [ ] **Step 4: Commit**

```bash
git add docs/devlog/detailed/<active-file>.md docs/devlog/summary.md
git commit -m "Record selection activity devlog"
```

---

## Self-review checklist

- **Spec coverage:** every numbered branch in `spec/Activity taxonomy` has a test in Task 2-4. Multi-selection breakdown → Task 6. Null cases → Task 5. Render → Task 7. Browser → Task 8.
- **Placeholder scan:** all steps show exact code or exact commands. Cases that need per-test setup (e.g. monk-monastery fixture) tell the implementer where to look for patterns. No "TBD".
- **Type consistency:** `activity`, `activityBreakdown`, `entries`, `overflow`, `coarseVerbForUnit`, `coarseVerbForBuilding`, `getSelectionActivityBreakdown` used consistently across Tasks 1 / 4 / 6 / 7.
- **Overflow representation:** resolved at Task 6 Step 2 — `activityBreakdown` becomes `{ entries, overflow }` instead of a flat array. Types updated there.
- **Docs:** ARCHITECTURE unchanged (Task 9 reflects that). Devlog + summary updated.
