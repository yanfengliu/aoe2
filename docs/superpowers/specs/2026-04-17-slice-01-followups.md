# Slice 1 — Small known-bug follow-ups (spec + plan)

Date: 2026-04-17.
Roadmap: `docs/superpowers/plans/2026-04-17-post-sheep-roadmap.md`.

## Goal

Four small bug-fix / polish items that were flagged during the sheep movement
slice but deliberately deferred. Each is independent of the others. Ship them
as four sequential commits with TDD discipline and a single end-of-slice
codex + gemini review pass.

## Item 1 — Cancel sheep movement when a villager begins gathering it

**Problem (codex Medium, round 2):** Issuing a sheep move order while a villager
is mid-harvest causes the gather state to thrash: the economy loop drops the
villager out of `gathering` whenever the sheep's approach cell flips, the
villager re-paths, the sheep keeps walking.

**Resolution chosen:** the simpler of the two viable fixes — when a villager
begins gathering a sheep (i.e., enters the gather state on a sheep target),
clear any outstanding `sheepMoveOrders` entry for that sheep. A claimed sheep
that someone is actively harvesting cannot be moved by the player; the player
can re-issue the move order after the villager finishes or moves off.

**Where to change in `src/game/simulation/createSimulationBridge.ts`:**

- The villager economy / gather loop is the right hook: when a villager
  transitions into the per-tick "gathering on this sheep" state, call
  `sheepMoveOrders.delete(sheepId)`.
- Look for the existing `gathering` task transition near
  `prototypeVillagerEconomy` and `findResourceApproachPlan`; the cleanest
  place is wherever the per-tick code decides "I am at the resource and I
  start the gather tick".

**Tests (`tests/simulation/sheepMovement.test.ts` extension):**

- Issue a move order on an owned sheep, queue a villager gather order on the
  same sheep, advance ticks until the villager arrives and starts gathering,
  assert `sheepMoveOrders` for that sheep is cleared and the sheep position
  stays stable.

## Item 2 — Same-type double-click selection for owned sheep

**Problem:** Today, double-clicking a unit selects every visible same-type
unit on screen (`selectOwnedUnitsByTypeInRect`). Double-clicking an owned
sheep does nothing because the `GameScene` `updateRecentFriendlyUnitClick`
only records candidates whose `selectedKind === 'unit'` and `isUnitType` is
true. Sheep never qualify.

**Resolution:**

- Generalize `selectOwnedUnitsByTypeInRect(unitType, ...)` to also accept
  `'sheep'` as a value alongside `UnitType`. When called with `'sheep'`, it
  selects every player-owned sheep with `amount > 0` whose position lies in
  the rect (reuse `getHumanOwnedSheepIdsInRect`).
- In `src/phaser/scenes/GameScene.ts`, extend `updateRecentFriendlyUnitClick`
  so that when the sole selection is a player-owned `'sheep'` resource, it
  records a double-click candidate with `unitType: 'sheep'`. Then
  `trySelectSameTypeOnDoubleClick` passes `'sheep'` to the bridge call.

**Tests:**

- Vitest: drive the bridge with a fixture containing several owned sheep, call
  `selectOwnedUnitsByTypeInRect('sheep', minX, minY, maxX, maxY)`, assert
  every owned sheep in the rect ends up in the selection.
- Browser: select an owned sheep, double-click on its rendered position,
  assert the selection count grows to include all visible owned sheep.

## Item 3 — Fog memory for static enemy buildings and resources

**Problem:** Once a cell exits the player's vision, any enemy building or
neutral resource on that cell disappears from the projected render frame.
That breaks the standard RTS expectation that you remember where enemy bases
and resource patches were.

**Resolution scope (v1):**

- Add a per-player memory store on the simulation bridge:
  `lastSeenStatic: Map<playerId, Map<entityId, MemoryEntry>>` where
  `MemoryEntry` captures `kind` (`'building' | 'resource'`), `entityType`,
  `position`, `footprintWidth/Height`, `tint`, `owner`, `size`, and
  `lastSeenTick`.
- Update memory each tick in a new `prototypeFogMemory` system that runs
  after `prototypeVisibility`: for every static entity (building / resource)
  whose cell is currently visible to the player, write its current state into
  the memory map. (Units and other moving entities are excluded for v1.)
- When projecting render entities for a player, for any cell that is
  *explored but not visible*, also project the memory entries for that cell
  (deduped against currently-visible entities) with a new
  `ProjectedEntityView` field `isMemory: true`.
- In `src/phaser/scenes/GameScene.ts` rendering, draw memory entities with
  reduced opacity (e.g., 0.5) and skip selection / health-bar overlays for
  them.
- HUD selection: clicking a memory cell does nothing (the entity is not
  selectable); regular selection helpers ignore memory entries.

**Tests:**

