# Slice 8 — Wonder, Relic, and Score win conditions

Date: 2026-04-17.
Roadmap: `docs/superpowers/plans/2026-04-17-post-sheep-roadmap.md` (slice 8).

## Goal

Three alternative victory paths layered on top of the existing
conquest-by-destruction condition:

1. **Wonder victory** — build a Wonder in Imperial Age, survive a
   countdown; if the Wonder is still standing when the countdown expires,
   that player wins.
2. **Relic victory** — hold ALL relics in your Monastery(ies) for the
   same countdown length; countdown runs down; if still holding every
   relic on the map at zero, that player wins.
3. **Score summary** — compute a running score (kills + buildings +
   economy) and surface it in the post-game summary alongside the winner.

## Non-goals for v1

- Wonder grace timer differs in canonical AoE2 (Standard is 200
  "minutes of game time"; we'll use a simpler fixed tick countdown).
- Simultaneous Wonder + Relic victories (if both countdowns complete
  on the same tick, whichever was started first wins; deterministic
  tie-breaker documented).
- Per-civ Wonder cost differences.

## Stats

- **Wonder:** HP 4800, 4×4 footprint, cost 1000 food + 1000 wood +
  1000 stone + 1000 gold (very expensive). Imperial Age only. One
  Wonder per player at a time.
- **Wonder countdown:** 2000 ticks (~200 seconds at TPS 10, readable
  mid-test).
- **Relic countdown:** 2000 ticks. Starts as soon as a player holds
  every relic present on the map inside their Monasteries.

## Where in the code

- `src/game/simulation/types.ts`:
  - Add `'wonder'` to building enums.
  - Extend `MatchState.outcome` reasoning — currently probably
    `'running' | 'victory' | 'defeat'`. Add a `winCondition` field
    (`'conquest' | 'wonder' | 'relic'`) plus an optional
    `wonderCountdownTicks` / `relicCountdownTicks` surfaced for HUD.
  - Add `'score'` state: optional fields on `MatchState` like
    `scores: Map<ownerId, number>` or a parallel summary.

- `src/game/content/buildingFootprints.ts` — add 4×4 Wonder.

- `src/game/simulation/createSimulationBridge.ts`:
  - `getBuildOptions(owner, 'villager')` includes `'wonder'` at
    Imperial Age, only when no Wonder exists already for that owner.
  - New `wonderState: Map<ownerId, { wonderId: EntityRef | null,
    countdownTicks: number | null }>`. Countdown starts on Wonder
    construction completion.
  - `prototypeWonderCountdown` system (phase: 'update', after:
    'prototypeProductionQueues' or wherever construction completion
    fires): each tick, if a player owns a completed Wonder and no
    countdown is running, start countdown. Decrement counter each
    tick. At 0, set match outcome to that player's victory with
    `winCondition: 'wonder'`.
  - If the Wonder is destroyed while the countdown is ticking, reset
    counter to null (destruction already handled by
    `destroyBuildingEntity`).
  - `prototypeRelicCountdown` system (after `prototypeHerdableMovement`
    or similar, anywhere after relic gold is computed): each tick,
    check whether one owner holds all relics present in the world
    (live relic entities + relics stored in that owner's
    monasteries). If yes and no countdown active, start. Decrement.
    At 0, victory.
  - When a match ends, freeze sim and emit a score per owner:
    `score = units_produced + buildings_produced + resources_gathered
    + relics_held * 50 + (wonder_completed ? 200 : 0)`. Pick simple
    weights. Surface as `matchState.scores`.

- `src/ui/hud/createHudController.ts`:
  - Post-game summary card: show winner + `winCondition` + scores
    for every owner.
  - If a countdown is active, show the countdown value prominently
    on the HUD (maybe in the top bar alongside age / pop).

## Tests

New `tests/simulation/winConditions.test.ts`:

1. **Wonder placeable in Imperial** — placement options include
   `'wonder'` at Imperial; not at Castle.
2. **Only one Wonder per owner** — after placing one Wonder, further
   attempts return `false` / invalid-placement.
3. **Wonder victory countdown** — build a Wonder (use
   `startingAge: 'imperial-age'` and a pre-placed Wonder in the fixture
   with a short-circuit countdown constant for the test, e.g., 20
   ticks for test speed). Advance 20 ticks; assert match outcome is
   victory for that owner with `winCondition === 'wonder'`.
4. **Wonder destroyed resets countdown** — start countdown, destroy
   Wonder mid-countdown, advance; match outcome stays `'running'`.
5. **Relic victory countdown** — fixture with all N relics deposited
   in player 1's Monastery. Assert countdown starts and victory fires
   at 0.
6. **Relic victory invalidated by pickup** — start relic countdown,
   have an enemy unit approach the Monastery (or destroy it, dropping
   the relics). Enemy picks up a relic before countdown completes.
   Assert countdown resets.
7. **Post-game score** — simulate a conquest victory, assert
   `matchState.scores` contains entries for both players with sensible
   numbers.

Browser: one case that builds a Wonder in a fixture, advances, asserts
the post-game HUD shows "Wonder Victory".

## Plan (TDD tasks)

### Task A: Wonder building content + placement

1. Add `'wonder'` type, footprint, stats. Exhaustive switches updated.
2. Villager placement at Imperial Age, gated on "no existing Wonder
   owned". HUD label + icon.
3. Commit: `Add Wonder building type, placement, and Imperial gate`.

### Task B: Wonder countdown victory

1. `prototypeWonderCountdown` system.
2. Vitest for victory trigger.
3. Vitest for destroyed-wonder countdown reset.
4. Commit: `Add Wonder victory countdown and destruction-resets-countdown rule`.

### Task C: Relic countdown victory

1. `prototypeRelicCountdown` system.
2. Vitest for trigger and invalidation.
3. Commit: `Add Relic victory countdown`.

### Task D: Score summary

1. Compute score in match-ending path.
2. Surface in `MatchState.scores` (or equivalent).
3. HUD post-game summary shows per-owner score.
4. Commit: `Compute per-player score at match end and surface in the summary`.

### Task E: Browser coverage

1. One Playwright case that reaches a Wonder victory in a short
   fixture, asserts the HUD's post-game card labels it "Wonder
   Victory".
2. Commit: `Cover Wonder victory in browser tests`.

### Task F: Slice gate

1. Full four-step gate.
2. Devlog + summary update.
3. Commit: `Close Slice 8 with passing gate`.

## Out of scope

- Dynamic countdown speed based on age / civ.
- King unit for regicide (separate game mode entirely).
- Timer-based victory (longest-surviving wins on a clock — not in
  Standard Random Map scope).
