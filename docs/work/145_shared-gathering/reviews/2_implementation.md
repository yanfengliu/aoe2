# Review 2: implementation

## Target

aoe2 commit c063fd2d on branch `shared-gathering-1105` (work 145 M1), reviewed as `git diff e4791912..c063fd2d`: round 1's repairs (the staggered Farm case asserting who farms what, the relic case's premise read from the shared cell, spec §6.9's relic sentence).

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from the worktree's ignored `tmp/review-runs/145-r2`. The lane is valid: its log's two `STATUS_DLL_INIT_FAILED` matches are lines of round 0's record that it read; it cited `moveDestinationSearch.ts:214` outside this round's diff, ran both focused files (22 tests) with its own instrumentation and an in-memory mutation, and changed no file (HEAD stayed c063fd2d).
- One lane, Codex preferred by the brief.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

- **Low — [design/spec-final.md:561](design/spec-final.md:561): contradictory relic movement rule.** The retained sentence says a unit beneath a relic "could not walk off it," immediately before the new sentence says it can. Scenario: load an old save with a ground relic under a Monk, then order the Monk onto adjacent open ground without picking up the relic; §6.4 and the implementation allow that (`moveDestinationSearch.ts:214` exempts the starting cell). Remove the obsolete inability claim or mark it as behaviour before work 145. The rule preventing new drops beneath units can remain.

It confirmed both test changes: the Farm case pins the chosen rule (instrumented: the newcomer gathered F1 while the farmer was in `to-dropoff`, then the farmer gathered F2), and a Farm reserved through the delivery fails it at `sharedGathering.test.ts:209`; the relic case's shared-cell premise stages the legacy save, and pickup, the accepted move, arrival and possession stay asserted, with nothing weakened beyond the premise the fix invalidates. Verdict: changes needed (the low finding).

## Findings and disposition

- **R2-1 (low), accepted and repaired.** The sentence now reads that such a unit would stand on blocked ground and "until work 145 it could not walk off it; since then it can, §6.4". The rule that a relic never lands under a unit stays.

## Verification

A wording change in the spec, checked by reading it beside §6.4 and by the work-docs content checks; no code changed in this round, and `npm run verify` on c063fd2d passed with its receipt (tree 935e666f29a7).

## Round outcome

One low finding, accepted and repaired. No re-review: the repair is one sentence of the spec, with no code or test change.
