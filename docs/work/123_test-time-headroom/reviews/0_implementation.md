# Review 0: implementation

## Target

Repository aoe2, work 123 M2 (the CI per-test headroom gate and the first round of browser-spec cuts). First `fc7d2667`, `bc032866` and `5369c780` on main `80ac4a95`; then the same work rebased on main `ea704401` as `0109199f`, `95c6d01b` and `97ff948e`, whose diff outside `docs/` the reviewer found byte-identical to the first. `97ff948e` stays recoverable on the remote branch `test-time-headroom-m2c`. The reviewer also read one uncommitted fix, the register's "three pages".

## Reviewers and coverage

- **One independent read-only reviewer**, a Claude subagent dispatched by the implementer, with the worktree, git, `gh` and the CI job logs. It ran no tests. A usage limit stopped it before it reported; it was resumed with its context and asked to cover the rebased commits too, and to say what would make the reports harder for work 124 M2 to extend.
- **Not covered:** the reviewer did not re-derive the 0.7-0.9 s snapshot cost or the 0.57-1.32x runner spread.

## Reports

### Claude subagent (read-only)

Its report, as delivered, with formatting kept:

> **1. should-fix, close to blocking: the specs are not "well inside" the line this gate draws.** On the two green runs the docs cite, these tests ran close to the line: barracks rush 57% and 58% (jobs 114762800937, 114756348702); game-progression-and-production:4 53% and 56%; placement-mode-hud-layout:232 55%; unitMotionPersistence on Windows 54% (job 114762800807). Identical code ran 1.86x slower on one shard-1 runner than on the other: command-deck-fits.spec.ts:364 took 17.3 s (58%, job 114756348896) and 9.3 s (31%, job 114762800879). The docs say the slowest runner is 1.32x the median, so a test stays green everywhere only at about 50% or less of its limit. Expect this gate to turn main red on slow runners. Decide before landing: make those tests cheaper, or record the reds you expect. The subject line of 95c6d01b and the register's bound ("a runner slower than any yet seen") overstate the margin.
>
> **2. should-fix: the cited CI runs did not run the tree being landed.** Run 38232871315 ran 6bec6d05, which predates the advanceTicks change and the three-page command bar. Run 38234822418 ran 83940c23, which still has two pages. Neither run includes the rebase. They are cited in the 95c6d01b message, plan.md:71 and devlog 2026-10-12_2026-10-12.md:27-28. Run CI on the landing tree and name the commits.
>
> **3. should-fix: a devlog number is wrong.** Devlog :29 says "at most 47% on windows-latest", but job 114762800807 printed 54%.
>
> **4. should-fix: things that would make work 124 M2 harder.** No run outcome is written: vitestTestTimeReporter.ts:50 drops `unhandledErrors` and `reason`, and durationBudgetReporter.ts:194-197 drops `result.status`. A cancelled vitest run still writes a report, and :66 records its unrun tests as 'skipped'; a run that failed only on unhandled errors writes every test as passed; a "no failures, nonzero count" check would accept both. Adding fields is safe, because the judge only requires `tests` (test-time-headroom.mjs:150). The judge uses a denylist: it treats every state except 'skipped' as measured (:82); make it an allowlist before adding a 'pending' state, or unrun tests count as measured at 0% and get past the "nothing measured" guard. A test pins the vitest reporter list: testTimeHeadroom.test.ts:273 requires exactly the two current reporters, so adding any vitest reporter fails it; the Playwright check at :278 matches a substring, so a third reporter entry passes but options on this one do not. Playwright runs onEnd in list order (multiplexer.js:67-73): a reporter that reads playwright.json in its own onEnd must come after this one; reading the file in `verify-receipt write` avoids that. A partial vitest run overwrites vitest.json and leaves no mark of its filter, one example being the `npx vitest run tests/architecture` that verify-receipt-lib.mjs:219 recommends; so the only proof the file came from this run is `start` deleting it.
>
> **5. nit: the job-level time check is skipped whenever the per-test check fails.** ci.yml:166 and :327 keep the default success condition. On run 38181131359, job 114593734216, step 14 succeeded, step 15 failed and step 16 was skipped. The per-test step also runs after a typecheck, lint or build failure and adds a misleading "no test-time report" error.
>
> **6. nit: the measured duration covers more than the time limit does.** Vitest's duration includes beforeEach/afterEach, which run under the 180 s hookTimeout. Playwright's includes the after-hooks slot, which has its own timeout (workerMain.js:332-333, 400). This makes the gate stricter, not weaker, but the header at :41-43 says the limit covers those hooks. The header at :20 is also off: two thirds × 1.5 is exactly the limit, so such a test would not "still finish".
>
> **7. nit: the splits lose some sequences.** selection-panel-height no longer goes from the scout to the Town Centre, or from the House to the sheep; only group 3 ends with "nothing selected again" (:263), so add a closing clear to groups 1 and 2. The claim at :45 that all three pages share one reference is prose only; nothing checks it. resource-workers (:123) no longer relabels and re-hovers the same readouts at 6, 7 and 16 digits, so a tooltip that caches its text would pass.
>
> **8. nit: the placement search now sees the HUD as of before the call.** It runs in one call with no frame drawn in between, and the HUD redraws in its own frame loop (createHudController.ts:433). Callers that first wait for `[data-placement-mode]` are safe; resource-workers:96-97, game-rendering-and-world:23-24 and de-command-surface:189-194 do not wait. Risk is low while the bar keeps its fixed height.
>
> **9. nit: leftover cost and stale comments.** The Monk polls (game-progression-production:151, :186) return the whole advanceTicks snapshot only to read economy state, which the new local rule forbids. The comment at :193-203 and the second pause at :204 are stale. Art-style test 1 returns a whole captured frame and never reads it.
>
> **10. nit: stale or wrong docs.** gate-proofs.md:114 still says "four tests". Devlog :21 says "17 states"; there are 16. Devlog :7 still says rebased on 80ac4a95. The 97ff948e message says the replay-adapter entry rolled over; it was the recording-connections entry. art-style:172 says the choice "survives a reload", but nothing reloads. The summary compaction filed the Linux-CI line, which had no version, under v0.3.210. The reporters' "under the root" comments don't match their paths, which are relative to the working directory.
>
> **Verified correct.** Vitest's `task.timeout` is the value vitest enforces (@vitest/runner 3.2.6, chunk-hooks.js:606-641), and the reporter fails if it is missing. Playwright updates `test.timeout` before onTestEnd (dispatcher.js:261) and leaves beforeAll out of the duration. A missing, empty or all-skipped report fails the step. Run 38181131359 failed this step in both unit jobs (Windows 99% and 88%, Ubuntu 73%) and in browser shard 4. All 54 changed advanceTicks lines threw their result away before. The hud-opaque, command-deck and art-style splits keep every assertion. At boot the renderer reads only `aoe2:art-style` (AoeVoxelWorldRenderer.ts:159), so testing at the stored value is equivalent to the old click-then-reload chain. The Monk's income check is unchanged. The new Escape wait gives at least 400 ms of game time at any frame rate. The in-page placement search keeps the same candidates, order, checks and messages. Dropping the forced sync puts no spec at risk. The uncommitted "three pages" fix is right.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | Specs near the line on slow runners (report item 1). | Accepted. Probes 3 to 5 confirmed the spread. | Round 2 of cuts (devlog 2026-10-14); the tests still nearest the line are named in the register's bound. Re-reviewed in round 1. |
| F1 | Cited CI runs did not run the reviewed tree (item 2). | Accepted. | The devlog and plan name each run's tree; CI ran on the rebuilt tip and on the final tree. |
| F2 | Devlog said 47% on windows-latest; 54% was printed (item 3). | Accepted. | Corrected, with the unit side's figures restated from later runs. |
| F3 | Reports hard for work 124 M2 to extend (item 4). | Accepted. | Reports carry `outcome` and `argv`; the judge is an allowlist; the vitest config check reads the config's list and the Playwright check accepts options; the reporter's header says a reader must come after it. Deleting stale reports at `start` is left to work 124. |
| F4 | Job-level check skipped after a red verdict; verdict run after earlier failures (item 5). | Accepted. | ci.yml: the suites have ids, the verdict runs when its suite ran, the job check on `!cancelled()`; the ci.yml case went red with the old condition. |
| F5 | Header overstated what the limit covers and that a test "still finishes" (item 6). | Accepted. | Header corrected. |
| F6 | Splits lose sequences; the shared reference is prose only; readouts no longer relabelled (item 7). | Accepted. | Closing clears; the "shared reference" claim withdrawn; in round 1's repair two lost transitions restored unmeasured and the readouts relabelled and re-hovered in each amount test. |
| F7 | Placement search reads the HUD as drawn before the call (item 8). | Accepted as a recorded risk, not changed. | Recorded in the devlog; three callers named by the report do not wait for the placement pill. |
| F8 | Monk polls ship whole snapshots; stale comment and pause; unread frame (item 9). | Accepted. | Polls step with `stepTicks` and read the economy in the page; the comment reworded and the pause kept as a stated precaution; no frame is returned unread. |
| F9 | Stale docs (item 10). | Accepted. | All corrected; the commit message's wrong entry name is left in the unmerged commit and named here. |

## Verification

On the repair, the rebuilt tip `516e0198` over main `9e4a320b`: run 38604015435 green on all six jobs. The gate's tests (19 cases) and `browserTestStepTicks.test.ts` (5) pass, and named mutations went red (devlog 2026-10-14). The changed browser specs passed locally on SwiftShader.

## Round outcome

Nothing blocking; four should-fix findings and six nits, all taken. F0 needed a second round of cuts and is held by the register's bound rather than closed outright. The repair went to a focused re-review, round 1.
