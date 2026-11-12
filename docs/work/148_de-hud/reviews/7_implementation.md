# Review 7: implementation (the menu's labels)

## Target

aoe2, work 148, the in-match menu's labels: commit `7b58d9c9` on branch `de-hud-menu-1111`, the merge of main `0f76b94b` into `62dff1ad`; its diff from main is the change (sixteen files: `src/ui/hud/gameMenuCaptions.ts`, `hudTemplate.ts`, `gameMenu.ts`, `icons/menuGlyphs.ts`, `src/styles.css`, `src/hudIcons.css`, five browser test files and the unit file, spec §14.1, the README, the changelog and plan 148).

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane (codex-cli 0.163.0), from a run folder outside the reviewed tree, the diff appended to the prompt. The prompt asked for defects with a file and line each, in five parts: the product (whether `--hud-menu-height` is the real sum, whether any height is still left to a font, whether any text can still resize the menu, the settings row's grid, the top and the ceiling at every window height and the tooltip lane, anything still assuming the old grid, width, centring or place of the Load form); the Load form's move (focus, the Tab wrap, Escape, a successful Restore, the disabled states); the tests (vacuous or weakened assertions, the folded white space, flakiness on Linux CI, false claims in headers, defect classes no test would catch); the other specs that open the menu; and the spec, README and changelog against the code. It named the coordinator's terms as not under review and the four known limits (two accessible names that do not contain their captions, Space, a real browser's scrollbar, the list scrolling with the Load form open). The tree's `git status --porcelain` and `git diff HEAD` were empty before the run and after it, and the head was `7b58d9c9` at both. The run's log holds no sandbox failure. No Claude lane was run.

## Reports

### Codex (`gpt-6-astra`)

