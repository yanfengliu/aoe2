# Debugging session — unit motion continuity

## Symptom

Commanded and autonomous units can visually hold for a fixed tick and then jump, units sharing a destination cell can recenter at spawn, arrival, or the first tick after save/load, and replay playback can fast-forward many ticks in one rendered frame after a long animation-frame gap.

## Expected vs actual

- Expected: every fixed-step fine-grid transform is published to rendering, stationary spawn and movement use one allocated sub-cell destination that survives save/load or replay reconstruction, and one visible replay frame consumes only a bounded elapsed interval.
- Actual: fine-grid fields were mutated in place without dirtying the component, movement aimed at an identity fallback before an arrival-time allocated-slot snap, runtime occupancy reconstruction could replace a saved crowded destination or promote a saved overflow unit, and replay consumed an unbounded wall-clock delta.

## Reproduction

- Headless focused tests: `npx vitest run tests/simulation/createSimulationBridge.unitMovement.test.ts tests/replay/ReplayController.interpolation.test.ts`.
- Live bridge probe: load `unit-sharing-fixture`, select both player units, issue a move to `(7, 10)`, and compare each unit's `unitTransform` with its projected render entity after every 100 ms step.
- Observed sequence for one unit before the fix: render/transform `(6, 10.5)`; next tick render holds while transform reaches `(6.5, 10.5)`; following tick render jumps to `(7, 10.5)`; arrival transform changes to `(7.5, 10)` while render remains stale until a selection refresh.

## Hypotheses

- [x] In-place `unitTransform` mutation bypasses the engine component store's dirty tracking, so the render adapter does not reproject fine-grid-only steps.
- [x] The move target and arrival predicate omit the occupancy grid's allocated slot, so the stationary arrival sync can select a different visual endpoint.
- [x] Replay playback accumulates an unbounded animation-frame delta after suspension and advances every missed simulation tick in one callback.
- [x] Rebuilding occupancy in entity-id order cannot reproduce arrival-order slot assignments unless the assigned numeric slot is persisted separately from a still-moving fine root.
- [x] Absence of numeric slot fields cannot represent both a legacy save and an authoritative current overflow; current overflow needs an explicit persisted marker and must rebuild after saved slot holders.

## Investigation log

- 2026-07-13 20:10 PDT — Focused simulation, renderer, interpolation, and animation suites passed, showing the existing tests did not exercise component publication continuity.
- 2026-07-13 20:20 PDT — A live `unit-sharing-fixture` probe demonstrated stale render roots and an arrival-time slot change; selecting the unit forced the hidden fine transform to appear.
- 2026-07-13 20:23 PDT — Grounded the behavior in civ-engine: `ComponentStore.set` marks a component dirty and `RenderAdapter` projects dirty entities, while AoE2 mutated `unitTransform` objects directly.
- 2026-07-13 20:25 PDT — Inspected replay playback and confirmed that its frame loop consumes the complete timestamp gap, unlike live presentation's bounded visible-frame delta.
- 2026-07-13 20:27 PDT — Adversarial review found that the first blocked-scout repair still snapped to its assigned slot and could exceed the normal fine-step bound. Removing the write avoided the jump but regressed the existing 2,000-tick no-livelock oracle.
- 2026-07-13 20:31 PDT — A bounded recenter toward the assigned in-cell slot preserved the escape phase without publishing more than one normal step; both the continuity bound and no-livelock oracle passed together.
- 2026-07-13 21:47 PDT — The complete gate exposed a fresh-spawn slot mismatch through fog/selection timing regressions. Engine visibility probes and baseline comparison showed the first north command spent one tick recentering west; aligning stationary spawns closed the perpendicular first-step delta while the fog tests now wait for their actual visibility prerequisite.
- 2026-07-13 21:54 PDT — Adversarial save/load replay reproduced a valid crowded mid-movement divergence: uninterrupted play advanced fine X `80 → 82`, while reconstruction chose the current root as a new slot and cleared the command at X `80`. Persisting the assigned offset separately closed the deterministic continuation test.
- 2026-07-13 22:52 PDT — A second adversarial load replay filled all 16 slots with higher-id occupants and moved a lower-id scout into authoritative overflow. Entity-id rebuild promoted the scout into `(0,0)` and displaced saved authority. An explicit overflow marker plus numeric-slot-first, legacy-second, overflow-last reconstruction preserved the pre-save state and uninterrupted next tick.
- 2026-07-13 23:00 PDT — The next overflow replay freed one peer's slot before saving. Normal phase-three allocation promoted the saved overflow during load, while uninterrupted play remained overflowed; the live arrival branch also claimed it would rebind but actually cleared the command without syncing occupancy. Exact overflow reconstruction now recreates the no-slot claim directly, and a later same-cell free-slot result rebinds while keeping the command active for bounded convergence.
- 2026-07-14 03:49 PDT — The first exact-pin browser gate exposed three invalid selection-test assumptions after stationary slot alignment. The gap tests chose the widest outer pair at centers `5.75` and `8.25`, whose midpoint was exactly the third villager at `7.0`; the moving-body test waited for a timing-dependent displayed/authority cell mismatch that coherent publication no longer guarantees. A shared clear-gap chooser excludes third-body coverage, while the motion proof now requires the displayed root to leave its initial cell while authority still reports `task === 'moving'`.
- 2026-07-14 04:05 PDT — A subsequent full browser pass caught the conquest health-bar test racing live startup combat: the hostile militia could reduce the house from 75 to 71 HP before the supposed pristine assertion. Paused boot now captures the full-health baseline, and the existing explicit `advanceTicks(80, 100)` path still unpauses, advances the attack, restores pause, and verifies damage. Ten repeated runs of this case and the strengthened moving-body case passed (20/20).
- 2026-07-14 04:20 PDT — The final disposable checkout, with all 32 changed source/test/config/lock files hash-matched to the worktree and Voxel resolved from reachable commit `faa00bf2ef83e5134bd9ca62c0b36cd0cfbe394b`, passed the complete canonical gate.

