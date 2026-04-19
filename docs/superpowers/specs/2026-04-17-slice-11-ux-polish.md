# Slice 11 — UX polish, debug overlays, and additional maps

Date: 2026-04-17.
Roadmap: `docs/superpowers/plans/2026-04-17-post-sheep-roadmap.md` (slice 11).

## Goal

Polish the existing HUD and input layer, add togglable debug overlays
for internal state inspection, and ship two additional map scripts so
the game boots into something other than Arabia.

## Scope

### 1. Tooltips

- Hover tooltips on: HUD chips (food, wood, gold, stone, age, pop,
  time), command panel buttons (train / research / build), and
  selection-detail values.
- Simple DOM tooltip with data-tooltip attribute + mouse-enter / leave
  handler.

### 2. Debug overlays (toggleable)

- Keyboard shortcut `F2` (or similar) cycles through overlay modes:
  `off → selection-bounds → pathing → fog-state → ai-state → perf → off`.
- **Selection bounds:** draw bounding rect of currently-selected
  entities.
- **Pathing:** for each moving unit, draw its current path
  (nextStep + target).
- **Fog state:** visible cells in one tint, explored-not-visible
  in another, never-seen in a third. Memory entities outlined.
- **AI state:** per-AI-player label showing current plan
  ('opening' / 'feudal-push' / 'attack' / etc.) and villager
  target distribution.
- **Perf:** per-tick ms, entity count, system timing breakdown.

### 3. Command feedback

- When a command is rejected (insufficient resources, invalid cell,
  etc.), a brief DOM toast: "Not enough food" / "Cell blocked" /
  etc.
- When a command lands, a small visual bump / sound (skip sound for
  v1; leave a placeholder).

### 4. Additional map scripts

- **Black Forest-ish:** dense trees across the map with narrow paths.
  Players start in tree-surrounded pockets.
- **Arena-ish:** players start inside a stone-wall ring. Only way
  out is to mine through or over.

Both deterministic from the seed string. Add URL parameters
`?seed=black-forest-fixture` and `?seed=arena-fixture` equivalents.
The default `aoe2-prototype` stays Arabia-style; these are optional
fixtures.

## Where in the code

- `src/ui/hud/createHudController.ts` — tooltips, command-reject
  toast, debug overlay HTML.
- `src/phaser/scenes/GameScene.ts` — debug overlay draw calls for
  pathing / selection bounds / fog tinting.
- `src/game/simulation/prototypeScenario.ts` — `createBlackForestMap`
  and `createArenaMap` scenario generators.
- `src/game/simulation/createSimulationBridge.ts` — `rejectionReason`
  surface on selected commands (or expose via an event stream) so
  the HUD can toast them.

## Tests

- Vitest: map-generation determinism for Black Forest and Arena
  seeds. A few spot checks (tile counts, connected regions).
- Browser: tooltip appears on HUD hover; debug overlay F2 cycles;
  command rejection toast shows when trying to queue a unit with
  insufficient resources.

## Plan

### Task A: Tooltips on HUD chips + command buttons

1. DOM tooltip mechanism.
2. Playwright: hover food chip, assert tooltip text.
3. Commit: `Add HUD tooltips on resource chips and command buttons`.

### Task B: Debug overlay scaffold + F2 toggle

1. Add a HUD overlay slot + F2 key handler.
2. Start with the simplest mode (selection-bounds).
3. Commit: `Add F2-toggle debug overlay with selection-bounds mode`.

### Task C: Other debug modes

1. Pathing, fog-state, ai-state, perf.
2. Commits per mode or bundled.

### Task D: Command-rejection toast

1. Surface reason on `issueMoveCommand` / `queueTrainUnit` etc. when
   rejected.
2. HUD toast.
3. Playwright.
4. Commit: `Toast command rejection reasons in the HUD`.

### Task E: Black Forest map

1. Map generator + fixture seed.
2. Vitest determinism.
3. Commit: `Add Black Forest deterministic map generator`.

### Task F: Arena map

1. Map generator + fixture seed.
2. Vitest determinism.
3. Commit: `Add Arena deterministic map generator`.

### Task G: Slice gate

1. Full four-step gate.
2. Devlog + summary.
3. Commit: `Close Slice 11 with passing gate`.

## Out of scope

- Audio (placeholder hooks only; no actual sound assets).
- Settings menu for binding debug keys.
- Replay system.
