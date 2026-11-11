# Review 6: implementation (M3a, round 5's repairs)

## Target

aoe2, work 148 M3a: commit `aef9a455` on branch `de-hud-m3-1111`, the repairs of review round 5 ([record](5_implementation.md)): the diff from `d18c1e48` in `tests/simulation/placementRefusalKinds.test.ts` and `tests/browser/de-placement-refusal.spec.ts`.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane (codex-cli 0.163.0), from a run folder outside the reviewed tree. The prompt asked, for each of R5-1 and R5-2, whether it is repaired and whether the repair holds what it claims: any branch of a builder that no combination produces, whether the "all sentences of a kind are distinct" assertion is sound, anything still read from the transient toast, whether measuring inside the observer's callback is sound, whether the log can miss or double-count a toast, order dependence, and any assertion the rewrite weakened. The tree's `git status --porcelain` and `git diff HEAD` were empty before the run and after it. No Claude lane was run.

## Reports

### Codex (`gpt-6-astra`)

The report whole, redacted only of its absolute paths.

**R5-1 is repaired. R5-2's expiry race is repaired, but its layout measurements need one minor correction.**

- **R5-1:** No current branch in `placementRefusal.ts` is missing from the matrix. It covers all three unreachable openings with and without suggestions, both fog verdicts, and every other builder conditional. The live case explicitly checks a real unexplored refusal without a suggestion.

  In-memory evaluation produced **1,020 distinct, correctly recognised combinations**, including the expected building. The previous reviewer's mutation now produces five unrecognised rows that the assertions reject.

  The uniqueness assertion at `tests/simulation/placementRefusalKinds.test.ts:120` is sound **for these inputs**. Each varying input currently changes the sentence. It does not prove exhaustive coverage by itself: adding another positive unexplored count would legitimately duplicate the existing positive-count wording, and a new conditional on an unlisted value still requires another test input. The header acknowledges that limitation.

- **R5-2:** The observer is installed before the relevant clicks, and captures text and geometry before a timer task can remove the toast. Subsequent assertions read saved values. The remaining live-toast assertion waits for zero elements, a persistent outcome, so expiry helps it rather than racing it.

  Layout reads synchronously obtain geometry inside the callback. Text restoration is safe: observation uses `childList: true` on the **container**, without `subtree`, so replacing a toast's text generates no observed records. The current controller fully populates each toast, appends it once, and later removes it; therefore this observer neither misses nor double-counts those insertions.

  Comparing the complete log introduces no case-order dependence here. Each test has a fresh page, and the three-click case awaits each expected prefix before clicking again. Slow execution does not erase earlier entries.

**R6-1 — P3: Room measurements capture the entry transform, overstating settled clearance.** `tests/browser/de-placement-refusal.spec.ts:74`

The controller flushes the inactive style before setting the active attribute (`src/ui/hud/toast.ts:52`). CSS transitions from `translateY(-4px)` to zero over 200ms (`src/styles.css:614`). Measuring immediately in the observer captures the entry position, rather than establishing the settled position.

Consequently, `floor - bottom` can overstate clearance by 4px: the six-line assertion can pass when the settled toast falls short. Conversely, the top-bar assertion can reject a toast whose settled position fits. Width and height are unaffected by this translation. Settle the transition synchronously before measuring both copies.

The previous version also lacked explicit transition settling; the rewrite makes early sampling systematic rather than resolving that measurement limitation.

**Assertion preservation:** The rewrite retains the text, cardinality, height, placement-mode, disappearance and room thresholds, and strengthens kind/building checks. It drops some literal suffix examples, but those suffixes are interpolated without branching or recognition decisions. Beyond the transition issue, I found no weakened contract or new defect.

Checks were read-only: source inspection and in-memory matrix evaluation. No browser or full test suite was run; startup CI status was unresolved. No files changed.

**Verdict: R5-1 repaired; R5-2's expiry race repaired; address minor measurement finding R6-1.**

## Findings and disposition

- **R5-1 and R5-2: repaired, as the reviewer found.** The bound it states for the distinctness assertion is the one in the test's header: a builder given a branch on a value outside the lists needs the value added.
- **R6-1 (P3), repaired.** The measurement takes the toast's own lift off: the box's top and bottom are corrected by the vertical translation of its computed transform at the moment of measuring, so they are the settled toast's whatever stage its entry is at. The room's numbers move by 4px (at 800x600 the longest real sentence now has 225px above the bar and the minimap where 229 was printed, and the four-times copy 208px, 12.2 of its lines, where 212 was), far inside the margins asserted.

## Verification

The repair is in the commit that adds this record. The browser spec's six cases pass with it, and the full gate ran on that commit (plan 148's Outcome). R6-1's repair was not sent to a third round: it is one correction to a test's arithmetic, checked by the numbers moving by exactly the 4px the reviewer named.

## Round outcome

Round 5's two findings are closed and round 6's one minor finding is repaired. No finding in either round was in the product.
