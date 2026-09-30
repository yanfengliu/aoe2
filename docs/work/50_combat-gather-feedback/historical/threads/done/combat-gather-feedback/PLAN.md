# PLAN — combat/gather feedback + selection polish (v0.1.45)

TDD throughout: test the LOGIC/TRIGGER (pure functions), not the exact pixels of an animation.

## Step 1 — pure effect module + tests (RED → GREEN)
- `tests/phaser/feedbackEffects.test.ts`:
  - `selectionPulse(timeMs)`: alpha in (0,1] within a lit band (never invisible, never >1); oscillates (two samples a half-period apart differ; a full period apart match); `radiusOffsetPx` bounded small (>=0, <= a few px); `lineWidth` bounded; deterministic for a given timeMs; smooth (no NaN).
  - `shouldFlashHit(prevHp, currHp)`: true iff `currHp < prevHp` with both finite; false for null/equal/heal/undefined-prev.
  - `HitFlashTracker`: a fresh sample never flashes (no prior); a drop starts a flash (intensity ~1 right after, decaying to 0 by the duration); a heal/no-change does not start a flash; `intensityAt` is 0 for an unknown id and after expiry; `pruneTo(visibleIdSet)` forgets ids not present; re-drop re-arms.
- `src/phaser/scenes/gameScene/feedbackEffects.ts`: implement to pass.

## Step 2 — pulse the selection ring (RED → GREEN)
- Extend `selectionLayers.renderSelection(entities, selectionState, pulse?)` to take an optional pulse (default = no-pulse static values, preserving current look when omitted, so existing callers/tests are unaffected). Apply `pulse.alpha`/`pulse.lineWidth` to `lineStyle` and add `pulse.radiusOffsetPx` to the unit `strokeCircle` radius and inflate the building `strokeRoundedRect` by the offset on each side (center unchanged).
- Add a focused draw test (graphics spy) asserting: with a pulse, the stroke alpha/width match the pulse and the unit ring radius = baseRadius + offset (base geometry preserved); without a pulse, the call is byte-identical to today.

## Step 3 — hit-flash draw (RED → GREEN)
- Add `drawHitFlash(graphics, cx, cy, r, intensity)` (in feedbackEffects or unitRenderer) — a filled translucent disc + bright ring whose alpha scales with intensity, kept within the unit bounding circle. Test via spy: intensity 0 draws nothing; intensity 1 draws within radius r with alpha proportional to intensity; deterministic.

## Step 4 — wire into GameScene (no LOC regression)
- Rebuild `previousHpById` on tick change beside `previousUnitProjectedPositions`.
- In `renderState`: feed the tracker the projected hp (from `state.entities`, not interpolated) + tick; prune to the visible id set; compute `selectionPulse(this.time.now)` once per frame; pass the pulse to `renderSelection`; for each unit, draw the flash overlay using `tracker.intensityAt(id, this.time.now)`.
- Force a per-frame render while an animation is active: in `syncFromBridge`, skip the early-return when `selectionState.selectedEntityIds.length > 0` OR the tracker reports any active flash. Keep the static fast path otherwise.
- Keep GameScene <= 1018 (extract any nontrivial body to feedbackEffects.ts; the scene only holds call-sites).

## Step 5 — visual-capture fixture + dispatch entry
- `src/game/simulation/fixtures/feedbackShowcase.ts`: `createFeedbackShowcaseFixture` — a TC + a P1 unit to select + an enemy melee unit adjacent to a P1 defender so a few ticks of combat drops the defender's hp (flash). Castle age, generous vision. Register `feedback-showcase-fixture` in `dispatch.ts` + export from `fixtures/index`.

## Step 6 — four gates + visual protocol
- `npm run typecheck`, `npm run lint`, `npm run build`, FULL `npm test` (isolated). Baseline 1429/2 → 1429 + new tests.
- Visual protocol (motion not capturable in a static PNG): capture HEAD `before` vs `after` on the feedback fixture with (a) a unit SELECTED (ring mid-pulse) and (b) a unit mid-FLASH; pixel-diff (mirror `tmp/ui-icons-2/diff.mjs`). Note in the report that motion isn't captured — the lead judges effect PRESENCE + placement + confinement + the trigger-logic tests.

## Step 7 — docs
- package.json 0.1.44 -> 0.1.45; changelog 0.1.45 entry; devlog summary (prepend, compact one old line to stay <=50); detailed devlog ## entry at top with reviewer line **[pending — main agent runs the multi-CLI review]**; spec §14.5 bullet; roadmap M7 mark done-partial (pulse + flash shipped; gather sparks + death particles + projectiles deferred). DESIGN.md/PLAN.md (this thread).

## Anti-regression checklist for reviewers
- No change to `ProjectedEntityView` / projection / bridge / save codec.
- Selection-ring center + base radius, HP-bar layout, footprint outline geometry unchanged.
- Time/clock + any per-entity variation confined to the render layer; no `Math.random`/`Date.now` in sim/bridge.
- O(visible entities); reused graphics layers; tracker pruned each tick.
- Existing browser selection tests (bridge-state assertions) still pass.
