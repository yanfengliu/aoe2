# Sheep movement — design

Date: 2026-04-17

## Goal

The player can select a player-owned (claimed) sheep and right-click a destination
to move it. Movement is at half villager speed. Once a sheep is claimed by any
owner, that ownership is sticky for the rest of the sheep's life.

## Non-goals

- Multi-sheep selection / batch herding (single-selection only in v1).
- Re-claiming sheep by enemy proximity once owned.
- Random wandering for unclaimed sheep.
- A new visual rally-line indicator.

## Background

Sheep today are pure resource entities (`position`, `resource`,
`renderable`). They have no `unit` component and no movement code. The only
sheep-specific behavior is `updateSheepOwnership`, which re-evaluates owner
each tick by proximity to player units within radius 6 (`MAX_HERDABLE_CLAIM_RADIUS`).
Selection works for inspection — sheep show up in the HUD — but the existing
`issueMoveCommand` / `issueContextCommand` paths early-return because they only
act on selected *units*.

## Approach

Treat sheep as **movable resources**. Add a thin per-feature movement system
that runs alongside the existing ownership system, reuse the existing unit
pathing/subgrid infrastructure, and route player commands through a new
sheep-aware branch when the selection is a player-owned sheep.

This keeps the resource/unit boundary intact: combat, AI targeting, population,
and economy code never see sheep as units, so there is no ripple risk.

## Components and state

Inside `createSimulationBridge.ts`:

- New constant `SHEEP_SUBGRID_STEP_PER_TICK = 1` (half of the villager
  `UNIT_SUBGRID_STEP_PER_TICK = 2`, which on the 4-wide subgrid means
  0.25 cells/tick vs villager 0.5 cells/tick).
- New per-bridge state `sheepMoveOrders: Map<number, Position>` mapping sheep
  entity id → target cell. Cleared on order completion, on path failure, and
  on sheep destruction.
- Sheep entities gain a `unitTransform` component at creation. The component
  semantics (fine subgrid position + slot) generalize naturally to any
  cell-occupant; nothing in `unitTransform` is unit-specific.

## Helper generalization

`stepUnitTransformToward` (and any path-step helper that depends on the
hardcoded `UNIT_SUBGRID_STEP_PER_TICK`) takes an explicit `stepUnits` parameter.
All existing call sites pass `UNIT_SUBGRID_STEP_PER_TICK` so unit/military
behavior is unchanged. The new sheep movement system passes
`SHEEP_SUBGRID_STEP_PER_TICK`.

## New system: `prototypeHerdableMovement`

- Phase: `update`
- Order: `after: ['prototypeHerdableOwnership']`,
  `before: ['prototypePlayerCommands']`

Per tick, for each `(sheepId, target)` in `sheepMoveOrders`:

1. Fetch `position`, `resource`, `unitTransform`. If any missing, or
   `resource.resourceType !== 'sheep'`, or `resource.amount <= 0`, or
   `resource.owner === null`, drop the order and continue.
2. If the transform is already at the target (use the same arrival predicate
   the unit code uses), drop the order.
3. Compute the next subgrid step using the same path planner the unit movement
   uses, parameterized with `SHEEP_SUBGRID_STEP_PER_TICK`. If the planner
   returns `null` (blocked), drop the order.
4. Apply the step via `moveUnitOneSubgridStep`, which already updates both
   the fine `unitTransform` and the coarse `position` when the cell flips.

## Modified system: `updateSheepOwnership`

Add an early-continue at the top of the per-sheep loop: if `resource.owner`
is already non-null, skip ownership re-evaluation. First claim still works
exactly as today; we just lock it in afterward.

## Selection and command routing

- Selection: no change. Sheep are already returned by
  `getSelectableEntitiesAtCell` and shown in the HUD.
- `issueMoveCommand(x, y)`: when exactly one entity is selected and it is a
  sheep with `resource.owner === HUMAN_PLAYER_ID` and `resource.amount > 0`,
  route to a new `issueSheepMoveCommand(sheepId, target)`. Otherwise fall
  through to the current unit path.
- `issueContextCommand(x, y)`: same routing for owned sheep when the click is
  on a free cell.
- `issueContextCommandAtEntity(entityId)`: when the selected entity is an
  owned sheep, take the target entity's `position` and route to
  `issueSheepMoveCommand`.

`issueSheepMoveCommand(sheepId, target)`:

- Validate ownership and `amount > 0`.
- Clamp target to map bounds.
- `sheepMoveOrders.set(sheepId, target)`.
- Return `true`.

## Edge cases

- **Active gather**: existing villager gather references the sheep by entity
  ref, not by cell, so gathers follow the moving sheep through the existing
  resource-approach loop. No change required; covered by adding a regression
  test.
- **Wolf attack**: wolves attack by entity ref at the sheep's current position.
  No interaction needed.
- **Sheep destroyed mid-order**: drop the entry on the next movement-system
  tick (handled by step 1 above) and also from the existing sheep destruction
  path so the map does not retain stale ids.
- **Pathing failure / unreachable target**: drop the order immediately.
- **Multi-select containing a sheep**: v1 ignores sheep members; only unit
  members receive commands. Acceptable for v1.

## Determinism

The new system is fully tick-driven and uses the existing deterministic path
planner. No new randomness is introduced. `sheepMoveOrders` is an ordinary
`Map` keyed by entity id; iteration order is insertion order, which is
deterministic given a fixed command sequence.

## Tests

New file `tests/simulation/sheepMovement.test.ts`:

1. **Stickiness**: a sheep claimed by a player unit retains `resource.owner`
   after the unit walks far away.
2. **Owned sheep moves on command**: select a player-owned sheep, issue
   `issueMoveCommand`, advance the world N ticks, assert the sheep's grid
   position is closer to the target.
3. **Order clears at arrival**: after enough ticks, sheep position equals
   target and the move-order map no longer contains the entry.
4. **Unclaimed sheep rejects command**: `issueMoveCommand` returns `false`
   and the position does not change.
5. **Enemy-owned sheep rejects command**: same as above.
6. **Half-speed**: equal-tick comparison shows the sheep covers exactly half
   the subgrid distance a villager covers from the same start.
7. **Path around blocker**: place a tree between sheep and target; sheep
   eventually arrives via a routed path.
8. **Gather follows moving sheep**: villager gathering an owned sheep keeps
   gathering after the sheep is moved one tile away.

Browser test addition in `tests/browser/`: select a player-owned sheep,
right-click a distant cell, advance, assert the rendered sheep position has
moved toward the target.

Per `AGENTS.md`, the gate is `npx vitest run`, `npx tsc --noEmit`,
`npx vite build`, and the Playwright suite green.

## Files affected

- `src/game/simulation/createSimulationBridge.ts` — primary
- `tests/simulation/sheepMovement.test.ts` — new
- `tests/browser/game.spec.ts` — possibly add browser case
- `docs/devlog/detailed/2026-04-17_2026-04-17.md` — append after implementation
- `docs/devlog/summary.md` — concise current entry after implementation

No architecture-doc update: this is a feature inside an existing module, not
a new boundary.
