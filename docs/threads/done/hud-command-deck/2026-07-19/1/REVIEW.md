# HUD command deck and build palette review — pass 1

## Scope

This pass adversarially reviewed the v0.3.7 selection-panel hierarchy, villager build cards, live cost coverage, command focus, delegated tooltips, responsive/replay layout, existing command authority, accessibility, tests, documentation, version metadata, and file-size boundary. Simulation rules, command validation, build charging, placement legality, and sibling repositories were explicitly outside the change scope.

## Findings and repairs

- Raw resource values initially participated in the selection-panel cache signature, so every gather increment recreated an otherwise unchanged palette. A RED identity regression proved the churn; the signature now changes only when a relevant resource crosses a displayed building-cost coverage threshold, while the existing Short-to-Ready transition still refreshes immediately and restores logical focus.
- Pointer-out and focus-out initially hid the shared tooltip without considering the other input modality. Mixed-ownership RED coverage now pins that the tooltip remains visible until both pointer and focus release it.
- Focused commands were not associated with the shared `role="tooltip"` for assistive technology, and replacing a focused or hovered command could leave stale text because DOM removal emits no focus-out. The active trigger now composes an `aria-describedby` token, and a mutation observer reconciles only disconnected owners; a separate RED proves unrelated HUD mutations cause zero tooltip writes.
- The wider/taller selection panel initially exceeded the steady-state replay reserve at 800x600. A real Chromium regression failed before the repair; timeline-aware height caps now keep the panel between the resource bar and replay strip at both 800x600 and the 700px narrow breakpoint.
- README reconciliation initially omitted owned Castles from the `Alt`+right-click garrison targets even though live capacity rules accept them. The control documentation now names Town Centers, Watch Towers, and Castles.
- The first complete browser pass exposed a deterministic test precondition failure: after selecting the Town Center, the expanded HUD covered the canvas bounding-box center, so a wheel event correctly went to the HUD and camera zoom remained 1.4. Trace inspection confirmed the target and open Attack tooltip. The test now chooses a left-side point, proves `elementFromPoint` is the world canvas, and sends the same real wheel input; no production input behavior changed.

## Evidence

- The initial hierarchy/cost/focus/keyboard-tooltip slice began RED with three failures. Additional RED/GREEN regressions cover unchanged-readiness node identity, mixed tooltip ownership, accessible description cleanup, disconnected triggers, observer idleness, replay layout, and exposed-canvas camera targeting.
- Independent focused review completed 15 tests across the build-card, tooltip, and glyph surfaces, checked every touched source/test file below 500 lines, and reported no remaining substantive finding.
- Fixed selection-panel captures show the old 320x519 panel exposing four of seven Dark Age choices and the new 390x606 panel exposing all seven with visible costs/readiness. Framing both captures on a 390x606 canvas changed 230,022 of 236,340 pixels (97.3267%), as expected for the complete information-hierarchy replacement.
- Final verification passed content validation, 2,214 unit tests with 2 skipped across 294 passed and 1 skipped files, 110 headless Chromium scenarios with 2 skipped, typecheck, zero-warning lint, and a 576-module production build. Production-only and full npm audits both reported zero vulnerabilities.

## Verdict

Approved after the cache, mixed-input, accessibility, lifecycle, observer-cost, replay-layout, documentation, and browser-precondition repairs. The final UI is a presentation hierarchy over the existing bridge-provided options and command callbacks; it neither hides choices nor creates a second affordability or placement authority.