The report whole, redacted only of its absolute paths (each link's target is given as the path and line it named).

Reviewed `7b58d9c95a3e169672291bc187f0250037e1f8a9`; the working tree remained clean. I found three P2 issues and one P3 documentation issue, with no confirmed product regression at the three required viewport sizes.

1. **P2 — The Load-form Tab test can pass without reaching Technology Tree.** At `tests/browser/de-game-menu-load-form.spec.ts:116`, the destination assertion runs only if focus leaves the form. Cycling through its four controls twice exhausts eight iterations, ends on Cancel, and satisfies both subsequent assertions. Skipping the textarea and Restore can also pass. **Smallest repair:** assert the expected sequence of enabled controls and unconditionally assert Technology Tree has focus afterward.

2. **P2 — The stress test never exercises long setting names.** `tests/browser/de-game-menu-text-room.spec.ts:102` changes action captions and setting states, leaving setting labels untouched despite the preceding comment claiming otherwise. Consequently, removing clipping specifically from setting labels would escape this coverage. **Smallest repair:** add long-name-only and long-name-plus-long-state cases, checking ellipsis, unchanged geometry, and no horizontal overflow. Keep the existing real-name/long-state case.

3. **P2 — The authoritative spec still requires icon-only menu actions elsewhere.** `design/spec-final.md:2119`, outside the diff, still says menu icons are the “sole visible action-name affordance.” This directly contradicts the revised §14.1 and implementation. **Smallest repair:** update that sentence to describe glyphs accompanying visible captions, retaining the accessibility guarantees.

4. **P3 — The shape paragraph overstates the Load-form guarantees.** `design/spec-final.md:2010` promises the whole form is visible “at every size” and describes every open-form menu as 822px tall. At 800×500, the default paste form ends at approximately y=429 while the panel ends at y=408. With browser storage selected, the textarea is hidden and the natural menu height is 732px instead. **Smallest repair:** qualify 822px as the unresized paste-form case and bound the whole-form visibility claim to the verified sizes.

The principal layout arithmetic is sound: `2 + 38 + 24 + 24 + 28 + 10×44 + 9×4 = 592px`. Opening the default paste form adds `220 + 6 + 4 = 230px`. The ceiling ends at `viewportHeight − 92`, preserving the tooltip lane; `src/ui/hud/tooltips.ts:153` then applies the 8px placement gap. The 692px closed-menu threshold is correct. One numeric qualification: rounding makes the 822px form fit at **1151px**, while the unrounded fallback needs 1152px. That fallback also permits half-pixel tops at odd heights.

At the intended widths, closed-menu vertical dimensions have pixel line heights and no wrapping dependency. The settings grid gives long states the remaining space and permits long names to shrink and ellipsize. The later stylesheets introduce no surviving three-column layout or competing dimensions; the scoped Load-form rules override its shadow and blur.

The Load move preserves hook-based wiring and DOM-based focus traversal. Successful Restore re-enables Load before returning focus through the existing close routine (`src/ui/hud/saveLoadPanel.ts:251`). I found no move-induced change to Escape, disabled-state handling, or either Tab boundary.

The requested existing consumers show no layout-dependent break by inspection:

| Consumers | Relevant behavior |
|---|---|
| `tests/browser/art-style-setting.spec.ts:158` | Locator click at 1280×720; no old coordinates. |
| `tests/browser/game-combat-and-meta-meta.spec.ts:237` | Hook-based Load/Restore; explicitly checks returned focus. |
| `tests/browser/de-command-surface.spec.ts:250` | Keyboard layer ordering, independent of layout. |
| `tests/browser/replay-load-dialog.spec.ts:22`, `tests/browser/replay-scrub.spec.ts:60`, `tests/browser/voxel-renderer.spec.ts:280` | Locator clicks on Replay, which remains above the fold. |
| `tests/browser/attack-warning.spec.ts:184`, `tests/browser/attack-warning-replay.spec.ts:94`, `tests/browser/attack-warning-replay-exit.spec.ts:164` | Hook-based Save/Load/Replay interactions. |
| `tests/browser/de-ground-frame-cost.spec.ts:100` | Programmatic setting click; visibility is irrelevant. |
| `tests/browser/civ-compendium.spec.ts:17`, `tests/browser/tech-tree-viewer.spec.ts:13` | Locator clicks on rows above the fold. |
| `tests/browser/hud-opaque-surfaces-swallow-clicks.spec.ts:48` | Explicitly excludes the unopened menu and Load form. |

The original 44px assertions remain unchanged. Whitespace folding does not materially weaken the visible-caption contract; separate browser assertions check line count and geometry. The wheel helper’s failure path can spend approximately 26 seconds waiting, but I found no demonstrated normal-path timing defect.

I inspected retained full-resolution menu and Load-form captures. I did **not** rerun tests, mutants, gates, or Linux/SwiftShader timing, verify DE’s installed strings, or generate fresh screenshots. `ci:status` could not reach GitHub because network access was blocked.

**Verdict: Request changes for the two test gaps and conflicting spec; no confirmed product regression at the required sizes.**

## Findings and disposition

- **R7-1 (P2), repaired.** The Tab loop in `tests/browser/de-game-menu-load-form.spec.ts` required only that the last stop inside the form be Cancel, so a Tab that went round the form twice, or skipped the paste box and Restore, passed. It now presses Tab five times and requires the stops to be exactly the pasted source, the paste box, Restore, Cancel and Technology Tree, then that Technology Tree has the focus. Red proof: a paste box that Tab skips (`tabindex="-1"`), red at that sequence at all three sizes.
- **R7-2 (P2), repaired.** The long texts were a caption on every action and a state on every settings row; the comment claimed a name too, and no case wrote one, so a setting's name that stopped being clipped went unseen. `tests/browser/de-game-menu-text-room.spec.ts` now also writes a name eight times as long into both settings rows, first beside the long state and then beside the real one, and requires the name cut on one line, the state keeping its floor of 35px ("off" whole), the name ending before the state starts, and the panel and every row unmoved. The comment says what is written. Red proof: `overflow: visible` on a settings row's name, red at the long name at all three sizes.
- **R7-3 (P2), repaired.** Spec §14.5's summary of the icon slices still said game-menu actions "intentionally use icons as the sole visible action-name affordance". It now says the menu's glyphs sit before their rows' visible names since work 148, with the earlier state as history. The worker's search before the review had looked for "icon-only", "Quit to title" and "Restart match" and missed this wording.
- **R7-4 (P3), repaired.** Spec §14.1's shape paragraph said the Load form is whole and in view "at every size" and that the list with the form open is 822px. It now bounds the first to the three sizes measured, with the height under which the form's foot is cut (522px), and gives 822px as the form with its paste box and 732px without. The reviewer's other number, that the rounded top lets the 822px panel fit from 1,151px where the unrounded fallback needs 1,152px, is why the paragraph, the plan and the changelog now say "about 1,150px".
- **Noted, not a finding.** The wheel helper's failure path could wait about 26 seconds (twelve turns of two seconds), close to a test's 30-second limit: a turn now waits one second, so a panel the wheel cannot scroll fails by name in twelve. And the unrounded fallback permits a half-pixel top in a window of odd height, which the style sheet's comment already says.

## Verification

The repairs are in the commit that adds this record. The three menu specs pass with them (eleven cases), and the two mutants above are red against the repaired assertions and nothing else. The reviewer's reading of the arithmetic (592px closed, 230px for the form, the ceiling ending at the window's height less 92px, the 692px threshold) agrees with the measured numbers in plan 148. The full gate ran on the repaired tree (plan 148's Outcome). The repairs were not sent to a second round: two are test assertions made exact, each with its own red proof, and two are wording in the spec.

## Round outcome

One round, one lane: no finding in the product at the three sizes, two P2 findings in the tests and one in the spec, one P3 in the spec, all four repaired. The reviewer read the other thirteen specs that open the menu and found none that the new layout breaks.
