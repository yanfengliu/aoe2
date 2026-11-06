# Review 0: plan (the M1 study and design)

## Target

aoe2 commit bd61f050 on branch `ai-train-reasons-1106` (work 151 M1), reviewed as `git diff 4bd1978b bd61f050`: plan 151's study, design and proposal, spec §13.2's design paragraph and its edited sentence, and plan 106's dated "(work 151)" lines. Docs only.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from a run folder in the worktree's ignored `tmp/review/r0/`, with the worktree as `--cd`; no sandbox failure in its log. The prompt asked for at least fifteen DE citations read in the installed scripts, the fog quote checked in DE's installed manual, the code claims checked in `src/`, consistency with spec §13.1 and §13.2 and plan 106, and handicaps brought in or missed. Its findings cite the installed scripts and `src/` at lines outside the diff (`tsa.per` 2385-2388, `units.per` 11781, `ai.ts` 125, `aiSiegePhase.ts` 80-90).
- One lane, Codex preferred by the brief. Verdict: request changes.

## Reports

### Codex (gpt-6-astra)

1. **R0-1, High: the resets omit what selects the family.** The "attacked in town" reset (T 2402-2416) is skipped unless `retreatnow` is already yes (T 2385-2388), and the retreat rule's own conditions (T 299-327) were cut short. Verified in the scripts. Fixed: plan 151 item 3 now says a 1v1 flush turns "usual" only once its army is ordered to retreat, with the retreat's conditions in full; M3's trigger and expectation, spec §13.2 and plan 106 follow.
2. **R0-2, High: shared rules missed.** The Hussar against siege (U 6749-6763) and the Mangonels on a flank or under attack (U 1438-1475) ask no `milunits yes`, so they run under the flush too. Verified. Fixed: item 2 lists them as shared; the Scout mapping, the M2 expectations and spec §13.2 no longer say no Scout trains under the flush.
3. **R0-3, Medium: the Castle Age archer rule's alternatives were written as cumulative.** U 9400-9412 is 120 gold with no Blacksmith or Bodkin Arrow, or 220 gold, or superiority under 0, or Bodkin Arrow and Crossbowman. Verified. Fixed in item 4, with an M2 fixture test for it.
4. **R0-4, Medium: the Spearman test contradicted U 9271-9288,** which trains Spearmen under 6 at 2 enemy cavalry. Fixed: the fixture test is 2 Scouts to 6, and the M2 expectation says 2 or more cavalry.
5. **R0-5, Medium: the mix has no Skirmisher after the Feudal Age** (`ai.ts` 125), so the flush's Castle rule never reaches a producer. Verified. Fixed: M2 adds the Skirmisher line to the Castle and Imperial mixes (mapping, design, spec).
6. **R0-6, Medium: the default unit is shared, not "usual", and Easiest skips it** (`#load-if-not-defined DIFFICULTY-EASIEST`, U 11781-11918). Verified. Fixed: item 5 marks it shared, M2 takes it, item 8 and spec §13.2 name the Easiest gate, and spec §13.1's list gains it as a handicap not adopted.
7. **R0-7, Medium: `siegereq` was named but not mapped.** Fixed: item 2 states it (I 4154-4179; the train actions U 13283-13305, 13410-13430), the mapping applies this AI's `siegeNeeded` to the mix in M2, and an M2 fixture test covers it; its `allowed-num-military` branch is named as the lower levels' handicap.
8. **R0-8, Medium: plan 151 left the ram goal's fog-free tower count out while plan 106 assigned it to M2.** Fixed: both now say work 151 leaves the ram goal's census, and so superiority, as it is, and plan 106's card stands on its own.

## Findings and disposition

All eight findings were fixed in the commit after bd61f050; the fixes were not re-reviewed (a second round was not run, within the brief's context limit). Minor points the review did not raise and left as written: the generic family's Mangonel rules at U 1611-1656 are cited with their family untraced, and the knight deficit at U 4639-4651 is gated through the jump at U 4628-4638 rather than asking `milunits yes` itself.

## Verification

The worker read each finding's citation in the installed scripts in this session (`tsa.per` 2385-2388, 299-327 and 1450-1459, `units.per` 6749-6763, 1438-1475, 9400-9412, 9271-9288, 11781 and 11918) and in `src/` (`ai.ts` `pickUnitMix`, `aiSiegePhase.ts`'s defence count). Not re-read by the worker: `siegereq`'s rule (`init.per` 4154-4179) and the train actions that ask it (`units.per` 13283-13305, 13410-13430), cited from plan 147 and `aiSiege.ts` and confirmed by the review. After the fixes, `npx vitest run tests/architecture` passed with the edited files staged, which runs the content checks `checkoutLineEndings.test.ts` and `workDocsIntegration.test.ts`. No game, match or measurement was run; none was needed for a docs-only round.

## Round outcome

Request changes, all eight findings fixed in the commit after bd61f050; not re-reviewed. M1 goes to the coordinator for its decision with this record.
