# M7 — Combat/gather feedback + selection polish (v0.1.45)

## Goal

Give the game its first DYNAMIC visual feedback. Today every cue is static: the selection ring is a flat constant-alpha circle/rect, gathering shows nothing, and combat is instant HP subtraction with no impact tell. This is the biggest remaining "not-alive" tell after the static-visual slices (units/buildings/terrain/HUD/icons are done). North star: the look + FEEL of an AoE2 HD clone, from ORIGINAL/PROCEDURAL art only (100% Phaser primitives/tweens — no asset files, no copyrighted AoE assets).

## Investigation findings (what render state actually exists)

`ProjectedEntityView` (`src/game/simulation/types.ts:255`) is the per-entity render contract. Available render-side, no sim/bridge call:

- `selected: boolean` — set in `visibility.ts:117` via `isSelected(ref.id)`. Selection also flows through `SelectionState.selectedEntityIds`, which already drives `selectionLayers.renderSelection`.
- `currentHp: number | null`, `maxHp: number | null` — set in `visibility.ts:118-119` from the combat/health side-map. These already drive the HP bars in `worldLayers.renderEntityHealthBars`.
- There is NO gather-task field on `ProjectedEntityView`. The villager's `GathererComponent.task` (`'idle' | 'to-resource' | 'gathering' | 'to-dropoff'`) lives in the sim and is surfaced on `EconomyState.villagers[].task` / `EconomyState.units[].task`, but is NOT projected per render-entity.

The render loop (`GameScene.renderState`) iterates `displayedEntities` (interpolated copies of the projected entities), clear-and-redraws each graphics layer every frame, and already tracks `previousUnitProjectedPositions` (a per-tick map of prior unit positions, rebuilt whenever `state.tick` changes) — used by `unitFacingRadians` to derive unit heading purely render-side. A per-frame HP DELTA is derivable the exact same way: a `previousHpById` map rebuilt on tick change.

The render is cached: `syncFromBridge` early-returns when `tick`, `selectionKey`, and `interpolationAlpha` are all unchanged. A time-based animation must therefore bust this cache while it is active (see below).

## Decision — two effects, both cleanly derivable; one skipped

### 1. Selection glow/pulse (SAFEST, core of the slice)
Animate the EXISTING selection ring's stroke alpha + radius over time so a selected entity breathes instead of sitting flat. Derived ONLY from the `selected` set (no new data). The ring's BASE geometry (center, base radius for units, footprint rect for buildings) is unchanged — the pulse scales the stroke alpha and adds a small outward radius offset; the entity hitbox / HP-bar / footprint geometry is untouched.

Pure helper: `selectionPulse(timeMs) -> { alpha, radiusOffsetPx, lineWidth }` from a cosine phase (`(1 - Math.cos(...)) / 2` swell). Tested: alpha stays within a sane lit band, oscillates over a period, radius offset is bounded and small, deterministic for a given time.

### 2. Hit flash (impact cue on damage)
When a unit's `currentHp` drops since the last tick sample, flash a brief bright overlay (a filled ring/disc tinted toward white-red) on that unit that decays over ~250ms. Derived from a render-side `previousHpById` map (mirrors `previousUnitProjectedPositions`) — NO sim change. This is the impact tell for combat (and for raids on villagers) without rendering projectiles (deferred to M2).

Pure helpers:
- `shouldFlashHit(prevHp, currHp)` — true iff `currHp < prevHp` (both finite).
- `HitFlashTracker` — `recordSample(id, hp, tick)` updates the per-id hp + start time on a drop; `intensityAt(id, nowMs)` returns a 0..1 decaying intensity (0 once expired); `forget(id)` / prune drops entities no longer present so the map stays O(visible). Tracker is the render-side analogue of the position map; it is fed the projected (not interpolated) hp and the scene clock.

### Skipped / deferred (reported, not done)
- **Gather sparks** — REQUIRES gather state on `ProjectedEntityView`, which is not projected. Adding it is a forbidden contract change. Skipped this slice (would otherwise be a clean third effect). Noted in spec/roadmap as deferred.
- **Death puff** — tracking entity DISAPPEARANCE cleanly (id present last tick, absent this tick) is doable but the flash already covers the "combat is happening" tell, and a puff that fires on every fog-exit / despawn is noisy; deferred to keep the slice contained.
- **Projectiles** — paired with the M2 projectile SIM; out of scope.

## Constraints honored
- RENDER-ONLY: no sim/bridge/save-format/contract change. `ProjectedEntityView` is untouched. Both effects derive from existing projected state + a render-side per-frame delta.
- TIME-BASED ANIMATION ALLOWED (purely visual; does not feed the deterministic sim/replay). The pulse phase comes from the Phaser scene clock (`this.time.now`); the flash decay from the same clock. No `Math.random`/`Date.now` anywhere — per-entity variation (if any) derives deterministically from `entityId`; no randomness is introduced into sim/bridge code.
- PERFORMANCE: O(visible entities). Reuse the existing per-layer graphics (clear-and-redraw like the other layers); the flash tracker is a single Map keyed by id, pruned each tick to the visible set. No per-frame-per-entity allocation beyond the existing pattern.
- Geometry unchanged: selection-ring CENTER + base radius, HP-bar layout, footprint outline are all byte-identical; the pulse only modulates the ring's own alpha/width and adds a small outward radius offset to the STROKE (not the hitbox).
- Cache-busting: while anything is selected OR a flash is in flight, the scene must re-render every frame for the animation to play. Handled by forcing the per-frame sync when an animation is active (a cheap predicate), leaving the static-frame fast path intact otherwise.

## Files
- NEW `src/phaser/scenes/gameScene/feedbackEffects.ts` (<500) — pure effect-decision functions + the `HitFlashTracker` factory. Fully unit-tested.
- EDIT `src/phaser/scenes/gameScene/selectionLayers.ts` — `renderSelection` takes a pulse param and modulates alpha/width/radius. Move-compatible (browser tests read bridge selection state, not ring pixels).
- EDIT `src/phaser/scenes/gameScene/unitRenderer.ts` (or a small flash draw in the scene) — draw the hit-flash overlay for a unit given an intensity.
- EDIT `src/phaser/scenes/GameScene.ts` — thread `this.time.now` + the tracker into the two render calls; force-render while an animation is active; rebuild `previousHpById` on tick change next to `previousUnitProjectedPositions`. Net LOC kept <= 1018 (extract to the helper module).
- NEW `src/game/simulation/fixtures/feedbackShowcase.ts` — a visual-only capture fixture: a selected unit (pulse) + an enemy attacker damaging a defender (flash). Registered in `dispatch.ts`.
- TEST `tests/phaser/feedbackEffects.test.ts` — pulse range/oscillation/determinism; `shouldFlashHit`; tracker update/decay/forget. Plus draw-path coverage via the graphics spy for the pulsed ring + the flash overlay.
