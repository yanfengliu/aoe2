# Review 0: implementation (M1)

## Target

aoe2, work 148 M1: DE's production queue in the HUD (icons, a consecutive run of one kind stacked into one with its count, one bar for the item in production under "Creating"/"Researching" and its percent, and a unit the population holds drawn red with "You need to build more houses."). Commit `78f48002` on branch `de-hud-1106`, its diff against `72f7266e` for `src`, `tests`, `scripts`, `design` and the plan (the devlog and changelog left out), reviewed at the branch's head `f5b62c7e`, which only merges main's docs-only commits.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane (codex-cli 0.163.0), from a run folder under fleet's ignored `tmp/review-runs/`. The prompt gave the task's criteria and asked it to look at the stacking, the active entry against `productionQueueSystem.ts`, the percent, a blocked state misreported, stale DOM, injection from labels, anything that could move a command button or cover the minimap, accessibility, the CSS against the 1120px wrapped layout and the palette rules, the adapted tests, and the capture script's refactor; to cite a file and line for every finding and at least one outside the diff. The sandbox check passed (no failed command in its log). Its report cites `productionQueueSystem.ts:153` and `tooltips.ts:248-309` outside the diff. One caveat on coverage: while it ran, the worker began the tooltip repair below in the same tree (`tooltips.ts` split, a new test file); the report says it "excluded concurrent tooltip edits", and its tooltip citations match the reviewed revision.

## Reports

### Codex (`gpt-6-astra`)

Three P2 and one P3. The report, redacted only of its absolute paths:

1. P2: the active icon's progress fill is invisible. `styles.css:501` styles an empty inline `<span>`, so its percentage width and height have no effect; the DOM test checks the width attribute, not rendered geometry. Fix: `display: block`, and check that the fill has visible dimensions.
2. P2: population changes can leave the housing message stale. `selectionPanel.ts:230` renders from the population, which is not in the signature, and the unchanged-signature return at line 197 runs before it is read. Reproduced: a blocked queue at population 200/195 still says "You need to build more houses." after the housing reaches 200/200. Fix: put the population in the invalidation and test a population-only update.
3. P2: fallback labels can inject HTML attributes. `productionQueue.ts:135` interpolates unescaped strings into `data-queue-entry`, `data-tooltip` and `aria-label`; with the type fields absent they come from `entry.label`, which `hydrateFromSavedGame.ts:296` keeps from a save. A label holding `" data-review-injected="yes` adds an attribute. Fix: the existing `escapeHtml`, with quote and markup cases.
4. P3: floating-point rounding understates some percents. `productionQueue.ts:77` gives 57% for 145 of 250 ticks, mathematically 58%, since dividing first yields 57.99999999999999. Fix: multiply by 100 before dividing.

It also reported: production scheduling checked at `productionQueueSystem.ts:153`; `tooltips.ts:309` accepts the spans through `[data-tooltip]`, and lines 248-275 place their tooltips above the bar and clear of the minimap; `TICKS` chunking is unchanged; every HUD token used is declared. It ran no browser or full gate.

## Findings and disposition

All four repaired, each with a test red on the reviewed source (the cases written first, run before the repair; and a mutant per repair, `tmp/mutate-m1.mjs`).

1. FINDING-1 (P2): `.hud-queue-icon__progress-fill` is a block. Test: the browser spec's three viewport cases measure both fills as rendered, each within about 1.6 points of the simulation's percent; red with the `display: block` taken out (mutant `r1-inline-fill`).
2. FINDING-2 (P2): the panel reads the owner's population through a new dep, `getPopulation` (the bridge's `getPopulationState`, wired in `createHudController.ts` and `createApp.ts`), only while a queue is drawn, and puts it in the signature. Test: a DOM case moves a held queue's population from 200/195 to 200/200 with the selection unchanged and expects "Population limit reached."; red before the repair and with the population out of the signature (mutant `r1-no-population-signature`).
3. FINDING-3 (P2): the entry, the tooltip and aria-label, and the status label's name go through `escapeHtml`. Test: a DOM case with a label holding a quote, an attribute and markup finds no injected attribute and no `<b>`, and the label as text; red before the repair and with the entry unescaped (mutant `r1-unescaped-entry`).
4. FINDING-4 (P3): the percent multiplies by 100 before dividing. Test: 145 of 250 ticks reads 58%; red before the repair and with the old formula (mutant `r1-divide-first`).

Found by the worker during the round, outside the report: a tooltip on any control the panel redraws vanished at the redraw, so while a building trained (15 redraws a second) a hovered queue icon or Train Villager showed its tooltip for one frame in twenty (`tmp/probes/queue-tooltip-hover.mjs`, a lobby match at 1280x720). The tooltip controller now finds the same control again after a redraw by its key (a command's `data-command`, a queue icon's `data-selection-queue-item`), and the copy factories moved to `tooltipCopy.ts` to keep `tooltips.ts` under its 500 lines. Tests: `tests/ui/tooltipFollowsRedraw.test.ts` (two cases red before, two controls green on both) and a browser case hovering the active icon and Train Villager across four redraws, each sample read in the frame after the ticks; both red with the old line put back (mutant `tooltip-drops-redrawn-host`; the browser case's first form, which read the tooltip after waiting on frames, stayed green there, since the browser's own later hover update re-showed it, and was rewritten). The same browser case then found the repair's own defect: the browser still held the replaced element as hovered, so moving the pointer away sent no pointerout the HUD heard and the tooltip stayed up over nothing. A document-level pointermove now releases the pointer's claim when it lands outside the control; a DOM case and the browser case's last check are red without it (mutant `tooltip-sticks-after-leave`).

## Verification

Recorded in plan 148 with the gate on the repair.

## Round outcome

Three P2 and one P3, all repaired, each with a test red without its repair; the tooltip defect found during the round repaired the same way. Round 1 ([record](1_implementation.md)) checked the repairs.