## Root cause

Fine movement bypassed the ECS publication contract, its endpoint was computed with inconsistent slot identity, runtime occupancy authority was not serialized with the fine transform, and replay timing treated hidden wall-clock time as visible presentation time.

## Fix

`transformOps.ts` now computes immutable replacement transforms, publishes every fine step through `World.setComponent`, and passes `worldOccupancy.getUnitSlotOffset(id)` to target construction, arrival checks, and autonomous heading probes. Stationary spawns align after allocation. `UnitTransformComponent` additively records `occupancySlotX/Y` or `occupancySlotOverflow`; reconstruction restores numeric assignments before legacy no-field units, then recreates exact overflow claims without modifying the serialized fine root. A same-cell slot that becomes free is bound explicitly while the command remains active until bounded movement reaches it. `scoutMovementSystem.ts` publishes a candidate only when legal; on a blocked tick it recenters toward the assigned in-cell slot by at most one normal fine step before selecting the escape heading, preserving both continuity and the prior deterministic anti-livelock phase. `ReplayController` and `AoeVoxelGameView` now consume the same renderer-neutral `boundedVisibleSimulationDelta` policy from `src/game/visibleSimulationTiming.ts`, limiting one visible callback to 250 ms of simulation time.

## Verification

- The new tests failed before implementation: projected `x=6` while the canonical transform was `x=6.5`, and a 10-second replay callback advanced 79 ticks. They pass after the fix.
- Focused Vitest: the final persistence matrix passes 36/36 across legacy-v2 first movement, crowded mid-movement continuation, full-cell overflow, peer-freed-before-save exact restoration plus bounded rebinding, replay interpolation, and occupancy contracts. The broader motion/rendering matrix previously passed 82 tests plus one intentional skip across commanded and autonomous movement, the 2,000-tick scout no-livelock/step-bound oracle, replay timing, representative role facing, Three identity, terrain-ray compatibility, and renderer ownership.
- Headless Chromium: the deterministic 84-slice scout path-corner test passed, proving more than 40 distinct displayed roots, more than 20 between quarter-grid fixed endpoints, root steps at or below 0.1 world units, heading steps at or below 0.25 radians, and positive facing/velocity alignment.
- Same-state 1280x720 screenshots from preserved commit `81dbb5f` and the fixed worktree differ in 267 pixels, localized to the moving selected scout and its minimap marker: `output/playwright/60hz-motion/aoe2-voxel-motion-continuity-{before,after,diff}.png`.
- Final exact-pin `npm run verify` is green: content validation covers 18 supported and 12 unsupported civilizations; Vitest passed 256 files and skipped one, with 1,940 tests passed and two skipped out of 1,942; headless Chromium passed 105 tests and skipped two out of 107; lint, typecheck, and the 444-module production build passed. Both `npm audit --omit=dev` and full `npm audit` report zero vulnerabilities.
- The explicitly requested command was also run from the live AoE worktree. Its unit stage passed the same 1,940 tests plus two skips, then the browser prebuild's AoE typecheck stopped because the unrelated dirty sibling Voxel worktree adds three uncommitted `ThreeRenderMetrics` fields. AoE remains pinned to exact reachable Voxel 0.1.4, whose isolated gate is green; no AoE compatibility code was added for the uncommitted future API.

## Follow-ups

- The executable two-leg corner and representative authored-forward role coverage are now included in the normal test suites.
