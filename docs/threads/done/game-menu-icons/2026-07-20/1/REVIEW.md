# Dedicated game-menu action icons review — pass 1

## Scope

This pass adversarially reviewed the v0.3.8 replacement of visible in-match menu action labels with dedicated icons: glyph distinctness, retained native semantics and hooks, keyboard/pointer tooltips, modal focus lifecycle, live Debug state, replay-mode unavailable actions, responsive geometry, visual balance, teardown, tests, documentation, version metadata, and file-size boundaries. Simulation commands, save/replay authority, renderer behavior, dependency resolution, the Voxel pin, and sibling repositories were explicitly outside the change scope.

## Findings and repairs

- The first controller iteration did not trap Tab within the `aria-modal` menu. The trap now wraps across visible enabled controls in both directions and includes nested visible Load controls without changing the established action order.
- The first tooltip repair responded to resize immediately, before narrow-breakpoint CSS had completed reflow, which could leave its old width and position overlapping the panel. Resize now repositions immediately and once more on the next animation frame; the browser contract changes viewport without blur/refocus and asserts final rectangles remain in-bounds and disjoint.
- Debug state changed through F2/API independently of the menu button. The debug controller now publishes mode changes, and the game menu updates both its visible mode and accessible name from the shared stream; teardown removes the subscription.
- Replay-mode Save and Replay initially used native `disabled`, removing the icon-only actions and their explanatory tooltips from keyboard navigation. They now remain native-enabled but carry `aria-disabled="true"`; existing state guards refuse Save and a new Replay guard no-ops without closing the menu.
- Closing the nested Load panel initially left focus on a now-hidden Cancel or Restore control, allowing the next Tab to escape to `BODY`. The shared close path now returns focus to the connected Load action after both Cancel and successful Restore, and real Chromium proves the next Tab reaches Replay inside the modal.
- Documentation initially placed the v0.3.8 state beneath the historical Phaser-era heading and omitted the renamed devlog backlink and review synthesis. Current UI state now precedes the historical record, links target the live detailed log, and this synthesis closes the review trail without rewriting dated history.

## Evidence

- TDD began with four icon/accessibility failures and a focused tooltip-placement failure. Review-driven contracts then failed five focus, resize, state-sync, and replay-unavailable expectations; the final nested-Load regression failed one of three Save/Load tests before its focus repair.
- The final focused contract passed 26 Vitest tests across five files. Two real headless Chromium flows prove the complete icon/menu behavior plus focus return after both Load Cancel and successful Restore.
- Fixed visual evidence compares the previous 280×458 text menu with the 280×338 icon menu on a common 280×458 canvas: 82,996 of 128,240 pixels changed (64.7193%). Independent desktop and 390×560 probes found unique 28–30-pixel glyphs, minimum 44-pixel targets, complete bidirectional focus order, synchronized Debug state, no overflow, and no tooltip-panel overlap after resize without refocusing.
- Independent final code and visual audits reported no remaining substantive finding. Task-owned headless browser processes and temporary directories were absent after review, while the user-requested localhost server remained HTTP 200.
- Final verification passed content validation, 2,224 unit tests with 2 skipped across 295 passed and 1 skipped files, 111 headless Chromium scenarios with 2 skipped, typecheck, zero-warning lint, and a 577-module production build. Production-only and full npm audits both reported zero vulnerabilities.

## Verdict

Approved after the focus-trap, responsive-tooltip, state-synchronization, replay-unavailable, nested-Load-focus, and documentation repairs. The result is a compact icon-only visual surface over the same native buttons and behavior hooks, with textual meaning preserved through accessible names and focus/pointer descriptions rather than visible action labels.
