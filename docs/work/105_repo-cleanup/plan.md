# Review and simplify AoE2

Status: complete
Owner: Codex integration owner
Created: 2026-09-30
Updated: 2026-09-30

## Problem and outcome

The owner requested a full repository review after preserving scattered progress on main, followed by cleanup of demonstrated code bloat and outdated or redundant documentation. Reduce unnecessary maintenance and verification work while preserving game behavior and authored progress.

## Scope

Survey all tracked source, scripts, tests, configuration, design inputs and documentation on main 79c11dab981208f03dbbd7cb21debdcfd2d5cdda. Deep inspection follows reference evidence and risky boundaries. Historical reviews/imports retain provenance; ignored dependencies, original recovery backups and active evidence are excluded. No feature expansion, dependency change or engine write. Main is the single serialized writing checkout, honoring the owner's request that all work land there and the sibling worktree folder stay absent.

## Approach

Three independent read-only Astra/xhigh domains cover simulation/contracts, app/render/input/playtest, and tooling/docs/tests. Combine complete inventories and import/reference scans with focused manual inspection; record actual coverage rather than imply every line was read. Accept evidence-backed simplifications, assign one writer at a time, obtain independent review of final changes and run appropriate gates once per coherent code increment. Preserve all earlier assertions and timeouts. Work records have one status plan and concise chronological review rounds; current guidance belongs in canonical docs.

## Acceptance criteria

- [x] Every tracked area receives a recorded survey; concrete findings and skipped manual areas are explicit.
- [x] Remove supported dead/duplicate code or redundant setup and correct stale/redundant current docs, with source and consumer evidence and no lost historical progress.
- [x] Relevant focused checks and the required final code gate pass, independent integrated review resolves material findings, and executable pushes receive remote verification.
- [x] Changes are committed and pushed on main; only main and the primary checkout remain, no sibling worktree folder or owned browser/server process remains.

## Implementation steps

- [x] Inspect remote status and repository instructions; inventory the complete tracked population. Consolidation's corpus, Linux CI and four browser shards passed; Windows CI exposed two temporary-root alias controls. The minimal repair has focused red/green evidence and independent acceptance in assignment 104 review 7.
- [x] Reviewers survey their domains and return supported findings, contracts and coverage limits; authored reports are retained in reviews 0 and 1.
- [x] Integration owner accepts a bounded cleanup; serialized worker implements it on main and updates affected canonical records. Reviews 3 through 5 accept the actual ownership repairs, notification order and strengthened atomic-replacement protocol test. Corrected document/index preparation passes its complete companion. The complete combined gate passed on the final code tree; hosted acceptance is GREEN.
- [x] Review the final change, verify appropriate contracts and push main 71a7b393. The complete local gate passed; hosted acceptance is GREEN. Close with measured changes and limitations.

## Outcome

v0.3.241 is committed and pushed on main as 71a7b393579989f0f175bae4b0cfc83c1d7d4ea2. The exact staged tree 4b326fe51c3f4a710fccdd3045f2ef5a0d4a308d passed the complete primary npm run verify: content validation, 4268 unit passes with three skips, typecheck, 230 browser passes with two skips, lint and build. The run finished in 13 minutes 45 seconds and released all 84 owned descendants. Reviews 0 through 5 preserve the survey, rejected targets and independent code acceptance; no material code finding remains. One prior gate was intentionally stopped after 3 minutes 15 seconds before later stages; another completed red with three failures in the review heading, index-backed line-ending preparation and old replay-replacement protocol expectation. The corrected full pass is separate from both. Hosted corpus 36697741027 is green; CI 36697741103 acceptance is GREEN. Docs-only closure receives focused review and affected content/hygiene checks before its commit. The staged audit inspected 32 changed production files: 345 added and 371 removed lines, a net reduction of 26 including the ownership repairs. New regression tests and authored review records grew; this is a production-source count, not a claim that Git or total storage shrank. DT-03 sharing of duplicate 45,000-tick suites was declined because projection/census equivalence was unmeasured.

Consolidation revision 79c11dab is on main with only main locally/remotely and no aoe2-worktrees folder. Original archives, source copies and branch ancestry are preserved. This assignment and consolidation share final hosted acceptance GREEN, while retaining separate plans and authored reviews.

2026-09-30 documentation acceptance: independent closure review found no new issue. Content validation, version consistency and all 150 architecture checks passed on the staged documents. Final metadata supplements are checked before the documentation-only commit; its automatic runtime CI is separate from verified code 71a7b393 and is not awaited under fleet R9.

## Fixed failure checks and disqualifiers

Independent review exposed the real app boundary omitted by controller-only rollback doubles. For APP-F4, a failed incoming presentation through the actual app/view replacement must leave the app and view on the committed outgoing bridge, preserve its presentation and controls, and keep replay tick, playback, perspective, callbacks and saved live pause usable. A successful swap must commit once and release only superseded resources. Compare validation-before-publication and checkpoint/rollback mechanisms against those same checks; investigate them independently before combining conclusions.

For APP-F5, begin a lazy prior-session read while stopped, delay database-open completion, request stop, then complete opening. Reads must settle according to their contract, stop must release the resulting connection/timer, and a later restart must remain usable.

Disqualifiers: a replacement double throwing before any real view mutation; swallowing the original error; losing outgoing presentation or controls while only the controller survives; a timed-out or still-running resource reported as closed; dropping the lazy read or periodic snapshot assertions; weaker case/population/history checks; source fixes outside the repository or a new persistent branch/worktree. The scope is these actual ownership boundaries, not a renderer or persistence rewrite.

## Mechanism comparison

Two fresh read-only investigations compared unpublished preparation with checkpoint rollback. Merely delaying the app assignment or prevalidating a bridge misses mutations in presentation, adapter histories and Natural ground. Full preparation would require unpublished presentation/adapter state and ground allocations before actual runtime admission; its success behavior and callback exclusions remain unmeasured. Checkpoint rollback can instead keep outgoing presentation state and ground resources through the synchronous swap, restoring bytes and re-admitting the retained outgoing snapshot after a later error. Actual dependency code permits an older revision after an epoch change; that permission needs a real RenderWorld control, not a permissive fake runtime.

The bounded checkpoint repair passed independent review, seven actual-app contracts, thirteen controller lifecycle cases and the complete combined gate. The two post-admission controls first failed as intended; an earlier resize probe changed the wrong width field and is not valid red evidence. Reviews 3 through 5 record the accepted playback, notification and replacement contracts. Terminal failed/disposed runtime or device recovery is outside this ownership contract.

Current devlog summary prose was reduced while every condensed original remained verbatim in the established detail file. The precision-corrected summary shrank from 82,183 to 17,637 bytes (78.5%); preserving all originals grew the two-file total by 18,374 bytes. Historical detail and review text was not rewritten. The current canary remains invalid: its baseline still raises one pinned-unit finding, so mutant sensitivity is unproved and no primary mutation was applied.