- Vitest: spawn a player + an enemy building inside the player's vision,
  walk the player away so the building exits vision, advance, assert the
  bridge's render frame still contains the building entity with
  `isMemory: true`. Then re-enter vision, assert `isMemory: false` again.
- Browser: same flow, assert the rendered building stays visible at reduced
  opacity after the player walks away.

## Item 4 — Reorder `prototypeHerdableMovement` before `prototypePlayerCommands`

**Problem (codex Medium, round 1):** The system currently runs after
`prototypeHerdableOwnership` only because that was the original constraint —
which created a dependency cycle when we tried to add
`before: ['prototypePlayerCommands']`. The cost is a one-tick lag where
gather and wildlife combat see the sheep's old position, but it's
suboptimal.

**Resolution:**

- Drop `after: ['prototypeHerdableOwnership']` from `prototypeHerdableMovement`
  (now safe because ownership is sticky — once claimed, sheep keep their
  owner regardless of when the movement system runs relative to ownership).
- Add `before: ['prototypePlayerCommands']` and verify the cycle is gone
  (the cycle was via the `prototypePlayerCommands → … → prototypeHerdableOwnership
  → prototypeHerdableMovement` chain; severing the bottom link fixes it).
- Run the full vitest suite to confirm; the existing sheep tests must still
  pass and unit tests must still pass.

**Tests:**

- Existing 10 sheep-movement vitest cases must stay green.
- Existing combat/economy/age-up suites must stay green.
- (No new test — this is an ordering change with no observable behavior delta
  beyond removing the one-tick lag.)

## Plan (TDD bite-sized tasks)

### Task A: Item 4 (low risk, builds momentum)

1. Edit `prototypeHerdableMovement` registration: drop
   `after: ['prototypeHerdableOwnership']`, add `before: ['prototypePlayerCommands']`.
2. Run the full vitest suite — expect green.
3. Commit: `Reorder sheep movement before player commands`.

### Task B: Item 1 (gather cancels sheep movement)

1. Locate the villager economy gather-state transition in
   `createSimulationBridge.ts` (look near `prototypeVillagerEconomy`).
2. Write a failing vitest case that exercises the thrash scenario.
3. Add `sheepMoveOrders.delete(sheepId)` at the moment a villager enters
   the per-tick gather of a sheep target.
4. Run the new test — expect green.
5. Run the full sheep test file — expect 11 green.
6. Commit: `Cancel sheep move orders when a villager starts harvesting`.

### Task C: Item 2 (same-type double-click for sheep)

1. Extend `selectOwnedUnitsByTypeInRect` signature to also accept `'sheep'`,
   wiring through `browserTestApi.ts` and `GameScene.ts` types.
2. When `unitType === 'sheep'`, return ids from `getHumanOwnedSheepIdsInRect`
   instead of `getHumanUnitIdsInRect`.
3. Vitest: assert the bridge call selects all owned sheep in a rect.
4. Edit `GameScene.updateRecentFriendlyUnitClick` to also record
   double-click candidates when the selection is a player-owned sheep
   resource.
5. Browser test: select sheep, double-click the rendered position, assert
   the selection grows to include all visible owned sheep.
6. Run full vitest + browser — expect green.
7. Commit: `Add same-type double-click selection for owned sheep`.

### Task D: Item 3 (fog memory)

1. Define `MemoryEntry` and the per-player memory map; add a
   `prototypeFogMemory` system (after `prototypeVisibility`) that writes
   visible static entities into the memory map.
2. Extend the projector: for cells currently `explored && !visible`,
   project memory entries with `isMemory: true`. Add the field to
   `ProjectedEntityView`.
3. Vitest: walk-away-and-look-back fixture asserts `isMemory: true` after
   exit and reverts to `isMemory: false` on re-enter.
4. Phaser scene: render `isMemory: true` entities at 0.5 opacity, skip
   selection and health bar overlays.
5. Browser test: scout reveals an enemy building, walks away, assert the
   rendered entity persists with reduced opacity.
6. Run full vitest + browser — expect green.
7. Commit: `Add fog memory for static enemy buildings and resources`.

### Task E: Slice gate

1. Run the full sequential gate (`npx vitest run`, `npx tsc --noEmit`,
   `npx vite build`, `npm run test:browser`).
2. Run `codex review --commit <range>` and `gemini -p "review …"` on the
   slice's commit range. Triage findings: ship real ones as a fix commit,
   document non-issues in the devlog entry.
3. Append a detailed devlog entry under
   `docs/devlog/detailed/2026-04-17_2026-04-17.md` and update the summary.

## Out of scope for this slice

- Memory for moving units (only static buildings + resources).
- Animated fade-in/fade-out of memory entities; instant opacity switch.
- Fog memory persisting across saves (will be revisited in Slice 9).
- Same-type double-click for boars / wolves / fish (sheep only — those are
  not commandable).
