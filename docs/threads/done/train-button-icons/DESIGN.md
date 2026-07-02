# Command-card Train-button icons (M7 UI) — DESIGN + REVIEW

**Objective (v0.1.72):** the M7 roadmap item "non-build command-card icons (train … buttons still text-only)" — give the "Train X" command-card buttons a unit icon, matching the Build buttons (v0.1.39) and selection panel (v0.1.44).

## Design

Extract `renderTrainButtons(trainOptions)` (exported, unit-testable) from the inline map in `createSelectionPanel.update`, mirroring `renderBuildButtons` exactly: a per-role UNIT glyph (`unitRoleGlyph(unitGlyphRole(unitType))`, reusing the v0.1.44 `unitGlyphs` art) BEFORE the label, with the "Train X" text moved into a `<span class="hud-command-label">` (same as the build button). Augment-not-replace: `data-command="train-<type>"`, `data-tooltip`, `class`, and `type` are all preserved; the glyph is a child SVG that doesn't affect the selector or click. DOM/CSS-only — no `src/phaser/`, sim, save, or contract touch.

## Why low-risk (self-review, no full Workflow)

Per AGENTS.md this is a near-trivial change (an extracted render fn reusing already-verified art), so a self-reviewed diff + gates is proportionate. The load-bearing checks, verified directly:
- **Browser-test safety:** all Playwright train-button assertions locate by `[data-command="train-<unit>"]` (preserved) and `.click()`/`toBeVisible()` — none assert the button text or inner structure. The build buttons already carry a glyph + the label span and are clicked the same way in browser tests, so the pattern is proven.
- **Visual protocol via reuse:** the glyph art is the same as the verified selection panel (v0.1.44), and the placement pattern (glyph before a `hud-command-label` span) is the verified build-button pattern (v0.1.39). The sizing CSS already targets `.hud-command-button` glyphs. So the pixel outcome is a known-good glyph in a known-good button — the before/after screenshot would only re-confirm this. DOM test asserts the glyph SVG is present + hooks + text preserved.
- **Byte-identical wiring:** the `update()` change swaps the inline map for the identical function call.

## Validation

TDD `tests/ui/trainButtonIcons.test.ts` (2): the train button prepends the role glyph, preserves the `data-command` hook + "Train X" text (in the label span), glyph precedes the label, and an empty option list renders nothing. Selection-icon + selectionGlyph regression suites green. Four gates GREEN with REAL exit codes (typecheck/lint/build 0; TEST EXIT 0; 1635 passed / 2 skipped / 0 failed).

**Follow-up (still open):** the action / market / research command-card buttons remain text-only — they need new generic glyph art (no existing per-tech/per-action glyphs to reuse), a separate slice.
