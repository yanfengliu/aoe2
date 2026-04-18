# Slice 5 — Monastery, Monks, and relics

Date: 2026-04-17.
Roadmap: `docs/superpowers/plans/2026-04-17-post-sheep-roadmap.md` (slice 5).

## Goal

Add the Monastery building, the Monk unit, and relic entities + relic-gold
income:

- **Monastery** — new building placeable by villagers in Castle Age.
- **Monk** — trainable from the Monastery, no combat damage. Three behaviors:
  1. **Heal** — when selected and right-click on a friendly wounded unit,
     the Monk walks to attack-range and per-tick restores HP to that unit
     (slow, capped at unit `maxHp`).
  2. **Convert** — when selected and right-click on an enemy unit, the
     Monk walks into range and over several ticks flips
     `targetUnit.owner` to the Monk's owner (conversion).
  3. **Relic pickup / drop-off** — when selected and right-click on a
     neutral relic, the Monk walks to it and picks it up. The Monk now
     "carries" the relic. Right-click on a friendly Monastery drops the
     relic; while deposited, the owner earns a small gold-per-tick
     stipend.
- **Relics** — 1–3 neutral relic entities spawn on the default scenario as
  new resource kind `'relic'`. Not harvestable. Pickable only by Monks.

## Stats (canonical)

- **Monastery:** HP 2100, 2×2 footprint, cost 175 wood. Unlocks at
  Castle Age.
- **Monk:** HP 30, move-speed slow (like a villager), vision 9 (large
  sight range canonically), cost 100 gold. No attack damage. Heal rate:
  1 HP per 1 second (10 ticks). Convert rate: a full conversion takes
  several seconds; canonical AoE2 is conversion chance per tick, but
  for determinism v1 uses a fixed "conversion progress" of 1 per tick,
  and once progress reaches 50, the target's owner flips.
- **Relic:** Neutral entity. Carrying emits no effect; depositing in a
  friendly Monastery generates +1 gold per tick for the owner while the
  relic is inside.

## Where in the code

- `src/game/simulation/types.ts` — add `'monastery'` to the building
  unions, `'monk'` to `UnitType`, `'relic'` to `ResourceKind` (if that
  is the right home for relics — relic isn't harvestable, but it IS a
  neutral world entity, so the resource slot is a natural fit).
- `src/game/simulation/createSimulationBridge.ts`
  - Footprints, stat switches, HUD labels/icons.
  - `getBuildOptions(owner, 'villager')` includes `'monastery'` at
    Castle Age.
  - `getTrainOptions(owner, 'monastery')` includes `'monk'` at Castle
    Age.
  - New per-entity state maps: `monkTasks: Map<unitId, MonkTask>` where
    a task is `{ kind: 'heal' | 'convert' | 'pickup' | 'deposit',
    targetEntityRef }`.
  - Convert progress: `conversionState: Map<targetUnitId,
    { byOwner: number, progress: number }>`. On a tick when a Monk is
    in range and targeting an enemy, increment progress; when progress
    hits 50, flip `targetUnit.owner` to the Monk's owner and clear
    state.
  - Heal: when a Monk is in range of a friendly wounded unit, add 1 HP
    to the target's combat state (clamped to `maxHp`) every 10 ticks.
  - Relic pickup: a Monk entity with a relic gains a `carriedRelicId`
    field. The relic entity is moved to the Monk's position each tick
    while carried. On deposit, the relic becomes a child of the
    Monastery (or just records `inMonastery = monasteryId` + deletes
    the world entity since it's no longer interactable).
  - Gold income: per tick, for every owner who has relics in their
    Monasteries, add +1 gold per relic to their player resources.
  - Context command routing: when a Monk is selected and the player
    right-clicks an entity, resolve the target type and choose
    heal / convert / pickup / deposit based on the target. Build on
    the existing `issueContextCommandAtEntity` plumbing.

## Tests

New `tests/simulation/monastery.test.ts`:

1. **Monastery placeable in Castle** — placement options include it.
2. **Monastery trains Monks** — train options include `'monk'`.
3. **Monk heals friendly unit** — take damage to a spearman, have a Monk
   heal it; after enough ticks, HP is restored.
4. **Monk converts enemy unit** — enemy militia near a Monk with convert
   order; after ~50 ticks, militia flips to the Monk's owner.
5. **Relic pickup** — Monk walks to a relic and picks it up; the
   relic position tracks the Monk each tick.
6. **Relic deposit and gold income** — deposit a relic in a Monastery;
   after 20 ticks, owner's gold has increased by 20.

Browser: extend `tests/browser/game.spec.ts`. Boot a fixture with an
existing Monastery and relic nearby; train a Monk; pick up the relic;
deposit; assert gold grows.

## Plan (TDD tasks)

### Task A: Content + types

1. `'monastery'`, `'monk'`, `'relic'` added to type unions.
2. Stat switches + footprints + HUD labels/icons extended.
3. Commit: `Add Monastery, Monk, and Relic types + stat tables`.

### Task B: Building placement and Monk training

1. `getBuildOptions(owner, 'villager')` includes Monastery in Castle.
2. `getTrainOptions(owner, 'monastery')` includes Monk in Castle.
3. Vitest for both.
4. Commit: `Allow villagers to place Monastery and Monastery to train Monks`.

### Task C: Monk heal behavior

1. Failing vitest: wound a friendly unit, issue Monk heal order,
   assert HP restored after ticks.
2. Implementation: monk-task state + heal-tick logic.
3. Commit: `Add Monk heal command and per-tick HP restoration`.

### Task D: Monk convert behavior

1. Failing vitest: Monk converts enemy militia; after target progress
   reaches 50, `unit.owner` flips.
2. Implementation: conversion state + tick-increment + owner flip +
   combat-state owner handoff.
3. Commit: `Add Monk convert command and deterministic ownership flip`.

### Task E: Relic spawning and pickup

1. Extend default scenario to spawn 2 relics.
2. Failing vitest: Monk picks up a relic; relic entity position tracks
   Monk position each tick.
3. Implementation: relic carried state + tick-follow.
4. Commit: `Add relic pickup and carry behavior`.

### Task F: Relic deposit + gold income

1. Failing vitest: deposit relic; gold grows per tick.
2. Implementation: monastery-side "relic stored" counter + per-tick
   gold emission.
3. Commit: `Add relic deposit and per-tick gold income`.

### Task G: Browser coverage

1. Playwright: Castle-Age fixture with a Monastery + relic; build a
   Monk; pick up the relic; deposit; assert gold visibly grows.
2. Commit: `Cover Monk relic pickup and deposit in browser tests`.

### Task H: Slice gate

1. Run the four-step gate.
2. Devlog entry + summary update.
3. Commit: `Close Slice 5 with passing gate`.

## Out of scope

- Monk research techs (Faith, Sanctity, Block Printing, Redemption,
  Heresy, Illumination — Imperial or later tiers).
- Convert bonuses for civs with faster conversions.
- Monk carrying multiple relics or multiple Monks stacking conversion
  speed — single Monk, single target, fixed rates.
- Monastery healing aura (some civ bonuses) — v1 only covers Monk heal.
